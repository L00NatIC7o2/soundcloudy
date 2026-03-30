import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import axios from "axios";
import puppeteer, { type Browser, type Page } from "puppeteer";
import {
  getRequestSoundCloudWebCredentials,
  refreshSoundCloudAuth,
  refreshSoundCloudTokenValue,
  setRequestSoundCloudWebCredentials,
} from "../../src/server/auth/soundcloud";

const HISTORY_URL = "https://soundcloud.com/you/history";
const PLAY_HISTORY_URL = "https://api-v2.soundcloud.com/me/play-history/tracks";
const PLAY_HISTORY_URL_LEGACY = "https://api-v2.soundcloud.com/me/play-history";
const PLAY_HISTORY_APP_VERSION =
  process.env.SOUNDCLOUD_APP_VERSION || "1770366292";
const PLAY_HISTORY_LOCALE = process.env.SOUNDCLOUD_APP_LOCALE || "en";
const NAV_TIMEOUT_MS = 15000;
const WAIT_TIMEOUT_MS = 5000;
let browserPromise: Promise<Browser> | null = null;
const HISTORY_COOKIE_ENV = "SOUNDCLOUD_HISTORY_COOKIE_PATH";
const FALLBACK_CLIENT_ID = "BecG5WJDDxYMffAfWcjJleNqrGyJyZhI";

let historyCache: {
  data: any;
  timestamp: number;
  token: string;
} | null = null;
const CACHE_TTL_MS = 60000; // 60 seconds

let extractedCredentials: {
  clientId: string;
  appVersion: string;
  timestamp: number;
} | null = null;
const CREDENTIALS_CACHE_TTL_MS = 86400000; // 24 hours

const resolveCredentialsCachePath = () => {
  if (process.env.APPDATA) {
    return path.join(process.env.APPDATA, "soundcloudy", "sc-credentials.json");
  }
  return path.join(process.cwd(), ".soundcloudy", "sc-credentials.json");
};

const loadCachedCredentials = () => {
  try {
    const cachePath = resolveCredentialsCachePath();
    if (!fs.existsSync(cachePath)) return null;
    const raw = fs.readFileSync(cachePath, "utf8");
    const parsed = JSON.parse(raw);
    if (
      parsed?.clientId &&
      parsed?.appVersion &&
      typeof parsed?.timestamp === "number" &&
      Date.now() - parsed.timestamp < CREDENTIALS_CACHE_TTL_MS
    ) {
      return {
        clientId: parsed.clientId,
        appVersion: parsed.appVersion,
        timestamp: parsed.timestamp,
      };
    }
    return null;
  } catch (_error) {
    return null;
  }
};

const saveCachedCredentials = (clientId: string, appVersion: string) => {
  try {
    const cachePath = resolveCredentialsCachePath();
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = {
      clientId,
      appVersion,
      timestamp: Date.now(),
    };
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), "utf8");
    console.log("✓ Saved extracted SoundCloud credentials to cache");
  } catch (error) {
    console.error("Failed to save credentials cache:", error);
  }
};

const getBrowser = async () => {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1200, height: 800 },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1200,800",
      ],
    });
    browserPromise.then((browser) => {
      browser.on("disconnected", () => {
        browserPromise = null;
      });
    });
  }
  return browserPromise;
};

const getV2ClientId = () => {
  if (extractedCredentials?.clientId) return extractedCredentials.clientId;
  const cached = loadCachedCredentials();
  if (cached?.clientId) {
    extractedCredentials = cached;
    return cached.clientId;
  }
  return (
    process.env.SOUNDCLOUD_V2_CLIENT_ID ||
    process.env.SOUNDCLOUD_CLIENT_ID ||
    FALLBACK_CLIENT_ID
  );
};

const getAppVersion = () => {
  if (extractedCredentials?.appVersion) return extractedCredentials.appVersion;
  const cached = loadCachedCredentials();
  if (cached?.appVersion) {
    extractedCredentials = cached;
    return cached.appVersion;
  }
  return process.env.SOUNDCLOUD_APP_VERSION || PLAY_HISTORY_APP_VERSION;
};

const resolveRequestWebCredentials = async (req: NextApiRequest, res: NextApiResponse) => {
  const sessionCredentials = await getRequestSoundCloudWebCredentials(req, res);
  const clientId =
    sessionCredentials?.clientId ||
    getV2ClientId();
  const appVersion =
    sessionCredentials?.appVersion ||
    getAppVersion();
  const appLocale =
    sessionCredentials?.appLocale ||
    PLAY_HISTORY_LOCALE;

  return {
    clientId,
    appVersion,
    appLocale,
  };
};

const normalizePlayHistoryItem = (item: any) => {
  const track =
    item?.track || item?.played_track || item?.item || item?.sound || item;
  if (!track || track.kind !== "track") return null;
  return {
    ...track,
    played_at:
      item?.played_at ||
      item?.playedAt ||
      item?.played_at_utc ||
      item?.playback_timestamp ||
      null,
  };
};

const refreshAccessToken = async (refreshToken: string) => {
  try {
    const refreshed = await refreshSoundCloudTokenValue(refreshToken);

    if (!refreshed) {
      return {
        token: null,
        refreshToken,
        expiresIn: 0,
        invalidGrant: true,
      };
    }

    return {
      token: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresIn: refreshed.expiresIn,
      invalidGrant: false,
    };
  } catch (error: any) {
    console.error("Token refresh failed:", error);
    return null;
  }
};
const fetchPlayHistory = async (
  token: string,
  limit: number,
  webCredentials: {
    clientId: string;
    appVersion: string;
    appLocale: string;
  },
  refreshToken?: string,
) => {
  const clientId = webCredentials.clientId;
  const appVersion = webCredentials.appVersion;
  const params = {
    limit,
    client_id: clientId,
    app_version: appVersion,
    app_locale: webCredentials.appLocale,
    oauth_token: token,
  };
  let response;
  const headers = {
    Authorization: `OAuth ${token}`,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Device-Locale": "en-US",
    "X-Client-Id": clientId,
    Origin: "https://soundcloud.com",
    Referer: "https://soundcloud.com/you/history",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  try {
    response = await axios.get(PLAY_HISTORY_URL, {
      params,
      headers,
      timeout: 10000,
    });
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      // Try with explicit oauth_token parameter first
      try {
        response = await axios.get(PLAY_HISTORY_URL, {
          params: {
            ...params,
            oauth_token: token,
          },
          headers,
          timeout: 10000,
        });
      } catch (retryError: any) {
        // If still 401/403 and we have a refresh token, try refreshing
        if (
          (retryError?.response?.status === 401 ||
            retryError?.response?.status === 403) &&
          refreshToken
        ) {
          const refreshed = await refreshAccessToken(refreshToken);
          if (refreshed?.invalidGrant) {
            throw retryError;
          }
          if (refreshed?.token) {
            // Retry with new token
            const newHeaders = {
              ...headers,
              Authorization: `OAuth ${refreshed.token}`,
              "X-Client-Id": getV2ClientId(),
            };
            response = await axios.get(PLAY_HISTORY_URL, {
              params: {
                ...params,
                oauth_token: refreshed.token,
              },
              headers: newHeaders,
              timeout: 10000,
            });
          } else {
            throw retryError;
          }
        } else {
          throw retryError;
        }
      }
    } else if (status === 404) {
      response = await axios.get(PLAY_HISTORY_URL_LEGACY, {
        params,
        headers,
        timeout: 10000,
      });
    } else {
      throw error;
    }
  }

  const items = response?.data?.collection || [];
  const tracks = items
    .map(normalizePlayHistoryItem)
    .filter((track: any) => track && track.id);
  return { tracks, rawCount: items.length };
};

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const resolveHistoryCookiePath = () => {
  if (process.env[HISTORY_COOKIE_ENV]) {
    return process.env[HISTORY_COOKIE_ENV] as string;
  }
  if (process.env.APPDATA) {
    return path.join(
      process.env.APPDATA,
      "soundcloudy",
      "soundcloud-history-cookies.json",
    );
  }
  return path.join(
    process.cwd(),
    ".soundcloudy",
    "soundcloud-history-cookies.json",
  );
};

const loadHistoryCookies = () => {
  try {
    const cookiePath = resolveHistoryCookiePath();
    if (!fs.existsSync(cookiePath)) return [];
    const raw = fs.readFileSync(cookiePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.cookies)) return [];
    return parsed.cookies;
  } catch (_error) {
    return [];
  }
};

const normalizeSameSite = (value?: string) => {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "lax") return "Lax";
  if (normalized === "strict") return "Strict";
  if (normalized === "none" || normalized === "no_restriction") return "None";
  return undefined;
};

const toPuppeteerCookie = (cookie: any) => {
  if (!cookie?.name || !cookie?.value || !cookie?.domain) return null;
  const normalized: any = {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || "/",
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly),
  };
  if (typeof cookie.expirationDate === "number") {
    normalized.expires = Math.floor(cookie.expirationDate);
  }
  const sameSite = normalizeSameSite(cookie.sameSite);
  if (sameSite) normalized.sameSite = sameSite;
  return normalized;
};

const resolvePlayedAt = (node: any) => {
  if (!node || typeof node !== "object") return null;
  return (
    node.played_at ||
    node.playedAt ||
    node.played_at_utc ||
    node.playedAtUtc ||
    node.playback_timestamp ||
    node.playbackTimestamp ||
    node.playback_time ||
    node.playbackTime ||
    null
  );
};

const resolveTrack = (node: any) => {
  if (!node || typeof node !== "object") return null;
  if (node.kind === "track" && node.id) return node;
  if (node.track && node.track.kind === "track") return node.track;
  if (node.sound && node.sound.kind === "track") return node.sound;
  if (node.entity && node.entity.kind === "track") return node.entity;
  if (node.item && node.item.kind === "track") return node.item;
  return null;
};

const extractTracks = (input: unknown, limit: number) => {
  const results: any[] = [];
  const seen = new Set<number>();
  const visited = new Set<unknown>();

  const pushTrack = (track: any, playedAt?: string | null) => {
    if (!track || track.kind !== "track" || !track.id) return;
    if (seen.has(track.id)) return;
    seen.add(track.id);
    results.push({
      ...track,
      played_at: playedAt || track.played_at || null,
    });
  };

  const walk = (node: any) => {
    if (!node || results.length >= limit) return;
    if (visited.has(node)) return;
    if (Array.isArray(node)) {
      visited.add(node);
      for (const item of node) {
        walk(item);
        if (results.length >= limit) return;
      }
      return;
    }
    if (typeof node !== "object") return;
    visited.add(node);

    const track = resolveTrack(node);
    if (track) {
      const playedAt = resolvePlayedAt(node) || resolvePlayedAt(track);
      pushTrack(track, playedAt);
    }

    for (const value of Object.values(node)) {
      walk(value);
      if (results.length >= limit) return;
    }
  };

  walk(input);
  return results.slice(0, limit);
};

const extractDomTrackUrls = async (page: Page, limit: number) => {
  const urls = await page.evaluate(() => {
    const selectors = [
      ".playHistory .historicalPlays_item a[href]",
      ".historicalPlays_item a[href]",
      "a.soundTitle__title",
      "a.soundTitle__titleLink",
      "a.sound__title",
      "a.sound__titleLink",
      "a.sc-link-primary",
      "a.sc-link-dark",
    ];
    const links = new Set<string>();
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => {
        const anchor = node as HTMLAnchorElement;
        if (anchor?.href) {
          links.add(anchor.href);
        }
      });
    }
    document.querySelectorAll("a[href]").forEach((node) => {
      const anchor = node as HTMLAnchorElement;
      if (!anchor?.href) return;
      if (!/soundcloud\.com\//i.test(anchor.href)) return;
      if (/\/you\//i.test(anchor.href)) return;
      if (/\/settings\//i.test(anchor.href)) return;
      links.add(anchor.href);
    });
    return Array.from(links);
  });

  return urls.slice(0, Math.max(limit * 4, 40));
};

const resolveTracksFromUrls = async (
  urls: string[],
  token: string,
  limit: number,
) => {
  const resolved: any[] = [];
  const seen = new Set<number>();
  for (const url of urls) {
    if (resolved.length >= limit) break;
    try {
      const response = await axios.get("https://api.soundcloud.com/resolve", {
        params: { url },
        headers: {
          Authorization: `OAuth ${token}`,
        },
        timeout: 8000,
      });
      const data = response.data;
      if (data?.kind === "track" && data.id && !seen.has(data.id)) {
        seen.add(data.id);
        resolved.push(data);
      }
    } catch (_error) {
      // Ignore resolve failures for individual URLs.
    }
  }
  return resolved;
};

const extractTracksFromResponses = (
  responses: Array<{ url: string; data: any }>,
  limit: number,
) => {
  const ordered = [...responses].sort((a, b) => {
    const score = (url: string) =>
      /history|play[-_]?history|track_history|listening|activity/i.test(url)
        ? 1
        : 0;
    return score(b.url) - score(a.url);
  });
  for (const entry of ordered) {
    const tracks = extractTracks(entry.data, limit);
    if (tracks.length > 0) return tracks;
  }
  return [];
};

const collectSampleNodes = (input: unknown, limit: number) => {
  const samples: any[] = [];
  const visited = new Set<unknown>();

  const addSample = (node: any, reason: string) => {
    if (!node || typeof node !== "object") return;
    if (samples.length >= limit) return;
    samples.push({
      reason,
      kind: node.kind || null,
      id: node.id || node.track_id || null,
      played_at: resolvePlayedAt(node),
      keys: Object.keys(node).slice(0, 16),
    });
  };

  const walk = (node: any) => {
    if (!node || samples.length >= limit) return;
    if (visited.has(node)) return;
    if (Array.isArray(node)) {
      visited.add(node);
      for (const item of node) {
        walk(item);
        if (samples.length >= limit) return;
      }
      return;
    }
    if (typeof node !== "object") return;
    visited.add(node);

    if (node.track || node.sound || node.entity || node.item) {
      addSample(node, "has-track-ref");
    } else if (node.kind === "track" || node.track_id) {
      addSample(node, "track-like");
    }

    for (const value of Object.values(node)) {
      walk(value);
      if (samples.length >= limit) return;
    }
  };

  walk(input);
  return samples;
};

const getListeningHistoryInternal = async (
  req: NextApiRequest,
  res: NextApiResponse,
  tokenOverride?: string,
  refreshTokenOverride?: string,
) => {
  const token = tokenOverride || req.cookies.soundcloud_token;
  const refreshToken =
    refreshTokenOverride || req.cookies.soundcloud_refresh_token;
  const allowScrape = req.query.scrape === "1";
  const debug = req.query.debug === "1";
  const rawLimit = Array.isArray(req.query.limit)
    ? req.query.limit[0]
    : req.query.limit;
  const parsedLimit = Number(rawLimit);
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 1000)
      : 100;

  if (!token) {
    throw new Error("Not authenticated");
  }

  const requestWebCredentials = await resolveRequestWebCredentials(req, res);

  try {
    const { tracks, rawCount } = await fetchPlayHistory(
      token,
      limit,
      requestWebCredentials,
      refreshToken,
    );
    return {
      items: tracks,
      limit,
      source: "play-history",
      debug: {
        rawCount,
      },
    };
  } catch (error: any) {
    if (!allowScrape) {
      const status = error?.response?.status || 500;
      const details = debug
        ? {
            status,
            data: error?.response?.data || null,
            headers: error?.response?.headers || null,
            message: error?.message || "Unknown error",
            url: PLAY_HISTORY_URL,
            params: {
              limit,
              client_id: requestWebCredentials.clientId,
              app_version: requestWebCredentials.appVersion,
              app_locale: requestWebCredentials.appLocale,
            },
          }
        : undefined;
      const err: any = new Error("Failed to fetch play history.");
      err.status = status;
      err.details = details || { status, message: "Unknown error" };
      throw err;
    }
  }

  const browser = await getBrowser();
  let page: Page | null = null;
  try {
    page = await browser.newPage();
    const jsonResponses: Array<{ url: string; data: any }> = [];
    const responseUrls: string[] = [];
    const fetchUrls: string[] = [];
    let capturedClientId: string | null = null;
    let capturedAppVersion: string | null = null;

    page.on("response", async (response) => {
      try {
        const url = response.url();
        const requestType = response.request().resourceType();
        if (requestType === "xhr" || requestType === "fetch") {
          fetchUrls.push(url);

          // Extract credentials from SoundCloud API requests
          if (
            (url.includes("api-v2.soundcloud.com") ||
              url.includes("api.soundcloud.com")) &&
            !capturedClientId
          ) {
            try {
              const urlObj = new URL(url);
              const clientId = urlObj.searchParams.get("client_id");
              const appVersion = urlObj.searchParams.get("app_version");
              if (clientId && !capturedClientId) {
                capturedClientId = clientId;
              }
              if (appVersion && !capturedAppVersion) {
                capturedAppVersion = appVersion;
              }
            } catch (_urlError) {
              // Ignore URL parsing errors
            }
          }
        }
        const headers = response.headers();
        const contentType = headers["content-type"] || "";
        if (!/json/i.test(contentType)) return;
        if (
          !/soundcloud\.com|api-v2\.soundcloud\.com|api\.soundcloud\.com/i.test(
            url,
          )
        ) {
          return;
        }
        const data = await response.json();
        responseUrls.push(url);
        jsonResponses.push({ url, data });
      } catch (_error) {
        // Ignore response parsing errors.
      }
    });
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const resourceType = request.resourceType();
      if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Authorization: `OAuth ${token}`,
    });

    await page.evaluateOnNewDocument((authToken: string) => {
      try {
        localStorage.setItem("oauth_token", authToken);
      } catch (_error) {
        // ignore localStorage failures
      }
    }, token);

    const savedCookies = loadHistoryCookies()
      .map(toPuppeteerCookie)
      .filter(Boolean);
    if (savedCookies.length > 0) {
      await page.setCookie(...(savedCookies as any[]));
    }

    await page.setCookie({
      name: "oauth_token",
      value: token,
      domain: ".soundcloud.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    });
    await page.setCookie({
      name: "soundcloud_token",
      value: token,
      domain: ".soundcloud.com",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });

    await page.goto(HISTORY_URL, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });

    const acceptCookies = async () => {
      if (!page) return false;
      try {
        const accepted = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll("button"));
          const acceptButton = buttons.find((button) =>
            /accept|agree|allow all/i.test(button.textContent || ""),
          );
          if (acceptButton) {
            (acceptButton as HTMLButtonElement).click();
            return true;
          }
          const oneTrustButton = document.querySelector(
            "#onetrust-accept-btn-handler",
          ) as HTMLButtonElement | null;
          if (oneTrustButton) {
            oneTrustButton.click();
            return true;
          }
          return false;
        });
        if (!accepted) {
          for (const frame of page.frames()) {
            try {
              const frameAccepted = await frame.evaluate(() => {
                const button = document.querySelector(
                  "#onetrust-accept-btn-handler",
                ) as HTMLButtonElement | null;
                if (button) {
                  button.click();
                  return true;
                }
                const buttons = Array.from(document.querySelectorAll("button"));
                const acceptButton = buttons.find((node) =>
                  /accept|agree|allow all/i.test(node.textContent || ""),
                );
                if (acceptButton) {
                  (acceptButton as HTMLButtonElement).click();
                  return true;
                }
                return false;
              });
              if (frameAccepted) {
                return true;
              }
            } catch (_error) {
              // Ignore frame evaluation errors.
            }
          }
        }
        if (accepted) {
          await delay(800);
        }
        return accepted;
      } catch (_error) {
        return false;
      }
    };

    const bodyText = await page.evaluate(
      () => document.body?.innerText?.slice(0, 400) || "",
    );
    if (/Cookies & Tracking|cookie/i.test(bodyText)) {
      const accepted = await acceptCookies();
      if (!accepted) {
        await delay(8000);
      }
      await delay(800);
      await page.reload({
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });
    }

    try {
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 8000 });
    } catch (_error) {
      // Network idle may never settle on this page.
    }

    try {
      await delay(1200);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(1200);
    } catch (_error) {
      // Ignore scroll issues.
    }

    const pageUrl = page.url();
    const pageTitle = await page.title();
    const bodyTextSample = await page.evaluate(
      () => document.body?.innerText?.slice(0, 400) || "",
    );

    try {
      await page.waitForFunction(
        () => Array.isArray((window as any).__sc_hydration),
        { timeout: WAIT_TIMEOUT_MS },
      );
    } catch (_error) {
      // Continue even if hydration is missing.
    }

    const hydration = await page.evaluate(
      () => (window as any).__sc_hydration || [],
    );
    let tracks = extractTracks(hydration, limit);
    const samples = collectSampleNodes(hydration, 6);

    const domTrackUrls = await extractDomTrackUrls(page, limit);
    if (tracks.length === 0 && domTrackUrls.length > 0) {
      tracks = await resolveTracksFromUrls(domTrackUrls, token, limit);
    }
    if (tracks.length === 0 && jsonResponses.length > 0) {
      tracks = extractTracksFromResponses(jsonResponses, limit);
    }

    // Save extracted credentials if found
    if (capturedClientId && capturedAppVersion) {
      saveCachedCredentials(capturedClientId, capturedAppVersion);
      extractedCredentials = {
        clientId: capturedClientId,
        appVersion: capturedAppVersion,
        timestamp: Date.now(),
      };
      await setRequestSoundCloudWebCredentials(req, res, {
        clientId: capturedClientId,
        appVersion: capturedAppVersion,
        appLocale: PLAY_HISTORY_LOCALE,
      });
    }

    const loggedOut = /signin|login|connect|session/.test(pageUrl);
    return {
      items: tracks,
      limit,
      source: "history-page",
      debug: {
        pageUrl,
        pageTitle,
        bodyTextSample,
        cookieCount: savedCookies.length,
        hydrationCount: Array.isArray(hydration) ? hydration.length : 0,
        loggedOut,
        domTrackUrlsCount: domTrackUrls.length,
        domTrackUrlsSample: domTrackUrls.slice(0, 6),
        responseCandidatesCount: jsonResponses.length,
        responseUrlsSample: responseUrls.slice(0, 6),
        fetchUrlsSample: fetchUrls.slice(0, 6),
        samples,
      },
    };
  } finally {
    if (page) await page.close();
  }
};

const getListeningHistory = async (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  try {
    return await getListeningHistoryInternal(req, res);
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Connection closed")) {
      browserPromise = null;
      return await getListeningHistoryInternal(req, res);
    }
    throw error;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    let token = req.cookies.soundcloud_token;
    const allowCache = req.query.cache === "1";
    const forceRefresh = req.query.force === "1";

    if (!token) {
      const auth = await refreshSoundCloudAuth(req, res);
      token = auth?.rawToken;
    }

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Check cache
    if (
      allowCache &&
      !forceRefresh &&
      historyCache &&
      historyCache.token === token &&
      Date.now() - historyCache.timestamp < CACHE_TTL_MS
    ) {
      return res.status(200).json({ ...historyCache.data, cached: true });
    }

    const payload = await getListeningHistoryInternal(req, res, token);

    // Store in cache
    if (token) {
      historyCache = {
        data: payload,
        timestamp: Date.now(),
        token,
      };
    }

    res.status(200).json(payload);
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const details = error?.details;
    res.status(status).json({
      error: error instanceof Error ? error.message : "Unknown error",
      ...(details ? { details } : {}),
    });
  }
}





