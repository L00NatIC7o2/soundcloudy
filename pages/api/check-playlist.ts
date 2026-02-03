import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { playlistId, trackId } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!playlistId || !trackId) {
    return res.status(400).json({ error: "Missing playlistId or trackId" });
  }

  try {
    const response = await axios.get(
      `https://api.soundcloud.com/playlists/${playlistId}/tracks`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        params: {
          limit: 200,
          linked_partitioning: 1,
        },
        timeout: 10000,
      },
    );

    const tracks = response.data.collection || response.data || [];
    const trackIdNum = parseInt(trackId as string);

    const isInPlaylist = tracks.some((item: any) => {
      const track = item?.track || item;
      return track?.id === trackIdNum;
    });

    res.json({ isInPlaylist });
  } catch (error: any) {
    console.error(
      "Check playlist error:",
      error.response?.status,
      error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Token expired or invalid",
        isInPlaylist: false,
      });
    }

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || "Failed to check playlist",
      isInPlaylist: false,
    });
  }
}
