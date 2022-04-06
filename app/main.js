const { app, BrowserWindow } = require('electron')
const path = require('path')
const { mainModule } = require('process')
//takes a filepath and creates the readStream for the CSV file


/*
* Electron control
*/

const createWindow = () => {
    const win = new BrowserWindow({
        width: 400,
        height: 400,
        webPreferences: {
            preload: path.join(__dirname , "preload.js"),
            contextIsolation: false,
            nodeIntegration: true
        }
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