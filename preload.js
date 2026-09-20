const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bassengfoto', {
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings) => ipcRenderer.invoke('settings:save', settings),
    chooseOutputFolder: () => ipcRenderer.invoke('settings:chooseOutputFolder'),
    chooseReplaceImage: () => ipcRenderer.invoke('settings:chooseReplaceImage')
  },
  fs: {
    readImageAsDataUrl: (filePath) => ipcRenderer.invoke('fs:readImageAsDataUrl', filePath)
  },
  athletes: {
    load: () => ipcRenderer.invoke('athletes:load'),
    save: (athletes) => ipcRenderer.invoke('athletes:save', athletes)
  },
  csv: {
    chooseFile: () => ipcRenderer.invoke('csv:chooseFile')
  },
  image: {
    checkExists: (fileName) => ipcRenderer.invoke('image:checkExists', fileName),
    save: (fileName, buffer) => ipcRenderer.invoke('image:save', { fileName, buffer })
  },
  shell: {
    openFolder: (folderPath) => ipcRenderer.invoke('shell:openFolder', folderPath)
  },
  display: {
    open: () => ipcRenderer.invoke('display:open'),
    isOpen: () => ipcRenderer.invoke('display:isOpen'),
    sendFrame: (dataUrl) => ipcRenderer.send('display:frame', dataUrl),
    sendCaptured: (payload) => ipcRenderer.send('display:captured', payload),
    onFrame: (callback) => ipcRenderer.on('display:frame', (_event, dataUrl) => callback(dataUrl)),
    onCaptured: (callback) => ipcRenderer.on('display:captured', (_event, payload) => callback(payload))
  }
});
