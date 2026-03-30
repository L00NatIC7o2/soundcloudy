const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  dialog,
  globalShortcut,
  nativeImage,
  ipcMain,
  shell,
} = require("electron");
const fs = require("fs");
const path = require("path");
const http = require("http");
const os = require("os");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");

let mainWindow = null;
let tray = null;
let isQuitting = false;
let serverProcess = null;
let updateDownloadNotified = false;
const PROTOCOL = "soundcloudy";
const HISTORY_COOKIE_FILENAME = "soundcloud-history-cookies.json";

const PORT = 3000;
const DEV_URL = "http://localhost:3000";
const FALLBACK_CLIENT_ID = "BecG5WJDDxYMffAfWcjJleNqrGyJyZhI";
const FALLBACK_APP_VERSION = "1770366292";

let cachedCredentials = null;

const loadCachedCredentials = () => {
  if (cachedCredentials) return cachedCredentials;
  try {
    const cachePath = path.join(app.getPath("userData"), "sc-credentials.json");
    if (!fs.existsSync(cachePath)) return null;
    const raw = fs.readFileSync(cachePath, "utf8");
    const parsed = JSON.parse(raw);
    const oneDay = 86400000;
    if (
      parsed?.clientId &&
      parsed?.appVersion &&
      typeof parsed?.timestamp === "number" &&
      Date.now() - parsed.timestamp < oneDay
    ) {
      cachedCredentials = {
        clientId: parsed.clientId,
        appVersion: parsed.appVersion,
      };
      return cachedCredentials;
    }
    return null;
  } catch (_error) {
    return null;
  }
};

const getPlayHistoryClientId = () => {
  const cached = loadCachedCredentials();
  if (cached?.clientId) return cached.clientId;
  return (
    process.env.SOUNDCLOUD_V2_CLIENT_ID ||
    process.env.SOUNDCLOUD_CLIENT_ID ||
    FALLBACK_CLIENT_ID
  );
};

const getPlayHistoryAppVersion = () => {
  const cached = loadCachedCredentials();
  if (cached?.appVersion) return cached.appVersion;
  return process.env.SOUNDCLOUD_APP_VERSION || FALLBACK_APP_VERSION;
};

const PLAY_HISTORY_APP_LOCALE = process.env.SOUNDCLOUD_APP_LOCALE || "en";

const getHistoryCookiePath = () =>
  path.join(app.getPath("userData"), HISTORY_COOKIE_FILENAME);

const sendPlayerToggle = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(
    "window.dispatchEvent(new CustomEvent('player-toggle'))",
  );
};

const getLocalAuthBaseUrl = () =>
  app.isPackaged ? `http://127.0.0.1:${PORT}` : DEV_URL;

const getLocalAuthToken = async () => {
  try {
    const cookies =
      await require("electron").session.defaultSession.cookies.get({
        name: "soundcloud_token",
        url: getLocalAuthBaseUrl(),
      });
    return cookies?.[0]?.value || null;
  } catch (_error) {
    return null;
  }
};

const fetchPlayHistoryViaWebSession = async () => {
  const token = await getLocalAuthToken();
  if (!token) {
    return { error: "Not authenticated" };
  }

  const historyWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    const session = historyWindow.webContents.session;
    const existingWebToken = await session.cookies.get({
      name: "oauth_token",
      domain: ".soundcloud.com",
    });
    const authToken = existingWebToken?.[0]?.value || token;

    const cookiePayload = {
      name: "oauth_token",
      value: authToken,
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "no_restriction",
      domain: ".soundcloud.com",
    };

    await session.cookies.set({
      url: "https://soundcloud.com",
      ...cookiePayload,
    });

    await session.cookies.set({
      url: "https://api-v2.soundcloud.com",
      ...cookiePayload,
    });

    await historyWindow.loadURL("https://soundcloud.com/you/history", {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    let result = null;
    try {
      result = await historyWindow.webContents.executeJavaScript(
        `(() => {
          const baseParams = {
            limit: "100",
            client_id: ${JSON.stringify(getPlayHistoryClientId())},
            app_version: ${JSON.stringify(getPlayHistoryAppVersion())},
            app_locale: ${JSON.stringify(PLAY_HISTORY_APP_LOCALE)},
            oauth_token: ${JSON.stringify(authToken)}
          };
          const headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Device-Locale": "en-US",
            "X-Client-Id": ${JSON.stringify(getPlayHistoryClientId())},
            "Authorization": "OAuth ${authToken}",
            "Origin": "https://soundcloud.com",
            "Referer": "https://soundcloud.com/you/history"
          };
          const v1Headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Authorization": "OAuth ${authToken}",
            "Origin": "https://soundcloud.com",
            "Referer": "https://soundcloud.com/you/history"
          };

          const fetchJson = async (url, requestHeaders) => {
            try {
              const res = await fetch(url, {
                credentials: "include",
                headers: requestHeaders || headers,
                cache: "no-store"
              });
              const text = await res.text().catch(() => null);
              let data = null;
              if (text) {
                try {
                  data = JSON.parse(text);
                } catch (_error) {
                  data = null;
                }
              }
              return {
                ok: res.ok,
                status: res.status,
                data,
                text: text ? text.slice(0, 200) : null
              };
            } catch (err) {
              return {
                ok: false,
                status: null,
                data: null,
                text: null,
                error: err?.message || "Failed to fetch",
                url
              };
            }
          };

          const playParams = new URLSearchParams(baseParams).toString();
          const playUrl = "https://api-v2.soundcloud.com/me/play-history/tracks?" + playParams;
          const probeUrl = async (label, url, requestHeaders) => {
            const res = await fetchJson(url, requestHeaders);
            return {
              label,
              status: res.status,
              ok: res.ok,
              error: res.error || null,
            };
          };

          const probes = async () => {
            return [
              await probeUrl(
                "v2:me",
                "https://api-v2.soundcloud.com/me?" +
                  new URLSearchParams(baseParams).toString(),
              ),
              await probeUrl(
                "v2:health",
                "https://api-v2.soundcloud.com/health",
              ),
              await probeUrl(
                "v1:me",
                "https://api.soundcloud.com/me",
                v1Headers,
              ),
            ];
          };

          return fetchJson(playUrl).then(async (first) => {
            if (!first.ok && first.status === 404) {
              const legacyParams = new URLSearchParams(baseParams).toString();
              const legacyUrl =
                "https://api-v2.soundcloud.com/me/play-history?" + legacyParams;
              const legacy = await fetchJson(legacyUrl);
              if (!legacy.ok && legacy.status === 404) {
                const trackParams = new URLSearchParams(baseParams).toString();
                const trackUrl = "https://api-v2.soundcloud.com/me/track_history?" + trackParams;
                const second = await fetchJson(trackUrl);
                if (!second.ok && second.status === 404) {
                  const activityParams = new URLSearchParams({
                    ...baseParams,
                    limit: "50",
                  }).toString();
                  const activityUrl =
                    "https://api-v2.soundcloud.com/me/activities?" +
                    activityParams;
                  const third = await fetchJson(activityUrl);
                  if (!third.ok && third.status === 404) {
                    const streamParams = new URLSearchParams({
                      ...baseParams,
                      limit: "50",
                    }).toString();
                    const streamUrl =
                      "https://api-v2.soundcloud.com/stream?" + streamParams;
                    const fourth = await fetchJson(streamUrl);
                    if (!fourth.ok && fourth.status === 404) {
                      const v1Params = new URLSearchParams({
                        limit: "50",
                      }).toString();
                      const v1Url =
                        "https://api.soundcloud.com/me/activities?" + v1Params;
                      const fifth = await fetchJson(v1Url, v1Headers);
                      return {
                        ...fifth,
                        fallback: "activities-v1",
                        debug: {
                          play: first.status,
                          legacy: legacy.status,
                          track: second.status,
                          activity: third.status,
                          stream: fourth.status,
                          activityV1: fifth.status,
                        },
                        probes: await probes(),
                      };
                    }
                    return {
                      ...fourth,
                      fallback: "stream",
                      debug: {
                        play: first.status,
                        legacy: legacy.status,
                        track: second.status,
                        activity: third.status,
                        stream: fourth.status,
                      },
                      probes: await probes(),
                    };
                  }
                  return {
                    ...third,
                    fallback: "activities",
                    debug: {
                      play: first.status,
                      legacy: legacy.status,
                      track: second.status,
                      activity: third.status,
                    },
                    probes: await probes(),
                  };
                }
                return {
                  ...second,
                  fallback: "track_history",
                  debug: { play: first.status, legacy: legacy.status, track: second.status },
                  probes: await probes(),
                };
              }
              return {
                ...legacy,
                fallback: "play-history",
                debug: { play: first.status, legacy: legacy.status },
                probes: await probes(),
              };
            }
            return {
              ...first,
              fallback: "play-history",
              debug: { play: first.status },
              probes: await probes(),
            };
          });
        })();`,
      );
    } catch (error) {
      return {
        error: "Failed to fetch play history",
        status: null,
        message: error?.message || "Web session request failed",
      };
    }

    if (!result?.ok) {
      const message =
        result?.data?.error ||
        result?.data?.errors?.[0]?.message ||
        result?.error ||
        result?.text ||
        "No response from web session";
      return {
        error: "Failed to fetch play history",
        status: result?.status || null,
        message,
        debug: result?.debug || null,
        probes: result?.probes || null,
        source: result?.fallback || null,
      };
    }

    const items = (result?.data?.collection || [])
      .map((item) => {
        if (item?.track) {
          return {
            ...item.track,
            played_at: item.played_at || item.created_at || null,
          };
        }
        if (item?.origin) {
          return {
            ...item.origin,
            played_at: item.created_at || item.origin?.created_at || null,
          };
        }
        if (item?.id && item?.title) {
          return {
            ...item,
            played_at: item.played_at || item.created_at || null,
          };
        }
        return null;
      })
      .filter(Boolean);
    return {
      items,
      source: result?.fallback || "play-history",
      status: result?.status || null,
      debug: result?.debug || null,
      probes: result?.probes || null,
    };
  } finally {
    historyWindow.destroy();
  }
};

const openHistoryLoginWindow = async () => {
  let loginWindow = null;
  let resolved = false;

  const finalize = (payload) => {
    if (resolved) return;
    resolved = true;
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.close();
    }
    return payload;
  };

  loginWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const session = loginWindow.webContents.session;

  const checkForWebToken = async () => {
    try {
      const cookies = await session.cookies.get({
        name: "oauth_token",
        domain: ".soundcloud.com",
      });
      return Boolean(cookies?.[0]?.value);
    } catch (_error) {
      return false;
    }
  };

  return new Promise((resolve) => {
    const maybeResolve = async () => {
      const hasToken = await checkForWebToken();
      if (hasToken) {
        resolve(finalize({ ok: true }));
      }
    };

    loginWindow.on("closed", () => {
      if (!resolved) {
        resolve(finalize({ ok: false, error: "Login window closed" }));
      }
    });

    loginWindow.webContents.on("did-finish-load", () => {
      void maybeResolve();
    });

    loginWindow.webContents.on("did-navigate", () => {
      void maybeResolve();
    });

    loginWindow
      .loadURL("https://soundcloud.com/you/history", {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      })
      .catch(() => {
        resolve(finalize({ ok: false, error: "Failed to load login page" }));
      });
  });
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
        await historyWindow.webContents.executeJavaScript(`(() => {
          const waitFor = (predicate, timeout = 8000) => new Promise((resolve) => {
            const start = Date.now();
            const tick = () => {
              if (predicate()) return resolve(true);
              if (Date.now() - start > timeout) return resolve(false);
              setTimeout(tick, 300);
            };
            tick();
          });

          return waitFor(
            () => document.querySelector('.playHistory') || document.querySelector('.historicalPlays_item')
          ).then(() => {
            window.scrollTo(0, document.body.scrollHeight);
            return true;
          });
        })();`);

        const payload = await historyWindow.webContents
          .executeJavaScript(`(() => {
          const selectors = [
            '.playHistory .historicalPlays_item a[href]',
            '.historicalPlays_item a[href]',
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
          const historyItems = root.querySelectorAll('.historicalPlays_item');
          const historyLinks = root.querySelectorAll('.historicalPlays_item a[href]');
          const playHistoryRoot = document.querySelector('.playHistory');
          const docHistoryItems = document.querySelectorAll('.historicalPlays_item');
          const docHistoryLinks = document.querySelectorAll('.historicalPlays_item a[href]');
          const bodyTextSample = (document.body?.innerText || '').slice(0, 200);
          const sampleClasses = Array.from(document.querySelectorAll('section,main,div'))
            .slice(0, 60)
            .map((node) => node.className)
            .filter((value) => typeof value === 'string' && value.trim().length > 0)
            .slice(0, 12);

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
              rootText: (root?.textContent || '').slice(0, 180),
              historyItemCount: historyItems.length,
              historyLinkCount: historyLinks.length,
              playHistoryFound: Boolean(playHistoryRoot),
              docHistoryItemCount: docHistoryItems.length,
              docHistoryLinkCount: docHistoryLinks.length,
              sampleClasses,
              bodyTextSample
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

const setupAutoUpdater = () => {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    updateDownloadNotified = false;
    console.log("[updater] checking for update");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("[updater] update available", info?.version || null);
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[updater] update not available");
  });

  autoUpdater.on("error", (error) => {
    console.error("[updater] error", error?.message || error);
  });

  autoUpdater.on("download-progress", (progress) => {
    console.log(
      "[updater] download progress",
      `${Math.round(progress?.percent || 0)}%`,
    );
  });

  autoUpdater.on("update-downloaded", async (info) => {
    console.log("[updater] update downloaded", info?.version || null);
    if (updateDownloadNotified) return;
    updateDownloadNotified = true;

    try {
      const result = await dialog.showMessageBox(mainWindow || undefined, {
        type: "info",
        buttons: ["Install Now", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Update Ready",
        message: `Soundcloudy ${info?.version || ""} is ready to install.`,
        detail:
          "The update has finished downloading. Install now to restart the app and apply it.",
      });

      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    } catch (error) {
      console.error("[updater] failed to show install prompt", error);
    }
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
  setupAutoUpdater();

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

ipcMain.handle("history-play-history", async () => {
  try {
    return await fetchPlayHistoryViaWebSession();
  } catch (error) {
    return { error: String(error) };
  }
});

ipcMain.handle("history-web-login", async () => {
  try {
    return await openHistoryLoginWindow();
  } catch (error) {
    console.error("History login failed:", error);
    return { ok: false, error: "History login failed" };
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

ipcMain.handle("get-local-network-url", () => {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (
        entry &&
        entry.family === "IPv4" &&
        !entry.internal &&
        !entry.address.startsWith("169.254.")
      ) {
        return `http://${entry.address}:3000`;
      }
    }
  }
  return "http://localhost:3000";
});
