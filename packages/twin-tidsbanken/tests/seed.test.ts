import { describe, it, expect, beforeAll } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestApp } from './helpers.js';

describe('Seed Data', () => {
  let db: Database.Database;

  beforeAll(() => {
    const app = createTestApp();
    db = app.db;
  });

  describe('Employee distribution', () => {
    it('seeds exactly 155 employees', () => {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM ansatt').get() as any;
      expect(row.cnt).toBe(155);
    });

    it('LED has 8 employees', () => {
      const row = db.prepare("SELECT COUNT(*) as cnt FROM ansatt WHERE Avdeling = 'LED'").get() as any;
      expect(row.cnt).toBe(8);
    });

    it('ADM has 10 employees', () => {
      const row = db.prepare("SELECT COUNT(*) as cnt FROM ansatt WHERE Avdeling = 'ADM'").get() as any;
      expect(row.cnt).toBe(10);
    });

    it('SAL has 8 employees', () => {
      const row = db.prepare("SELECT COUNT(*) as cnt FROM ansatt WHERE Avdeling = 'SAL'").get() as any;
      expect(row.cnt).toBe(8);
    });

    it('LOG has 12 employees (including vessel crew)', () => {
      const row = db.prepare("SELECT COUNT(*) as cnt FROM ansatt WHERE Avdeling = 'LOG'").get() as any;
      expect(row.cnt).toBe(12);
    });

    it('SET-RB has 12 employees', () => {
      const row = db.prepare("SELECT COUNT(*) as cnt FROM ansatt WHERE Avdeling = 'SET-RB'").get() as any;
      expect(row.cnt).toBe(12);
    });

    it('SET-TJ has 10 employees', () => {
      const row = db.prepare("SELECT COUNT(*) as cnt FROM ansatt WHERE Avdeling = 'SET-TJ'").get() as any;
      expect(row.cnt).toBe(10);
    });

    it('each SJO department has 5 employees', () => {
      for (let i = 1; i <= 10; i++) {
        const code = `SJO-${String(i).padStart(2, '0')}`;
        const row = db.prepare("SELECT COUNT(*) as cnt FROM ansatt WHERE Avdeling = ?").get(code) as any;
        expect(row.cnt).toBe(5);
      }
    });

    it('each PRO department has 15 employees', () => {
      for (const code of ['PRO-D', 'PRO-K', 'PRO-N']) {
        const row = db.prepare("SELECT COUNT(*) as cnt FROM ansatt WHERE Avdeling = ?").get(code) as any;
        expect(row.cnt).toBe(15);
      }
    });

    it('all employees have valid Norwegian emails', () => {
      const employees = db.prepare('SELECT Epost FROM ansatt').all() as any[];
      for (const e of employees) {
        expect(e.Epost).toContain('@ode.no');
      }
    });

    it('all employees are active', () => {
      const row = db.prepare("SELECT COUNT(*) as cnt FROM ansatt WHERE Aktiv = 1").get() as any;
      expect(row.cnt).toBe(155);
    });
  });

  describe('Reference data', () => {
    it('has 19 departments', () => {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM avdeling').get() as any;
      expect(row.cnt).toBe(19);
    });

    it('has 10 activity codes', () => {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM aktivitet').get() as any;
      expect(row.cnt).toBe(10);
    });

    it('has 4 work types', () => {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM arbeidstype').get() as any;
      expect(row.cnt).toBe(4);
    });

    it('has 7 shift definitions', () => {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM skift').get() as any;
      expect(row.cnt).toBe(7);
    });

    it('has 6 projects', () => {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM prosjekt').get() as any;
      expect(row.cnt).toBe(6);
    });
  });

  describe('Plans', () => {
    it('generates plan data', () => {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM plan').get() as any;
      expect(row.cnt).toBeGreaterThan(0);
    });

    it('all plans reference existing employees', () => {
      const orphans = db.prepare(
        'SELECT COUNT(*) as cnt FROM plan WHERE AnsattNr NOT IN (SELECT AnsattNr FROM ansatt)'
      ).get() as any;
      expect(orphans.cnt).toBe(0);
    });
  });

  describe('Stemplings', () => {
    it('generates stempling data', () => {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM stempling').get() as any;
      expect(row.cnt).toBeGreaterThan(0);
    });

    it('all stemplings reference existing employees', () => {
      const orphans = db.prepare(
        'SELECT COUNT(*) as cnt FROM stempling WHERE AnsattNr NOT IN (SELECT AnsattNr FROM ansatt)'
      ).get() as any;
      expect(orphans.cnt).toBe(0);
    });

    it('has both clock-in (0) and clock-out (1) types', () => {
      const types = db.prepare('SELECT DISTINCT Type FROM stempling ORDER BY Type').all() as any[];
      expect(types.map((t: any) => t.Type)).toContain(0);
      expect(types.map((t: any) => t.Type)).toContain(1);
    });
  });

  describe('Timelinje', () => {
    it('generates timelinje data', () => {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM timelinje').get() as any;
      expect(row.cnt).toBeGreaterThan(0);
    });

    it('all timelinje entries reference existing employees', () => {
      const orphans = db.prepare(
        'SELECT COUNT(*) as cnt FROM timelinje WHERE AnsattNr NOT IN (SELECT AnsattNr FROM ansatt)'
      ).get() as any;
      expect(orphans.cnt).toBe(0);
    });
  });

  describe('Deterministic seeding', () => {
    it('same seed produces identical data', () => {
      const app2 = createTestApp();
      const employees1 = db.prepare('SELECT Fornavn, Etternavn FROM ansatt ORDER BY AnsattNr').all();
      const employees2 = app2.db.prepare('SELECT Fornavn, Etternavn FROM ansatt ORDER BY AnsattNr').all();
      expect(employees1).toEqual(employees2);
    });
  });
});
