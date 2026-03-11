import supertest from 'supertest';
import { createApp, type TidsbankenApp } from '../src/index.js';

const AUTH_HEADERS = {
  'subscription-key': 'test-subscription-key',
  'tb-key': 'test-tb-key',
};

/**
 * Create a test app with in-memory DB and seeded data.
 */
export function createTestApp(options?: { autoSeed?: boolean }): TidsbankenApp & { request: supertest.Agent } {
  const { app, db } = createApp(':memory:', {
    seed: 42,
    referenceDate: '2025-10-01',
    autoSeed: options?.autoSeed ?? true,
  });
  const request = supertest(app);
  return { app, db, request };
}

/**
 * Make an authenticated GET request.
 */
export function authGet(request: supertest.Agent, path: string) {
  return request.get(path).set(AUTH_HEADERS);
}

/**
 * Make an authenticated POST request.
 */
export function authPost(request: supertest.Agent, path: string, body?: unknown) {
  const req = request.post(path).set(AUTH_HEADERS);
  if (body) req.send(body);
  return req;
}

export { AUTH_HEADERS };
