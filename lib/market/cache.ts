/**
 * In-memory cache with TTL and in-flight request coalescing.
 *
 * Sits between the provider methods and `finnhubFetch`. The Next.js data
 * cache (via `revalidate`) already persists responses across requests; this
 * layer adds two things it does not:
 *
 * 1. In-flight coalescing: N concurrent requests for the same uncached
 *    resource share one upstream call instead of N. On Finnhub's free tier
 *    (60 calls/min) this is the difference between a stock page costing
 *    3 upstream calls and costing 3 × concurrent-users.
 * 2. Instant hits: a Map lookup avoids the HTTP cache path entirely.
 *
 * Errors are never cached — a failed load is retried on the next request.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MAX_ENTRIES = 500;

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const entry = store.get(key);

  if (entry && entry.expiresAt > Date.now()) {
    return entry.value as T;
  }

  const pending = inflight.get(key);

  if (pending) {
    return pending as Promise<T>;
  }

  const promise = loader().then(
    (value) => {
      if (store.size >= MAX_ENTRIES) {
        evictOldest();
      }

      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      inflight.delete(key);

      return value;
    },
    (error) => {
      inflight.delete(key);
      throw error;
    }
  );

  inflight.set(key, promise);

  return promise;
}

function evictOldest(): void {
  let oldestKey: string | null = null;
  let oldestExpiry = Infinity;

  for (const [key, entry] of store) {
    if (entry.expiresAt < oldestExpiry) {
      oldestExpiry = entry.expiresAt;
      oldestKey = key;
    }
  }

  if (oldestKey !== null) {
    store.delete(oldestKey);
  }
}
