import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId } = req.query;

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({ error: "Missing trackId" });
  }

  try {
    // Get track info
    const trackResponse = await axios.get(
      `https://api-v2.soundcloud.com/tracks/${trackId}`,
      {
        params: { client_id: process.env.SOUNDCLOUD_CLIENT_ID },
        timeout: 5000,
      },
    );

    const track = trackResponse.data;

    // Check if track has transcodings (stream URLs)
    if (track.media && track.media.transcodings) {
      const mp3 = track.media.transcodings.find(
        (t: any) => t.format.mime_type === "audio/mpeg",
      );

      if (mp3) {
        const streamResponse = await axios.get(mp3.url, {
          params: { client_id: process.env.SOUNDCLOUD_CLIENT_ID },
          timeout: 5000,
        });

        if (streamResponse.data.url) {
          return res.redirect(307, streamResponse.data.url);
        }
      }
    }

    // Fallback to direct stream if available
    if (track.stream_url) {
      return res.redirect(
        307,
        `${track.stream_url}?client_id=${process.env.SOUNDCLOUD_CLIENT_ID}`,
      );
    }

    res.status(404).json({ error: "No stream available for this track" });
  } catch (error: any) {
    console.error("Stream error:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Failed to get stream",
    });
  }
}
