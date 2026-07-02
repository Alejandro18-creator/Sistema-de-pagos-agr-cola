const { contextBridge, ipcRenderer } = require("electron");

const portableStorageApi = {
  readJson: (relativePath) => ipcRenderer.invoke("storage:read", relativePath),
  writeJson: (relativePath, data) =>
    ipcRenderer.invoke("storage:write", { relativePath, data }),
  fileExists: (relativePath) =>
    ipcRenderer.invoke("storage:exists", relativePath),
};

if (process.contextIsolated && contextBridge?.exposeInMainWorld) {
  contextBridge.exposeInMainWorld("portableStorage", portableStorageApi);
} else {
  window.portableStorage = portableStorageApi;
}
