import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { q, offset = 0, limit = 20 } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Query parameter required" });
    }

    // Make sure you're calling the SoundCloud API correctly
    const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(q)}&offset=${offset}&limit=${limit}&client_id=${process.env.SOUNDCLOUD_CLIENT_ID}`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to fetch from SoundCloud",
      });
    }

    const data = await response.json();

    return res.status(200).json({
      collection: data.collection || [],
      hasMore: data.collection?.length === parseInt(limit as string),
    });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
