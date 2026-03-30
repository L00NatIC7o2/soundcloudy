import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  getRequestSoundCloudWebCredentials,
  refreshSoundCloudAuth,
  type SoundCloudAuthContext,
} from "../../../src/server/auth/soundcloud";
import type { TrackDetails } from "../../../src/lib/trackDetails";

type SoundCloudHeaders = {
  Authorization?: string;
};

type TrackApiResponse = TrackDetails;

type CacheEntry = {
  data: TrackApiResponse;
  updatedAt: number;
};

const TRACK_CACHE_TTL_MS = 60 * 1000;
const trackResponseCache = new Map<string, CacheEntry>();

const readCache = (trackId: string) => {
  const cached = trackResponseCache.get(trackId);
  if (!cached) return null;
  if (Date.now() - cached.updatedAt > TRACK_CACHE_TTL_MS) {
    trackResponseCache.delete(trackId);
    return null;
  }
  return cached.data;
};

const writeCache = (trackId: string, data: TrackApiResponse) => {
  trackResponseCache.set(trackId, {
    data,
    updatedAt: Date.now(),
  });
};

const requestWithFallback = async <T>(
  urls: string[],
  auth: SoundCloudAuthContext | null,
  publicClientId: string,
  refreshAuth?: () => Promise<SoundCloudAuthContext | null>,
  params: Record<string, string | number> = {},
) => {
  const errors: any[] = [];
  let activeAuth = auth;
  let didRefresh = false;

  for (const url of urls) {
    const attemptAuthRequest = async (ctx: SoundCloudAuthContext) => {
      const headers: SoundCloudHeaders = { Authorization: ctx.headerValue };
      return axios.get<T>(url, { headers, params, timeout: 10000 });
    };

    if (activeAuth) {
      try {
        return await attemptAuthRequest(activeAuth);
      } catch (error: any) {
        errors.push(error);

        if (
          !didRefresh &&
          refreshAuth &&
          (error?.response?.status === 401 || error?.response?.status === 403)
        ) {
          try {
            const refreshedAuth = await refreshAuth();
            if (refreshedAuth) {
              activeAuth = refreshedAuth;
              didRefresh = true;
              return await attemptAuthRequest(activeAuth);
            }
          } catch (refreshError: any) {
            errors.push(refreshError);
          }
        }

        if (
          error?.response?.status === 401 ||
          error?.response?.status === 403
        ) {
          try {
            return await axios.get<T>(url, {
              params: { ...params, oauth_token: activeAuth.queryValue },
              timeout: 10000,
            });
          } catch (oauthError: any) {
            errors.push(oauthError);
          }
        }
      }
    }

    try {
      return await axios.get<T>(url, {
        params: { ...params, client_id: publicClientId },
        timeout: 10000,
      });
    } catch (publicError: any) {
      errors.push(publicError);
    }
  }

  throw errors[errors.length - 1] || new Error("Failed to load SoundCloud data");
};

const buildArtist = (user: any) => ({
  id: user?.id,
  username: user?.username || "Unknown",
  permalink_url: user?.permalink
    ? `https://soundcloud.com/${user.permalink}`
    : "#",
  avatar_url: user?.avatar_url || "/placeholder.png",
});

const fetchTrackPayload = async (
  trackId: string,
  auth: SoundCloudAuthContext | null,
  publicClientId: string,
  refreshAuth: () => Promise<SoundCloudAuthContext | null>,
): Promise<TrackApiResponse> => {
  const trackRes = await requestWithFallback<any>(
    [
      `https://api-v2.soundcloud.com/tracks/${trackId}`,
      `https://api.soundcloud.com/tracks/${trackId}`,
    ],
    auth,
    publicClientId,
    refreshAuth,
  );
  const track = trackRes.data;

  const [commentsResult, relatedResult] = await Promise.allSettled([
    requestWithFallback<any>(
      [
        `https://api-v2.soundcloud.com/tracks/${trackId}/comments`,
        `https://api.soundcloud.com/tracks/${trackId}/comments`,
      ],
      auth,
      publicClientId,
      refreshAuth,
      { limit: 50 },
    ),
    requestWithFallback<any>(
      [
        `https://api-v2.soundcloud.com/tracks/${trackId}/related`,
        `https://api.soundcloud.com/tracks/${trackId}/related`,
      ],
      auth,
      publicClientId,
      refreshAuth,
      { limit: 8 },
    ),
  ]);

  const comments =
    commentsResult.status === "fulfilled"
      ? (commentsResult.value.data.collection || commentsResult.value.data || []).map(
          (c: any) => ({
            id: c.id,
            user: {
              username: c.user?.username || "Unknown",
              permalink_url: c.user?.permalink
                ? `https://soundcloud.com/${c.user.permalink}`
                : "#",
              avatar_url: c.user?.avatar_url || "/placeholder.png",
            },
            body: c.body,
            timestamp: c.timestamp,
          }),
        )
      : [];

  const related_tracks =
    relatedResult.status === "fulfilled"
      ? (relatedResult.value.data.collection || relatedResult.value.data || []).map(
          (t: any) => ({
            id: t.id,
            title: t.title,
            artist: buildArtist(t.user),
            user: buildArtist(t.user),
            artwork_url: t.artwork_url || "/placeholder.png",
          }),
        )
      : [];

  return {
    id: track.id,
    title: track.title,
    artwork_url: track.artwork_url || "/placeholder.png",
    artist: buildArtist(track.user),
    play_count: track.playback_count || track.play_count || 0,
    likes_count: track.likes_count || track.favoritings_count || 0,
    reposts_count: track.reposts_count || track.reposts || 0,
    bio: track.description || "",
    comments,
    related_tracks,
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;
  const trackId = Array.isArray(id) ? id[0] : id;
  let auth = await getRequestSoundCloudAuthContext(req, res);
  const webCredentials = await getRequestSoundCloudWebCredentials(req, res);
  const publicClientId =
    webCredentials?.clientId ||
    process.env.SOUNDCLOUD_CLIENT_ID ||
    "BecG5WJDDxYMffAfWcjJleNqrGyJyZhI";

  if (!trackId) {
    return res.status(400).json({ error: "Missing track id" });
  }

  const cached = readCache(trackId);
  if (cached) {
    return res.json(cached);
  }

  const refreshAuth = async () => {
    auth = await refreshSoundCloudAuth(req, res);
    return auth;
  };

  try {
    const payload = await fetchTrackPayload(
      trackId,
      auth,
      publicClientId,
      refreshAuth,
    );
    writeCache(trackId, payload);
    return res.json(payload);
  } catch (error: any) {
    console.error("[track-api] Error:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message || "Failed to load track",
    });
  }
}



