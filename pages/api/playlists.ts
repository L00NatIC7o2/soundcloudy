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
    // Get current user info first
    const meResp = await axios.get("https://api.soundcloud.com/me", {
      headers: { Authorization: `OAuth ${token}` },
    });

    const userId = meResp.data.id;

    // Get user's playlists
    const playlistsResp = await axios.get(
      `https://api.soundcloud.com/users/${userId}/playlists`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: { limit: 50 },
      },
    );

    res.json({ playlists: playlistsResp.data });
  } catch (error: any) {
    console.error("Playlists error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
}
