const cache = new Map<string, { data: any; timestamp: number }>()

export async function cachedFetch(url: string, ttlMs: number = 30000): Promise<any> {
  const now = Date.now()
  const cached = cache.get(url)
  
  if (cached && (now - cached.timestamp) < ttlMs) {
    return cached.data
  }

  const res = await fetch(url)
  const data = await res.json()
  
  cache.set(url, { data, timestamp: now })
  return data
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}
