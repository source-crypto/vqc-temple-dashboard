// This is a simple in-memory cache. In a production environment with multiple
// service replicas, a distributed cache like Redis would be used to ensure
// cache consistency across all instances.
interface CacheEntry<T> {
  data: T;
  expires: number;
}

const cache = new Map<string, CacheEntry<any>>();

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  const expires = Date.now() + ttlMs;
  cache.set(key, { data, expires });
}

export function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

export function invalidateCache(key: string | RegExp): void {
  if (typeof key === 'string') {
    cache.delete(key);
  } else {
    for (const k of cache.keys()) {
      if (key.test(k)) {
        cache.delete(k);
      }
    }
  }
}

export function clearCache(): void {
  cache.clear();
}
