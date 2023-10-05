const fs = require('fs')
const fsP = require('fs').promises
const path = require('path');
const { logEvents } = require('./functions/logger')
const { v4: uuid } = require('uuid')
const { getFilesRecursive } = require('./functions/getFilesRecursive')
const { TextractClient, AnalyzeIDCommand } = require("@aws-sdk/client-textract");
const { format } = require('date-fns')
const { backOff } = require('exponential-backoff')
const axios = require('axios')

const client = new TextractClient({ region: "us-east-2" });

// SETTINGS
const THROTTLE_RATE = 700
const INFLIGHT_REQUESTS_MAX = 5;
let requestsInFlight = 0;

(async () => {
  const batchFile = checkForBatchFile()
  if (batchFile === null) startNewBatch()
  else continuePreviousBatch(batchFile, THROTTLE_RATE, INFLIGHT_REQUESTS_MAX)
})()

function checkForBatchFile() {
  // Attempt to read the file batchfile.js
  try {
    const batchFile = JSON.parse(fs.readFileSync('./batchFile.json', { encoding: 'utf-8' }))
    return batchFile
  } catch(e) {
    return null;
  }
}

async function startNewBatch(){
  const batchNumber = format(new Date(), 'yyyyMMdd_HHmmss')
  const files = getFilesRecursive("./input_files")
  createBatchfile(batchNumber, files)
  
  const outputJsonDir = `./batches/${batchNumber}/json`
  createBatchResultsDirectory("./input_files", outputJsonDir)

  // Send the files to textract. The request rate must be equal to THROTTLE_RATE and inflight requests must not exceed INFLIGHT_REQUESTS_MAX.
  initializeTextractRequest(batchNumber, files, THROTTLE_RATE, INFLIGHT_REQUESTS_MAX)
  
  function createBatchfile(batchNumber, files){
    console.log('Creating batchfile')
    const data = {
      batchNumber,
      files
    }
    fs.writeFileSync("./batchfile.json", JSON.stringify(data, null, 2), 'utf-8')
  }
  
  async function createBatchResultsDirectory(src, dest) {
    console.log("dest is", dest)
    try {
      // Check if the source path is a directory
      const stat = await fsP.stat(src);
      if (!stat.isDirectory()) {
        console.log(`${src} is not a directory.`);
        return;
      }
  
      // Create the directory in the destination if it doesn't exist
      await fsP.mkdir(dest, { recursive: true });
  
      const entries = await fsP.readdir(src, { withFileTypes: true });
  
      for (let entry of entries) {
        if (entry.isDirectory()) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
  
          await initBatchResultsDirectory(srcPath, destPath);
        }
      }
      console.log('Directory structure has been copied successfully.');
    } catch (err) {
      console.error(`Error copying directory structure from ${src} to ${dest}:`, err);
    }
  }
}

async function initializeTextractRequest(batchNumber, files, THROTTLE_RATE, INFLIGHT_REQUESTS_MAX){
  const numberOfFilesToSend = files.length
  let i = 0;
  while(i < numberOfFilesToSend) {
    if (files[i].processed === true) {
      console.log('while i is: ', i)
      i++
      continue;
    }
    await sleep(THROTTLE_RATE)
    const logId = uuid()

    if (requestsInFlight >= INFLIGHT_REQUESTS_MAX) {
      console.log('Exceeded maximum inflight requests, waiting for responses.')
    } else {
      logEvents(`${logId}\tProcessing ${files[i].pathName}\tFile ${i+1} of ${numberOfFilesToSend}: `, 'requests.log', batchNumber)
      sendFileToTextract(logId, files[i], files.length, i, batchNumber)
      i++
    }
  }
}

function continuePreviousBatch(batchfile, THROTTLE_RATE, INFLIGHT_REQUESTS_MAX){
  const files = batchfile.files
  initializeTextractRequest(batchfile.batchNumber, files, THROTTLE_RATE, INFLIGHT_REQUESTS_MAX)
}

async function sendFileToTextract(requestId, file, filesLength, index, batchNumber) {  
  const command = initTextractRequest(file)
  console.log(`Processing file ${index+1} of ${filesLength}: ${file.pathName}.`)
  
  const options = {
    delayFirstAttempt: true,
    startingDelay: 100,
    numOfAttempts: 5,
    retry: (error, attemptNumber) => {
      // console.log('Retry function i is:', index)
      // console.log('retry error is:', error)
      if (["ProvisionedThroughputExceededException","ThrottlingException","InternalServerError"].includes(error.response.data.name)) {
        logEvents(`${requestId}\tRETRY: ${attemptNumber}\t${error.response.data.$metadata.httpStatusCode}\t${error.response.data.name}\t${file.pathName}\t`, 'requests.log', batchNumber)
        return true;
      }
    }
  }
  try {
    requestsInFlight++
    const response = await backOff(() => axios.get("http://localhost:3000/"), options)
    // const response = await backOff( () => client.send(command), options )
    // console.log('response is:', response)
    if (response.data.$metadata.httpStatusCode === 200) {
      // decrement inflight requests
      requestsInFlight--
      // write to json file here
      // writeJSONToDir(file, response.IdentityDocuments[0].IdentityDocumentFields)
      logEvents(`${requestId}\tSUCCESS\t200\t${file.pathName}\t`, 'responses.log', batchNumber)
    }
  } catch (error) {
    // console.log(error)
    requestsInFlight--
    logEvents(`${requestId}\tFAIL\t${error.response.data.$metadata.httpStatusCode}\t${error.response.data.name}\t${file.pathName}\t`, 'responses.log', batchNumber)
  } finally {
    updateBatchfile(index)
  }

  function initTextractRequest(){
    const buffer = fs.readFileSync(file.pathName)
    const input = { // AnalyzeIDRequest
      DocumentPages: [ // DocumentPages // required
        { // Document
          Bytes: buffer
        },
      ],
    };

    return new AnalyzeIDCommand(input);
  }
}

function updateBatchfile(index) {
  const batchfile = JSON.parse(fs.readFileSync('./batchfile.json', 'utf-8'))
  batchfile.files[index].processed = true
  fs.writeFileSync("./batchfile.json", JSON.stringify(batchfile, null, 2), 'utf-8')
}

function writeJSONToDir(file, data) {
  try {
    let filePathSegements = file.dirName.split(path.sep)
    filePathSegements.shift()
    filePathSegements = filePathSegements.join(path.sep)
    const filePath = path.join(outputJsonDir, filePathSegements, `${file.fileName}.json`)
    console.log("Writing to: ", filePath)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8', (err) => {
      if (err) console.error('Error writing to file: ', err)
    })
  } catch (error) {
    console.log('An error occured while handling the response:', error)
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// function createBatchfile(files){
//   const data = JSON.stringify(files)
//   fs.writeFileSync(`./batchFile-${batchNumber}.json`, data)
// }