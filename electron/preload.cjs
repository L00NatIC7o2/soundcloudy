const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  togglePlayPause: () => ipcRenderer.send("player-toggle"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  getLocalNetworkUrl: () => ipcRenderer.invoke("get-local-network-url"),
  captureHistorySession: () => ipcRenderer.invoke("history-capture"),
  scrapeHistoryUrls: () => ipcRenderer.invoke("history-scrape"),
  playHistoryViaWeb: () => ipcRenderer.invoke("history-play-history"),
  historyWebLogin: () => ipcRenderer.invoke("history-web-login"),
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
