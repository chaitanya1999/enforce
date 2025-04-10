const { app, BrowserWindow, ipcMain,  Menu, MenuItem, webFrame } = require('electron')
const Utils = require('../Utils');
const path = require('path');
const url = require("url");
const codeToFetch = require('../codeToFetch');
const AuthTest = require('../AuthTest');
const FetchClassCmpList = require('../FetchClassCmpList');
const CodeFetcher = require('../FetchCode');
const fs = require('fs');
const QueryTool = require('../QueryTool');
const AnonymousApex = require('../AnonymousApex');
const DeployCode = require('../DeployCode');
FETCHED_CLASS_CMP_LIST_FILE = '/../../data/fetchedClassCmpList.json';
const log = Utils.debug;
// const MODE = 'dev';
const MODE = 'dev';

class EnForce {
    fetchedClassCmp = {};

    main() {
        console.log('Starting...');
        app.whenReady().then(() => {
            this.createWindow()
        })

        this.loadFetchedClassCmpList();
        
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') app.quit()
        })
    }

    loadFetchedClassCmpList() {
        try {
            log('Reading file - ' + FETCHED_CLASS_CMP_LIST_FILE);
            let fileContents = fs.readFileSync(__dirname + FETCHED_CLASS_CMP_LIST_FILE);
            this.fetchedClassCmp = JSON.parse(fileContents);
        } catch(err) {
            log('Error reading/parsing file - ' , err);
            this.fetchedClassCmp = {};
        }
    }

    createWindow(){
        log('createWindow')
        const win = new BrowserWindow({
            width: 800,
            height: 600,
            frame:false,
            webPreferences: {
                preload: path.join(app.getAppPath(), 'preload.js'),
                // nodeIntegration: true,
                contextIsolation: true,
                experimentalFeatures: true
            }
        })
        win.removeMenu();
        log('loadURL - ' + MODE);
        if(MODE == 'prod') {
            win.loadURL(
                url.format({
                    pathname: path.join(__dirname, `../../dist/client/browser/index.html`),
                    protocol: "file:",
                    slashes: true
                })
            );
            // win.removeMenu();
        } else {
            const menu = new Menu();
            menu.append(new MenuItem({
                label: 'Electron',
                submenu: [
                    {
                        role: 'help',
                        accelerator: 'Ctrl+Shift+I',
                        click: () => { win.webContents.isDevToolsOpened() ? win.webContents.closeDevTools() : win.webContents.openDevTools(); }
                    },
                    {
                        role: 'help',
                        accelerator: 'Ctrl+R',
                        click: () => { win.webContents.reload(); }
                    },
                    {
                        role: 'help',
                        accelerator: 'Ctrl+-',
                        click: () => { win.webContents.setZoomLevel(win.webContents.getZoomLevel() - 0.5); }
                    },
                    {
                        role: 'help',
                        accelerator: 'Ctrl+=',
                        click: () => { win.webContents.setZoomLevel(win.webContents.getZoomLevel() + 0.5); }
                    }
                ]
            }));
            win.setMenu(menu)
            win.loadURL('http://localhost:4200')
        }
        // win.addListener("resized", ()=>{
        //     console.log('resize event');
        //     win.setContentSize(win.getSize()[0], win.getSize()[1]);
        // })
    
        
        this.setupEvents(ipcMain, win.webContents, win);

    
    }

    setupEvents(ipcMain, webContentChannel, win) {
        ipcMain.on('getOrgs', (e,x) => {
            log('IPC - getOrgs | ' + x);
            // let orgCreds = this.rawClone(codeToFetch.CREDENTIALS);
            let orgCreds = Utils.getAllOrgs();
            for(let key in orgCreds) {
                orgCreds[key].orgName = key;
            }
            // console.log('IPC | getOrgs | ' , orgCreds);
            webContentChannel.send('getOrgs', orgCreds);
        });

        ipcMain.on('authenticate', async (e,x) => {
            log('IPC - authenticate | ' + x);
            let returnValue = await (new AuthTest().main(x[0]));
            webContentChannel.send('authenticate', returnValue);
        });

        ipcMain.on('FetchClassCmpList', async (e,x) => {
            log('IPC - FetchClassCmpList | ' , x);
            let param = x[0];
            let orgName = param.orgName;
            let toFetchList = param.toFetchList;
            let ignoreCache = param.ignoreCache;
            let result = [];
            log('IPC - FetchClassCmpList | Checking cache - ' + orgName + ' | ignoreCache = ' + ignoreCache);
            if(!ignoreCache && this.fetchedClassCmp[orgName]) {
                log('IPC - FetchClassCmpList | loading from cache')
                let notFetchedFromCache = [];
                for(let toFetch of toFetchList) {
                    if(this.fetchedClassCmp[orgName][toFetch]) {
                        log('IPC - FetchClassCmpList | cache contains ' + toFetch);
                        let data = {
                            type : toFetch,
                            list : this.fetchedClassCmp[orgName][toFetch]
                        }
                        result.push(Utils.EnForceResponse.success(data))
                    } else {
                        log('IPC - FetchClassCmpList | cache does not contains ' + toFetch);
                        notFetchedFromCache.push(toFetch);
                    }
                }
                toFetchList = notFetchedFromCache;
            }
            if(toFetchList.length) {
                log('IPC - FetchClassCmpList | Making SF call ' + toFetchList);
                let tempResult = await (new FetchClassCmpList().main(orgName, toFetchList));
                result = [...result , ...tempResult];
            }
            log('IPC - FetchClassCmpList | sending response back ');
            webContentChannel.send('FetchClassCmpList', result);

            //store in cache
            log('IPC - FetchClassCmpList | Refreshing cache ');
            for(let enforceResp of result) {
                if(enforceResp.isSuccess ==  false) continue;
                this.fetchedClassCmp[orgName] = this.fetchedClassCmp[orgName] || {};
                this.fetchedClassCmp[orgName][enforceResp.data.type] = enforceResp.data.list;
            }
            log('IPC - FetchClassCmpList | Writing cache ');
            fs.writeFileSync(__dirname + FETCHED_CLASS_CMP_LIST_FILE, JSON.stringify(this.fetchedClassCmp, null, 4));
        });

        ipcMain.on('FetchCode', async (e,x) => {
            log('IPC - FetchCode | ' + JSON.stringify(x));
            let params = x[0];
            let enforceResp = await new CodeFetcher().main(params, false, true);
            log('IPC - FetchCode | fetched')
            let response = enforceResp[params.OrgNames[0]][0];
            log('IPC - FetchCode | sending response back');
            // console.log('#$#$ ' + JSON.stringify(response));
            webContentChannel.send('FetchCode', response);
        });

        ipcMain.on('executeQuery', async (e,x) => {
            log('IPC - executeQuery | ' + JSON.stringify(x));
            let params = x[0];
            let enforceResp = await new QueryTool().executeSOQL(params.orgName, params.soqlQuery, params.fetchDeleted, params.toolingApi);
            log('IPC - executeQuery | executed. Sending response.');
            webContentChannel.send('executeQuery', enforceResp);
        });

        ipcMain.on('getInstanceURL' , async (e,x) => {
            log('IPC - getInstanceURL');
            let params = x[0];
            let instanceUrl = Utils.getInstanceURL(params.orgName);
            webContentChannel.send('getInstanceURL', instanceUrl);
        });

        ipcMain.on('executeAnonymous' , async (e,x) => {
            log('IPC - selectedEntityType');
            let params = x[0];
            let response = await new AnonymousApex().main(params.code, params.orgName);
            webContentChannel.send('executeAnonymous', response);
        });

        ipcMain.on('minimize', async(e,x) => {
            win.minimize();
        });

        ipcMain.on('maximize', async(e,x) => {
            if(!win.isMaximized()) win.maximize();
            else win.restore();
        });

        ipcMain.on('close', async(e,x) => {
            win.close();
        });

        ipcMain.on('getOnigASM', async(e,x) => {
            log('getOnigASM');
            let file = fs.readFileSync('./onigasm.wasm');
            webContentChannel.send('getOnigASM', toArrayBuffer(file))
            log('getOnigASM return');
        })
        
        ipcMain.on('getTMgrammer', async(e,x) => {
            let scopeName = x[0];
            log('getTMgrammer - ' + scopeName);
            let path = './tmGrammar/';
            let fileName = 'java.tmLanguage.json';

            if(scopeName == 'source.css') fileName = 'css.tmLanguage.json'
            else if(scopeName == 'source.java') fileName = 'java.tmLanguage.json';
            else if(scopeName == 'text.html.basic') fileName = 'html.tmLanguage.json';
            else if(scopeName == 'source.js') fileName = 'javaScript.tmLanguage.json';
            // else if(scopeName == 'source.apex') fileName = 'apex.tmLanguage.json';

            let file = ''+fs.readFileSync(path + fileName);
            webContentChannel.send('getTMgrammer', toArrayBuffer(file));
            log('getTMgrammer return');
        })

        ipcMain.on('DeployCode', async (e,x) => {
            let params = x[0];
            log('DeployCode - ' + params.orgName);
            let response = await (new DeployCode().main(params.orgName, {
                type : params.Type,
                id : params.Id,
                Body : params.Code
            }));
            webContentChannel.send('DeployCode', response);
        })

        ipcMain.on('setCredentials', (e,x) => {
            log('IPC - setCredentials | ');
            // console.log(x);
            
            if(x[0]) {
                log('Writing credentials.json');
                fs.writeFileSync('./credentials.json', JSON.stringify(x[0], null, 4));
                Utils.loadAllOrgs();
            }

            webContentChannel.send('setCredentials', true);
        });
    }
    
    rawClone(obj){
        return JSON.parse(JSON.stringify(obj));
    }
}

function toArrayBuffer(buffer) {
    // return buffer;
    return new TextEncoder().encode(buffer).buffer;
    // const arrayBuffer = new ArrayBuffer(buffer.length);
    // const view = new Uint8Array(arrayBuffer);
    // for (let i = 0; i < buffer.length; ++i) {
    //   view[i] = buffer[i];
    // }
    // return arrayBuffer;
}

module.exports = EnForce;

// if(window) window.EnForce = EnForce;

// if(require?.main === module) {
    new EnForce().main();
// }