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

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // v1 API search endpoint
    const response = await axios.get("https://api.soundcloud.com/tracks", {
      headers: {
        Authorization: `OAuth ${token}`,
      },
      params: {
        q,
        limit: 20,
        linked_partitioning: 1,
      },
      timeout: 10000,
    });

    const collection = response.data.collection || response.data || [];
    console.log("Search results:", collection.length);

    res.json({ collection });
  } catch (error: any) {
    console.error("Search error:", error.response?.status, error.message);
    res.status(error.response?.status || 500).json({
      error: "Search failed",
      collection: [],
    });
  }
}
