/**
 * Simple sliding-window rate limiter using an in-memory Map.
 * Works for single-instance deployments (Vercel serverless: each instance is isolated,
 * so limits apply per-instance — acceptable for abuse prevention on auth endpoints).
 */
interface Window {
  count:     number
  resetAt:   number
}

const store = new Map<string, Window>()

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  store.forEach((win, key) => {
    if (win.resetAt < now) store.delete(key)
  })
}, 5 * 60 * 1000)

interface Options {
  /** Max requests in the window */
  limit:    number
  /** Window duration in seconds */
  windowSec: number
}

interface Result {
  success:   boolean
  remaining: number
  resetAt:   number
}

export function rateLimit(key: string, { limit, windowSec }: Options): Result {
  const now    = Date.now()
  const winMs  = windowSec * 1000
  let win = store.get(key)

  if (!win || win.resetAt < now) {
    win = { count: 0, resetAt: now + winMs }
    store.set(key, win)
  }

  win.count++

  return {
    success:   win.count <= limit,
    remaining: Math.max(0, limit - win.count),
    resetAt:   win.resetAt,
  }
}

/** Extract a stable client identifier from headers (IP or forwarded IP) */
export function getClientId(req: Request): string {
  const forwarded = (req.headers as any).get?.("x-forwarded-for")
  const ip        = forwarded ? forwarded.split(",")[0].trim() : "unknown"
  return ip
}
