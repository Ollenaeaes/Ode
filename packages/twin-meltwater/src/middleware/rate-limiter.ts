import { Request, Response, NextFunction } from 'express';

export interface RateLimitConfig {
  /** Per-minute general limit */
  generalPerMinute?: number;
  /** Per-minute analytics limit */
  analyticsPerMinute?: number;
  /** Per-minute export limit */
  exportPerMinute?: number;
  /** Hourly per-IP limit */
  hourlyPerIp?: number;
  /** Daily document quota */
  dailyDocumentQuota?: number;
}

const DEFAULT_CONFIG: Required<RateLimitConfig> = {
  generalPerMinute: 100,
  analyticsPerMinute: 10,
  exportPerMinute: 20,
  hourlyPerIp: 2000,
  dailyDocumentQuota: 30000,
};

interface BucketEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private config: Required<RateLimitConfig>;
  // Buckets keyed by `${type}:${key}`
  private buckets: Map<string, BucketEntry> = new Map();

  constructor(config: RateLimitConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getBucket(key: string, windowMs: number): BucketEntry {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || now >= existing.resetAt) {
      const entry: BucketEntry = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, entry);
      return entry;
    }

    return existing;
  }

  private check(
    bucketKey: string,
    windowMs: number,
    limit: number
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const bucket = this.getBucket(bucketKey, windowMs);

    if (bucket.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
    }

    bucket.count++;
    return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
  }

  checkGeneral(apiKey: string): { allowed: boolean; remaining: number; resetAt: number } {
    return this.check(`general:${apiKey}`, 60000, this.config.generalPerMinute);
  }

  checkAnalytics(apiKey: string): { allowed: boolean; remaining: number; resetAt: number } {
    return this.check(`analytics:${apiKey}`, 60000, this.config.analyticsPerMinute);
  }

  checkExport(apiKey: string): { allowed: boolean; remaining: number; resetAt: number } {
    return this.check(`export:${apiKey}`, 60000, this.config.exportPerMinute);
  }

  checkHourlyIp(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
    return this.check(`hourly:${ip}`, 3600000, this.config.hourlyPerIp);
  }

  checkDailyQuota(apiKey: string): { allowed: boolean; remaining: number; resetAt: number } {
    return this.check(`daily:${apiKey}`, 86400000, this.config.dailyDocumentQuota);
  }

  /** Reset all counters */
  reset(): void {
    this.buckets.clear();
  }

  getConfig(): Required<RateLimitConfig> {
    return { ...this.config };
  }
}

export function createRateLimitMiddleware(
  limiter: RateLimiter,
  type: 'general' | 'analytics' | 'export' = 'general'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = (req as any).apiKey as string;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Check IP hourly limit
    const ipResult = limiter.checkHourlyIp(ip);
    if (!ipResult.allowed) {
      const retryAfter = Math.ceil((ipResult.resetAt - Date.now()) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.set('X-RateLimit-Limit', String(limiter.getConfig().hourlyPerIp));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', String(Math.ceil(ipResult.resetAt / 1000)));
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Hourly IP rate limit exceeded',
        code: 429,
      });
      return;
    }

    // Check daily document quota
    const dailyResult = limiter.checkDailyQuota(apiKey);
    if (!dailyResult.allowed) {
      const retryAfter = Math.ceil((dailyResult.resetAt - Date.now()) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.set('RateLimit-Day-Remaining', '0');
      res.set('RateLimit-Day-Reset', String(Math.ceil(dailyResult.resetAt / 1000)));
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Daily document quota exceeded',
        code: 429,
      });
      return;
    }

    // Check type-specific per-minute limit
    let result: { allowed: boolean; remaining: number; resetAt: number };
    let limit: number;

    switch (type) {
      case 'analytics':
        result = limiter.checkAnalytics(apiKey);
        limit = limiter.getConfig().analyticsPerMinute;
        break;
      case 'export':
        result = limiter.checkExport(apiKey);
        limit = limiter.getConfig().exportPerMinute;
        break;
      default:
        result = limiter.checkGeneral(apiKey);
        limit = limiter.getConfig().generalPerMinute;
    }

    // Set rate limit headers
    res.set('X-RateLimit-Limit', String(limit));
    res.set('X-RateLimit-Remaining', String(result.remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
    res.set('RateLimit-Day-Remaining', String(dailyResult.remaining));
    res.set('RateLimit-Day-Reset', String(Math.ceil(dailyResult.resetAt / 1000)));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded for ${type} requests`,
        code: 429,
      });
      return;
    }

    next();
  };
}
