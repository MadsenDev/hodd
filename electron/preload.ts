import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('hoddDesktop', {
  platform: process.platform,

  // Export archive
  exportArchive: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('hodd:archive:export', payload),

  // All data + mutation API
  api: {
    getCatalog:           () => ipcRenderer.invoke('hodd:catalog'),
    getHoldings:          () => ipcRenderer.invoke('hodd:holdings'),
    getCatalogOverrides:  () => ipcRenderer.invoke('hodd:catalog-overrides'),
    getUserCollections:   () => ipcRenderer.invoke('hodd:user-collections'),
    getUserItems:         () => ipcRenderer.invoke('hodd:user-items'),
    getBaseCollections:   () => ipcRenderer.invoke('hodd:base-collections'),
    getSettings:          () => ipcRenderer.invoke('hodd:settings'),
    getUser:              () => ipcRenderer.invoke('hodd:user'),
    getHomeConfig:        () => ipcRenderer.invoke('hodd:home-config'),
    getStatsConfig:       () => ipcRenderer.invoke('hodd:stats-config'),
    getStory:             (id: string) => ipcRenderer.invoke('hodd:story:get', id),

    saveHolding:  (id: string, patch: Record<string, unknown>) => ipcRenderer.invoke('hodd:holding:save', id, patch),
    removeHolding:(id: string)                                  => ipcRenderer.invoke('hodd:holding:remove', id),
    saveCatalog:  (id: string, patch: Record<string, unknown>) => ipcRenderer.invoke('hodd:catalog:save', id, patch),
    saveStory:    (id: string, paragraphs: string[])           => ipcRenderer.invoke('hodd:story:save', id, paragraphs),
    createCollection: (def: { name: string; type: string; accent: string; template: string[] }) =>
      ipcRenderer.invoke('hodd:collection:create', def),
    addItem: (collectionId: string, draft: Record<string, unknown>) =>
      ipcRenderer.invoke('hodd:item:add', collectionId, draft),
    saveSetting: (key: string, value: string) => ipcRenderer.invoke('hodd:setting:save', key, value),
    lookup: (type: string, query: string) => ipcRenderer.invoke('hodd:lookup', type, query),
    getHomeDynamic: () => ipcRenderer.invoke('hodd:home-dynamic'),
    getTimeline:    () => ipcRenderer.invoke('hodd:timeline'),
  },

  // Ollama local AI
  ollama: {
    status:   ()                                                              => ipcRenderer.invoke('hodd:ollama:status'),
    chat:     (model: string, messages: { role: string; content: string }[]) => ipcRenderer.invoke('hodd:ollama:chat', model, messages),
    generate: (model: string, prompt: string, system?: string)               => ipcRenderer.invoke('hodd:ollama:generate', model, prompt, system),
  },
});
