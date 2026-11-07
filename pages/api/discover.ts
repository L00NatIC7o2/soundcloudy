import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudWebCredentials,
  getStoredSoundCloudSession,
  requireSoundCloudAccessToken,
} from "../../src/server/auth/soundcloud";
import {
  getPersonalDataCache,
  setPersonalDataCache,
} from "../../apps/backend/src/server/cache/personalData";

const DISCOVER_CACHE_TTL_MS = 15 * 60 * 1000;
const FALLBACK_CLIENT_ID = "BecG5WJDDxYMffAfWcjJleNqrGyJyZhI";
const FALLBACK_APP_VERSION = "1770366292";
const CLIENT_ID_TTL_MS = 60 * 60 * 1000;
const SOUNDcloud_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";
let cachedClientId: { value: string; expiresAt: number } | null = null;
let clientIdRequest: Promise<string> | null = null;

const discoverCurrentClientId = async () => {
  if (cachedClientId && cachedClientId.expiresAt > Date.now()) {
    return cachedClientId.value;
  }
  if (clientIdRequest) return clientIdRequest;

  clientIdRequest = (async () => {
    const homepage = await axios.get<string>("https://soundcloud.com", {
      headers: { "User-Agent": SOUNDcloud_USER_AGENT },
      responseType: "text",
      timeout: 15000,
    });
    const assetUrls = [
      ...homepage.data.matchAll(
        /src=["'](https:\/\/a-v2\.sndcdn\.com\/assets\/[^"']+\.js)["']/g,
      ),
    ].map((match) => match[1]);

    for (const assetUrl of assetUrls) {
      try {
        const asset = await axios.get<string>(assetUrl, {
          headers: { "User-Agent": SOUNDcloud_USER_AGENT },
          responseType: "text",
          timeout: 12000,
        });
        const match = asset.data.match(/client_id\s*:\s*["']([^"']+)["']/);
        if (match?.[1]) {
          cachedClientId = {
            value: match[1],
            expiresAt: Date.now() + CLIENT_ID_TTL_MS,
          };
          return match[1];
        }
      } catch {
        // Continue past any stale or unavailable asset bundle.
      }
    }
    throw new Error("Could not find SoundCloud's current web client ID");
  })().finally(() => {
    clientIdRequest = null;
  });

  return clientIdRequest;
};

const fetchPersonalizedV2 = async (
  endpoint: string,
  token: string,
  clientId: string,
  appVersion: string | null,
  appLocale: string,
  limit: number,
) => {
  const params: Record<string, string | number> = {
    client_id: clientId,
    app_locale: appLocale,
    limit,
    linked_partitioning: 1,
    oauth_token: token,
  };
  if (appVersion) params.app_version = appVersion;

  const url = `https://api-v2.soundcloud.com${endpoint}`;
  try {
    return await axios.get(url, {
      params,
      headers: {
        Authorization: `OAuth ${token}`,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Device-Locale": "en-US",
        "X-Client-Id": clientId,
        Origin: "https://soundcloud.com",
        Referer: "https://soundcloud.com/discover",
        Cookie: `oauth_token=${encodeURIComponent(token)}`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
      },
      timeout: 15000,
    });
  } catch (error: any) {
    // Some v2 endpoints accept the OAuth token as a query parameter instead
    // of (or in addition to) the Authorization header.
    if (![401, 403].includes(error.response?.status)) throw error;
    return axios.get(url, {
      params,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Device-Locale": "en-US",
        "X-Client-Id": clientId,
        Origin: "https://soundcloud.com",
        Referer: "https://soundcloud.com/discover",
        Cookie: `oauth_token=${encodeURIComponent(token)}`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
      },
      timeout: 15000,
    });
  }
};

const getCollection = (data: any) =>
  Array.isArray(data?.collection) ? data.collection : [];

const getSafeUpstreamError = (error: any) => {
  const data = error?.response?.data;
  const providerMessage =
    (typeof data === "string" ? data : null) ||
    data?.message ||
    data?.error_description ||
    data?.error ||
    data?.errors?.[0]?.error_message;
  const status = error?.response?.status || null;
  const message = String(
    providerMessage ||
      (status === 403
        ? "SoundCloud denied the request. Its API rejected the signed-in session or client credentials."
        : error?.message || "Request failed"),
  ).slice(0, 240);
  return { status, message };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = await requireSoundCloudAccessToken(req, res);
  if (!token)
    return res.status(401).json({ error: "Not authenticated", sections: [] });

  const sessionState = await getStoredSoundCloudSession(req, res);
  const userId = sessionState?.session?.userId || sessionState?.tokens?.userId;
  const cachedDiscover = userId
    ? getPersonalDataCache<{ sections: any[] }>(userId, "discover")
    : undefined;
  if (cachedDiscover?.sections?.length) return res.status(200).json(cachedDiscover);

  const sections: any[] = [];
  const issues: Array<{ source: string; status: number | null; message: string }> = [];
  const existingWebCredentials = await getRequestSoundCloudWebCredentials(
    req,
    res,
  );
  const fallbackClientId =
    existingWebCredentials?.clientId ||
    process.env.SOUNDCLOUD_V2_CLIENT_ID ||
    process.env.SOUNDCLOUD_CLIENT_ID ||
    FALLBACK_CLIENT_ID;
  let clientId = fallbackClientId;
  try {
    clientId = await discoverCurrentClientId();
  } catch (error: any) {
    console.warn("Could not refresh SoundCloud web client ID:", error.message);
  }
  const appVersion =
    existingWebCredentials?.appVersion ||
    process.env.SOUNDCLOUD_APP_VERSION ||
    FALLBACK_APP_VERSION;
  const appLocale = existingWebCredentials?.appLocale || "en";

  // Fetch the same personalized selection rows the SoundCloud Discover page
  // displays, directly from v2. This keeps the user's auth in the API request
  // and avoids launching a second browser inside Electron.
  try {
    const response = await fetchPersonalizedV2(
      "/mixed-selections",
      token,
      clientId,
      appVersion,
      appLocale,
      10,
    );
    for (const selection of getCollection(response.data)) {
      const items = Array.isArray(selection?.items?.collection)
        ? selection.items.collection
        : Array.isArray(selection?.items)
          ? selection.items
          : [];
      if (!items.length) continue;
      sections.push({
        title: selection.title || selection.name || "For You",
        items,
      });
    }
  } catch (error: any) {
    const details = getSafeUpstreamError(error);
    issues.push({
      source: "mixed-selections",
      ...details,
    });
    console.warn("SoundCloud personalized Discover request failed:", {
      ...details,
    });
  }

  // Recent listening history is useful even when SoundCloud returns no mixed
  // selections. Do not request scrape mode here; it launches Puppeteer when
  // the API history call fails, which can interfere with Electron sign-in.
  try {
    const response = await axios.get(
      "https://api-v2.soundcloud.com/me/play-history/tracks",
      {
        params: {
          client_id: clientId,
          app_version: appVersion,
          app_locale: appLocale,
          oauth_token: token,
          limit: 20,
        },
        headers: {
          Authorization: `OAuth ${token}`,
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Device-Locale": "en-US",
          "X-Client-Id": clientId,
          Origin: "https://soundcloud.com",
          Referer: "https://soundcloud.com/you/history",
          Cookie: `oauth_token=${encodeURIComponent(token)}`,
          "User-Agent": SOUNDcloud_USER_AGENT,
        },
        timeout: 12000,
      },
    );
    const items = getCollection(response.data)
      .map((entry: any) => {
        const track = entry?.track || entry?.item || entry;
        return track?.id
          ? {
              ...track,
              kind: track.kind || "track",
              played_at: entry?.played_at || entry?.created_at || null,
            }
          : null;
      })
      .filter(Boolean);
    if (items.length && !sections.some((section) => section.title === "Recently Played")) {
      sections.unshift({ title: "Recently Played", items });
    }
  } catch (error: any) {
    const details = getSafeUpstreamError(error);
    issues.push({
      source: "play-history",
      ...details,
    });
    console.warn("SoundCloud Discover listening history request failed:", {
      ...details,
    });
  }

  const result = { sections };
  if (userId && sections.length) {
    setPersonalDataCache(userId, "discover", result, DISCOVER_CACHE_TTL_MS);
  }
  if (!sections.length && issues.length) {
    return res.status(200).json({ sections, issues });
  }
  return res.status(200).json(result);
}
