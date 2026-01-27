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
      `https://api.soundcloud.com/playlists/${id}`,
      {
        headers: { Authorization: `OAuth ${token}` },
      },
    );

    res.json({ tracks: playlistResp.data.tracks || [] });
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
