import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export const config = { api: { responseLimit: false, bodyParser: false } };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId } = req.query as { trackId?: string };
  const token = req.cookies.soundcloud_token;
  if (!trackId) return res.status(400).json({ error: "Missing trackId" });
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const streamsResp = await axios.get(
      `https://api.soundcloud.com/tracks/soundcloud:tracks:${trackId}/streams`,
      {
        headers: { Authorization: `OAuth ${token}` },
        validateStatus: () => true,
      },
    );
    if (streamsResp.status !== 200) {
      return res
        .status(streamsResp.status)
        .json({ error: "Failed to get streams" });
    }

    const streams = streamsResp.data;
    const streamUrl =
      streams.http_mp3_128_url ||
      streams.hls_mp3_128_url ||
      streams.preview_mp3_128_url;
    if (!streamUrl)
      return res.status(404).json({ error: "No stream URL available" });

    // Fetch audio without auth; these URLs are pre-signed
    let audioResp = await axios.get(streamUrl, {
      responseType: "stream",
      headers: { "User-Agent": "Mozilla/5.0" },
      validateStatus: () => true,
    });

    // Fallback: retry with OAuth header if first attempt failed
    if (audioResp.status === 401) {
      audioResp = await axios.get(streamUrl, {
        responseType: "stream",
        headers: {
          "User-Agent": "Mozilla/5.0",
          Authorization: `OAuth ${token}`,
        },
        validateStatus: () => true,
      });
    }

    if (audioResp.status !== 200) {
      return res
        .status(audioResp.status)
        .json({ error: "Failed to fetch audio" });
    }

    res.setHeader(
      "Content-Type",
      audioResp.headers["content-type"] || "audio/mpeg",
    );
    res.setHeader("Accept-Ranges", "bytes");
    if (audioResp.headers["content-length"]) {
      res.setHeader("Content-Length", audioResp.headers["content-length"]);
    }
    audioResp.data.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
