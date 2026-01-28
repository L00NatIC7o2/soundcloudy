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

    // Get token from cookies (set during OAuth login)
    const token =
      req.cookies.access_token || process.env.SOUNDCLOUD_OAUTH_TOKEN;

    if (!token) {
      return res.status(401).json({ collection: [], hasMore: false });
    }

    console.log("🔍 Searching:", q);

    const response = await axios.get(
      "https://api-v2.soundcloud.com/search/tracks",
      {
        params: {
          q,
          offset: offsetNum,
          limit: limitNum,
        },
        headers: {
          Authorization: `OAuth ${token}`,
        },
        timeout: 10000,
      },
    );

    const collection = response.data.collection || [];
    const hasMore = !!response.data.next_href;

    res.json({ collection, hasMore });
  } catch (error: any) {
    console.error("Search error:", error.message);
    res.status(200).json({ collection: [], hasMore: false });
  }
}
