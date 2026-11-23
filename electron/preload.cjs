'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const params = new URLSearchParams(window.location.search);
const baseUrl = params.get('api') || '';
const runtimeMode = params.get('mode') || 'LOCAL_STANDALONE';

const api = {
  baseUrl,
  runtimeMode,
  workspace: {
    get: () => ipcRenderer.invoke('workspace:get'),
    update: (patch) => ipcRenderer.invoke('workspace:update', patch),
  },
  paths: {
    data: () => ipcRenderer.invoke('paths:data'),
    output: () => ipcRenderer.invoke('paths:output'),
    logs: () => ipcRenderer.invoke('paths:logs'),
  },
  shell: {
    showInFolder: (p) => ipcRenderer.invoke('shell:showInFolder', p),
    openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
  },
  dialog: {
    openVideoFile: () => ipcRenderer.invoke('dialog:openVideoFile'),
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  },
  app: {
    getRuntimeInfo: () => ipcRenderer.invoke('app:get-runtime-info'),
    restartSidecar: () => ipcRenderer.invoke('app:restart-sidecar'),
    quit: () => ipcRenderer.invoke('app:quit'),
  },
};

contextBridge.exposeInMainWorld('api', api);
