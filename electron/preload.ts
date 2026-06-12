import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('hoddDesktop', {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('hodd:state:get'),
  saveState: (state: Record<string, unknown>) => ipcRenderer.invoke('hodd:state:save', state),
  exportArchive: (payload: Record<string, unknown>) => ipcRenderer.invoke('hodd:archive:export', payload),
});
