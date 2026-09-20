import type { NextApiRequest, NextApiResponse } from "next";
import axios, { type AxiosResponse } from "axios";
import {
  getRequestSoundCloudAuthContext,
  getStoredSoundCloudSession,
  refreshSoundCloudAuth,
} from "../../src/server/auth/soundcloud";

type MembershipMap = Record<number, number[]>;

interface SoundCloudCollectionResponse<T = any> {
  collection?: T[];
  next_href?: string | null;
}

const CACHE_TTL_MS = 60_000;
const snapshotCache = new Map<
  string,
  { expiresAt: number; memberships: MembershipMap }
>();

const fetchPaginatedCollection = async (
  url: string,
  authHeader: string,
  limit = 200,
) => {
  const collection: any[] = [];
  let nextUrl: string | null = url;
  let isFirstRequest = true;

  while (nextUrl) {
    const response: AxiosResponse<SoundCloudCollectionResponse> =
      await axios.get(nextUrl, {
        headers: { Authorization: authHeader },
        params: isFirstRequest ? { limit, linked_partitioning: 1 } : undefined,
        timeout: 10000,
      });

    collection.push(...(response.data?.collection || []));
    nextUrl = response.data?.next_href || null;
    isFirstRequest = false;
  }

  return collection;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let auth = await getRequestSoundCloudAuthContext(req, res);
  let sessionState = await getStoredSoundCloudSession(req, res);

  if (!auth) {
    auth = await refreshSoundCloudAuth(req, res);
    if (auth && !sessionState) {
      sessionState = await getStoredSoundCloudSession(req, res);
    }
  }

  if (!auth) {
    return res
      .status(401)
      .json({ error: "Not authenticated", memberships: {} });
  }

  const currentUserId = Number(
    sessionState?.session?.userId || sessionState?.tokens?.userId || 0,
  );

  if (!currentUserId) {
    return res
      .status(401)
      .json({ error: "Not authenticated", memberships: {} });
  }

  const cacheKey = auth.rawToken.slice(0, 24);
  const cached = snapshotCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ memberships: cached.memberships });
  }

  try {
    const playlists = await fetchPaginatedCollection(
      `https://api.soundcloud.com/users/${currentUserId}/playlists`,
      auth.headerValue,
      100,
    );
    const ownedPlaylists = playlists.filter(
      (playlist: any) => Number(playlist?.user?.id) === currentUserId,
    );

    const memberships: MembershipMap = {};

    for (const playlist of ownedPlaylists) {
      try {
        const tracks = await fetchPaginatedCollection(
          `https://api.soundcloud.com/playlists/${playlist.id}/tracks`,
          auth.headerValue,
          200,
        );
        for (const item of tracks) {
          const track = item?.track || item;
          const trackId = Number(track?.id);
          if (!Number.isFinite(trackId) || trackId <= 0) continue;
          if (!memberships[trackId]) {
            memberships[trackId] = [];
          }
          if (!memberships[trackId].includes(playlist.id)) {
            memberships[trackId].push(playlist.id);
          }
        }
      } catch (error) {
        console.warn(`Could not preload playlist ${playlist.id}`);
      }
    }

    snapshotCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      memberships,
    });

    return res.json({ memberships });
  } catch (error: any) {
    console.error(
      "Owned playlist membership preload error:",
      error.response?.status,
      error.message,
    );
    return res.status(error.response?.status || 500).json({
      error:
        error.response?.data?.message ||
        "Failed to preload playlist memberships",
      memberships: {},
    });
  }
}
