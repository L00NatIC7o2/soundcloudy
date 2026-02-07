const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  togglePlayPause: () => ipcRenderer.send("player-toggle"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
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
