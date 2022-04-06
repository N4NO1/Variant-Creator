const fs = require("fs")
const csv = require("csv-parser")
const { resolve } = require("path")
const csvParser = require("csv-parser")
const path = require('path')
const csvWriteStream = require('csv-write-stream')
var csvWriter = csvWriteStream()
var headersMap = []

module.exports = {
    readCsv
}

async function readCsv(readPath) {

    const writePath = path.join(readPath.split('\\').pop().split('/').pop())
    console.log(writePath)
    //create the stream using the filePath parameter
    const stream = fs.createReadStream(readPath)
        //map headers and convert them to lower case
        .pipe(csv({ mapHeaders: ({ header, index }) => header.toLowerCase().trim() }))
        //on the header row, check that certain columns exist, and create headers for write stream
        .on("headers", (headers) => {
            headersMap = headers.slice()
            stream.pause()
            var exists = checkHeaders(headers)
            //exists is an array of missing required headers
            if (exists.length != 0) {
                stream.end()
                return "error"
            }
            else {
                //remove headers that aren't attributes
                headers.splice(headers.indexOf("prefix"), 1)
                headers.splice(headers.indexOf("price"), 1)
                headers.splice(headers.indexOf("splitter"), 1)
                headers.splice(headers.indexOf("name"), 1)
                //add "attribute " as a prefix to the attribute names
                headers = headers.map(n => "attribute " + n)
                //create a array that contains the headers
                //Add on the headers from the readStream headers array (which has has the prefix appended)
                newHeaders = ["sku", "name", "salePrice", "taxRate", "is variable", "variable attribute"].concat(headers)
                //set the writeStream headers to the array created above
                csvWriter.headers = newHeaders
                //pipe the write stream to the csvWriter
                csvWriter.pipe(fs.createWriteStream(writePath))
                stream.resume()
            }
        })
        .on("data", (data) => {
            //pause the stream so only 1 row is computed at a time
            stream.pause()

            //pass the row data to the control function, on success resume the stream
            control(data).then(() => { stream.resume() })
                // if control errors, catch it, and return the error to the console
                .catch((e) => {
                    console.error(e)
                    stream.end()
                    return e
                })
        })
        //on the end of the file, end the writeStream
        .on("end", () => {
            console.log("Done")
            csvWriter.end()
            return writePath
        })
}

function checkHeaders(headers = []) {
    //Check that headers exist.  If a header doesn't exist increment the variable by 1
    const requiredHeaders = ['name']
    var missingHeaders = []

    requiredHeaders.forEach(header => {
        if (!headers.includes(header)) {
            missingHeaders.push(header)
        }
    })
    return missingHeaders
}

async function control(column) {
    //set the start time
    var start = new Date().getTime()

    const columnObject = await createObject(column)

    const variations = await generateVariants(columnObject)

    //set the end time
    var end = new Date().getTime()


    console.log(`Created ${columnObject.possibilities} in ${end - start}ms`)


    //send the variations array to the write variants to the CSV
    const written = await writeVariants(variations)

    return
}

async function createObject(columnData) {

    //initialise the template object
    var variable = {
        name: "" + columnData[headersMap.indexOf("name")],
        prefix: "" + columnData[headersMap.indexOf("prefix")] ?? "",
        splitter: "" + columnData[headersMap.indexOf("splitter")] ?? "",
        salePrice: columnData[headersMap.indexOf("price")] ?? 0,
        taxRate: "" + (columnData[headersMap.indexOf("tax rate")] ?? "zero rated"),
        attributes: [],
        possibilities: 1
    }
    //delete columns that aren't attributes from the
    var removeColumns = ["name", "prefix", "splitter", "price", "tax rate"]

    removeColumns.forEach(value => {
        delete columnData[headersMap.indexOf(value)]
    })


    const columnEntryArray = Object.entries(columnData)


    columnEntryArray.forEach(index => {
        const [colNum, values] = index
        const valuesArray = values.split(",")
        var obj = {
            name: headersMap[colNum],
            values: valuesArray.filter(n => n)
        }
        if (obj.values.length) {
            variable.attributes.push(obj)
            variable.possibilities *= obj.values.length
        }
    })

    return variable
}

async function generateVariants(variableObject = {}) {
    var variantArray = []
    var attributeNames = []

    var lastStepCount = variableObject.possibilities

    //intialise the array with the variants starting details
    for (let i = 0; i < variableObject.possibilities; i++) {
        variantArray[i] = {
            sku: variableObject.prefix,
            name: variableObject.name,
            salePrice: variableObject.salePrice,
            taxRate: variableObject.taxRate
        }
    }

    await variableObject.attributes.forEach(async index => {
        lastStepCount /= index.values.length
        // console.log(variantArray)
        variantArray = await handleAttribute(index, lastStepCount, variableObject, variantArray, (lastStepCount === 1 ? "" : variableObject.splitter))
        attributeNames.push(index.name)
    })

    
    variantArray.unshift({
        sku:variableObject.prefix,
        name:variableObject.name,
        "is variable": "yes",
        "variable attribute": attributeNames
    })

    return variantArray
}

async function handleAttribute(attributeObject, perStep, variableObject, variants, split) {
    var i = 0
    var value = 0
    while (i < variableObject.possibilities) {
        if (value == attributeObject.values.length) { value = 0 }

        for (let j = 0; j < perStep; j++) {
            variants[i].sku = variants[i].sku + attributeObject.values[value] + split
            variants[i].name = variants[i].name + attributeObject.values[value] + split
            variants[i]["attribute " + attributeObject.name] = attributeObject.values[value]
            i++
        }
        value++
    }

    return variants
}

async function writeVariants(variants = []) {
    variants.forEach(variant => {
        csvWriter.write(variant)
    })
    return true
}