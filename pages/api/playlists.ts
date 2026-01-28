import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Get user's playlists using OAuth token (this is allowed)
    const response = await axios.get(
      "https://api-v2.soundcloud.com/me/playlists",
      {
        headers: { Authorization: `OAuth ${token}` },
        params: {
          limit: 50,
          client_id: process.env.SOUNDCLOUD_CLIENT_ID,
        },
        timeout: 5000,
      },
    );

    res.json({ playlists: response.data.collection || [] });
  } catch (error: any) {
    console.error("Playlists error:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch playlists",
      playlists: [],
    });
  }
}
