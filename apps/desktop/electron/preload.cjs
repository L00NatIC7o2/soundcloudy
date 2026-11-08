const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  togglePlayPause: () => ipcRenderer.send("player-toggle"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  getLocalNetworkUrl: () => ipcRenderer.invoke("get-local-network-url"),
  captureHistorySession: () => ipcRenderer.invoke("history-capture"),
  scrapeHistoryUrls: () => ipcRenderer.invoke("history-scrape"),
  playHistoryViaWeb: () => ipcRenderer.invoke("history-play-history"),
  fetchDiscoverSelections: () => ipcRenderer.invoke("discover-selections"),
  historyWebLogin: () => ipcRenderer.invoke("history-web-login"),
  updates: {
    getState: () => ipcRenderer.invoke("updates:get-state"),
    setPreferences: (preferences) =>
      ipcRenderer.invoke("updates:set-preferences", preferences),
    check: () => ipcRenderer.invoke("updates:check"),
    download: () => ipcRenderer.invoke("updates:download"),
    install: () => ipcRenderer.invoke("updates:install"),
    onEvent: (callback) => {
      const handler = (_event, updateEvent) => callback(updateEvent);
      ipcRenderer.on("updates:event", handler);
      return () => ipcRenderer.removeListener("updates:event", handler);
    },
  },
  windowControls: {
    minimize: () => ipcRenderer.invoke("window-minimize"),
    maximizeToggle: () => ipcRenderer.invoke("window-maximize-toggle"),
    close: () => ipcRenderer.invoke("window-close"),
    isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
    onMaximized: (callback) => {
      const handler = (_event, state) => callback(state);
      ipcRenderer.on("window-maximized", handler);
      return () => ipcRenderer.removeListener("window-maximized", handler);
    },
  },
});
