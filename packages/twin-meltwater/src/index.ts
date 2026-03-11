import express from 'express';
import { createDatabase, isDatabaseSeeded } from './db.js';
import { seedDatabase, type SeedOptions } from './seed.js';
import { createAuthMiddleware, type AuthOptions } from './middleware/auth.js';
import { RateLimiter, createRateLimitMiddleware, type RateLimitConfig } from './middleware/rate-limiter.js';
import { createSearchRouter } from './routes/search.js';
import { createAnalyticsRouter } from './routes/analytics.js';
import { createStreamsRouter } from './routes/streams.js';
import { createExportsRouter, type ExportRouterOptions } from './routes/exports.js';
import type Database from 'better-sqlite3';

export interface AppOptions {
  /** Path to SQLite database file, or ':memory:' for in-memory */
  dbPath?: string;
  /** Auth config */
  auth?: AuthOptions;
  /** Rate limit config */
  rateLimit?: RateLimitConfig;
  /** Seed options */
  seed?: SeedOptions | false;
  /** Export options */
  export?: ExportRouterOptions;
}

export interface MeltwaterApp {
  app: express.Express;
  db: Database.Database;
  rateLimiter: RateLimiter;
  /** Cleanup function to stop intervals */
  close: () => void;
}

export function createApp(options: AppOptions = {}): MeltwaterApp {
  const {
    dbPath = ':memory:',
    auth = {},
    rateLimit = {},
    seed: seedOpts,
    export: exportOpts = {},
  } = options;

  const app = express();
  const db = createDatabase(dbPath);
  const rateLimiter = new RateLimiter(rateLimit);

  // Seed if not already seeded (unless explicitly disabled)
  if (seedOpts !== false && !isDatabaseSeeded(db)) {
    seedDatabase(db, seedOpts || {});
  }

  // Middleware
  app.use(express.json());

  // Auth middleware on /v2 routes
  const authMiddleware = createAuthMiddleware(auth);

  // Mount routes under /v2 with path-specific rate limiting
  const searchRouter = createSearchRouter(db);
  const analyticsRouter = createAnalyticsRouter(db);
  const streamsRouter = createStreamsRouter(db);
  const exportsRouter = createExportsRouter(db, exportOpts);

  // Search: /v2/search
  app.use('/v2/search', authMiddleware, createRateLimitMiddleware(rateLimiter, 'general'), searchRouter);

  // Analytics: /v2/analytics/*
  app.use('/v2/analytics', authMiddleware, createRateLimitMiddleware(rateLimiter, 'analytics'), analyticsRouter);

  // Streams: /v2/streams
  app.use('/v2/streams', authMiddleware, createRateLimitMiddleware(rateLimiter, 'general'), streamsRouter);

  // Exports: /v2/exports
  app.use('/v2/exports', authMiddleware, createRateLimitMiddleware(rateLimiter, 'export'), exportsRouter);

  // Health endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'twin-meltwater' });
  });

  const intervals: NodeJS.Timeout[] = [];
  if ((exportsRouter as any)._cleanupInterval) {
    intervals.push((exportsRouter as any)._cleanupInterval);
  }

  return {
    app,
    db,
    rateLimiter,
    close: () => {
      intervals.forEach(clearInterval);
      db.close();
    },
  };
}

// Standalone server
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const port = parseInt(process.env.PORT || '3006');
  const { app } = createApp({
    auth: { validKeys: [process.env.MELTWATER_API_KEY || 'test-meltwater-key'] },
  });

  app.listen(port, () => {
    console.log(`twin-meltwater listening on port ${port}`);
  });
}

export { createDatabase, isDatabaseSeeded } from './db.js';
export { seedDatabase } from './seed.js';
export { RateLimiter } from './middleware/rate-limiter.js';
export type { RateLimitConfig } from './middleware/rate-limiter.js';
export type { AuthOptions } from './middleware/auth.js';
