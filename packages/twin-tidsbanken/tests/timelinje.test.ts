import { describe, it, expect, beforeAll } from 'vitest';
import type supertest from 'supertest';
import type Database from 'better-sqlite3';
import { createTestApp, authGet, authPost } from './helpers.js';

describe('Timelinje (Time Entries) Endpoints', () => {
  let request: supertest.Agent;
  let db: Database.Database;

  beforeAll(() => {
    const app = createTestApp();
    request = app.request;
    db = app.db;
  });

  describe('GET /api/v3/timelinje', () => {
    it('returns time entries in OData envelope', async () => {
      const res = await authGet(request, '/api/v3/timelinje');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.value)).toBe(true);
      expect(res.body.value.length).toBeGreaterThan(0);
    });

    it('includes expected fields', async () => {
      const res = await authGet(request, '/api/v3/timelinje?$top=1');
      const t = res.body.value[0];
      expect(t).toHaveProperty('TimelinjeId');
      expect(t).toHaveProperty('AnsattNr');
      expect(t).toHaveProperty('Dato');
      expect(t).toHaveProperty('Timer');
      expect(t).toHaveProperty('Overtid');
      expect(t).toHaveProperty('Godkjent');
    });

    it('supports filtering by employee', async () => {
      const res = await authGet(request, '/api/v3/timelinje?$filter=AnsattNr eq 1001&$top=200');
      expect(res.body.value.length).toBeGreaterThan(0);
      expect(res.body.value.every((t: any) => t.AnsattNr === 1001)).toBe(true);
    });

    it('supports filtering by date range', async () => {
      const res = await authGet(request,
        "/api/v3/timelinje?$filter=Dato ge '2025-10-01' and Dato le '2025-10-31'&$top=200"
      );
      expect(res.body.value.length).toBeGreaterThan(0);
    });

    it('supports filtering for absence entries', async () => {
      const res = await authGet(request,
        "/api/v3/timelinje?$filter=Fraverstype ne null&$top=200"
      );
      // Should have some absence entries (from 3% absence rate)
      expect(res.body.value.length).toBeGreaterThan(0);
      // Absence entries have Timer = 0
      expect(res.body.value.every((t: any) => t.Timer === 0)).toBe(true);
    });
  });

  describe('POST /api/v3/timelinje', () => {
    it('creates a time entry', async () => {
      const res = await authPost(request, '/api/v3/timelinje', {
        AnsattNr: 1001,
        Dato: '2025-11-15',
        Timer: 7.5,
        Aktivitet: 'NORM',
        Arbeidstype: 'FAST',
      });
      expect(res.status).toBe(201);
      expect(res.body.AnsattNr).toBe(1001);
      expect(res.body.Timer).toBe(7.5);
    });

    it('returns 400 when required fields missing', async () => {
      const res = await authPost(request, '/api/v3/timelinje', {
        Timer: 7.5,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Timelinje data patterns', () => {
    it('work entries have positive hours', () => {
      const entries = db.prepare(
        "SELECT * FROM timelinje WHERE Fraverstype IS NULL AND Timer > 0 LIMIT 20"
      ).all() as any[];
      expect(entries.length).toBeGreaterThan(0);
      for (const e of entries) {
        expect(e.Timer).toBeGreaterThan(0);
        expect(e.Timer).toBeLessThanOrEqual(24);
      }
    });

    it('absence entries have Timer = 0 and Fraverstype set', () => {
      const entries = db.prepare(
        "SELECT * FROM timelinje WHERE Fraverstype IS NOT NULL LIMIT 20"
      ).all() as any[];
      expect(entries.length).toBeGreaterThan(0);
      for (const e of entries) {
        expect(e.Timer).toBe(0);
        expect(['SYK', 'FERIE', 'PERM']).toContain(e.Fraverstype);
      }
    });

    it('some entries have overtime', () => {
      const overtimeEntries = db.prepare(
        "SELECT COUNT(*) as cnt FROM timelinje WHERE Overtid > 0"
      ).get() as any;
      expect(overtimeEntries.cnt).toBeGreaterThan(0);
    });
  });
});
