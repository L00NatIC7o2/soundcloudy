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
    // Use /tracks/:urn/streams endpoint to get streamable URLs
    const streamsResp = await axios.get(
      `https://api.soundcloud.com/tracks/soundcloud:tracks:${trackId}/streams`,
      { headers: { Authorization: `OAuth ${token}` } },
    );
    const streams = streamsResp.data;

    // Prefer http_mp3_128_url, fallback to hls variants
    const streamUrl =
      streams.http_mp3_128_url ||
      streams.hls_mp3_128_url ||
      streams.preview_mp3_128_url;

    if (!streamUrl) {
      return res
        .status(404)
        .json({ error: "No stream URL available for this track" });
    }

    // Fetch and pipe the audio
    const audioResp = await axios.get(streamUrl, {
      responseType: "stream",
      headers: { Range: req.headers.range },
    });

    res.status(audioResp.status);
    [
      "content-type",
      "content-length",
      "accept-ranges",
      "content-range",
    ].forEach((h) => {
      const v = audioResp.headers[h];
      if (v) res.setHeader(h, v);
    });
    audioResp.data.pipe(res);
  } catch (err: any) {
    console.error(
      "Stream error:",
      err.response?.status,
      err.response?.data || err.message,
    );
    res.status(err.response?.status || 500);
  }
}
