import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { q, nextHref } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!q && !nextHref) {
    return res
      .status(400)
      .json({ collection: [], hasMore: false, nextHref: null });
  }

  if (!token) {
    return res.status(401).json({
      error: "Not authenticated",
      collection: [],
      hasMore: false,
      nextHref: null,
    });
  }

  try {
    console.log("🔍 Searching:", q, "using nextHref:", !!nextHref);

    // Try multiple search strategies
    let response;
    let collection = [];
    let responseNextHref = null;

    // If nextHref provided, use it directly
    if (nextHref && typeof nextHref === "string") {
      console.log("📍 Following next_href pagination...");
      response = await axios.get(nextHref, {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        timeout: 10000,
      });
    } else {
      // Initial search
      console.log("🔍 Starting new search for:", q);
      response = await axios.get("https://api.soundcloud.com/tracks", {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        params: {
          q,
          limit: 200,
          linked_partitioning: 1,
          access: "playable",
        },
        timeout: 10000,
      });
    }

    collection = Array.isArray(response.data)
      ? response.data
      : response.data?.collection || [];
    responseNextHref = response.data?.next_href || null;

    console.log(
      "✅ Results:",
      collection.length,
      "hasMore:",
      !!responseNextHref,
    );
    if (collection.length > 1 && q) {
      const scoreByRecencyLikes = (track: any, query: string) => {
        const createdAt = track.created_at ? Date.parse(track.created_at) : 0;
        const ageMs = createdAt > 0 ? Date.now() - createdAt : 0;

        // Primary: newest first
        let baseScore = -ageMs;

        // Boost if artist name matches query
        const artistName = (track.user?.username || "").toLowerCase();
        const queryLower = query.toLowerCase();
        if (
          artistName.includes(queryLower) ||
          queryLower.includes(artistName)
        ) {
          baseScore += 1e15;
        }

        // Secondary: likes as tiebreaker
        const likes =
          Number(track.favoritings_count ?? track.likes_count ?? 0) || 0;
        baseScore += likes;

        return baseScore;
      };

      collection = [...collection].sort(
        (a: any, b: any) =>
          scoreByRecencyLikes(b, q as string) -
          scoreByRecencyLikes(a, q as string),
      );
    }

    return res.json({
      collection,
      hasMore: !!responseNextHref,
      nextHref: responseNextHref,
    });
  } catch (error: any) {
    console.error(
      "Search error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Not authenticated",
        collection: [],
        hasMore: false,
        nextHref: null,
      });
    }

    return res.status(error.response?.status || 500).json({
      collection: [],
      hasMore: false,
      nextHref: null,
    });
  }
}
