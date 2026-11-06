interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const MAX_CACHE_ENTRIES = 300;
const cache = new Map<string, CacheEntry<unknown>>();

const makeKey = (userId: string | number, key: string) =>
  `${userId}:${key}`;

export const getPersonalDataCache = <T>(
  userId: string | number,
  key: string,
): T | undefined => {
  const cacheKey = makeKey(userId, key);
  const entry = cache.get(cacheKey);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(cacheKey);
    return undefined;
  }
  return entry.value as T;
};

export const setPersonalDataCache = <T>(
  userId: string | number,
  key: string,
  value: T,
  ttlMs: number,
) => {
  const now = Date.now();
  const cacheKey = makeKey(userId, key);
  for (const [cacheKey, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(cacheKey);
    }
  }

  cache.delete(cacheKey);
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }

  cache.set(cacheKey, {
    value,
    expiresAt: now + ttlMs,
  });
};

export const invalidatePersonalDataCache = (userId: string | number) => {
  const prefix = `${userId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
};
