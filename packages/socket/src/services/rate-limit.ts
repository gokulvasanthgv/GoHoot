interface Bucket {
  count: number
  resetAt: number
}
const buckets = new Map<string, Bucket>()

export const consumeLimit = (
  key: string,
  maximum: number,
  windowMs: number,
  now = Date.now(),
): boolean => {
  if (buckets.size > 10000) {
    for (const [id, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(id)
      }
    }

    if (buckets.size > 10000 && !buckets.has(key)) {
      return false
    }
  }

  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })

    return true
  }

  if (bucket.count >= maximum) {
    return false
  }

  bucket.count += 1

  return true
}
