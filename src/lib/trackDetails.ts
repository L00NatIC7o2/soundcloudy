type ArtistLike = {
  id?: number;
  username?: string;
  permalink_url?: string;
  avatar_url?: string;
};

type Comment = {
  id: string | number;
  user: {
    username: string;
    permalink_url: string;
    avatar_url: string;
  };
  body: string;
  timestamp: number;
};

type RelatedTrack = {
  id: string | number;
  title: string;
  artwork_url?: string;
  user?: ArtistLike;
  artist?: ArtistLike;
};

export type TrackDetails = {
  id: string | number;
  title: string;
  artwork_url?: string;
  artist?: ArtistLike;
  play_count: number;
  likes_count: number;
  reposts_count: number;
  bio: string;
  comments: Comment[];
  related_tracks: RelatedTrack[];
};

type CacheEntry = {
  data?: TrackDetails;
  promise?: Promise<TrackDetails>;
  error?: string;
  updatedAt: number;
};

const TRACK_DETAILS_TTL_MS = 60 * 1000;
const detailCache = new Map<string | number, CacheEntry>();

const isFresh = (entry?: CacheEntry | null) =>
  Boolean(entry?.data && Date.now() - entry.updatedAt < TRACK_DETAILS_TTL_MS);

const readTrackDetails = async (
  trackId: string | number,
): Promise<TrackDetails> => {
  const response = await fetch(`/api/track/${trackId}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Failed to load track");
  }

  return data;
};

export const getCachedTrackDetails = (trackId: string | number) => {
  const entry = detailCache.get(trackId);
  return isFresh(entry) ? entry?.data ?? null : null;
};

export const fetchTrackDetails = async (trackId: string | number) => {
  const cached = detailCache.get(trackId);
  if (isFresh(cached)) {
    return cached!.data!;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = readTrackDetails(trackId)
    .then((data) => {
      detailCache.set(trackId, {
        data,
        updatedAt: Date.now(),
      });
      return data;
    })
    .catch((error) => {
      detailCache.set(trackId, {
        error: error instanceof Error ? error.message : "Failed to load track",
        updatedAt: Date.now(),
      });
      throw error;
    });

  detailCache.set(trackId, {
    ...cached,
    promise,
    updatedAt: Date.now(),
  });

  return promise;
};

export const prefetchTrackDetails = (trackId?: string | number | null) => {
  if (!trackId) return;
  const cached = detailCache.get(trackId);
  if (isFresh(cached) || cached?.promise) return;

  void fetchTrackDetails(trackId).catch(() => {
    // Keep prefetch failures silent; the panel handles real errors.
  });
};
