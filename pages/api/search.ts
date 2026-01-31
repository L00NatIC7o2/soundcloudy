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

    // Try multiple search strategies
    let response;
    let collection = [];
    let hasMore = false;

    // Strategy 1: Standard search with linked_partitioning
    try {
      response = await axios.get("https://api.soundcloud.com/tracks", {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        params: {
          q,
          offset: offsetNum,
          limit: limitNum,
          linked_partitioning: 1,
          filter: "streamable",
          order: "hotness",
        },
        timeout: 10000,
      });

      console.log("✅ Search response status:", response.status);
      console.log(
        "📦 Response data type:",
        Array.isArray(response.data) ? "array" : "object",
      );
      console.log("🔗 Full response keys:", Object.keys(response.data || {}));

      collection = Array.isArray(response.data)
        ? response.data
        : response.data?.collection || [];

      console.log("📊 Strategy 1 results:", collection.length);

      // If empty, try without linked_partitioning
      if (collection.length === 0 && offsetNum === 0) {
        console.log("⚠️ Trying without linked_partitioning...");
        const altResponse = await axios.get(
          "https://api.soundcloud.com/tracks",
          {
            headers: {
              Authorization: `OAuth ${token}`,
            },
            params: {
              q,
              limit: limitNum,
              filter: "streamable",
              order: "hotness",
            },
            timeout: 10000,
          },
        );

        collection = Array.isArray(altResponse.data)
          ? altResponse.data
          : altResponse.data?.collection || [];
        console.log("📊 Alternative strategy results:", collection.length);

        if (collection.length > 0) {
          response = altResponse;
        }
      }

      hasMore = Array.isArray(response.data)
        ? collection.length >= limitNum
        : Boolean(response.data?.next_href);

      console.log(
        "📊 Final results count:",
        collection.length,
        "hasMore:",
        hasMore,
      );

      return res.json({ collection, hasMore });
    } catch (searchError) {
      throw searchError;
    }
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
