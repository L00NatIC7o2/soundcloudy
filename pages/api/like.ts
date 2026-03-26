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

  const { trackId, like } = req.body;
  let auth = await getRequestSoundCloudAuthContext(req, res);

  if (!auth) {
    auth = await refreshSoundCloudAuth(req, res);
  }

  if (!auth) {
    console.warn("/api/like called without token cookie");
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!trackId) {
    return res.status(400).json({ error: "Missing trackId" });
  }

  try {
    if (like) {
      await axios.post(
        `https://api.soundcloud.com/likes/tracks/${trackId}`,
        {},
        {
          headers: { Authorization: auth.headerValue },
          timeout: 5000,
        },
      );
    } else {
      await axios.delete(`https://api.soundcloud.com/likes/tracks/${trackId}`, {
        headers: { Authorization: auth.headerValue },
        timeout: 5000,
      });
    }
    return res.json({ success: true });
  } catch (error: any) {
    console.error(
      "Like error:",
      error?.response?.status,
      error?.response?.data,
      error.message,
    );

    let errorMsg = "Failed to update like";
    if (error?.response?.status === 401) errorMsg = "Not authenticated";
    if (error?.response?.status === 403) errorMsg = "Track not playable or forbidden";
    return res.status(error?.response?.status || 500).json({ error: errorMsg });
  }
}
