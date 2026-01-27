import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export const config = { api: { responseLimit: false, bodyParser: false } };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId } = req.query as { trackId?: string };

  if (!trackId) {
    return res.status(400).json({ error: "Missing trackId" });
  }

  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res
      .status(401)
      .json({ error: "Not authenticated - no token cookie found" });
  }

  try {
    console.log("Getting streams for track:", trackId);

    const streamsResp = await axios.get(
      `https://api.soundcloud.com/tracks/soundcloud:tracks:${trackId}/streams`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
          "User-Agent": "Mozilla/5.0",
        },
        validateStatus: () => true,
      },
    );

    console.log("Streams response status:", streamsResp.status);

    if (streamsResp.status !== 200) {
      console.error("Stream API error:", streamsResp.data);
      return res.status(streamsResp.status).json({
        error: streamsResp.data?.error || "Failed to get streams",
      });
    }

    const streams = streamsResp.data;
    const streamUrl =
      streams.http_mp3_128_url ||
      streams.hls_mp3_128_url ||
      streams.preview_mp3_128_url;

    if (!streamUrl) {
      return res.status(404).json({ error: "No stream URL available" });
    }

    console.log("Got stream URL:", streamUrl);

    // Fetch the actual audio stream WITH the token in the URL
    const audioResp = await axios.get(streamUrl, {
      params: { client_id: process.env.SOUNDCLOUD_CLIENT_ID },
      headers: {
        Authorization: `OAuth ${token}`,
        "User-Agent": "Mozilla/5.0",
      },
      responseType: "stream",
      timeout: 30000,
      validateStatus: () => true,
    });

    console.log("Audio response status:", audioResp.status);

    if (audioResp.status !== 200) {
      console.error("Audio fetch failed:", audioResp.status, audioResp.data);
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
    console.error("Stream error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
