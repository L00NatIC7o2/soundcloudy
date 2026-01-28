import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { q, offset = "0", limit = "20" } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({
        collection: [],
        hasMore: false,
      });
    }

    const offsetNum = parseInt(offset as string) || 0;
    const limitNum = parseInt(limit as string) || 20;

    // Use v1 API endpoint instead of v2
    const url = `https://api.soundcloud.com/tracks?q=${encodeURIComponent(q)}&offset=${offsetNum}&limit=${limitNum}&client_id=${process.env.SOUNDCLOUD_CLIENT_ID}`;

    console.log("🔍 Searching:", q, "offset:", offsetNum);

    const response = await fetch(url);

    if (!response.ok) {
      console.error("❌ SoundCloud API error:", response.status);
      return res.status(200).json({
        collection: [],
        hasMore: false,
      });
    }

    const data = await response.json();

    return res.status(200).json({
      collection: data || [],
      hasMore: (data?.length || 0) >= limitNum,
    });
  } catch (error) {
    console.error("❌ Search error:", error);
    return res.status(200).json({
      collection: [],
      hasMore: false,
    });
  }
}
