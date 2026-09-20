import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  getStoredSoundCloudSession,
  refreshSoundCloudAuth,
} from "../../src/server/auth/soundcloud";

const normalizeLikedPlaylistItems = (data: any) => {
  const rawItems = Array.isArray(data)
    ? data
    : Array.isArray(data?.collection)
      ? data.collection
      : [];

  return rawItems
    .map((item: any) => item?.playlist || item?.origin || item)
    .filter((item: any) => {
      if (!item || !item.id) return false;
      if (item.kind === "track") return false;
      return Boolean(
        item.kind === "playlist" ||
        item.kind === "album" ||
        item.is_album ||
        item.set_type ||
        Array.isArray(item.tracks),
      );
    });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let auth = await getRequestSoundCloudAuthContext(req, res);
  let sessionState = await getStoredSoundCloudSession(req, res);

  if (!auth) {
    auth = await refreshSoundCloudAuth(req, res);
    if (auth && !sessionState) {
      sessionState = await getStoredSoundCloudSession(req, res);
    }
  }

  if (!auth) {
    return res.status(401).json({ error: "Not authenticated", playlists: [] });
  }

  const currentUserId = Number(
    sessionState?.session?.userId || sessionState?.tokens?.userId || 0,
  );

  if (!currentUserId) {
    console.warn(
      "Likes playlists route missing userId, falling back to /me likes",
    );
  }

  try {
    let response;
    const endpoint = currentUserId
      ? `https://api.soundcloud.com/users/${currentUserId}/likes`
      : "https://api.soundcloud.com/me/likes";

    try {
      response = await axios.get(endpoint, {
        headers: {
          Authorization: auth.headerValue,
        },
        params: {
          limit: 200,
          linked_partitioning: 1,
        },
        timeout: 10000,
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        const refreshedAuth = await refreshSoundCloudAuth(req, res, {
          force: true,
        });
        if (!refreshedAuth) {
          return res.status(401).json({
            error: "Not authenticated",
            playlists: [],
          });
        }
        auth = refreshedAuth;
        response = await axios.get(endpoint, {
          headers: {
            Authorization: refreshedAuth.headerValue,
          },
          params: {
            limit: 200,
            linked_partitioning: 1,
          },
          timeout: 10000,
        });
      } else if ([404, 405].includes(error.response?.status)) {
        response = await axios.get(
          "https://api.soundcloud.com/me/likes/playlists",
          {
            headers: {
              Authorization: auth.headerValue,
            },
            params: {
              limit: 200,
            },
            timeout: 10000,
          },
        );
      } else {
        throw error;
      }
    }

    res.json({ playlists: normalizeLikedPlaylistItems(response.data) });
  } catch (error: any) {
    console.error(
      "Likes playlists error:",
      error.response?.status,
      error.response?.data || error.message,
    );
    res.status(error.response?.status || 500).json({ playlists: [] });
  }
}
