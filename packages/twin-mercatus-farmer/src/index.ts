import express from 'express';
import type { Database } from 'better-sqlite3';
import { createAuthMiddleware } from '@ode/twin-foundation';
import { createDatabase } from './db.js';
import { errorHandler, simulateErrorMiddleware } from './middleware/error.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { createSitesRouter } from './routes/meta/sites.js';
import { createCompaniesRouter } from './routes/meta/companies.js';
import { createWeightSamplesRouter } from './routes/biology/weight-samples.js';
import { createMortalityRouter } from './routes/biology/mortality.js';
import { createHarvestImportsRouter } from './routes/biology/harvest-imports.js';
import { createEnvironmentRouter } from './routes/timeseries/environment.js';
import { createCustomTimeseriesRouter } from './routes/timeseries/custom.js';
import { createFinancialsRouter } from './routes/financials/values.js';

export interface AppOptions {
  /** SQLite database path. Defaults to ':memory:' */
  dbPath?: string;
  /** Pre-initialized database instance (overrides dbPath) */
  db?: Database;
  /** Public routes that skip auth */
  publicRoutes?: string[];
}

/**
 * Create and configure the Express application.
 * Returns both the app and database for testing/lifecycle management.
 */
export function createApp(options: AppOptions = {}) {
  const db = options.db ?? createDatabase(options.dbPath);
  const app = express();
  const rateLimiter = createRateLimiter();

  // Body parsing
  app.use(express.json());

  // Log Scale-Version header if present (no behavioral effect)
  app.use((req, _res, next) => {
    const scaleVersion = req.headers['scale-version'];
    if (scaleVersion) {
      // Just accept and log — no behavioral effect
    }
    next();
  });

  // Health check (public, before auth)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', twin: 'mercatus-farmer', version: '0.1.0' });
  });

  // Auth middleware
  const authMiddleware = createAuthMiddleware({
    publicRoutes: ['/health', ...(options.publicRoutes || [])],
  });
  app.use(authMiddleware);

  // Rate limiting (after auth, so we have user context)
  app.use(rateLimiter.middleware);

  // Simulate error header support
  app.use(simulateErrorMiddleware);

  // Routes
  app.use('/api/meta/sites', createSitesRouter(db));
  app.use('/api/meta/companies', createCompaniesRouter(db));
  app.use('/api/biology/weight-samples', createWeightSamplesRouter(db));
  app.use('/api/biology/mortality', createMortalityRouter(db));
  app.use('/api/biology/harvest-imports', createHarvestImportsRouter(db));
  app.use('/api/timeseries/environment', createEnvironmentRouter(db));
  app.use('/api/timeseries/custom', createCustomTimeseriesRouter(db));
  app.use('/api/financials', createFinancialsRouter(db));

  // Error handling (must be last)
  app.use(errorHandler);

  return { app, db, rateLimiter };
}

// Start server if run directly
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('index.ts') ||
  process.argv[1].endsWith('index.js')
);

if (isDirectRun && !process.env.VITEST) {
  const port = parseInt(process.env.PORT || '3001', 10);
  const { app } = createApp({ dbPath: process.env.DB_PATH || './mercatus-farmer.db' });
  app.listen(port, () => {
    console.log(`Twin Mercatus Farmer listening on port ${port}`);
  });
}
