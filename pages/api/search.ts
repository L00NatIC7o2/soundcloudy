import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { q } = req.query;

  if (!q || typeof q !== "string") {
    return res.status(400).json({ error: "Missing search query" });
  }

  try {
    // Using public SoundCloud API endpoint with client_id
    const response = await axios.get(
      "https://api-v2.soundcloud.com/search/tracks",
      {
        params: {
          q,
          limit: 20,
          client_id: process.env.SOUNDCLOUD_CLIENT_ID,
        },
        timeout: 5000,
      },
    );

    res.json({ collection: response.data.collection || [] });
  } catch (error: any) {
    console.error("Search error:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Search failed",
      collection: [],
    });
  }
}
