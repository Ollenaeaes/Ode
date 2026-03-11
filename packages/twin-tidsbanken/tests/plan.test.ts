import { describe, it, expect, beforeAll } from 'vitest';
import type supertest from 'supertest';
import type Database from 'better-sqlite3';
import { createTestApp, authGet } from './helpers.js';

describe('Plan (Schedule) Endpoints', () => {
  let request: supertest.Agent;
  let db: Database.Database;

  beforeAll(() => {
    const app = createTestApp();
    request = app.request;
    db = app.db;
  });

  describe('GET /api/v3/plan', () => {
    it('returns plans in OData envelope', async () => {
      const res = await authGet(request, '/api/v3/plan');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.value)).toBe(true);
      expect(res.body.value.length).toBeGreaterThan(0);
    });

    it('includes expected plan fields', async () => {
      const res = await authGet(request, '/api/v3/plan?$top=1');
      const plan = res.body.value[0];
      expect(plan).toHaveProperty('PlanId');
      expect(plan).toHaveProperty('AnsattNr');
      expect(plan).toHaveProperty('Dato');
      expect(plan).toHaveProperty('Skift');
      expect(plan).toHaveProperty('SkiftNavn');
      expect(plan).toHaveProperty('Timer');
      expect(plan).toHaveProperty('Avdeling');
    });

    it('supports filtering by employee', async () => {
      const res = await authGet(request, '/api/v3/plan?$filter=AnsattNr eq 1001&$top=200');
      expect(res.body.value.length).toBeGreaterThan(0);
      expect(res.body.value.every((p: any) => p.AnsattNr === 1001)).toBe(true);
    });

    it('supports filtering by date', async () => {
      const res = await authGet(request, "/api/v3/plan?$filter=Dato eq '2025-10-01'&$top=200");
      expect(res.body.value.length).toBeGreaterThan(0);
      expect(res.body.value.every((p: any) => p.Dato === '2025-10-01')).toBe(true);
    });
  });

  describe('Plan data patterns', () => {
    it('office employees have KONTOR shift on workdays', () => {
      // AnsattNr 1001-1008 are LED (office)
      const plans = db.prepare(
        "SELECT * FROM plan WHERE AnsattNr = 1001 AND Skift = 'KONTOR' LIMIT 5"
      ).all() as any[];
      expect(plans.length).toBeGreaterThan(0);
      expect(plans[0].SkiftNavn).toBe('Kontortid');
    });

    it('processing employees rotate shifts', () => {
      // PRO-D starts at: LED(8) + ADM(10) + SAL(8) + LOG(12) + SET-RB(12) + SET-TJ(10) + SJO(50) = 110
      const proStart = 1001 + 110; // 1111
      const plans = db.prepare(
        `SELECT DISTINCT Skift FROM plan WHERE AnsattNr = ? AND Skift IN ('DAG', 'KVELD', 'NATT')`
      ).all(proStart) as any[];
      // Should have at least 2 different shifts over 3 months
      expect(plans.length).toBeGreaterThanOrEqual(2);
    });

    it('sea site employees have SJO-PA and SJO-AV shifts', () => {
      // SJO-01 starts at: LED(8) + ADM(10) + SAL(8) + LOG(12) + SET-RB(12) + SET-TJ(10) = 60
      const sjoStart = 1001 + 60; // 1061
      const shifts = db.prepare(
        "SELECT DISTINCT Skift FROM plan WHERE AnsattNr = ?"
      ).all(sjoStart) as any[];
      const shiftCodes = shifts.map((s: any) => s.Skift);
      expect(shiftCodes).toContain('SJO-PA');
      expect(shiftCodes).toContain('SJO-AV');
    });

    it('generates 3 months of plan data', () => {
      const dateRange = db.prepare(
        'SELECT MIN(Dato) as minDate, MAX(Dato) as maxDate FROM plan'
      ).get() as any;
      const min = new Date(dateRange.minDate);
      const max = new Date(dateRange.maxDate);
      const months = (max.getFullYear() - min.getFullYear()) * 12 + (max.getMonth() - min.getMonth());
      expect(months).toBeGreaterThanOrEqual(2); // At least spanning ~3 months
    });
  });
});
