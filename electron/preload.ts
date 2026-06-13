import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('hoddDesktop', {
  platform: process.platform,

  // Archive export / import
  exportArchive: (payload: Record<string, unknown>) =>
    ipcRenderer.invoke('hodd:archive:export', payload),
  importArchive: () =>
    ipcRenderer.invoke('hodd:archive:import'),

  // Title bar theme sync (Windows)
  setTitleBarTheme: (theme: 'light' | 'dark') =>
    ipcRenderer.invoke('hodd:titlebar:set-theme', theme),

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
    getAllStories:        ()           => ipcRenderer.invoke('hodd:stories:all'),

    saveHolding:  (id: string, patch: Record<string, unknown>) => ipcRenderer.invoke('hodd:holding:save', id, patch),
    removeHolding:(id: string)                                  => ipcRenderer.invoke('hodd:holding:remove', id),
    saveCatalog:  (id: string, patch: Record<string, unknown>) => ipcRenderer.invoke('hodd:catalog:save', id, patch),
    saveStory:    (id: string, paragraphs: string[])           => ipcRenderer.invoke('hodd:story:save', id, paragraphs),
    createCollection: (def: { name: string; type: string; accent: string; template: string[] }) =>
      ipcRenderer.invoke('hodd:collection:create', def),
    deleteCollection: (id: string) => ipcRenderer.invoke('hodd:collection:delete', id),
    addItem: (collectionId: string, draft: Record<string, unknown>) =>
      ipcRenderer.invoke('hodd:item:add', collectionId, draft),
    deleteItem:        (id: string)                                   => ipcRenderer.invoke('hodd:item:delete', id),
    setItemOwned:      (id: string, owned: boolean)                   => ipcRenderer.invoke('hodd:item:set-owned', id, owned),
    updateUserItem:    (id: string, fields: Record<string, unknown>)  => ipcRenderer.invoke('hodd:item:update-fields', id, fields),
    saveSetting: (key: string, value: string) => ipcRenderer.invoke('hodd:setting:save', key, value),
    lookup: (type: string, query: string) => ipcRenderer.invoke('hodd:lookup', type, query),
    getFavorites:   ()           => ipcRenderer.invoke('hodd:favorites'),
    addFavorite:    (id: string) => ipcRenderer.invoke('hodd:favorite:add', id),
    removeFavorite: (id: string) => ipcRenderer.invoke('hodd:favorite:remove', id),
    getHomeDynamic: () => ipcRenderer.invoke('hodd:home-dynamic'),
    getTimeline:    () => ipcRenderer.invoke('hodd:timeline'),
    getGrowth:      () => ipcRenderer.invoke('hodd:growth'),
    pickImage: (multi?: boolean) => ipcRenderer.invoke('hodd:image:pick', multi),
    deleteImage: (filename: string) => ipcRenderer.invoke('hodd:image:delete', filename),
    resetAll: () => ipcRenderer.invoke('hodd:reset-all'),
  },

  // Ollama local AI
  ollama: {
    status:   ()                                                              => ipcRenderer.invoke('hodd:ollama:status'),
    chat:     (model: string, messages: { role: string; content: string }[]) => ipcRenderer.invoke('hodd:ollama:chat', model, messages),
    generate: (model: string, prompt: string, system?: string)               => ipcRenderer.invoke('hodd:ollama:generate', model, prompt, system),
    checkInstalled: () => ipcRenderer.invoke('hodd:ollama:check-installed'),
    install:        (password?: string) => ipcRenderer.invoke('hodd:ollama:install', password),
    cancelInstall:  () => ipcRenderer.invoke('hodd:ollama:cancel-install'),
    start:          () => ipcRenderer.invoke('hodd:ollama:start'),
    pullModel:      (name: string) => ipcRenderer.invoke('hodd:ollama:pull', name),
    stop:           () => ipcRenderer.invoke('hodd:ollama:stop'),
    onStream:       (cb: (data: { type: string; data: string }) => void) =>
      ipcRenderer.on('hodd:ollama:stream', (_e, d) => cb(d)),
    offStream:      () => ipcRenderer.removeAllListeners('hodd:ollama:stream'),
    onPullProgress: (cb: (data: { status: string; pct: number | null }) => void) =>
      ipcRenderer.on('hodd:ollama:pull-progress', (_e, d) => cb(d)),
    offPullProgress: () => ipcRenderer.removeAllListeners('hodd:ollama:pull-progress'),
  },
});
