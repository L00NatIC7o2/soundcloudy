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
    // Try to get playlist with track metadata including timestamps
    const playlistResp = await axios.get(
      `https://api-v2.soundcloud.com/playlists/${id}`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: { representation: "full" },
      },
    );

    // Check if tracks have added_at property
    const tracksWithMeta = (playlistResp.data.tracks || []).map(
      (track: any, idx: number) => ({
        ...track,
        // Use track.added_at if available, otherwise playlist last_modified as fallback
        added_at:
          track.added_at ||
          track.added_to_playlist_at ||
          playlistResp.data.last_modified,
        playlist_position: idx,
      }),
    );

    res.json({
      tracks: tracksWithMeta,
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
