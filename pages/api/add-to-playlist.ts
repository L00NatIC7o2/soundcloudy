import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { playlistId, trackId } = req.body;
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    await axios.post(
      `https://api.soundcloud.com/playlists/${playlistId}/tracks`,
      { tracks: [{ id: trackId }] },
      { headers: { Authorization: `OAuth ${token}` } },
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
}
