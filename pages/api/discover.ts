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
import { getSoundCloudWebClientId } from "../../src/server/soundcloud/webClientId";

const DISCOVER_CACHE_TTL_MS = 15 * 60 * 1000;
const FALLBACK_CLIENT_ID = "BecG5WJDDxYMffAfWcjJleNqrGyJyZhI";
const FALLBACK_APP_VERSION = "1770366292";
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
  Array.isArray(data)
    ? data
    : Array.isArray(data?.collection)
      ? data.collection
      : [];

const normalizeHistoryEntry = (entry: any) => {
  const track = entry?.track || entry?.origin || entry?.item || entry;
  return track?.id
    ? {
        ...track,
        kind: track.kind || "track",
        played_at: entry?.played_at || entry?.created_at || track?.played_at,
      }
    : null;
};

const fetchRecentHistory = async (
  token: string,
  clientId: string,
  appVersion: string | null,
  appLocale: string,
) => {
  const endpoints = [
    "https://api-v2.soundcloud.com/me/play-history/tracks",
    "https://api-v2.soundcloud.com/me/track_history",
    "https://api-v2.soundcloud.com/me/activities",
    "https://api-v2.soundcloud.com/stream",
    "https://api.soundcloud.com/me/activities",
  ];

  for (const endpoint of endpoints) {
    try {
      const isV2 = endpoint.includes("api-v2.soundcloud.com");
      const response = await axios.get(endpoint, {
        params: {
          ...(isV2
            ? {
                client_id: clientId,
                app_version: appVersion || undefined,
                app_locale: appLocale,
                oauth_token: token,
                linked_partitioning: 1,
              }
            : {}),
          limit: 20,
        },
        headers: {
          Authorization: `OAuth ${token}`,
          Accept: "application/json, text/plain, */*",
          ...(isV2 ? { "X-Client-Id": clientId } : {}),
        },
        timeout: 10000,
      });
      const items = getCollection(response.data)
        .map(normalizeHistoryEntry)
        .filter(Boolean);
      if (items.length) return items;
    } catch (error: any) {
      if (![401, 403, 404, 405].includes(error?.response?.status)) {
        console.warn("SoundCloud Discover history fallback failed:", {
          endpoint,
          status: error?.response?.status || null,
          message: error?.message,
        });
      }
    }
  }

  return [];
};

const fetchUserFallbackSections = async (
  token: string,
  userId: string | number | undefined,
) => {
  if (!userId) return [];
  const userEndpoint = `https://api.soundcloud.com/users/${encodeURIComponent(
    String(userId),
  )}`;
  const fallbacks = [
    {
      title: "From your likes",
      url: `${userEndpoint}/likes/tracks`,
      kind: "track",
    },
    {
      title: "Your uploads",
      url: `${userEndpoint}/tracks`,
      kind: "track",
    },
    {
      title: "Your playlists",
      url: `${userEndpoint}/playlists`,
      kind: "playlist",
    },
  ];

  const results = await Promise.all(
    fallbacks.map(async (fallback) => {
      try {
        const response = await axios.get(fallback.url, {
          params: { limit: 10, linked_partitioning: 1, access: "playable" },
          headers: { Authorization: `OAuth ${token}` },
          timeout: 10000,
        });
        const items = getCollection(response.data)
          .map((entry: any) => {
            const item = entry?.track || entry;
            return item?.id
              ? { ...item, kind: item.kind || fallback.kind }
              : null;
          })
          .filter(Boolean);
        return items.length ? { title: fallback.title, items } : null;
      } catch (error: any) {
        console.warn("SoundCloud Discover fallback failed:", {
          source: fallback.title,
          status: error?.response?.status || null,
          message: error?.message,
        });
        return null;
      }
    }),
  );
  return results.filter(Boolean);
};

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
    clientId = await getSoundCloudWebClientId(fallbackClientId);
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

  const items = await fetchRecentHistory(token, clientId, appVersion, appLocale);
  if (items.length) {
    if (!sections.some((section) => /recently played/i.test(section.title))) {
      sections.unshift({ title: "Listening History", items });
    }
  }

  if (!sections.length) {
    sections.push(
      ...(await fetchUserFallbackSections(
        token,
        sessionState?.session?.userId || sessionState?.tokens?.userId,
      )),
    );
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
