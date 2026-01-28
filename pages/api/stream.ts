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
    // Get track info first
    const trackResponse = await axios.get(
      `https://api-v2.soundcloud.com/tracks/${trackId}`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: { client_id: process.env.SOUNDCLOUD_CLIENT_ID },
      },
    );

    const track = trackResponse.data;

    // Get stream URL
    const streamResponse = await axios.get(
      `https://api-v2.soundcloud.com/tracks/${trackId}/stream`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: { client_id: process.env.SOUNDCLOUD_CLIENT_ID },
      },
    );

    const streamUrl = streamResponse.data.url;

    if (!streamUrl) {
      throw new Error("No stream URL available");
    }

    // Redirect to the stream
    res.redirect(307, streamUrl);
  } catch (error: any) {
    console.error("Stream error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
}
