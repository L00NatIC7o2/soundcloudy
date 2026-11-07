import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  getStoredSoundCloudSession,
  refreshSoundCloudAuth,
  type SoundCloudAuthContext,
} from "../../../src/server/auth/soundcloud";
import {
  getPersonalDataCache,
  setPersonalDataCache,
} from "../../../apps/backend/src/server/cache/personalData";

const PERSONAL_CACHE_TTL_MS = 5 * 60 * 1000;

const fetchCurrentUser = async (auth: SoundCloudAuthContext) => {
  return await axios.get("https://api.soundcloud.com/me", {
    headers: {
      Authorization: auth.headerValue,
    },
    timeout: 10000,
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id, kind, urn } = req.query;
  let auth = await getRequestSoundCloudAuthContext(req, res);

  if (!auth) {
    auth = await refreshSoundCloudAuth(req, res);
  }

  if (!auth) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing playlist ID" });
  }

  const resourceKind = Array.isArray(kind) ? kind[0] : kind;
  const systemPlaylistUrn = Array.isArray(urn) ? urn[0] : urn;
  const isSystemPlaylist =
    resourceKind === "system-playlist" ||
    id.startsWith("soundcloud:system-playlists:") ||
    Boolean(systemPlaylistUrn?.startsWith("soundcloud:system-playlists:"));
  const providedUrn = systemPlaylistUrn || id;
  const resourceId = isSystemPlaylist
    ? providedUrn
    : providedUrn.startsWith("soundcloud:playlists:")
      ? providedUrn
      : `soundcloud:playlists:${providedUrn}`;

  const sessionState = await getStoredSoundCloudSession(req, res);
  const currentUserId =
    sessionState?.session?.userId || sessionState?.tokens?.userId;
  const cacheKey = `${isSystemPlaylist ? "system-playlist" : "playlist"}:${resourceId}`;
  const cachedPlaylist = currentUserId
    ? getPersonalDataCache<{ tracks: any[] }>(currentUserId, cacheKey)
    : undefined;
  if (cachedPlaylist) {
    return res.json(cachedPlaylist);
  }

  try {
    let response;
    const playlistUrl = isSystemPlaylist
      ? `https://api.soundcloud.com/system-playlists/${encodeURIComponent(resourceId)}`
      : `https://api.soundcloud.com/playlists/${encodeURIComponent(resourceId)}`;
    try {
      response = await axios.get(playlistUrl, {
        headers: {
          Authorization: auth.headerValue,
        },
        params: isSystemPlaylist ? { access: "playable,preview" } : undefined,
        timeout: 10000,
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        try {
          await fetchCurrentUser(auth);
          return res.status(200).json({
            tracks: [],
            inaccessible: true,
          });
        } catch (meError: any) {
          if (meError.response?.status !== 401) {
            throw meError;
          }
        }

        const refreshedAuth = await refreshSoundCloudAuth(req, res, {
          force: true,
        });
        if (!refreshedAuth) {
          return res.status(401).json({ error: "Not authenticated", tracks: [] });
        }
        auth = refreshedAuth;
        try {
          response = await axios.get(playlistUrl, {
            headers: {
              Authorization: refreshedAuth.headerValue,
            },
            params: isSystemPlaylist ? { access: "playable,preview" } : undefined,
            timeout: 10000,
          });
        } catch (retryError: any) {
          if (retryError.response?.status === 401) {
            try {
              await fetchCurrentUser(refreshedAuth);
              return res.status(200).json({
                tracks: [],
                inaccessible: true,
              });
            } catch {
              return res.status(401).json({
                error: "Not authenticated",
                tracks: [],
              });
            }
          }
          throw retryError;
        }
      } else {
        throw error;
      }
    }

    const result = {
      tracks: Array.isArray(response.data?.tracks)
        ? response.data.tracks
        : Array.isArray(response.data?.collection)
          ? response.data.collection
          : [],
    };
    if (currentUserId) {
      setPersonalDataCache(
        currentUserId,
        cacheKey,
        result,
        PERSONAL_CACHE_TTL_MS,
      );
    }
    res.json(result);
  } catch (error: any) {
    console.error(
      "Playlist error:",
      error.response?.status,
      error.response?.data,
      error.message,
      { resourceType: isSystemPlaylist ? "system-playlist" : "playlist", resourceId },
    );

    res.status(error.response?.status || 500).json({
      error: "Failed to fetch playlist",
      tracks: [],
      resourceType: isSystemPlaylist ? "system-playlist" : "playlist",
      resourceUrn: resourceId,
    });
  }
}
