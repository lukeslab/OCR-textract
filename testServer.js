const express = require('express')
const app = express()
const port = 3000

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function chooseResultToSend(){
    function rollTheDice() {
        return Math.floor(Math.random()*5)
    }
    const diceRoll = rollTheDice()
    console.log('dice roll is: ', diceRoll)
    switch(diceRoll) {
        case 0:
        return {
            $metadata: {
                httpStatusCode: 400,
            },
            name: "ProvisionedThroughputExceededException"
        }
        case 1:
        return {
            $metadata: {
                httpStatusCode: 400,
            },
            name: "ThrottlingException"
        }
        case 2:
        return {
            $metadata: {
                httpStatusCode: 400,
            },
            name: "InternalServerError"
        }
        case 3:
        return {
            $metadata: {
                httpStatusCode: 400,
            },
            name: "OtherError"
        }
        default:
        return {
            $metadata: {
                httpStatusCode: 200,
            }
        }
    }
}

app.get('/', async (req, res) => {
    await sleep(5000)
    const resultToSend = chooseResultToSend()
    const statusCode = resultToSend.$metadata.httpStatusCode
    console.log('result to send is: ', resultToSend)
    res.status(statusCode).json(resultToSend)
})

app.listen(port, () => {
  console.log(`Test server listening on port ${port}`)
})
