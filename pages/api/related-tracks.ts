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

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Get track info
    const trackResponse = await axios.get(
      `https://api.soundcloud.com/tracks/${trackId}`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        timeout: 10000,
      },
    );

    const track = trackResponse.data;

    // Search for related tracks by artist or genre
    const searchQuery =
      track.user?.username || track.genre || track.title.split(" ")[0];

    const relatedResponse = await axios.get(
      "https://api.soundcloud.com/tracks",
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        params: {
          q: searchQuery,
          limit: 20,
          linked_partitioning: 1,
        },
        timeout: 10000,
      },
    );

    // Filter out current track
    const related = (
      relatedResponse.data.collection ||
      relatedResponse.data ||
      []
    )
      .filter((t: any) => t.id !== parseInt(trackId))
      .slice(0, 10); // Limit to 10 related tracks

    console.log("Related tracks found:", related.length);
    res.json({ collection: related });
  } catch (error: any) {
    console.error(
      "Related tracks error:",
      error.response?.status,
      error.message,
    );
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch related tracks",
      collection: [],
    });
  }
}
