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
  name: 'Ola Nordmann',
});

describe('Biology Endpoints', () => {
  let app: Express;
  let db: Database.Database;
  let siteId: string;
  let fishGroupId: string;

  beforeEach(async () => {
    const result = createApp();
    app = result.app;
    db = result.db;
    seedDatabase(db);

    // Get a site and fish group for testing
    const site = db.prepare("SELECT id FROM sites WHERE type = 'sea_site' LIMIT 1").get() as { id: string };
    siteId = site.id;
    const fg = db.prepare('SELECT id FROM fish_groups WHERE site_id = ? LIMIT 1').get(siteId) as { id: string };
    fishGroupId = fg.id;
  });

  describe('Weight Samples', () => {
    describe('GET /api/biology/weight-samples', () => {
      it('returns weight samples with pagination', async () => {
        const res = await request(app)
          .get('/api/biology/weight-samples')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('total');
        expect(res.body).toHaveProperty('limit');
        expect(res.body).toHaveProperty('offset');
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.total).toBeGreaterThan(0);
      });

      it('filters by siteId', async () => {
        const res = await request(app)
          .get(`/api/biology/weight-samples?siteId=${siteId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        for (const sample of res.body.data) {
          expect(sample.siteId).toBe(siteId);
        }
      });

      it('filters by date range', async () => {
        const res = await request(app)
          .get('/api/biology/weight-samples?fromDate=2025-06-01&toDate=2025-12-31')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        for (const sample of res.body.data) {
          expect(sample.sampleDate >= '2025-06-01').toBe(true);
          expect(sample.sampleDate <= '2025-12-31').toBe(true);
        }
      });

      it('respects limit and offset', async () => {
        const res1 = await request(app)
          .get('/api/biology/weight-samples?limit=5&offset=0')
          .set('Authorization', `Bearer ${token}`);

        const res2 = await request(app)
          .get('/api/biology/weight-samples?limit=5&offset=5')
          .set('Authorization', `Bearer ${token}`);

        expect(res1.body.data).toHaveLength(5);
        expect(res2.body.data).toHaveLength(5);
        // Different pages should return different data
        expect(res1.body.data[0].id).not.toBe(res2.body.data[0].id);
      });
    });

    describe('POST /api/biology/weight-samples', () => {
      it('creates a weight sample', async () => {
        const res = await request(app)
          .post('/api/biology/weight-samples')
          .set('Authorization', `Bearer ${token}`)
          .send({
            siteId,
            fishGroupId,
            sampleDate: '2026-03-10',
            count: 50,
            averageWeightGrams: 2850.5,
            minWeightGrams: 2100,
            maxWeightGrams: 3600,
            stdDevGrams: 380,
            conditionFactor: 1.05,
          });

        expect(res.status).toBe(201);
        expect(res.body.siteId).toBe(siteId);
        expect(res.body.averageWeightGrams).toBe(2850.5);
        expect(res.body.id).toBeDefined();
      });

      it('rejects invalid data', async () => {
        const res = await request(app)
          .post('/api/biology/weight-samples')
          .set('Authorization', `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('ValidationError');
        expect(res.body.details.length).toBeGreaterThan(0);
      });

      it('rejects non-existent site', async () => {
        const res = await request(app)
          .post('/api/biology/weight-samples')
          .set('Authorization', `Bearer ${token}`)
          .send({
            siteId: 'nonexistent',
            sampleDate: '2026-03-10',
            count: 50,
            averageWeightGrams: 2850.5,
          });

        expect(res.status).toBe(404);
      });
    });
  });

  describe('Mortality', () => {
    describe('GET /api/biology/mortality', () => {
      it('returns mortality records with pagination', async () => {
        const res = await request(app)
          .get('/api/biology/mortality')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.total).toBeGreaterThan(0);
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('filters by cause', async () => {
        const res = await request(app)
          .get('/api/biology/mortality?cause=DISEASE')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        for (const record of res.body.data) {
          expect(record.cause).toBe('DISEASE');
        }
      });

      it('filters by siteId and date range', async () => {
        const res = await request(app)
          .get(`/api/biology/mortality?siteId=${siteId}&fromDate=2025-06-01&toDate=2025-09-01`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        for (const record of res.body.data) {
          expect(record.siteId).toBe(siteId);
        }
      });
    });

    describe('POST /api/biology/mortality', () => {
      it('creates a mortality record', async () => {
        const res = await request(app)
          .post('/api/biology/mortality')
          .set('Authorization', `Bearer ${token}`)
          .send({
            siteId,
            fishGroupId,
            recordDate: '2026-03-10',
            count: 15,
            cause: 'NATURAL',
            notes: 'Normal background mortality',
          });

        expect(res.status).toBe(201);
        expect(res.body.cause).toBe('NATURAL');
        expect(res.body.count).toBe(15);
        expect(res.body.notes).toBe('Normal background mortality');
      });

      it('rejects invalid cause', async () => {
        const res = await request(app)
          .post('/api/biology/mortality')
          .set('Authorization', `Bearer ${token}`)
          .send({
            siteId,
            recordDate: '2026-03-10',
            count: 15,
            cause: 'INVALID_CAUSE',
          });

        expect(res.status).toBe(400);
        expect(res.body.details).toEqual(
          expect.arrayContaining([expect.stringContaining('cause must be one of')])
        );
      });
    });
  });

  describe('Harvest Imports', () => {
    describe('GET /api/biology/harvest-imports', () => {
      it('returns harvest imports (may be empty before harvest)', async () => {
        const res = await request(app)
          .get('/api/biology/harvest-imports')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('total');
      });
    });

    describe('POST /api/biology/harvest-imports', () => {
      it('creates a harvest import', async () => {
        const res = await request(app)
          .post('/api/biology/harvest-imports')
          .set('Authorization', `Bearer ${token}`)
          .send({
            siteId,
            fishGroupId,
            harvestDate: '2026-03-10',
            count: 5000,
            totalWeightKg: 17500,
            averageWeightGrams: 3500,
            qualityGrade: 'A',
            destination: 'Ode Foredling Vartdal',
          });

        expect(res.status).toBe(201);
        expect(res.body.count).toBe(5000);
        expect(res.body.totalWeightKg).toBe(17500);
        expect(res.body.qualityGrade).toBe('A');
        expect(res.body.destination).toBe('Ode Foredling Vartdal');
      });

      it('rejects invalid data', async () => {
        const res = await request(app)
          .post('/api/biology/harvest-imports')
          .set('Authorization', `Bearer ${token}`)
          .send({ siteId });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('ValidationError');
      });
    });
  });
});
