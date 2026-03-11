import express from 'express';
import { createDatabase, isDatabaseSeeded } from './db.js';
import { createTidsbankenAuth } from './middleware/auth.js';
import { createAnsattRouter } from './routes/ansatt.js';
import { createAvdelingRouter } from './routes/avdeling.js';
import { createAktivitetRouter } from './routes/aktivitet.js';
import { createArbeidstypeRouter } from './routes/arbeidstype.js';
import { createProsjektRouter, createProsjektlinjeRouter } from './routes/prosjekt.js';
import { createPlanRouter } from './routes/plan.js';
import { createStemplingRouter } from './routes/stempling.js';
import { createTimelinjeRouter } from './routes/timelinje.js';
import { createWebhooksRouter, createEksportRouter } from './routes/webhooks.js';
import { seedAll } from './seed/index.js';
import type Database from 'better-sqlite3';

export interface TidsbankenApp {
  app: express.Express;
  db: Database.Database;
}

/**
 * Create and configure the Tidsbanken Express app.
 * @param dbPath Path to SQLite file, or ':memory:' for in-memory
 * @param options Additional configuration
 */
export function createApp(dbPath: string = ':memory:', options?: {
  seed?: number;
  referenceDate?: string;
  autoSeed?: boolean;
  subscriptionKey?: string;
  tbKey?: string;
}): TidsbankenApp {
  const db = createDatabase(dbPath);
  const app = express();

  // Body parsing
  app.use(express.json());

  // Auth middleware (skips /admin routes)
  app.use(createTidsbankenAuth({
    subscriptionKey: options?.subscriptionKey,
    tbKey: options?.tbKey,
  }));

  // API routes
  app.use('/api/v3/ansatt', createAnsattRouter(db));
  app.use('/api/v3/avdeling', createAvdelingRouter(db));
  app.use('/api/v3/aktivitet', createAktivitetRouter(db));
  app.use('/api/v3/arbeidstype', createArbeidstypeRouter(db));
  app.use('/api/v3/prosjekt', createProsjektRouter(db));
  app.use('/api/v3/prosjektlinje', createProsjektlinjeRouter(db));
  app.use('/api/v3/plan', createPlanRouter(db));
  app.use('/api/v3/stempling', createStemplingRouter(db));
  app.use('/api/v3/timelinje', createTimelinjeRouter(db));

  // Admin routes (no auth required)
  app.use('/admin/webhooks', createWebhooksRouter(db));
  app.use('/admin/eksport', createEksportRouter(db));

  // Auto-seed if empty
  if (options?.autoSeed !== false && !isDatabaseSeeded(db)) {
    seedAll(db, { seed: options?.seed, referenceDate: options?.referenceDate });
  }

  return { app, db };
}

// Start server when run directly
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('index.ts') ||
  process.argv[1].endsWith('index.js')
);

if (isDirectRun) {
  const port = parseInt(process.env.PORT || '3002', 10);
  const { app } = createApp(process.env.DB_PATH || './tidsbanken.db');

  app.listen(port, () => {
    console.log(`Twin Tidsbanken running on http://localhost:${port}`);
  });
}
