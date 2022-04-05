const { app, BrowserWindow } = require('electron')

const fs = require("fs")
const csv = require("csv-parser")
const { resolve } = require("path")
const csvWriteStream = require('csv-write-stream')
const csvParser = require("csv-parser")
var csvWriter = csvWriteStream()
const path = require('path')


//assigning the file path from CLI Arg 2, 
//can be set by calling method by changing variable in readCsv function call
const filePath = process.argv[2]

//readCsv(filePath)

//takes a filepath and creates the readStream for the CSV file
function readCsv(filePath) {

    //create the stream using the filePath parameter
    const stream = fs.createReadStream(filePath)
        //map headers and convert them to lower case
        .pipe(csv({ mapHeaders: ({ header, index }) => header.toLowerCase().trim() }))
        //on the header row, check that certain columns exist, and create headers for write stream
        .on("headers", (headers) => {
            stream.pause()
            var exists = checkHeaders(headers)
            //if columns don't exist, error with a message, and end the stream
            if (exists === false) {
                console.error("header 'name' is missing but required")
                stream.end()
            }
            // if required headers exist create the headers for the file
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
                newHeaders = ["sku", "name", "salePrice", "taxRate", "is variable"].concat(headers)
                //set the writeStream headers to the array created above
                csvWriter.headers = newHeaders
                //pipe the write stream to the csvWriter
                csvWriter.pipe(fs.createWriteStream("output.csv"))
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
                    console.error("error", e)
                    stream.end()
                })
        })
        //on the end of the file, end the writeStream
        .on("end", () => {
            console.log("Done")
            csvWriter.end()
        })
}

function checkHeaders(headers = []) {
    //Check that headers exist.  If a header doesn't exist increment the variable by 1
    var requiredHeadersExist = 0

    requiredHeadersExist += (headers.includes("name") === true ? 0 : 1)

    if (requiredHeadersExist == 0) {
        //if all headers exist, allow the script to continue
        return true
    }
    else {
        //if headers are missing, stop the script
        return false
    }

}

function control(column) {

    //set the start time
    var start = new Date().getTime()

    /*
    create an object from the column data in the format
    {
        name: "",
        prefix:"",
        splitter:"",
        salePrice:"",
        taxRate:"",
        attributes:[{
            name:"",
            values:[]
        },...],
        possibilities:0
    }
    */
    const columnObject = createObject(column)

    /*
    create variations, and return them as an array of objects in this form:
    [{
        sku:"",
        name:"",
        salePrice:"",
        taxRate:"",

        ***list of attribute data
        'attribute xyz':"",
        'attribute abc':"",
        ...
    },...]
    */
    const variations = generateVariants(columnObject)

    //set the end time
    var end = new Date().getTime()


    console.log(`Created ${columnObject.possibilities} in ${end - start}ms`)


    //send the variations array to the write variants to the CSV
    const written = writeVariants(variations)

    return
}

function createObject(columnData) {

    //initialise the object that is the template
    var variable = {
        name: "" + columnData.name,
        prefix: "" + columnData.prefix ?? "",
        splitter: "" + columnData.splitter ?? "",
        salePrice: columnData.price ?? 0,
        taxRate: "" + columnData.taxRate ?? "zero rated",
        attributes: [],
        possibilities: 1
    }
    //delete columns that aren't attributes from the 
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
    var variantArray = []

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

    variableObject.attributes.forEach(index => {
        lastStepCount /= index.values.length
        variantArray = handleAttribute(index, lastStepCount, variableObject, variantArray, (lastStepCount === 1 ? "" : variableObject.splitter))
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
            variants[i]["attribute " + attributeObject.name] = attributeObject.values[value]

            i++
        }
        value++
    }
    return variants
}

function writeVariants(variants = []) {
    variants.forEach(variant => {
        csvWriter.write(variant)
    })
    return true
}


/*
* Electron control
*/

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600
    })

    win.loadFile('index.html')
}

//electron handlers
//when ready, create the electron window
app.whenReady().then(() => {
    createWindow()
})

//when electron is closed, stop the script
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})