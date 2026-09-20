import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  refreshSoundCloudAuth,
  type SoundCloudAuthContext,
} from "../../../src/server/auth/soundcloud";

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
  const { id } = req.query;
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

  try {
    let response;
    try {
      response = await axios.get(`https://api.soundcloud.com/playlists/${id}`, {
        headers: {
          Authorization: auth.headerValue,
        },
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
          response = await axios.get(`https://api.soundcloud.com/playlists/${id}`, {
            headers: {
              Authorization: refreshedAuth.headerValue,
            },
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

    res.json({ tracks: response.data.tracks || [] });
  } catch (error: any) {
    console.error(
      "Playlist error:",
      error.response?.status,
      error.response?.data,
      error.message,
    );

    res.status(error.response?.status || 500).json({
      error: "Failed to fetch playlist",
      tracks: [],
    });
  }
}
