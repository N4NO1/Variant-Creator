const fs = require("fs")
const csv = require("csv-parser")
const { resolve } = require("path")
const csvWriteStream = require('csv-write-stream')
const csvParser = require("csv-parser")
var csvWriter = csvWriteStream()


const filePath = process.argv[2]

function readCsv(filePath) {
const stream = fs.createReadStream(filePath)
    .pipe(csv({ mapHeaders: ({ header, index }) => header.toLowerCase().trim() }))
    .on("headers", (headers) => {
        stream.pause()
        var exists = checkHeaders(headers)
        if ( exists === false) {
            console.error("header 'name' is missing but required")
            stream.end()
        }
        else {
            headers.splice(headers.indexOf("prefix"),1)
            headers.splice(headers.indexOf("price"),1)
            headers.splice(headers.indexOf("splitter"),1)
            headers.splice(headers.indexOf("name"),1)
            headers = headers.map(n => "attribute " + n)
            newHeaders = ["sku","name","salePrice", "taxRate", "is variable"].concat(headers)
            csvWriter.headers = newHeaders
            csvWriter.pipe(fs.createWriteStream("output.csv"))
            stream.resume()
        }
    })
    .on("data", (data) => {
        stream.pause()

        control(data).then(() => { stream.resume() })
            .catch((e) => {
                console.error("error",e)
                stream.end()
            })
    })
    .on("end", () => {
        console.log("Done")
        csvWriter.end()
    })
}

function checkHeaders(headers = []) {
    var requiredHeadersExist = 0

    requiredHeadersExist += (headers.includes("name") === true ? 0 : 1)
    
    if (requiredHeadersExist == 0) {
        return true
    }
    else {
        return false
    }

}

function control(column) {

    var start = new Date().getTime()

    const columnObject = createObject(column)


    const variations = generateVariants(columnObject)

    var end = new Date().getTime()

    console.log(`Created `, `Time: ${end-start}ms`)
    
    const written = writeVariants(variations)


    return
}

function createObject(columnData) {

    var variable = {
        name: columnData.name,
        prefix: columnData.prefix ?? "",
        splitter: columnData.splitter ?? "",
        salePrice:columnData.price ?? 0,
        taxRate: columnData.taxRate ?? "zero rated",
        attributes: [],
        possibilities: 1
    }
    delete columnData["name"]
    delete columnData["prefix"]
    delete columnData["splitter"]
    delete columnData["price"]
    delete columnData["taxRate"]

    const columnEntryArray = Object.entries(columnData)


    columnEntryArray.forEach(index => {
        const [name, values] = index
        const valuesArray = values.split(",")
        var obj = {
            name: name,
            values: valuesArray.filter(n => n)
        }
        if (obj.values.length) {
            variable.attributes.push(obj)
            variable.possibilities *= obj.values.length
        }
    })

    return variable
}

function generateVariants(variableObject = {}) {
    var variantArray=[]

    var lastStepCount = variableObject.possibilities

    //intialise the array with the variants starting details
    for (let i = 0; i < variableObject.possibilities; i++) {
        variantArray[i] = {
            sku:variableObject.prefix,
            name:variableObject.name,
            salePrice:variableObject.salePrice,
            taxRate:variableObject.taxRate
        }
    }

    variableObject.attributes.forEach(index => {
        lastStepCount /= index.values.length
        variantArray = handleAttribute(index, lastStepCount, variableObject, variantArray, (lastStepCount === 1 ? "" :variableObject.splitter))
    })
    return variantArray
}

function handleAttribute(attributeObject, perStep, variableObject, variants, split) {
    var i = 0
    var value = 0

    while (i < variableObject.possibilities) {
        if (value == attributeObject.values.length) { value = 0 }

        for (let j = 0; j < perStep; j++) {
            variants[i].sku = variants[i].sku + attributeObject.values[value] + split
            variants[i].name = variants[i].name + attributeObject.values[value] + split
            variants[i]["attribute " + attributeObject.name] =  attributeObject.values[value]

            i++
        }
        value++
    }
    return variants
}

function writeVariants(variants = []) {
    variants.forEach(variant =>{
        csvWriter.write(variant)
    })
    return true
}