const csvHandler = require('./csvHandler.js')
//invoke download for CSV output
//figure out how to use CSV in input from filepath
async function parseFileFn (readPath) {
    const result = await csvHandler.readCsv(readPath)
    console.log(result)
    return result
}

window.vacBridge = {
    parseFile: parseFileFn
}