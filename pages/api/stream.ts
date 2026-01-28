import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!trackId) {
    return res.status(400).json({ error: "Missing trackId" });
  }

  try {
    // Use SoundCloud's public API endpoint that doesn't require auth
    const response = await axios.get(
      `https://api-v2.soundcloud.com/tracks/${trackId}`,
      {
        params: { client_id: "uhlkXHnXoaAxIjoziy18peYV5eSwuMLz" },
      },
    );

    const track = response.data;

    // Check if track has a stream URL
    if (track.media && track.media.transcodings) {
      const m3u8 = track.media.transcodings.find(
        (t: any) => t.format.mime_type === "audio/mpeg",
      );

      if (m3u8) {
        // Get the actual stream URL
        const streamRes = await axios.get(m3u8.url, {
          params: { client_id: "uhlkXHnXoaAxIjoziy18peYV5eSwuMLz" },
        });

        const streamUrl = streamRes.data.url;
        return res.redirect(307, streamUrl);
      }
    }

    // Fallback to HLS stream if available
    if (track.stream_url) {
      return res.redirect(307, track.stream_url);
    }

    res.status(404).json({ error: "No stream available for this track" });
  } catch (error: any) {
    console.error("Stream error:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Failed to get stream",
    });
  }
}
