import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { q, offset = "0", limit = "20" } = req.query;

  if (!q) {
    return res.status(400).json({ collection: [], hasMore: false });
  }

  try {
    const offsetNum = parseInt(offset as string) || 0;
    const limitNum = parseInt(limit as string) || 20;

    console.log("🔍 Searching:", q);

    const response = await axios.get("https://api.soundcloud.com/tracks", {
      params: {
        q,
        offset: offsetNum,
        limit: limitNum,
        client_id: process.env.SOUNDCLOUD_CLIENT_ID,
      },
      timeout: 10000,
    });

    const collection = Array.isArray(response.data) ? response.data : [];
    const hasMore = collection.length >= limitNum;

    res.json({ collection, hasMore });
  } catch (error: any) {
    console.error("Search error:", error.message);
    res.status(200).json({ collection: [], hasMore: false });
  }
}
