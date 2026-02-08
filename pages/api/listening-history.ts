import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import axios from "axios";
import puppeteer, { type Browser, type Page } from "puppeteer";

const HISTORY_URL = "https://soundcloud.com/you/history";
const NAV_TIMEOUT_MS = 15000;
const WAIT_TIMEOUT_MS = 5000;
let browserPromise: Promise<Browser> | null = null;
const HISTORY_COOKIE_ENV = "SOUNDCLOUD_HISTORY_COOKIE_PATH";

const getBrowser = async () => {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: false,
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

const getListeningHistoryInternal = async (req: NextApiRequest) => {
  const token = req.cookies.soundcloud_token;
  const rawLimit = Array.isArray(req.query.limit)
    ? req.query.limit[0]
    : req.query.limit;
  const parsedLimit = Number(rawLimit);
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 200)
      : 100;

  if (!token) {
    throw new Error("Not authenticated");
  }

  const browser = await getBrowser();
  let page: Page | null = null;
  try {
    page = await browser.newPage();
    const jsonResponses: Array<{ url: string; data: any }> = [];
    const responseUrls: string[] = [];
    const fetchUrls: string[] = [];
    page.on("response", async (response) => {
      try {
        const url = response.url();
        const requestType = response.request().resourceType();
        if (requestType === "xhr" || requestType === "fetch") {
          fetchUrls.push(url);
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

    await page.goto(HISTORY_URL, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });

    const acceptCookies = async () => {
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
          await page.waitForTimeout(800);
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
        await page.bringToFront();
        await page.waitForTimeout(8000);
      }
      await page.waitForTimeout(800);
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
      await page.waitForTimeout(1200);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1200);
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

const getListeningHistory = async (req: NextApiRequest) => {
  try {
    return await getListeningHistoryInternal(req);
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Connection closed")) {
      browserPromise = null;
      return await getListeningHistoryInternal(req);
    }
    throw error;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const payload = await getListeningHistory(req);
    res.status(200).json(payload);
  } catch (error: any) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
