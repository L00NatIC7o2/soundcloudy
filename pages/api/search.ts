import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { q, nextHref, limit, suggest } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!q && !nextHref) {
    return res.status(400).json({
      collection: [],
      hasMore: false,
      nextHref: null,
      artists: [],
      albums: [],
      playlists: [],
    });
  }

  if (!token) {
    return res.status(401).json({
      error: "Not authenticated",
      collection: [],
      hasMore: false,
      nextHref: null,
      artists: [],
      albums: [],
      playlists: [],
    });
  }

  try {
    console.log("🔍 Searching:", q, "using nextHref:", !!nextHref);

    const isSuggest =
      suggest === "1" ||
      suggest === "true" ||
      suggest === "yes" ||
      suggest === "on";
    const requestedLimit = Number(limit);
    const trackLimit = Math.min(
      Number.isFinite(requestedLimit)
        ? Math.max(1, requestedLimit)
        : isSuggest
          ? 8
          : 200,
      200,
    );
    const sectionLimit = isSuggest ? Math.min(trackLimit, 10) : 50;

    let collection = [];
    let responseNextHref = null;
    let artists: any[] = [];
    let albums: any[] = [];
    let playlists: any[] = [];

    if (nextHref && typeof nextHref === "string") {
      console.log("📍 Following next_href pagination...");
      const response = await axios.get(nextHref, {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        timeout: 10000,
      });

      collection = Array.isArray(response.data)
        ? response.data
        : response.data?.collection || [];
      responseNextHref = response.data?.next_href || null;
    } else {
      console.log("🔍 Starting new search for:", q);

      const [trackResponse, userResponse, playlistResponse] = await Promise.all(
        [
          axios.get("https://api.soundcloud.com/tracks", {
            headers: {
              Authorization: `OAuth ${token}`,
            },
            params: {
              q,
              limit: trackLimit,
              linked_partitioning: 1,
              access: "playable",
            },
            timeout: 10000,
          }),
          axios.get("https://api.soundcloud.com/users", {
            headers: {
              Authorization: `OAuth ${token}`,
            },
            params: {
              q,
              limit: sectionLimit,
            },
            timeout: 10000,
          }),
          axios.get("https://api.soundcloud.com/playlists", {
            headers: {
              Authorization: `OAuth ${token}`,
            },
            params: {
              q,
              limit: sectionLimit,
              linked_partitioning: 1,
            },
            timeout: 10000,
          }),
        ],
      );

      collection = Array.isArray(trackResponse.data)
        ? trackResponse.data
        : trackResponse.data?.collection || [];
      responseNextHref = trackResponse.data?.next_href || null;

      const userCollection = Array.isArray(userResponse.data)
        ? userResponse.data
        : userResponse.data?.collection || [];
      artists = [...userCollection].sort(
        (a: any, b: any) => (b.followers_count || 0) - (a.followers_count || 0),
      );

      const setCollection = Array.isArray(playlistResponse.data)
        ? playlistResponse.data
        : playlistResponse.data?.collection || [];
      const sortedSets = [...setCollection].sort((a: any, b: any) => {
        const aScore =
          (a.likes_count || a.favoritings_count || 0) * 10 +
          (a.playback_count || 0);
        const bScore =
          (b.likes_count || b.favoritings_count || 0) * 10 +
          (b.playback_count || 0);
        return bScore - aScore;
      });

      albums = sortedSets.filter(
        (set: any) => set.is_album || set.set_type === "album",
      );
      playlists = sortedSets.filter(
        (set: any) => !(set.is_album || set.set_type === "album"),
      );
    }

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
      artists,
      albums,
      playlists,
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
        artists: [],
        albums: [],
        playlists: [],
      });
    }

    return res.status(error.response?.status || 500).json({
      collection: [],
      hasMore: false,
      nextHref: null,
      artists: [],
      albums: [],
      playlists: [],
    });
  }
}
