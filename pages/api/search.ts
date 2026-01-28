import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { q } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!q || typeof q !== "string") {
    return res.status(400).json({ error: "Missing search query" });
  }

  try {
    const response = await axios.get("https://api.soundcloud.com/tracks", {
      headers: token ? { Authorization: `OAuth ${token}` } : {},
      params: {
        q,
        limit: 20,
        linked_partitioning: 1,
        client_id: process.env.SOUNDCLOUD_CLIENT_ID,
      },
      timeout: 5000,
    });

    res.json({ collection: response.data.collection || response.data || [] });
  } catch (error: any) {
    console.error("Search error:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Search failed",
      collection: [],
    });
  }
}
