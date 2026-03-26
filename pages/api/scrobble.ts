import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { requireSoundCloudAccessToken } from "../../src/server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId } = req.body;
  const token = await requireSoundCloudAccessToken(req, res);

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Track play event (unofficial, may not work)
    await axios.post(
      `https://api.soundcloud.com/tracks/${trackId}/plays`,
      { client_id: process.env.SOUNDCLOUD_CLIENT_ID },
      { headers: { Authorization: `OAuth ${token}` } },
    );

    res.json({ success: true });
  } catch (error: any) {
    // Silently fail if endpoint unavailable
    console.log("Scrobble attempt:", error.message);
    res.json({ success: false, note: "SoundCloud scrobble unavailable" });
  }
}

