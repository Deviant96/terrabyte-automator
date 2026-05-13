const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),

  // Config
  configGet: () => ipcRenderer.invoke('config-get'),
  configSet: (data) => ipcRenderer.invoke('config-set', data),

  // Requests
  requestSubmit: (payload) => ipcRenderer.invoke('request-submit', payload),
  requestGetAll: () => ipcRenderer.invoke('request-get-all'),
  requestGetOne: (id) => ipcRenderer.invoke('request-get-one', id),
  requestDelete: (id) => ipcRenderer.invoke('request-delete', id),
  requestClearAll: () => ipcRenderer.invoke('request-clear-all'),

  // DB
  dbExport: () => ipcRenderer.invoke('db-export'),

  // Webhook
  webhookTest: () => ipcRenderer.invoke('webhook-test'),

  // Events from main process
  onRequestUpdate: (cb) => ipcRenderer.on('request-update', (_, data) => cb(data)),
  onToast: (cb) => ipcRenderer.on('toast', (_, data) => cb(data))
});
