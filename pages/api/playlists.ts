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
    // Get current user info
    const meResp = await axios.get("https://api.soundcloud.com/me", {
      headers: { Authorization: `OAuth ${token}` },
    });

    const userId = meResp.data.id;

    // Get user's playlists
    const playlistsResp = await axios.get(
      `https://api.soundcloud.com/users/${userId}/playlists`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: { limit: 200 },
      },
    );

    // Sort by most recently modified (most recently played)
    const sorted = (playlistsResp.data || [])
      .sort((a: any, b: any) => {
        const dateA = new Date(a.modified_at || a.created_at || 0).getTime();
        const dateB = new Date(b.modified_at || b.created_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);

    res.json({ playlists: sorted });
  } catch (error: any) {
    console.error("Playlists error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
}
