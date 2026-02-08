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
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");

let mainWindow = null;
let tray = null;
let isQuitting = false;
let serverProcess = null;
const PROTOCOL = "soundcloudy";
const HISTORY_COOKIE_FILENAME = "soundcloud-history-cookies.json";

const PORT = 3000;
const DEV_URL = "http://localhost:3000";

const getHistoryCookiePath = () =>
  path.join(app.getPath("userData"), HISTORY_COOKIE_FILENAME);

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

const resolveElectronExecPath = () => {
  const candidates = [];
  const appExe = app.getPath("exe");
  if (appExe) candidates.push(appExe);
  if (process.execPath) candidates.push(process.execPath);
  const exeName = path.basename(
    appExe || process.execPath || "Soundcloudy.exe",
  );
  candidates.push(path.join(process.resourcesPath, "..", exeName));
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

const startNextServer = () => {
  if (!app.isPackaged) return Promise.resolve();
  const serverDir = path.join(process.resourcesPath, "standalone");
  const serverPath = path.join(serverDir, "server.js");

  if (!fs.existsSync(serverPath)) {
    return Promise.reject(new Error(`Missing server bundle at ${serverPath}`));
  }

  const logPath = path.join(app.getPath("userData"), "next-server.log");
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  const writeLog = (chunk) => {
    const text = chunk?.toString?.() ?? String(chunk);
    logStream.write(text);
  };

  const execPath = resolveElectronExecPath();
  if (!execPath) {
    return Promise.reject(
      new Error("Unable to locate the Electron executable."),
    );
  }

  serverProcess = spawn(execPath, [serverPath], {
    cwd: process.resourcesPath,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      SOUNDCLOUD_HISTORY_COOKIE_PATH: getHistoryCookiePath(),
      ELECTRON_RUN_AS_NODE: "1",
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout?.on("data", writeLog);
  serverProcess.stderr?.on("data", writeLog);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    serverProcess.on("error", (error) => {
      finish(error);
    });

    serverProcess.on("exit", (code, signal) => {
      serverProcess = null;
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      finish(new Error(`Next server exited with ${reason}. See ${logPath}`));
    });

    waitForServer(`http://127.0.0.1:${PORT}`)
      .then(() => finish())
      .catch((error) => {
        finish(
          new Error(
            `${error instanceof Error ? error.message : String(error)}. See ${logPath}`,
          ),
        );
      });
  });
};

const buildErrorPage = (title, message) => {
  const safeTitle = String(title || "Soundcloudy");
  const safeMessage = String(message || "Something went wrong.");
  return `data:text/html;charset=utf-8,${encodeURIComponent(`
    <html>
      <head><title>${safeTitle}</title></head>
      <body style="font-family: sans-serif; background: #0b0b0b; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
        <div style="max-width: 560px; padding: 24px; background: rgba(255,255,255,0.06); border-radius: 12px; border: 1px solid rgba(255,255,255,0.12);">
          <h2 style="margin: 0 0 12px;">${safeTitle}</h2>
          <p style="margin: 0 0 12px; line-height: 1.4;">${safeMessage}</p>
          <p style="margin: 0; opacity: 0.7;">Try quitting and reopening the app.</p>
        </div>
      </body>
    </html>
  `)}`;
};

const captureHistorySession = async () => {
  const historyWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#0b0b0b",
    autoHideMenuBar: true,
    parent: mainWindow || undefined,
    modal: Boolean(mainWindow),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const targetUrl = "https://soundcloud.com/you/history";
  await historyWindow.loadURL(targetUrl);

  return new Promise((resolve) => {
    let resolved = false;
    const finalize = async () => {
      if (resolved) return;
      resolved = true;
      try {
        const cookies = await historyWindow.webContents.session.cookies.get({
          domain: ".soundcloud.com",
        });
        const cookiePath = getHistoryCookiePath();
        fs.writeFileSync(
          cookiePath,
          JSON.stringify(
            { capturedAt: new Date().toISOString(), cookies },
            null,
            2,
          ),
        );
        resolve({ saved: cookies.length > 0, count: cookies.length });
      } catch (error) {
        resolve({ saved: false, error: String(error) });
      }
    };

    historyWindow.on("close", async (event) => {
      event.preventDefault();
      await finalize();
      historyWindow.destroy();
    });

    historyWindow.on("closed", () => {
      if (!resolved) {
        resolve({ saved: false, error: "History window closed." });
      }
    });
  });
};

const scrapeHistoryUrls = async () => {
  const historyWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#0b0b0b",
    autoHideMenuBar: true,
    parent: mainWindow || undefined,
    modal: Boolean(mainWindow),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const targetUrl = "https://soundcloud.com/you/history";
  await historyWindow.loadURL(targetUrl);

  return new Promise((resolve) => {
    let resolved = false;
    const finalize = async () => {
      if (resolved) return;
      resolved = true;
      try {
        const payload = await historyWindow.webContents
          .executeJavaScript(`(() => {
          const selectors = [
            'a.soundTitle__title',
            'a.soundTitle__titleLink',
            'a.sound__title',
            'a.sound__titleLink',
            'a.sc-link-primary',
            'a.sc-link-dark'
          ];
          const links = new Set();
          const trackIds = new Set();

          const addTrackId = (value) => {
            const id = Number(value);
            if (Number.isFinite(id)) trackIds.add(id);
          };

          const findHistoryRoot = () => {
            const textMatch = (node) =>
              (node.textContent || '').toLowerCase().includes("tracks you've played");
            const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4'));
            const match = headings.find(textMatch);
            if (match) {
              return match.closest('section') || match.parentElement || document.body;
            }
            return document.body;
          };

          const root = findHistoryRoot();

          for (const selector of selectors) {
            root.querySelectorAll(selector).forEach((node) => {
              if (node && node.href) links.add(node.href);
            });
          }

          root.querySelectorAll('a[href]').forEach((node) => {
            if (!node || !node.href) return;
            if (!/soundcloud\.com\//i.test(node.href)) return;
            if (/\/you\//i.test(node.href)) return;
            if (/\/settings\//i.test(node.href)) return;
            links.add(node.href);
          });

          root
            .querySelectorAll('[data-track-id],[data-sound-id],[data-id],[data-permalink-path]')
            .forEach((node) => {
              const el = node;
              if (el.dataset) {
                addTrackId(el.dataset.trackId);
                addTrackId(el.dataset.soundId);
                addTrackId(el.dataset.id);
                if (el.dataset.permalinkPath) {
                  links.add('https://soundcloud.com' + el.dataset.permalinkPath);
                }
              }
            });

          const resolveTrack = (node) => {
            if (!node || typeof node !== 'object') return null;
            if (node.kind === 'track' && node.id) return node;
            if (node.track && node.track.kind === 'track') return node.track;
            if (node.sound && node.sound.kind === 'track') return node.sound;
            if (node.entity && node.entity.kind === 'track') return node.entity;
            if (node.item && node.item.kind === 'track') return node.item;
            return null;
          };

          const walk = (node, visited) => {
            if (!node) return;
            if (visited.has(node)) return;
            if (Array.isArray(node)) {
              visited.add(node);
              node.forEach((item) => walk(item, visited));
              return;
            }
            if (typeof node !== 'object') return;
            visited.add(node);

            const track = resolveTrack(node);
            if (track) {
              addTrackId(track.id);
              if (track.permalink_url) links.add(track.permalink_url);
              if (track.permalink) links.add('https://soundcloud.com/' + track.permalink);
            }

            Object.values(node).forEach((value) => walk(value, visited));
          };

          if (Array.isArray(window.__sc_hydration)) {
            walk(window.__sc_hydration, new Set());
          }

          return {
            urls: Array.from(links),
            trackIds: Array.from(trackIds),
            debug: {
              rootText: (root?.textContent || '').slice(0, 180)
            }
          };
        })();`);
        resolve(payload);
      } catch (error) {
        resolve({ urls: [], trackIds: [], error: String(error) });
      }
    };

    historyWindow.on("close", async (event) => {
      event.preventDefault();
      await finalize();
      historyWindow.destroy();
    });

    historyWindow.on("closed", () => {
      if (!resolved) {
        resolve({ urls: [], trackIds: [], error: "History window closed." });
      }
    });
  });
};

const createWindow = async () => {
  let serverError = null;
  try {
    await startNextServer();
  } catch (error) {
    serverError = error;
  }

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

  if (serverError) {
    const message =
      serverError instanceof Error ? serverError.message : String(serverError);
    await mainWindow.loadURL(
      buildErrorPage("Failed to start", `Server error: ${message}`),
    );
  } else {
    try {
      await mainWindow.loadURL(startUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await mainWindow.loadURL(
        buildErrorPage("Failed to load", `Load error: ${message}`),
      );
    }
  }

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

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription) => {
      mainWindow
        .loadURL(
          buildErrorPage(
            "Failed to load",
            `${errorDescription} (${errorCode})`,
          ),
        )
        .catch(() => {});
      mainWindow.show();
    },
  );
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
  const iconCandidates = [
    app.isPackaged
      ? path.join(process.resourcesPath, "standalone", "public", "tray.ico")
      : path.join(app.getAppPath(), "public", "tray.ico"),
    app.isPackaged
      ? path.join(process.resourcesPath, "standalone", "public", "tray.png")
      : path.join(app.getAppPath(), "public", "tray.png"),
    app.isPackaged
      ? path.join(process.resourcesPath, "icon.ico")
      : path.join(app.getAppPath(), "icon.ico"),
  ];
  let icon = nativeImage.createEmpty();
  for (const candidate of iconCandidates) {
    const nextIcon = nativeImage.createFromPath(candidate);
    if (!nextIcon.isEmpty()) {
      icon = nextIcon;
      break;
    }
  }
  if (!icon.isEmpty()) {
    icon = icon.resize({ width: 16, height: 16 });
    icon.setTemplateImage(false);
  }
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

ipcMain.handle("history-capture", async () => {
  try {
    return await captureHistorySession();
  } catch (error) {
    return { saved: false, error: String(error) };
  }
});

ipcMain.handle("history-scrape", async () => {
  try {
    return await scrapeHistoryUrls();
  } catch (error) {
    return { urls: [], error: String(error) };
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
