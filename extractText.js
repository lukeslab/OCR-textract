const fs = require('fs')
const fsP = require('fs').promises
const path = require('path');
const { logEvents } = require('./functions/logger')
const { v4: uuid } = require('uuid')
const { getFilesRecursive } = require('./functions/getFilesRecursive')
const { TextractClient, AnalyzeIDCommand } = require("@aws-sdk/client-textract");
const { format } = require('date-fns')

const batchNumber = format(new Date(), 'yyyyMMdd_HHmmss')
const outputJsonDir = `./batches/${batchNumber}/json`

const client = new TextractClient({ region: "us-east-2" });

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
    } catch (err) {
        console.error(`Error copying directory structure from ${src} to ${dest}:`, err);
    }
}

async function getTextractResults(file, index, files) {
  const id = uuid()
  try {
    console.log("batchNumber is", batchNumber)
    const buffer = fs.readFileSync(file.pathName)

    const input = { // AnalyzeIDRequest
        DocumentPages: [ // DocumentPages // required
          { // Document
            Bytes: buffer
          },
        ],
      };
    const command = new AnalyzeIDCommand(input);
    console.log(`Processing file ${index+1} of ${files.length}: ${file.pathName}.`)
    logEvents(`${id}\tProcessing file ${index+1} of ${files.length}: ${file.pathName}`, 'requests.log', batchNumber)
    const response = await client.send(command)

    console.log("Data:", response)
    if (response.$metadata.httpStatusCode === 200) {
      // write to json file here
      writeJSONToDir(file, response.IdentityDocuments[0].IdentityDocumentFields)
      logEvents(`${id}\tSUCCESS\t200\t${file.pathName}\t`, 'responses.log', batchNumber)
    }
  } catch (error) {
    console.log("Could not extract text:", error)
    // Log the file pathname for those that fail, eg ERROR <errorTypeTrhownByTextract> <file.pathName>
    logEvents(`${id}\tFAIL\t${error.$metadata.httpStatusCode}\t${error.name}\t${file.pathName}\t`, 'responses.log', batchNumber)
  }
}

function writeJSONToDir(file, data) {
  let filePathSegements = file.dirName.split(path.sep)
  filePathSegements.shift()
  filePathSegements = filePathSegements.join(path.sep)
  const filePath = path.join(outputJsonDir, filePathSegements, `${file.fileName}.json`)
  console.log("Writing to: ", filePath)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8', (err) => {
    if (err) console.error('Error writing to file: ', err)
  })
}


// copy the directory structure of input files into json
copyDirStructure('./input_files', outputJsonDir)
  .then(() => {
      console.log('Directory structure has been copied successfully.');
      // get list of sample files in from input_files, recursively.
      const files = getFilesRecursive('./input_files');
      console.log(files);

      files.forEach((file, index, files) => {
        setTimeout( getTextractResults, (index+1)*1500, file, index, files)
      })
  })
  .catch(error => {
      console.error('Error:', error);
  });