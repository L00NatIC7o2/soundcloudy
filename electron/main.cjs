const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  nativeImage,
  ipcMain,
  shell,
} = require("electron");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");

let mainWindow = null;
let tray = null;
let isQuitting = false;
let serverProcess = null;
const PROTOCOL = "soundcloudy";

const PORT = 3000;
const DEV_URL = "http://localhost:3000";

const sendPlayerToggle = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(
    "window.dispatchEvent(new CustomEvent('player-toggle'))",
  );
};

const waitForServer = (url, timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tryOnce = () => {
      http
        .get(url, (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
            res.resume();
            resolve();
            return;
          }
          res.resume();
          retry();
        })
        .on("error", retry);
    };

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error("Timed out waiting for Next server"));
        return;
      }
      setTimeout(tryOnce, 250);
    };

    tryOnce();
  });

const startNextServer = () => {
  if (!app.isPackaged) return Promise.resolve();
  const serverPath = path.join(
    process.resourcesPath,
    "app.asar",
    ".next",
    "standalone",
    "server.js",
  );

  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "inherit",
  });

  serverProcess.on("exit", () => {
    serverProcess = null;
  });

  return waitForServer(`http://127.0.0.1:${PORT}`);
};

const createWindow = async () => {
  await startNextServer();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#0b0b0b",
    frame: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = app.isPackaged ? `http://127.0.0.1:${PORT}` : DEV_URL;

  await mainWindow.loadURL(startUrl);

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.webContents.send("window-maximized", mainWindow.isMaximized());
  });

  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window-maximized", true);
  });

  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window-maximized", false);
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
};

const handleAuthCallbackUrl = (url) => {
  try {
    const parsed = new URL(url);
    const nonce = parsed.searchParams.get("nonce");
    if (!nonce) return;
    const bridgeUrl = app.isPackaged
      ? `http://127.0.0.1:${PORT}/api/auth/bridge?nonce=${encodeURIComponent(
          nonce,
        )}`
      : `${DEV_URL}/api/auth/bridge?nonce=${encodeURIComponent(nonce)}`;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(bridgeUrl).catch(() => {});
      mainWindow.show();
    }
  } catch (_error) {
    // ignore invalid URLs
  }
};

const registerProtocol = () => {
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient(PROTOCOL);
    return;
  }

  const execPath = process.execPath;
  const appPath = path.resolve(process.argv[1]);
  app.setAsDefaultProtocolClient(PROTOCOL, execPath, [appPath]);
};

const setupTray = () => {
  const iconPath = path.join(app.getAppPath(), "icon.ico");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip("Soundcloudy");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        if (mainWindow) mainWindow.show();
      },
    },
    {
      label: "Play/Pause",
      click: sendPlayerToggle,
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    if (mainWindow) mainWindow.show();
  });
};

const setupShortcuts = () => {
  globalShortcut.register("MediaPlayPause", sendPlayerToggle);
  globalShortcut.register("MediaNextTrack", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.executeJavaScript(
      "window.dispatchEvent(new CustomEvent('player-next'))",
    );
  });
  globalShortcut.register("MediaPreviousTrack", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.executeJavaScript(
      "window.dispatchEvent(new CustomEvent('player-prev'))",
    );
  });
};

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const urlArg = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (urlArg) handleAuthCallbackUrl(urlArg);
    if (mainWindow) mainWindow.show();
  });
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleAuthCallbackUrl(url);
});

app.on("ready", async () => {
  registerProtocol();
  await createWindow();
  setupTray();
  setupShortcuts();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

ipcMain.on("player-toggle", sendPlayerToggle);

ipcMain.handle("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle("window-maximize-toggle", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle("window-close", () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle("window-is-maximized", () => {
  if (!mainWindow) return false;
  return mainWindow.isMaximized();
});

ipcMain.handle("open-external", (_event, url) => {
  if (typeof url !== "string") return;
  shell.openExternal(url);
});
