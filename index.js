const fs = require('fs')
const path = require('path');

const { TextractClient, AnalyzeIDCommand } = require("@aws-sdk/client-textract");

// get list of sample files in directory, recursively.

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

function writeJSONToDir(file, data) {
  const filePath = path.join("./output_json", file)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8', (err) => {
    if (err) console.error('Error writing to file: ', err)
  })
}

function getTextractResults(file) {
  const buffer = fs.readFileSync(file.pathName)

  const client = new TextractClient({ region: "us-east-2" });

  const input = { // AnalyzeIDRequest
      DocumentPages: [ // DocumentPages // required
        { // Document
          Bytes: buffer
        },
      ],
    };
  const command = new AnalyzeIDCommand(input);
  const response = client.send(command, (err, data)=> {
    // write to json file here
    // console.log(data.IdentityDocuments[0].IdentityDocumentFields)
    writeJSONToDir(`${file.fileName}.json`, data.IdentityDocuments[0].IdentityDocumentFields)
  })
}

// Usage
const files = getFilesRecursive('./input_files');
console.log(files);

// files.forEach( file => getTextractResults(file))

getTextractResults({pathName: "input_files/20210409_110200.jpg", fileName: "20210409_110200"})