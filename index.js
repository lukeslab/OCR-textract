const fs = require('fs')
const { TextractClient, AnalyzeIDCommand } = require("@aws-sdk/client-textract");

// get list of sample files in directory, recursively.
// for each file, put into a buffer and send to textract.
// write the results to a .json file, where the file name matches the image file. i.e., sample_id_1.json

const buffer = fs.readFileSync("./sample_dls/sample_3.jpg")

// const base64FileString = buffer.toString('base64')
// console.log("File is:", base64FileString)


const client = new TextractClient({ region: "us-east-2" });

const input = { // AnalyzeIDRequest
    DocumentPages: [ // DocumentPages // required
      { // Document
        Bytes: buffer
      },
    ],
  };
const command = new AnalyzeIDCommand(input);
const response = client.send(command, (err, data)=> console.log(data.IdentityDocuments[0].IdentityDocumentFields))

