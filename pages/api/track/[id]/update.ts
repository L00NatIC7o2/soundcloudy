import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  getStoredSoundCloudSession,
  refreshSoundCloudAuth,
} from "../../../../src/server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title || title.length > 200) {
    return res.status(400).json({ error: "Enter a title from 1 to 200 characters." });
  }

  const trackId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!trackId) return res.status(400).json({ error: "Missing track ID." });

  let auth = await getRequestSoundCloudAuthContext(req, res);
  if (!auth) auth = await refreshSoundCloudAuth(req, res);
  if (!auth) return res.status(401).json({ error: "Not authenticated." });

  const session = await getStoredSoundCloudSession(req, res);
  const ownerId = session?.session?.userId || session?.tokens?.userId;
  if (!ownerId) return res.status(401).json({ error: "Could not verify the signed-in user." });

  try {
    const trackResponse = await axios.get(
      `https://api.soundcloud.com/tracks/${encodeURIComponent(trackId)}`,
      { headers: { Authorization: auth.headerValue }, timeout: 10000 },
    );
    if (String(trackResponse.data?.user?.id) !== String(ownerId)) {
      return res.status(403).json({ error: "You can only edit your own tracks." });
    }

    const updated = await axios.put(
      `https://api.soundcloud.com/tracks/${encodeURIComponent(trackId)}`,
      { track: { title } },
      {
        headers: {
          Authorization: auth.headerValue,
          "Content-Type": "application/json",
          Accept: "application/json; charset=utf-8",
        },
        timeout: 15000,
      },
    );
    return res.status(200).json({ track: updated.data });
  } catch (error: any) {
    console.error("Track title update failed:", error?.response?.status, error?.response?.data);
    return res.status(error?.response?.status || 502).json({
      error: error?.response?.data?.message || "Could not update the track title.",
    });
  }
}
