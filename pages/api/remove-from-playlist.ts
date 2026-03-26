import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { requireSoundCloudAccessToken } from "../../src/server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { playlistId, trackId } = req.body;
  const token = await requireSoundCloudAccessToken(req, res);

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
        timeout: 10000,
      },
    );

    const tracks = Array.isArray(playlistResponse.data?.tracks)
      ? playlistResponse.data.tracks
      : [];
    const filteredTracks = tracks.filter(
      (track: any) => Number(track?.id) !== Number(trackId),
    );

    await axios.put(
      `https://api.soundcloud.com/playlists/${playlistId}`,
      {
        playlist: {
          tracks: filteredTracks.map((track: any) => ({
            id: String(track.id),
          })),
        },
      },
      {
        headers: {
          Authorization: `OAuth ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
}

