import { describe, it, expect, beforeAll } from 'vitest';
import type supertest from 'supertest';
import type Database from 'better-sqlite3';
import { createTestApp, authGet, authPost } from './helpers.js';

describe('Stempling (Clock-in/out) Endpoints', () => {
  let request: supertest.Agent;
  let db: Database.Database;

  beforeAll(() => {
    const app = createTestApp();
    request = app.request;
    db = app.db;
  });

  describe('GET /api/v3/stempling', () => {
    it('returns stemplings in OData envelope', async () => {
      const res = await authGet(request, '/api/v3/stempling');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.value)).toBe(true);
      expect(res.body.value.length).toBeGreaterThan(0);
    });

    it('includes expected fields', async () => {
      const res = await authGet(request, '/api/v3/stempling?$top=1');
      const s = res.body.value[0];
      expect(s).toHaveProperty('StemplingId');
      expect(s).toHaveProperty('AnsattNr');
      expect(s).toHaveProperty('Tidspunkt');
      expect(s).toHaveProperty('Type');
      expect(s).toHaveProperty('Kilde');
    });

    it('supports filtering by employee', async () => {
      const res = await authGet(request, '/api/v3/stempling?$filter=AnsattNr eq 1001&$top=200');
      expect(res.body.value.length).toBeGreaterThan(0);
      expect(res.body.value.every((s: any) => s.AnsattNr === 1001)).toBe(true);
    });

    it('supports filtering by type (clock-in = 0)', async () => {
      const res = await authGet(request, '/api/v3/stempling?$filter=Type eq 0&$top=10');
      expect(res.body.value.every((s: any) => s.Type === 0)).toBe(true);
    });

    it('supports $orderby on Tidspunkt', async () => {
      const res = await authGet(request, '/api/v3/stempling?$filter=AnsattNr eq 1001&$orderby=Tidspunkt desc&$top=5');
      const times = res.body.value.map((s: any) => s.Tidspunkt);
      expect(times).toEqual([...times].sort().reverse());
    });
  });

  describe('POST /api/v3/stempling', () => {
    it('creates a clock-in entry', async () => {
      const res = await authPost(request, '/api/v3/stempling', {
        AnsattNr: 1001,
        Type: 0,
        Tidspunkt: '2025-11-15T08:00:00',
        Lokasjon: 'HQ',
      });
      expect(res.status).toBe(201);
      expect(res.body.AnsattNr).toBe(1001);
      expect(res.body.Type).toBe(0);
      expect(res.body.StemplingId).toBeDefined();
    });

    it('returns 400 when required fields missing', async () => {
      const res = await authPost(request, '/api/v3/stempling', {
        Tidspunkt: '2025-11-15T08:00:00',
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent employee', async () => {
      const res = await authPost(request, '/api/v3/stempling', {
        AnsattNr: 9999,
        Type: 0,
      });
      expect(res.status).toBe(404);
    });
  });

  describe('Stempling data patterns', () => {
    it('stemplings come in pairs (clock-in + clock-out)', () => {
      const counts = db.prepare(`
        SELECT AnsattNr, DATE(Tidspunkt) as Dato,
               SUM(CASE WHEN Type = 0 THEN 1 ELSE 0 END) as ClockIns,
               SUM(CASE WHEN Type = 1 THEN 1 ELSE 0 END) as ClockOuts
        FROM stempling
        WHERE AnsattNr = 1001
        GROUP BY AnsattNr, DATE(Tidspunkt)
        LIMIT 10
      `).all() as any[];

      for (const day of counts) {
        expect(day.ClockIns).toBe(day.ClockOuts);
      }
    });

    it('has approximately 3% absence rate', () => {
      // Count plans vs stemplings for an office employee
      const planDays = db.prepare(
        "SELECT COUNT(DISTINCT Dato) as cnt FROM plan WHERE AnsattNr = 1001 AND Skift = 'KONTOR'"
      ).get() as any;
      const stemplingDays = db.prepare(
        "SELECT COUNT(DISTINCT DATE(Tidspunkt)) as cnt FROM stempling WHERE AnsattNr = 1001"
      ).get() as any;

      // Absence rate should be roughly 0-10% (3% expected, but with randomness)
      const absenceRate = 1 - stemplingDays.cnt / planDays.cnt;
      expect(absenceRate).toBeGreaterThanOrEqual(0);
      expect(absenceRate).toBeLessThan(0.15); // Allow some variance
    });
  });
});
