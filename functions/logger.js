const { format } = require('date-fns')
// const { v4: uuid } = require('uuid')
const fs = require('fs')
const fsPromises = require('fs').promises
const path = require('path')

const logEvents = async (message, logFileName, batchNumber) => {
    const dateTime = format(new Date(), 'yyyyMMdd\tHH:mm:ss')
    const logItem = `${dateTime}\t${message}\n`

    try {
        if (!fs.existsSync(`./batches/${batchNumber}/logs`)) {
            await fsPromises.mkdir(`./batches/${batchNumber}/logs`, { recursive: true })
        }
        await fsPromises.appendFile(path.join(`./batches/${batchNumber}/logs`, logFileName), logItem)
    } catch(err){
        console.log(err);
    }
}

module.exports = { logEvents }