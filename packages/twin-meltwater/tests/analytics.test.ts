import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp, type MeltwaterApp } from '../src/index.js';

describe('Analytics Aggregation', () => {
  let mw: MeltwaterApp;
  const API_KEY = 'test-meltwater-key';

  beforeAll(() => {
    mw = createApp({
      dbPath: ':memory:',
      auth: { validKeys: [API_KEY] },
      rateLimit: { analyticsPerMinute: 1000, dailyDocumentQuota: 100000, hourlyPerIp: 10000 },
      seed: { count: 500, seed: 42 },
    });
  });

  afterAll(() => {
    mw.close();
  });

  describe('GET /v2/analytics/volume', () => {
    it('should return daily volume counts', async () => {
      const res = await request(mw.app)
        .get('/v2/analytics/volume?interval=day')
        .set('apikey', API_KEY);
      expect(res.status).toBe(200);
      expect(res.body.interval).toBe('day');
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('period');
      expect(res.body.data[0]).toHaveProperty('count');
    });

    it('should return weekly volume counts', async () => {
      const res = await request(mw.app)
        .get('/v2/analytics/volume?interval=week')
        .set('apikey', API_KEY);
      expect(res.status).toBe(200);
      expect(res.body.interval).toBe('week');
      expect(res.body.data.length).toBeGreaterThan(0);
      // Weekly should have fewer periods than daily
    });

    it('should return monthly volume counts', async () => {
      const res = await request(mw.app)
        .get('/v2/analytics/volume?interval=month')
        .set('apikey', API_KEY);
      expect(res.status).toBe(200);
      expect(res.body.interval).toBe('month');
      expect(res.body.data.length).toBeGreaterThanOrEqual(5); // Sep-Feb at minimum
    });

    it('should reject invalid interval', async () => {
      const res = await request(mw.app)
        .get('/v2/analytics/volume?interval=year')
        .set('apikey', API_KEY);
      expect(res.status).toBe(400);
    });

    it('should filter by query', async () => {
      const all = await request(mw.app)
        .get('/v2/analytics/volume?interval=month')
        .set('apikey', API_KEY);
      const filtered = await request(mw.app)
        .get('/v2/analytics/volume?interval=month&q=torsk')
        .set('apikey', API_KEY);

      const allTotal = all.body.data.reduce((s: number, d: any) => s + d.count, 0);
      const filteredTotal = filtered.body.data.reduce((s: number, d: any) => s + d.count, 0);
      expect(filteredTotal).toBeLessThan(allTotal);
      expect(filteredTotal).toBeGreaterThan(0);
    });

    it('should filter by date range', async () => {
      const res = await request(mw.app)
        .get('/v2/analytics/volume?interval=month&from=2025-11-01T00:00:00.000Z&to=2025-12-31T23:59:59.999Z')
        .set('apikey', API_KEY);
      expect(res.status).toBe(200);
      // Should only have Nov and Dec
      for (const d of res.body.data) {
        expect(d.period).toMatch(/^2025-(11|12)/);
      }
    });
  });

  describe('GET /v2/analytics/sentiment', () => {
    it('should return sentiment breakdown', async () => {
      const res = await request(mw.app)
        .get('/v2/analytics/sentiment')
        .set('apikey', API_KEY);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3); // positive, neutral, negative
      expect(res.body.total).toBeGreaterThanOrEqual(500);

      for (const item of res.body.data) {
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('percentage');
        expect(item).toHaveProperty('avgScore');
        expect(['positive', 'neutral', 'negative']).toContain(item.label);
      }

      // Percentages should sum to ~100
      const totalPct = res.body.data.reduce((s: number, d: any) => s + d.percentage, 0);
      expect(totalPct).toBeGreaterThan(99);
      expect(totalPct).toBeLessThan(101);
    });

    it('should have correct score ranges per label', async () => {
      const res = await request(mw.app)
        .get('/v2/analytics/sentiment')
        .set('apikey', API_KEY);

      const positive = res.body.data.find((d: any) => d.label === 'positive');
      const negative = res.body.data.find((d: any) => d.label === 'negative');

      expect(positive.avgScore).toBeGreaterThan(0);
      expect(negative.avgScore).toBeLessThan(0);
    });
  });

  describe('GET /v2/analytics/top-sources', () => {
    it('should return top sources', async () => {
      const res = await request(mw.app)
        .get('/v2/analytics/top-sources')
        .set('apikey', API_KEY);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.length).toBeLessThanOrEqual(10);

      for (const item of res.body.data) {
        expect(item).toHaveProperty('source');
        expect(item).toHaveProperty('count');
      }

      // Should be sorted descending by count
      for (let i = 1; i < res.body.data.length; i++) {
        expect(res.body.data[i].count).toBeLessThanOrEqual(res.body.data[i - 1].count);
      }
    });

    it('should respect limit parameter', async () => {
      const res = await request(mw.app)
        .get('/v2/analytics/top-sources?limit=3')
        .set('apikey', API_KEY);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
    });
  });

  describe('GET /v2/analytics/top-topics', () => {
    it('should return top topics', async () => {
      const res = await request(mw.app)
        .get('/v2/analytics/top-topics')
        .set('apikey', API_KEY);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);

      for (const item of res.body.data) {
        expect(item).toHaveProperty('topic');
        expect(item).toHaveProperty('count');
      }

      // Should be sorted descending by count
      for (let i = 1; i < res.body.data.length; i++) {
        expect(res.body.data[i].count).toBeLessThanOrEqual(res.body.data[i - 1].count);
      }
    });

    it('should respect limit parameter', async () => {
      const res = await request(mw.app)
        .get('/v2/analytics/top-topics?limit=5')
        .set('apikey', API_KEY);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(5);
    });
  });
});
