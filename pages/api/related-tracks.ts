import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({ error: "Missing trackId" });
  }

  try {
    // Get track info first
    const trackResponse = await axios.get(
      `https://api.soundcloud.com/tracks/${trackId}`,
      {
        headers: token ? { Authorization: `OAuth ${token}` } : {},
        params: {
          client_id: process.env.SOUNDCLOUD_CLIENT_ID,
        },
        timeout: 5000,
      },
    );

    const track = trackResponse.data;

    // Search for similar tracks by same artist or similar tags
    const searchQuery =
      track.user?.username || track.genre || track.title.split(" ")[0];

    const relatedResponse = await axios.get(
      "https://api.soundcloud.com/tracks",
      {
        headers: token ? { Authorization: `OAuth ${token}` } : {},
        params: {
          q: searchQuery,
          limit: 20,
          linked_partitioning: 1,
          client_id: process.env.SOUNDCLOUD_CLIENT_ID,
        },
        timeout: 5000,
      },
    );

    // Filter out the current track
    const related = (
      relatedResponse.data.collection ||
      relatedResponse.data ||
      []
    ).filter((t: any) => t.id !== parseInt(trackId));

    res.json({ collection: related });
  } catch (error: any) {
    console.error("Related tracks error:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch related tracks",
      collection: [],
    });
  }
}
