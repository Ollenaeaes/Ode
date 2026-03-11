import express from 'express';
import Database from 'better-sqlite3';
import { createAuthMiddleware } from '@ode/twin-foundation';
import { createDatabase } from './db.js';
import { seedDatabase } from './seed.js';
import { createEmployeesRouter } from './routes/employees.js';
import { createPayCodesRouter } from './routes/pay-codes.js';
import { createVariableTransactionsRouter } from './routes/variable-transactions.js';
import { createAccountingTransactionsRouter } from './routes/accounting-transactions.js';
import { createExpensesRouter } from './routes/expenses.js';

export interface AppOptions {
  db?: Database.Database;
  seed?: number;
  skipSeed?: boolean;
  skipAuth?: boolean;
}

export function createApp(options: AppOptions = {}): { app: express.Express; db: Database.Database } {
  const db = options.db ?? createDatabase();

  if (!options.skipSeed) {
    seedDatabase(db, options.seed ?? 42);
  }

  const app = express();
  app.use(express.json());

  // Health check (public)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'twin-visma-payroll' });
  });

  // Auth middleware for API routes
  if (!options.skipAuth) {
    app.use('/api', createAuthMiddleware({
      publicRoutes: ['/health'],
    }));
  }

  // Mount routes
  app.use('/api/v1/employees', createEmployeesRouter(db));
  app.use('/api/v1/pay-codes', createPayCodesRouter(db));
  app.use('/api/v1/variable-transactions', createVariableTransactionsRouter(db));
  app.use('/api/v1/accounting-transactions', createAccountingTransactionsRouter(db));
  app.use('/api/v1/expenses', createExpensesRouter(db));

  return { app, db };
}

// Start server when run directly
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  const port = parseInt(process.env.PORT || '3004');
  const { app } = createApp();
  app.listen(port, () => {
    console.log(`twin-visma-payroll listening on port ${port}`);
  });
}

export { createDatabase } from './db.js';
export { seedDatabase, DEPARTMENTS, PAY_CODES, PERIODS, DEPT_EMPLOYEE_COUNTS, maskBankAccount } from './seed.js';
