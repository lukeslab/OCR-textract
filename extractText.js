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

const batchNumber = format(new Date(), 'yyyyMMdd_HHmmss')
const outputJsonDir = `./batches/${batchNumber}/json`

const client = new TextractClient({ region: "us-east-2" });

// SETTINGS
const THROTTLE_RATE = 700
const INFLIGHT_REQUESTS_MAX = 5;
let requestsInFlight = 0;

async function copyDirStructure(src, dest) {
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

            await copyDirStructure(srcPath, destPath);
        }
    }
    console.log('Directory structure has been copied successfully.');
  } catch (err) {
    console.error(`Error copying directory structure from ${src} to ${dest}:`, err);
  }
}

async function getTextractResults(requestId, file, filesLength, index) {
  console.log('textract function i is: ', index)
  const buffer = fs.readFileSync(file.pathName)

  const input = { // AnalyzeIDRequest
    DocumentPages: [ // DocumentPages // required
      { // Document
        Bytes: buffer
      },
    ],
  };
  const command = new AnalyzeIDCommand(input);
  console.log(`Processing file ${index+1} of ${filesLength}: ${file.pathName}.`)
  
  requestsInFlight++
  
  const options = {
    delayFirstAttempt: true,
    startingDelay: 100,
    numOfAttempts: 5,
    retry: (error, attemptNumber) => {
      console.log('Retry function i is:', index)
      if (["ProvisionedThroughputExceededException","ThrottlingException","InternalServerError"].includes(error.response.data.name)) {
        logEvents(`${requestId}\tRETRY: ${attemptNumber}\t${error.response.data.$metadata.httpStatusCode}\t${error.response.data.name}\t${file.pathName}\t`, 'requests.log', batchNumber)
        return true;
      }
    }
  }
  try {
    const response = await backOff(() => axios.get("http://localhost:3000/"), options)
    // const response = await backOff( () => client.send(command), options )
    console.log('response is:', response)
    if (response.data.$metadata.httpStatusCode === 200) {
      // decrement inflight requests
      requestsInFlight--
      // write to json file here
      // writeJSONToDir(file, response.IdentityDocuments[0].IdentityDocumentFields)
      logEvents(`${requestId}\tSUCCESS\t200\t${file.pathName}\t`, 'responses.log', batchNumber)
    }
  } catch (error) {
    console.log(error)
    logEvents(`${requestId}\tFAIL\t${error.response.data.$metadata.httpStatusCode}\t${error.response.data.name}\t${file.pathName}\t`, 'responses.log', batchNumber)
    requestsInFlight--
  }
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

// function checkForBatchFile() {
//   const batchFile = fs.readFileSync("./batchFile", "utf-8")
//   if (batchFile) return JSON.parse(batchFile)
//   else return false
// }

// function createBatchFile(files){
//   const data = JSON.stringify(files)
//   fs.writeFileSync(`./batchFile-${batchNumber}.json`, data)
// }

(async () => {
    // copy the directory structure of input files into json
    await copyDirStructure('./input_files', outputJsonDir)

    const files = getFilesRecursive('./input_files')
    console.log(files)

    // const batchFile = checkForBatchFile()

    // let files = null;
    // if (!batchFile) {
    //   // get list of sample files in from input_files, recursively.
    //   files = getFilesRecursive('./input_files')
    //   console.log(files)
    //   createBatchFile(files)
    // } else {
    //   files = batchFile
    // }

    // send the files to textract. Specifiy THROTTLE_RATE, and MAX_ATTEMPTS
    const numFiles = files.length
    let i = 0;
    while(i < numFiles) {
      await sleep(THROTTLE_RATE)
      const id = uuid()

      if (requestsInFlight >= INFLIGHT_REQUESTS_MAX) {
        console.log('Exceeded maximum inflight requests, waiting for responses.')
      } else {
        logEvents(`${id}\tProcessing ${files[i].pathName}\tFile ${i+1} of ${numFiles}: `, 'requests.log', batchNumber)
        getTextractResults(id, files[i], files.length, i)
        i++
      }
    }
})()