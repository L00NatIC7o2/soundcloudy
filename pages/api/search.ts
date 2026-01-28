import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { q, offset = 0, limit = 20 } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!q || typeof q !== "string") {
    return res.status(400).json({ error: "Missing search query" });
  }

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const response = await axios.get("https://api.soundcloud.com/tracks", {
      headers: {
        Authorization: `OAuth ${token}`,
      },
      params: {
        q,
        limit: parseInt(limit as string) || 20,
        offset: parseInt(offset as string) || 0,
        linked_partitioning: 1,
      },
      timeout: 10000,
    });

    const collection = response.data.collection || response.data || [];
    const nextHref = response.data.next_href;

    console.log(
      "Search results:",
      collection.length,
      "Next available:",
      !!nextHref,
    );

    res.json({
      collection,
      nextHref,
      hasMore: !!nextHref,
    });
  } catch (error: any) {
    console.error("Search error:", error.response?.status, error.message);
    res.status(error.response?.status || 500).json({
      error: "Search failed",
      collection: [],
    });
  }
}
