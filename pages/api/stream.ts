import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export const config = { api: { responseLimit: false, bodyParser: false } };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId, token } = req.query as { trackId?: string; token?: string };
  if (!trackId || !token)
    return res.status(400).json({ error: "Missing trackId or token" });

  try {
    // Get streamable URLs from SoundCloud
    const streamsResp = await axios.get(
      `https://api.soundcloud.com/tracks/soundcloud:tracks:${trackId}/streams`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
          Accept: "application/json; charset=utf-8",
        },
      },
    );
    const streams = streamsResp.data;

    console.log("Available streams:", Object.keys(streams));

    // Prefer http_mp3_128_url, fallback to hls variants
    const streamUrl =
      streams.http_mp3_128_url ||
      streams.hls_mp3_128_url ||
      streams.preview_mp3_128_url;

    if (!streamUrl) {
      return res.status(404).json({ error: "No stream URL available" });
    }

    // Return the stream URL to client
    res.status(200).json({ streamUrl });
  } catch (err: any) {
    console.error(
      "Stream error:",
      err.response?.status,
      err.response?.data || err.message,
    );
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.message || err.message,
    });
  }
}
