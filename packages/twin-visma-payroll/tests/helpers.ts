import { createApp } from '../src/index.js';
import { createTestToken } from '@ode/twin-foundation';
import type express from 'express';
import type Database from 'better-sqlite3';

export function setupTestApp(seed: number = 42): { app: express.Express; db: Database.Database } {
  return createApp({ seed, skipAuth: true });
}

export function createAuthHeader(): string {
  const token = createTestToken({
    sub: 'test-user-1',
    tid: 'ode-tenant',
    roles: ['payroll-admin'],
    name: 'Test User',
  });
  return `Bearer ${token}`;
}
