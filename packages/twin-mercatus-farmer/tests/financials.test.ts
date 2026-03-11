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
  name: 'Ingrid Havstein',
});

describe('Financial Endpoints', () => {
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

  describe('GET /api/financials/values', () => {
    it('returns financial values with pagination', async () => {
      const res = await request(app)
        .get('/api/financials/values')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThan(0);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('offset');
    });

    it('filters by siteId', async () => {
      const res = await request(app)
        .get(`/api/financials/values?siteId=${siteId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      for (const val of res.body.data) {
        expect(val.siteId).toBe(siteId);
      }
    });

    it('filters by metric', async () => {
      const res = await request(app)
        .get('/api/financials/values?metric=FEED_COST_PER_KG')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      for (const val of res.body.data) {
        expect(val.metric).toBe('FEED_COST_PER_KG');
      }
    });

    it('filters by period range', async () => {
      const res = await request(app)
        .get('/api/financials/values?fromPeriod=2025-06&toPeriod=2025-09')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      for (const val of res.body.data) {
        expect(val.period >= '2025-06').toBe(true);
        expect(val.period <= '2025-09').toBe(true);
      }
    });

    it('returns values with correct fields', async () => {
      const res = await request(app)
        .get(`/api/financials/values?limit=1`)
        .set('Authorization', `Bearer ${token}`);

      const val = res.body.data[0];
      expect(val).toHaveProperty('id');
      expect(val).toHaveProperty('siteId');
      expect(val).toHaveProperty('metric');
      expect(val).toHaveProperty('period');
      expect(val).toHaveProperty('value');
      expect(val).toHaveProperty('currency');
      expect(val.currency).toBe('NOK');
    });
  });

  describe('POST /api/financials/values-import', () => {
    it('imports a single financial value', async () => {
      const res = await request(app)
        .post('/api/financials/values-import')
        .set('Authorization', `Bearer ${token}`)
        .send({
          siteId,
          metric: 'FEED_COST_PER_KG',
          period: '2026-03',
          value: 13.75,
        });

      expect(res.status).toBe(201);
      expect(res.body.imported).toBe(1);
      expect(res.body.data[0].metric).toBe('FEED_COST_PER_KG');
      expect(res.body.data[0].value).toBe(13.75);
    });

    it('imports multiple financial values', async () => {
      const res = await request(app)
        .post('/api/financials/values-import')
        .set('Authorization', `Bearer ${token}`)
        .send([
          { siteId, metric: 'FEED_COST_PER_KG', period: '2026-03', value: 13.75 },
          { siteId, metric: 'BIOMASS_VALUE', period: '2026-03', value: 28000000 },
        ]);

      expect(res.status).toBe(201);
      expect(res.body.imported).toBe(2);
    });

    it('rejects invalid metric', async () => {
      const res = await request(app)
        .post('/api/financials/values-import')
        .set('Authorization', `Bearer ${token}`)
        .send({
          siteId,
          metric: 'INVALID_METRIC',
          period: '2026-03',
          value: 100,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects missing required fields', async () => {
      const res = await request(app)
        .post('/api/financials/values-import')
        .set('Authorization', `Bearer ${token}`)
        .send({ siteId });

      expect(res.status).toBe(400);
    });
  });
});
