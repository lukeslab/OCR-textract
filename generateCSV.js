require('dotenv').config()
const fs = require('fs');
const { getFilesRecursive } = require('./functions/getFilesRecursive')

const BATCH_NUMBER = ""

if (!BATCH_NUMBER) throw "No batch specified."

const columnHeaders = [
    "Filepath",
    "FIRST_NAME_text", "FIRST_NAME_score", 
    "LAST_NAME_text", "LAST_NAME_score",
    "MIDDLE_NAME_text", "MIDDLE_NAME_score",
    "SUFFIX_text", "SUFFIX_score",
    "CITY_IN_ADDRESS_text", "CITY_IN_ADDRESS_score",
    "ZIP_CODE_IN_ADDRESS_text", "ZIP_CODE_IN_ADDRESS_score",
    "STATE_IN_ADDRESS_text", "STATE_IN_ADDRESS_score",
    "STATE_NAME_text", "STATE_NAME_score",
    "DOCUMENT_NUMBER_text", "DOCUMENT_NUMBER_score",
    "EXPIRATION_DATE_text", "EXPIRATION_DATE_score",
    "DATE_OF_BIRTH_text", "DATE_OF_BIRTH_score",
    "DATE_OF_ISSUE_text", "DATE_OF_ISSUE_score",
    "ID_TYPE_text", "ID_TYPE_score",
    "ENDORSEMENTS_text", "ENDORSEMENTS_score",
    "VETERAN_text", "VETERAN_score",
    "RESTRICTIONS_text", "RESTRICTIONS_score",
    "CLASS_text", "CLASS_score",
    "ADDRESS_text", "ADDRESS_score",
    "COUNTY_text", "COUNTY_score",
    "PLACE_OF_BIRTH_text", "PLACE_OF_BIRTH_score",
    "MRZ_CODE_text", "MRZ_CODE_score"
];

const outputFiles = getFilesRecursive(`./batches/${BATCH_NUMBER}/json`)
const csvFile = `./batches/${BATCH_NUMBER}/results.csv`

console.log(outputFiles)

fs.appendFileSync(csvFile, `${columnHeaders.toString()}\n`)

outputFiles.forEach( file => {
    const fileFields = JSON.parse(fs.readFileSync(file.pathName, 'utf8'))
    fs.appendFileSync(csvFile, `${file.pathName},`)
    fileFields.forEach( field => {
        if (field.Type.Text === "MRZ_CODE") {
           const newMRZ_CODEText = field.ValueDetection.Text.replace(/\n/, "\\n")
           fs.appendFileSync(csvFile, `${field.ValueDetection.Text === "" ? "No text" : newMRZ_CODEText}, ${field.ValueDetection.Confidence},`)
        } else {
            fs.appendFileSync(csvFile, `${field.ValueDetection.Text === "" ? "No text" : field.ValueDetection.Text}, ${field.ValueDetection.Confidence},`)
        }
    })
    fs.appendFileSync(csvFile, "\n")
})

