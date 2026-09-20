import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { requireSoundCloudAccessToken } from "../../src/server/auth/soundcloud";

const historyCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 1000;

const normalizeTrackHistoryItem = (item: any) => {
  const track = item?.track;
  if (!track?.id) return null;

  return {
    ...track,
    kind: track.kind || "track",
    artist:
      track.user?.username || track.publisher_metadata?.artist || "Unknown Artist",
    artwork_url:
      track.artwork_url?.replace("-large", "-t500x500") ||
      track.user?.avatar_url,
    played_at: item.played_at || item.created_at || null,
  };
};

const normalizeActivityEntity = (entity: any, fallbackPlayedAt?: string | null) => {
  if (!entity || typeof entity !== "object") return null;

  if (entity.track) {
    return normalizeActivityEntity(
      {
        ...entity.track,
        played_at:
          entity.played_at ||
          entity.created_at ||
          entity.track.played_at ||
          fallbackPlayedAt ||
          null,
      },
      fallbackPlayedAt,
    );
  }

  if (entity.playlist) {
    return normalizeActivityEntity(
      {
        ...entity.playlist,
        played_at:
          entity.played_at ||
          entity.created_at ||
          entity.playlist.played_at ||
          fallbackPlayedAt ||
          null,
      },
      fallbackPlayedAt,
    );
  }

  if (entity.system_playlist) {
    return normalizeActivityEntity(
      {
        ...entity.system_playlist,
        kind: entity.system_playlist.kind || "system-playlist",
        played_at:
          entity.played_at ||
          entity.created_at ||
          entity.system_playlist.played_at ||
          fallbackPlayedAt ||
          null,
      },
      fallbackPlayedAt,
    );
  }

  if (entity.album) {
    return normalizeActivityEntity(
      {
        ...entity.album,
        kind: entity.album.kind || "playlist",
        is_album: true,
        played_at:
          entity.played_at ||
          entity.created_at ||
          entity.album.played_at ||
          fallbackPlayedAt ||
          null,
      },
      fallbackPlayedAt,
    );
  }

  if (entity.origin) {
    return normalizeActivityEntity(
      {
        ...entity.origin,
        played_at:
          entity.played_at ||
          entity.created_at ||
          entity.origin.played_at ||
          fallbackPlayedAt ||
          null,
      },
      fallbackPlayedAt,
    );
  }

  if (entity.item) {
    return normalizeActivityEntity(
      {
        ...entity.item,
        played_at:
          entity.played_at ||
          entity.created_at ||
          entity.item.played_at ||
          fallbackPlayedAt ||
          null,
      },
      fallbackPlayedAt,
    );
  }

  if (!entity.kind || !entity.id) return null;

  if (entity.kind === "track") {
    return {
      ...entity,
      artist:
        entity.user?.username ||
        entity.publisher_metadata?.artist ||
        "Unknown Artist",
      artwork_url:
        entity.artwork_url?.replace("-large", "-t500x500") ||
        entity.user?.avatar_url,
      played_at: entity.played_at || fallbackPlayedAt || null,
    };
  }

  if (
    entity.kind === "playlist" ||
    entity.kind === "playlist-like" ||
    entity.kind === "system-playlist"
  ) {
    return {
      ...entity,
      artwork_url:
        entity.artwork_url?.replace("-large", "-t500x500") ||
        entity.tracks?.[0]?.artwork_url?.replace?.("-large", "-t500x500") ||
        entity.user?.avatar_url,
      played_at: entity.played_at || fallbackPlayedAt || null,
    };
  }

  return null;
};

const mergeRecentItems = (items: any[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const itemId = Number(item?.id);
    if (!itemId) return false;
    const marker = `${item.kind || "unknown"}:${itemId}:${item.played_at || ""}`;
    if (seen.has(marker)) return false;
    seen.add(marker);
    return true;
  });
};

const getLimit = (req: NextApiRequest) => {
  const raw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(parsed, 50);
};

const getBaseUrl = (req: NextApiRequest) => {
  const protoHeader = req.headers["x-forwarded-proto"];
  const hostHeader = req.headers["x-forwarded-host"];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || "http";
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || req.headers.host;
  return `${proto}://${host}`;
};

const fetchTrackPlayHistory = async (req: NextApiRequest, limit: number) => {
  const baseUrl = getBaseUrl(req);
  const response = await axios.get(
    `${baseUrl}/api/listening-history?limit=${limit}&cache=1&scrape=1`,
    {
      headers: {
        Cookie: req.headers.cookie || "",
      },
      timeout: 20000,
    },
  );

  return {
    items: Array.isArray(response.data?.items)
      ? response.data.items.map((item: any) => normalizeTrackHistoryItem({ track: item, played_at: item?.played_at }))
      : [],
    nextHref: response.data?.next_href || null,
  };
};

const fetchMixedRecentActivity = async (token: string, limit: number) => {
  const candidateUrls = [
    "https://api.soundcloud.com/me/activities",
    "https://api.soundcloud.com/me/activities/all/owners",
    "https://api.soundcloud.com/me/activities/tracks",
  ];

  for (const url of candidateUrls) {
    try {
      const response = await axios.get(url, {
        params: {
          limit,
          linked_partitioning: 1,
        },
        headers: {
          Authorization: `OAuth ${token}`,
        },
        timeout: 10000,
      });

      const collection = Array.isArray(response.data?.collection)
        ? response.data.collection
        : [];

      const items = collection
        .map((item: any) =>
          normalizeActivityEntity(
            item,
            item?.played_at || item?.created_at || item?.updated_at || null,
          ),
        )
        .filter(Boolean);

      if (items.length) {
        return items;
      }
    } catch (_error) {
      // Try the next candidate URL.
    }
  }

  return [];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = await requireSoundCloudAccessToken(req, res);
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const limit = getLimit(req);
  const cached = historyCache.get(token);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    const [trackHistory, mixedActivity] = await Promise.all([
      fetchTrackPlayHistory(req, limit),
      fetchMixedRecentActivity(token, limit),
    ]);

    const mergedItems = mergeRecentItems([
      ...mixedActivity,
      ...trackHistory.items,
    ]).slice(0, limit);

    const result = {
      items: mergedItems,
      tracks: mergedItems.filter((item) => item?.kind === "track"),
      next_href: trackHistory.nextHref,
    };

    historyCache.set(token, { data: result, timestamp: Date.now() });
    return res.status(200).json(result);
  } catch (error: any) {
    console.error(
      "Recently Played Error:",
      error.response?.data || error.message,
      error.response?.status || "",
    );

    return res.status(500).json({
      error: "Failed to fetch recent activity",
      items: [],
      tracks: [],
      next_href: null,
    });
  }
}
