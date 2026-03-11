import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp, type MeltwaterApp } from '../src/index.js';

describe('Rate Limiting', () => {
  let mw: MeltwaterApp;
  const API_KEY = 'test-meltwater-key';
  const API_KEY_2 = 'test-meltwater-key-2';

  beforeAll(() => {
    mw = createApp({
      dbPath: ':memory:',
      auth: { validKeys: [API_KEY, API_KEY_2] },
      rateLimit: {
        generalPerMinute: 3,
        analyticsPerMinute: 2,
        exportPerMinute: 2,
        hourlyPerIp: 100,
        dailyDocumentQuota: 100,
      },
      seed: { count: 50, seed: 42 },
    });
  });

  afterAll(() => {
    mw.close();
  });

  beforeEach(() => {
    mw.rateLimiter.reset();
  });

  it('should include rate limit headers', async () => {
    const res = await request(mw.app).get('/v2/search').set('apikey', API_KEY);
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
    expect(res.headers['ratelimit-day-remaining']).toBeDefined();
    expect(res.headers['ratelimit-day-reset']).toBeDefined();
  });

  it('should enforce general per-minute limit', async () => {
    // 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      const res = await request(mw.app).get('/v2/search').set('apikey', API_KEY);
      expect(res.status).toBe(200);
    }

    // 4th should be rate limited
    const res = await request(mw.app).get('/v2/search').set('apikey', API_KEY);
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Too Many Requests');
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('should enforce analytics per-minute limit', async () => {
    // 2 requests should succeed
    for (let i = 0; i < 2; i++) {
      const res = await request(mw.app)
        .get('/v2/analytics/volume?interval=day')
        .set('apikey', API_KEY);
      expect(res.status).toBe(200);
    }

    // 3rd should be rate limited
    const res = await request(mw.app)
      .get('/v2/analytics/volume?interval=day')
      .set('apikey', API_KEY);
    expect(res.status).toBe(429);
  });

  it('should have independent counters per API key', async () => {
    // Exhaust key 1
    for (let i = 0; i < 3; i++) {
      await request(mw.app).get('/v2/search').set('apikey', API_KEY);
    }
    const res1 = await request(mw.app).get('/v2/search').set('apikey', API_KEY);
    expect(res1.status).toBe(429);

    // Key 2 should still work
    const res2 = await request(mw.app).get('/v2/search').set('apikey', API_KEY_2);
    expect(res2.status).toBe(200);
  });

  it('should return correct remaining count', async () => {
    const res1 = await request(mw.app).get('/v2/search').set('apikey', API_KEY);
    expect(res1.headers['x-ratelimit-remaining']).toBe('2');

    const res2 = await request(mw.app).get('/v2/search').set('apikey', API_KEY);
    expect(res2.headers['x-ratelimit-remaining']).toBe('1');

    const res3 = await request(mw.app).get('/v2/search').set('apikey', API_KEY);
    expect(res3.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('should enforce daily document quota', async () => {
    // Create app with very low daily quota
    const smallQuota = createApp({
      dbPath: ':memory:',
      auth: { validKeys: ['quota-key'] },
      rateLimit: {
        generalPerMinute: 1000,
        dailyDocumentQuota: 2,
        hourlyPerIp: 10000,
      },
      seed: { count: 10, seed: 42 },
    });

    // First 2 requests use the daily quota
    await request(smallQuota.app).get('/v2/search').set('apikey', 'quota-key');
    await request(smallQuota.app).get('/v2/search').set('apikey', 'quota-key');

    // 3rd should fail with daily quota exceeded
    const res = await request(smallQuota.app).get('/v2/search').set('apikey', 'quota-key');
    expect(res.status).toBe(429);
    expect(res.body.message).toContain('Daily');

    smallQuota.close();
  });
});
