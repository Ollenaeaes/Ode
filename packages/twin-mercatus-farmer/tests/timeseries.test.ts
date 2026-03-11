import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestToken } from '@ode/twin-foundation';
import { createApp } from '../src/index.js';
import { seedDatabase } from '../src/seed.js';
import type Database from 'better-sqlite3';

const token = createTestToken({
  sub: 'user-1',
  tid: 'tenant-1',
  roles: ['admin'],
  name: 'Lars Solvang',
});

describe('Time Series Endpoints', () => {
  let app: Express;
  let db: Database.Database;
  let siteId: string;

  beforeEach(async () => {
    const result = createApp();
    app = result.app;
    db = result.db;
    seedDatabase(db);

    const site = db.prepare("SELECT id FROM sites WHERE type = 'sea_site' LIMIT 1").get() as { id: string };
    siteId = site.id;
  });

  describe('Environment Time Series', () => {
    describe('GET /api/timeseries/environment/:siteId', () => {
      it('returns raw time series data', async () => {
        const res = await request(app)
          .get(`/api/timeseries/environment/${siteId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.aggregation).toBe('raw');
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data[0]).toHaveProperty('parameter');
        expect(res.body.data[0]).toHaveProperty('timestamp');
        expect(res.body.data[0]).toHaveProperty('value');
        expect(res.body.data[0]).toHaveProperty('unit');
      });

      it('filters by parameter', async () => {
        const res = await request(app)
          .get(`/api/timeseries/environment/${siteId}?parameter=temperature`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        for (const point of res.body.data) {
          expect(point.parameter).toBe('temperature');
        }
      });

      it('filters by date range', async () => {
        const res = await request(app)
          .get(`/api/timeseries/environment/${siteId}?fromDate=2025-06-01&toDate=2025-06-30`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        for (const point of res.body.data) {
          expect(point.timestamp >= '2025-06-01').toBe(true);
          expect(point.timestamp <= '2025-07-01').toBe(true);
        }
      });

      it('supports hourly aggregation', async () => {
        const res = await request(app)
          .get(`/api/timeseries/environment/${siteId}?aggregation=hourly&parameter=temperature&fromDate=2025-06-01&toDate=2025-06-07`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.aggregation).toBe('hourly');
        if (res.body.data.length > 0) {
          expect(res.body.data[0]).toHaveProperty('avgValue');
          expect(res.body.data[0]).toHaveProperty('minValue');
          expect(res.body.data[0]).toHaveProperty('maxValue');
          expect(res.body.data[0]).toHaveProperty('sampleCount');
        }
      });

      it('supports daily aggregation', async () => {
        const res = await request(app)
          .get(`/api/timeseries/environment/${siteId}?aggregation=daily&parameter=temperature&fromDate=2025-06-01&toDate=2025-06-30`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.aggregation).toBe('daily');
        if (res.body.data.length > 0) {
          expect(res.body.data[0]).toHaveProperty('avgValue');
        }
      });

      it('returns 404 for non-existent site', async () => {
        const res = await request(app)
          .get('/api/timeseries/environment/nonexistent')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
      });

      it('rejects invalid aggregation', async () => {
        const res = await request(app)
          .get(`/api/timeseries/environment/${siteId}?aggregation=weekly`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(400);
      });

      it('supports comma-separated parameters', async () => {
        const res = await request(app)
          .get(`/api/timeseries/environment/${siteId}?parameter=temperature,oxygen`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const params = new Set(res.body.data.map((d: Record<string, unknown>) => d.parameter));
        // Should only contain temperature and/or oxygen
        for (const p of params) {
          expect(['temperature', 'oxygen']).toContain(p);
        }
      });
    });
  });

  describe('Custom Time Series', () => {
    describe('POST /api/timeseries/custom', () => {
      it('creates a custom time series point', async () => {
        const res = await request(app)
          .post('/api/timeseries/custom')
          .set('Authorization', `Bearer ${token}`)
          .send({
            siteId,
            parameter: 'feed_amount_kg',
            timestamp: '2026-03-10T08:00:00Z',
            value: 450.5,
            unit: 'kg',
          });

        expect(res.status).toBe(201);
        expect(res.body.parameter).toBe('feed_amount_kg');
        expect(res.body.value).toBe(450.5);
        expect(res.body.source).toBe('custom');
      });

      it('rejects missing fields', async () => {
        const res = await request(app)
          .post('/api/timeseries/custom')
          .set('Authorization', `Bearer ${token}`)
          .send({ siteId });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('ValidationError');
      });
    });

    describe('GET /api/timeseries/custom', () => {
      it('retrieves custom time series data', async () => {
        // Create some custom data first
        await request(app)
          .post('/api/timeseries/custom')
          .set('Authorization', `Bearer ${token}`)
          .send({
            siteId,
            parameter: 'feed_amount_kg',
            timestamp: '2026-03-10T08:00:00Z',
            value: 450.5,
            unit: 'kg',
          });

        const res = await request(app)
          .get(`/api/timeseries/custom?siteId=${siteId}&parameter=feed_amount_kg`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data[0].source).toBe('custom');
      });

      it('does not return sensor data', async () => {
        const res = await request(app)
          .get(`/api/timeseries/custom?siteId=${siteId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        // All returned data should be custom source
        for (const point of res.body.data) {
          expect(point.source).toBe('custom');
        }
      });
    });
  });
});
