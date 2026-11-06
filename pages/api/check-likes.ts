import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  getStoredSoundCloudSession,
} from "../../src/server/auth/soundcloud";

type LikeStateCache = Map<string, { isLiked: boolean; expiresAt: number }>;

const CACHE_TTL_MS = 15_000;
const likeStateCache = new Map<string, LikeStateCache>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const rawTrackIds =
    typeof req.query.trackIds === "string" ? req.query.trackIds : "";
  const trackIds = Array.from(
    new Set(
      rawTrackIds
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((id) => Number.isSafeInteger(id) && id > 0),
    ),
  ).slice(0, 50);

  if (!trackIds.length) {
    return res.status(400).json({ error: "Missing trackIds", likes: {} });
  }

  const auth = await getRequestSoundCloudAuthContext(req, res);
  const sessionState = await getStoredSoundCloudSession(req, res);
  const currentUserId = Number(
    sessionState?.session?.userId || sessionState?.tokens?.userId || 0,
  );

  if (!auth || !currentUserId) {
    return res.status(401).json({ error: "Not authenticated", likes: {} });
  }

  const cacheKey = auth.rawToken.slice(0, 24);
  let userCache = likeStateCache.get(cacheKey);
  if (!userCache) {
    userCache = new Map();
    likeStateCache.set(cacheKey, userCache);
  }

  const now = Date.now();
  const likes: Record<number, boolean> = {};
  const uncachedTrackIds: number[] = [];

  for (const [trackId, cached] of userCache) {
    if (cached.expiresAt <= now) {
      userCache.delete(trackId);
    }
  }

  for (const trackId of trackIds) {
    const cached = userCache.get(String(trackId));
    if (cached && cached.expiresAt > now) {
      likes[trackId] = cached.isLiked;
    } else {
      userCache.delete(String(trackId));
      uncachedTrackIds.push(trackId);
    }
  }

  if (!uncachedTrackIds.length) {
    return res.json({ likes });
  }

  try {
    const response = await axios.get(
      `https://api.soundcloud.com/users/${currentUserId}/likes/tracks`,
      {
        headers: { Authorization: auth.headerValue },
        params: {
          ids: uncachedTrackIds.join(","),
          limit: uncachedTrackIds.length,
        },
        timeout: 5000,
      },
    );

    const collection = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.collection)
        ? response.data.collection
        : [];
    const likedTrackIds = new Set<number>();

    for (const item of collection) {
      const id = Number(item?.track?.id ?? item?.id);
      if (Number.isSafeInteger(id) && id > 0) {
        likedTrackIds.add(id);
      }
    }

    const expiresAt = Date.now() + CACHE_TTL_MS;
    for (const trackId of uncachedTrackIds) {
      const isLiked = likedTrackIds.has(trackId);
      likes[trackId] = isLiked;
      userCache.set(String(trackId), { isLiked, expiresAt });
    }

    return res.json({ likes });
  } catch (error: any) {
    console.error(
      "Batch check likes error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    if (error.response?.status === 429) {
      const retryAfter = error.response.headers?.["retry-after"];
      if (retryAfter) {
        res.setHeader("Retry-After", retryAfter);
      }
    }

    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || "Failed to check track likes",
      likes: {},
    });
  }
}
