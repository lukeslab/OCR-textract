const fs = require('fs')
const fsP = require('fs').promises
const path = require('path');

const { TextractClient, AnalyzeIDCommand } = require("@aws-sdk/client-textract");
const client = new TextractClient({ region: "us-east-2" });

async function copyDirStructure(src, dest) {
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

function getFilesRecursive(directory) {
    let results = [];
    
    // Read items in the directory
    const items = fs.readdirSync(directory); 

    for (const item of items) {
        if (item === '.DS_Store') continue;

        const itemPath = path.join(directory, item);
        const stat = fs.statSync(itemPath);
        
        // If it's a directory, recursively get its files
        if (stat.isDirectory()) {
            results = results.concat(getFilesRecursive(itemPath));
        } else {
            let ext = path.extname(itemPath)
            results.push({
              dirName: path.dirname(itemPath),
              pathName: itemPath,
              fileName: path.basename(itemPath, ext)
            });
        }
    }

    return results;
}

async function getTextractResults(file, index, files) {
  try {
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
    const response = await client.send(command)

    console.log("Data:", response)
    if (response.$metadata.httpStatusCode === 200) {
      // write to json file here
      writeJSONToDir(file, response.IdentityDocuments[0].IdentityDocumentFields)
      // Log the file as a success???
    }
  } catch (error) {
    console.log("Could not extract text:", file.fileName)
    // Log the file pathname for those that fail, eg ERROR <errorTypeTrhownByTextract> <file.pathName>
  }
}

function writeJSONToDir(file, data) {
  let filePathSegements = file.dirName.split(path.sep)
  filePathSegements.shift()
  filePathSegements = filePathSegements.join(path.sep)
  const filePath = path.join("./output_json", filePathSegements, `${file.fileName}.json`)
  console.log("Writing to: ", filePath)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8', (err) => {
    if (err) console.error('Error writing to file: ', err)
  })
}

// copy the directory structure of input files into output_json
copyDirStructure('./input_files', './output_json')
  .then(() => {
      console.log('Directory structure has been copied successfully.');
      // get list of sample files in from input_files, recursively.
      const files = getFilesRecursive('./input_files');
      console.log(files);

      files.forEach((file, index, files) => {
        setTimeout( getTextractResults, (index+1)*1100, file, index, files)
      })
  })
  .catch(error => {
      console.error('Error:', error);
  });

