const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    getRootDir: () => ipcRenderer.invoke('get-root-dir'),
    readEnv: () => ipcRenderer.invoke('read-env'),
    saveEnv: (content) => ipcRenderer.invoke('save-env', content),
    readToken: () => ipcRenderer.invoke('read-token'),
    saveToken: (content) => ipcRenderer.invoke('save-token', content),
    startServer: () => ipcRenderer.invoke('start-server'),
    stopServer: (force) => ipcRenderer.invoke('stop-server', force),
    getStatus: () => ipcRenderer.invoke('get-status'),
    onLog: (callback) => ipcRenderer.on('server-log', (event, value) => callback(value)),
    onStatusChange: (callback) => ipcRenderer.on('server-status', (event, value) => callback(value)),
    onMetrics: (callback) => ipcRenderer.on('system-metrics', (event, value) => callback(value)),
    onRequestClose: (callback) => ipcRenderer.on('request-close-choice', () => callback()),
    sendCloseChoice: (choice) => ipcRenderer.send('close-choice', choice),
    onTriggerStart: (callback) => ipcRenderer.on('trigger-start', () => callback()),
    onTriggerStop: (callback) => ipcRenderer.on('trigger-stop', () => callback()),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings)
});
