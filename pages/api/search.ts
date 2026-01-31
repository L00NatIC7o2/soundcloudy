import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { q, offset = "0", limit = "32" } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!q) {
    return res.status(400).json({ collection: [], hasMore: false });
  }

  if (!token) {
    return res
      .status(401)
      .json({ error: "Not authenticated", collection: [], hasMore: false });
  }

  try {
    const offsetNum = parseInt(offset as string) || 0;
    const limitNum = parseInt(limit as string) || 32;

    console.log("🔍 Searching:", q, "offset:", offsetNum, "limit:", limitNum);
    const response = await axios.get("https://api.soundcloud.com/tracks", {
      headers: {
        Authorization: `OAuth ${token}`,
      },
      params: {
        q,
        offset: offsetNum,
        limit: limitNum,
        linked_partitioning: 1,
      },
      timeout: 10000,
    });

    console.log("✅ Search response status:", response.status);
    console.log(
      "📦 Response data type:",
      Array.isArray(response.data) ? "array" : "object",
    );
    console.log("🔗 Full response keys:", Object.keys(response.data || {}));
    console.log(
      "📝 Collection content:",
      JSON.stringify(response.data?.collection || response.data).substring(
        0,
        200,
      ),
    );
    console.log("🔗 next_href:", response.data?.next_href);

    const collection = Array.isArray(response.data)
      ? response.data
      : response.data?.collection || [];
    const hasMore = Array.isArray(response.data)
      ? collection.length >= limitNum
      : Boolean(response.data?.next_href);

    console.log("📊 Results count:", collection.length, "hasMore:", hasMore);

    return res.json({ collection, hasMore });
  } catch (error: any) {
    console.error(
      "Search error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      return res
        .status(401)
        .json({ error: "Not authenticated", collection: [], hasMore: false });
    }

    return res
      .status(error.response?.status || 500)
      .json({ collection: [], hasMore: false });
  }
}
