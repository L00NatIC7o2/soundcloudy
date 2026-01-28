import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { q, offset = "0", limit = "20" } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Query parameter required" });
    }

    const offsetNum = parseInt(offset as string) || 0;
    const limitNum = parseInt(limit as string) || 20;

    const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(q)}&offset=${offsetNum}&limit=${limitNum}&client_id=${process.env.SOUNDCLOUD_CLIENT_ID}`;

    console.log("Searching:", url);

    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        "SoundCloud API error:",
        response.status,
        response.statusText,
      );
      return res.status(response.status).json({
        error: "Failed to fetch from SoundCloud",
        collection: [],
        hasMore: false,
      });
    }

    const data = await response.json();

    return res.status(200).json({
      collection: data.collection || [],
      hasMore: (data.collection?.length || 0) >= limitNum,
    });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({
      error: "Internal server error",
      collection: [],
      hasMore: false,
    });
  }
}
