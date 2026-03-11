import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestToken } from '@ode/twin-foundation';
import { createApp } from '../src/index.js';

const token = createTestToken({
  sub: 'user-1',
  tid: 'tenant-1',
  roles: ['admin'],
  name: 'Test User',
});

describe('Error Handling + Rate Limiting', () => {
  let app: ReturnType<typeof createApp>['app'];
  let rateLimiter: ReturnType<typeof createApp>['rateLimiter'];

  beforeEach(() => {
    const result = createApp();
    app = result.app;
    rateLimiter = result.rateLimiter;
  });

  describe('Auth middleware', () => {
    it('rejects requests without auth header', async () => {
      const res = await request(app).get('/api/meta/sites');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects requests with invalid token', async () => {
      const res = await request(app)
        .get('/api/meta/sites')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });

    it('allows requests with valid token', async () => {
      const res = await request(app)
        .get('/api/meta/sites')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('allows health check without auth', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.twin).toBe('mercatus-farmer');
    });
  });

  describe('Error response format', () => {
    it('returns standard error schema for 404', async () => {
      const res = await request(app)
        .get('/api/meta/sites/nonexistent-id')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('details');
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('returns validation errors with details', async () => {
      const res = await request(app)
        .post('/api/biology/weight-samples')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
      expect(res.body.details.length).toBeGreaterThan(0);
    });
  });

  describe('X-Twin-Simulate-Error header', () => {
    it('simulates a 500 error', async () => {
      const res = await request(app)
        .get('/api/meta/sites')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Twin-Simulate-Error', '500');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('SimulatedError');
    });

    it('simulates a 503 error', async () => {
      const res = await request(app)
        .get('/api/meta/sites')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Twin-Simulate-Error', '503');
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('SimulatedError');
    });

    it('ignores invalid simulate-error values', async () => {
      const res = await request(app)
        .get('/api/meta/sites')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Twin-Simulate-Error', 'not-a-number');
      expect(res.status).toBe(200);
    });
  });

  describe('Rate limiting', () => {
    it('returns rate limit headers', async () => {
      const res = await request(app)
        .get('/api/meta/sites')
        .set('Authorization', `Bearer ${token}`);
      expect(res.headers['x-ratelimit-limit']).toBe('100');
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('returns 429 when rate limit exceeded', async () => {
      rateLimiter.reset();

      // Send 100 requests to exhaust the limit
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app)
            .get('/api/meta/sites')
            .set('Authorization', `Bearer ${token}`)
        );
      }
      await Promise.all(promises);

      // The 101st request should be rate limited
      const res = await request(app)
        .get('/api/meta/sites')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(429);
      expect(res.body.error).toBe('TooManyRequests');
      expect(res.headers['retry-after']).toBeDefined();
    });
  });

  describe('Scale-Version header', () => {
    it('accepts Scale-Version header without error', async () => {
      const res = await request(app)
        .get('/api/meta/sites')
        .set('Authorization', `Bearer ${token}`)
        .set('Scale-Version', '2.1.0');
      expect(res.status).toBe(200);
    });
  });
});
