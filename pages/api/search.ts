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

    const scoreByRecencyLikes = (track: any, query: string) => {
      const likes =
        Number(track.favoritings_count ?? track.likes_count ?? 0) || 0;
      const createdAt = track.created_at ? Date.parse(track.created_at) : 0;
      const ageMs = createdAt > 0 ? Date.now() - createdAt : 0;
      const ageDays = Math.max(ageMs / (1000 * 60 * 60 * 24), 1);

      // Base score: likes weighted by recency
      let baseScore = (likes + 1) / Math.pow(ageDays, 1.5);

      // Boost if artist name matches query
      const artistName = (track.user?.username || "").toLowerCase();
      const queryLower = query.toLowerCase();
      if (artistName.includes(queryLower) || queryLower.includes(artistName)) {
        baseScore *= 100; // Strong boost for artist name matches
      }

      // Slight boost for track title matches
      const trackTitle = (track.title || "").toLowerCase();
      if (trackTitle.includes(queryLower)) {
        baseScore *= 2;
      }

      return baseScore;
    };

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

      if (collection.length > 1) {
        collection = [...collection].sort(
          (a: any, b: any) =>
            scoreByRecencyLikes(b, q as string) -
            scoreByRecencyLikes(a, q as string),
        );
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
