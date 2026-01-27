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

    // Add the playlist creation date to each track as "added_at"
    const tracksWithAddedDate = (playlistResp.data.tracks || []).map(
      (track: any) => ({
        ...track,
        added_at: playlistResp.data.created_at, // Use playlist creation as fallback
      }),
    );

    res.json({
      tracks: tracksWithAddedDate,
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
