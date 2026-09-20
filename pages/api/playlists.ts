import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  getStoredSoundCloudSession,
  refreshSoundCloudAuth,
} from "../../src/server/auth/soundcloud";

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

  console.log("Playlists API - token exists:", !!auth?.rawToken);

  if (!auth) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const currentUserId = Number(
    sessionState?.session?.userId || sessionState?.tokens?.userId || 0,
  );

  if (!currentUserId) {
    return res.status(401).json({ error: "Not authenticated", playlists: [] });
  }

  try {
    let response;
    try {
      response = await axios.get(
        `https://api.soundcloud.com/users/${currentUserId}/playlists`,
        {
          headers: {
            Authorization: auth.headerValue,
          },
          params: {
            limit: 50,
            linked_partitioning: 1,
          },
          timeout: 10000,
        },
      );
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
        sessionState = await getStoredSoundCloudSession(req, res);
        response = await axios.get(
          `https://api.soundcloud.com/users/${currentUserId}/playlists`,
          {
            headers: {
              Authorization: refreshedAuth.headerValue,
            },
            params: {
              limit: 50,
              linked_partitioning: 1,
            },
            timeout: 10000,
          },
        );
      } else {
        throw error;
      }
    }

    console.log("SoundCloud API response:", response.status);
    console.log(
      "Playlists count:",
      response.data.collection?.length || response.data.length || 0,
    );

    const playlists = (response.data.collection || response.data || []).filter(
      (playlist: any) => Number(playlist?.user?.id) === currentUserId,
    );
    res.json({ playlists });
  } catch (error: any) {
    console.error(
      "Playlists error:",
      error.response?.status,
      error.response?.data,
      error.message,
    );

    if (error.response?.status === 401) {
      return res.status(200).json({
        error: "Token expired or invalid",
        playlists: [],
        degraded: true,
      });
    }

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || "Failed to fetch playlists",
      playlists: [],
    });
  }
}
