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

  if (!playlistId || !trackId) {
    return res.status(400).json({ error: "Missing playlistId or trackId" });
  }

  try {
    const playlistResponse = await axios.get(
      `https://api.soundcloud.com/playlists/${playlistId}`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: { limit: 200, linked_partitioning: 1 },
        timeout: 10000,
      },
    );

    const playlist = playlistResponse.data;
    const tracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];
    const trackIdNum = Number(trackId);
    const filteredTracks = tracks.filter(
      (track: any) => Number(track?.id) !== trackIdNum,
    );

    await axios.put(
      `https://api.soundcloud.com/playlists/${playlistId}`,
      {
        title: playlist?.title,
        tracks: filteredTracks.map((track: any) => ({ id: track.id })),
      },
      { headers: { Authorization: `OAuth ${token}` } },
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
}
