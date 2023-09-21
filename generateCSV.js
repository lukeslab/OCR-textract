const fs = require('fs');
const converter = require('json-2-csv')
const { getFilesRecursive } = require('./functions/getFilesRecursive')

const BATCH_NUMBER = "20230829_15:14:42"

if (!BATCH_NUMBER) throw "No batch specified."

async function convertJsonToCSV(data, options, path) {
    const csv = await converter.json2csv(data, options)
    fs.writeFileSync(path, csv)
}

const jsonFiles = getFilesRecursive(`./batches/${BATCH_NUMBER}/json`)

const csvFilepath = `./batches/${BATCH_NUMBER}/results.csv`

const options = {
    expandNestedObjects: true,

}
const jsonObjectsFromFiles = []

jsonFiles.forEach( file => {
    const json = JSON.parse(fs.readFileSync(file.pathName, 'utf8'))
    jsonObjectsFromFiles.push(json)
})

convertJsonToCSV(jsonObjectsFromFiles, options, csvFilepath)


