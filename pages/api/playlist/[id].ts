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

  try {
    const playlistResp = await axios.get(
      `https://api.soundcloud.com/playlists/${id}?representation=compact`,
      {
        headers: { Authorization: `OAuth ${token}` },
      },
    );

    // Fetch full playlist data to get track metadata with added_at timestamps
    const fullPlaylistResp = await axios.get(
      `https://api.soundcloud.com/playlists/${id}/tracks`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: { limit: 200 },
      },
    );

    res.json({
      tracks: fullPlaylistResp.data,
      playlist: playlistResp.data,
    });
  } catch (error: any) {
    console.error(
      "Playlist detail error:",
      error.response?.data || error.message,
    );
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
}
