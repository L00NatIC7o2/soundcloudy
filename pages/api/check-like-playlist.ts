import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  refreshSoundCloudAuth,
  type SoundCloudAuthContext,
} from "../../src/server/auth/soundcloud";

const fetchPlaylistLikeState = async (
  playlistId: string,
  auth: SoundCloudAuthContext,
) => {
  const response = await axios.get(
    "https://api.soundcloud.com/me/likes/playlists",
    {
      headers: {
        Authorization: auth.headerValue,
      },
      params: {
        ids: playlistId,
        limit: 10,
      },
      timeout: 5000,
    },
  );

  const data = response.data;
  const collection = Array.isArray(data)
    ? data
    : Array.isArray(data?.collection)
      ? data.collection
      : [];

  const playlistIdNum = parseInt(playlistId, 10);
  return collection.some((item: any) => {
    const id = item?.playlist?.id ?? item?.id;
    return id === playlistIdNum;
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { playlistId } = req.query;
  let auth = await getRequestSoundCloudAuthContext(req, res);

  if (!playlistId || typeof playlistId !== "string") {
    return res.status(400).json({ error: "Missing playlistId" });
  }

  if (!auth) {
    auth = await refreshSoundCloudAuth(req, res);
  }

  if (!auth) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const isLiked = await fetchPlaylistLikeState(playlistId, auth);
    res.json({ isLiked });
  } catch (error: any) {
    if ([401, 403].includes(error.response?.status)) {
      try {
        const refreshedAuth = await refreshSoundCloudAuth(req, res, {
          force: true,
        });
        if (refreshedAuth) {
          const isLiked = await fetchPlaylistLikeState(playlistId, refreshedAuth);
          return res.json({ isLiked });
        }
      } catch (refreshError: any) {
        console.error(
          "Check playlist like refresh error:",
          refreshError.response?.data || refreshError.message,
        );
      }
    }

    console.error("Check playlist like error:", error.message);
    res.json({ isLiked: false });
  }
}

