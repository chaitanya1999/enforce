// Preload (Isolated World)
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld(
    'customIpc',
    {
        on : (channel, listener) => {
            ipcRenderer.on(channel, (e,...args) => listener(e, args));
        },
        once : (channel, listener) => {
            ipcRenderer.once(channel, (e,...args) => listener(e, args));
        },
        send : (channel, ...args) => {
            ipcRenderer.send(channel, args);
        }
    }
)
contextBridge.exposeInMainWorld(
    'desktopMode',
    true
)