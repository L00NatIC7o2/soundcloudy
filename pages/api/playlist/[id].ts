import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing playlist ID" });
  }

  try {
    // Get playlist tracks using OAuth token
    const response = await axios.get(
      `https://api-v2.soundcloud.com/playlists/${id}`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: {
          client_id: process.env.SOUNDCLOUD_CLIENT_ID,
        },
        timeout: 5000,
      },
    );

    res.json({ tracks: response.data.tracks || [] });
  } catch (error: any) {
    console.error("Playlist error:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch playlist",
      tracks: [],
    });
  }
}
