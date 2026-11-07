import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { requireSoundCloudAccessToken } from "../../src/server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const trackId = String(req.body?.trackId || "").trim();
  if (!/^\d+$/.test(trackId)) {
    return res.status(400).json({ success: false, error: "A valid track ID is required" });
  }

  const token = await requireSoundCloudAccessToken(req, res);

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Track play event (unofficial, may not work)
    const response = await axios.post(
      `https://api.soundcloud.com/tracks/${encodeURIComponent(trackId)}/plays`,
      { client_id: process.env.SOUNDCLOUD_CLIENT_ID },
      {
        headers: { Authorization: `OAuth ${token}` },
        timeout: 8000,
      },
    );

    return res.json({ success: true, status: response.status });
  } catch (error: any) {
    const status = error.response?.status;
    console.warn("SoundCloud play report failed:", {
      trackId,
      status: status || null,
      message: error.message,
    });
    return res.status(502).json({
      success: false,
      note: "SoundCloud did not accept the play report",
      upstreamStatus: status || null,
    });
  }
}

