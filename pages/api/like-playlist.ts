import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  refreshSoundCloudAuth,
} from "../../src/server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { playlistId, like } = req.body;
  let auth = await getRequestSoundCloudAuthContext(req, res);

  if (!playlistId) {
    return res.status(400).json({ error: "Missing playlistId" });
  }

  if (!auth) {
    auth = await refreshSoundCloudAuth(req, res);
  }

  if (!auth) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    try {
      if (like) {
        await axios.post(
          `https://api.soundcloud.com/likes/playlists/${playlistId}`,
          {},
          {
            headers: { Authorization: auth.headerValue },
            timeout: 5000,
          },
        );
      } else {
        await axios.delete(
          `https://api.soundcloud.com/likes/playlists/${playlistId}`,
          {
            headers: { Authorization: auth.headerValue },
            timeout: 5000,
          },
        );
      }
    } catch (error: any) {
      if ([401, 403].includes(error.response?.status)) {
        const refreshedAuth = await refreshSoundCloudAuth(req, res, {
          force: true,
        });
        if (!refreshedAuth) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        auth = refreshedAuth;
        if (like) {
          await axios.post(
            `https://api.soundcloud.com/likes/playlists/${playlistId}`,
            {},
            {
              headers: { Authorization: refreshedAuth.headerValue },
              timeout: 5000,
            },
          );
        } else {
          await axios.delete(
            `https://api.soundcloud.com/likes/playlists/${playlistId}`,
            {
              headers: { Authorization: refreshedAuth.headerValue },
              timeout: 5000,
            },
          );
        }
      } else {
        throw error;
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error(
      "Playlist like error:",
      error?.response?.status,
      error?.response?.data,
      error.message,
    );
    let errorMsg = "Failed to update playlist like";
    if (
      error?.response?.data?.errors &&
      Array.isArray(error.response.data.errors)
    ) {
      errorMsg = error.response.data.errors
        .map((e: any) => e.error_message || e)
        .join("; ");
    } else if (typeof error?.response?.data === "string") {
      errorMsg = error.response.data;
    } else if (error?.response?.data?.error) {
      errorMsg = error.response.data.error;
    }
    res.status(error.response?.status || 500).json({
      error: errorMsg,
    });
  }
}

