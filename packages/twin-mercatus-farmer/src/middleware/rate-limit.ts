import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '@ode/twin-foundation';

interface TokenBucket {
  timestamps: number[];
}

const WINDOW_MS = 60_000; // 60 seconds
const MAX_REQUESTS = 100;

/**
 * In-memory sliding window rate limiter.
 * Limits to 100 requests per 60 seconds per auth token subject.
 */
export function createRateLimiter() {
  const buckets = new Map<string, TokenBucket>();

  // Clean up old entries periodically (every 5 minutes)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
      if (bucket.timestamps.length === 0) {
        buckets.delete(key);
      }
    }
  }, 300_000);

  // Allow cleanup interval to not keep the process alive
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  function middleware(req: Request, res: Response, next: NextFunction): void {
    const user = (req as AuthenticatedRequest).user;
    // If no user context (e.g., public route), skip rate limiting
    if (!user) {
      next();
      return;
    }

    const key = user.userId;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      buckets.set(key, bucket);
    }

    // Remove timestamps outside the window
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);

    if (bucket.timestamps.length >= MAX_REQUESTS) {
      const oldestInWindow = bucket.timestamps[0];
      const retryAfter = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.status(429).json({
        error: 'TooManyRequests',
        message: `Rate limit exceeded. Max ${MAX_REQUESTS} requests per ${WINDOW_MS / 1000} seconds.`,
        details: [`Retry after ${retryAfter} seconds`],
      });
      return;
    }

    bucket.timestamps.push(now);
    res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS));
    res.setHeader('X-RateLimit-Remaining', String(MAX_REQUESTS - bucket.timestamps.length));
    next();
  }

  function reset(): void {
    buckets.clear();
  }

  return { middleware, reset };
}
