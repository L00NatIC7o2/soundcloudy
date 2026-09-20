import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  getStoredSoundCloudSession,
  refreshSoundCloudAuth,
  type SoundCloudAuthContext,
} from "../../src/server/auth/soundcloud";

const fetchLikeState = async (
  trackId: string,
  auth: SoundCloudAuthContext,
  currentUserId: number,
) => {
  let response;
  try {
    response = await axios.get(
      `https://api.soundcloud.com/users/${currentUserId}/likes/tracks`,
      {
        headers: {
          Authorization: auth.headerValue,
        },
        params: {
          ids: trackId,
          limit: 10,
        },
        timeout: 5000,
      },
    );
  } catch (error: any) {
    if ([404, 405].includes(error.response?.status)) {
      response = await axios.get("https://api.soundcloud.com/me/likes/tracks", {
        headers: {
          Authorization: auth.headerValue,
        },
        params: {
          ids: trackId,
          limit: 10,
        },
        timeout: 5000,
      });
    } else {
      throw error;
    }
  }

  const data = response.data;
  const collection = Array.isArray(data)
    ? data
    : Array.isArray(data?.collection)
      ? data.collection
      : [];

  const trackIdNum = parseInt(trackId, 10);
  return collection.some((item: any) => {
    const id = item?.track?.id ?? item?.id;
    return id === trackIdNum;
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId } = req.query;
  let auth = await getRequestSoundCloudAuthContext(req, res);
  let sessionState = await getStoredSoundCloudSession(req, res);

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({ error: "Missing trackId" });
  }

  if (!auth) {
    auth = await refreshSoundCloudAuth(req, res);
    if (auth && !sessionState) {
      sessionState = await getStoredSoundCloudSession(req, res);
    }
  }

  if (!auth) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const currentUserId = Number(
    sessionState?.session?.userId || sessionState?.tokens?.userId || 0,
  );

  if (!currentUserId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const isLiked = await fetchLikeState(trackId, auth, currentUserId);
    return res.json({ isLiked });
  } catch (error: any) {
    if ([401, 403].includes(error.response?.status)) {
      try {
        const refreshedAuth = await refreshSoundCloudAuth(req, res, {
          force: true,
        });
        if (refreshedAuth) {
          const isLiked = await fetchLikeState(
            trackId,
            refreshedAuth,
            currentUserId,
          );
          return res.json({ isLiked });
        }
      } catch (refreshError: any) {
        console.error(
          "Check like refresh error:",
          refreshError.response?.data || refreshError.message,
        );
      }
    }

    console.error("Check like error:", error.message);
    return res.json({ isLiked: false });
  }
}
