import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

// Cache for recently played to avoid hitting SC too hard
const historyCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds (history changes often)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = req.cookies.soundcloud_token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  // 1. Check Memory Cache
  const cached = historyCache.get(token);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    // 2. Fetch from SoundCloud API-V2
    // api-v2 is much more reliable for 'me' history than the public v1
    const response = await axios.get(
      "https://api-v2.soundcloud.com/me/play-history/tracks",
      {
        params: {
          limit: req.query.limit || 20,
          linked_partitioning: 1, // Crucial for getting the 'next_href' for scrolling
        },
        headers: {
          Authorization: `OAuth ${token}`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      },
    );

    // 3. Clean and Transform the Data
    // SC play-history returns a 'collection' where each item is a 'track' object
    const tracks = response.data.collection.map((item: any) => {
      const track = item.track;
      return {
        id: track.id,
        title: track.title,
        artist: track.user?.username || "Unknown Artist",
        artwork_url:
          track.artwork_url?.replace("-large", "-t500x500") ||
          track.user?.avatar_url,
        duration: track.duration,
        permalink_url: track.permalink_url,
        stream_url: track.stream_url,
        played_at: item.played_at, // Specific to history
      };
    });

    const result = {
      items: tracks,
      next_href: response.data.next_href, // Pass this back so your frontend can load more
    };

    historyCache.set(token, { data: result, timestamp: Date.now() });
    return res.status(200).json(result);
  } catch (error: any) {
    console.error(
      "Recently Played Error:",
      error.response?.data || error.message,
    );

    // Fallback: If API-V2 fails, try the standard /me/activities (v1)
    try {
      const fallback = await axios.get(
        "https://api.soundcloud.com/me/activities/tracks",
        {
          headers: { Authorization: `OAuth ${token}` },
        },
      );
      return res.status(200).json({ items: fallback.data.collection || [] });
    } catch {
      return res
        .status(500)
        .json({ error: "Failed to fetch play history", items: [] });
    }
  }
}
