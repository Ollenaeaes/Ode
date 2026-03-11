import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import type Database from 'better-sqlite3';
import { setupTestApp } from './helpers.js';

describe('Accounting Transactions API', () => {
  let app: express.Express;
  let db: Database.Database;

  beforeAll(() => {
    ({ app, db } = setupTestApp());
  });

  describe('GET /api/v1/accounting-transactions', () => {
    it('should return paginated transactions', async () => {
      const res = await request(app).get('/api/v1/accounting-transactions');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.totalCount).toBeGreaterThan(0);
    });

    it('should filter by periodId', async () => {
      const res = await request(app).get('/api/v1/accounting-transactions?periodId=2025-10');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((tx: Record<string, unknown>) => {
        expect(tx.periodId).toBe('2025-10');
      });
    });

    it('should filter by departmentId', async () => {
      const res = await request(app).get('/api/v1/accounting-transactions?departmentId=dept-sea-ops');

      expect(res.status).toBe(200);
      res.body.data.forEach((tx: Record<string, unknown>) => {
        expect(tx.departmentId).toBe('dept-sea-ops');
      });
    });

    it('should filter by accountCode', async () => {
      const res = await request(app).get('/api/v1/accounting-transactions?accountCode=5000');

      expect(res.status).toBe(200);
      res.body.data.forEach((tx: Record<string, unknown>) => {
        expect(tx.accountCode).toBe('5000');
      });
    });

    it('should have correct transaction structure', async () => {
      const res = await request(app).get('/api/v1/accounting-transactions?pageSize=1');

      const tx = res.body.data[0];
      expect(tx).toHaveProperty('transactionId');
      expect(tx).toHaveProperty('periodId');
      expect(tx).toHaveProperty('accountCode');
      expect(tx).toHaveProperty('departmentId');
      expect(tx).toHaveProperty('department');
      expect(tx.department).toHaveProperty('name');
      expect(tx).toHaveProperty('description');
      expect(tx).toHaveProperty('debitAmount');
      expect(tx).toHaveProperty('creditAmount');
      expect(tx).toHaveProperty('transactionDate');
    });

    it('should have debits equal credits per period', async () => {
      const periods = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'];

      for (const period of periods) {
        const res = await request(app).get(`/api/v1/accounting-transactions?periodId=${period}&pageSize=200`);

        let totalDebits = 0;
        let totalCredits = 0;

        res.body.data.forEach((tx: Record<string, unknown>) => {
          totalDebits += tx.debitAmount as number;
          totalCredits += tx.creditAmount as number;
        });

        // Allow small floating point difference
        expect(Math.abs(totalDebits - totalCredits)).toBeLessThan(1);
      }
    });

    it('should use proper account code series', async () => {
      const res = await request(app).get('/api/v1/accounting-transactions?pageSize=200');

      const accountCodes = new Set<string>();
      res.body.data.forEach((tx: Record<string, unknown>) => {
        accountCodes.add(tx.accountCode as string);
      });

      // Should include salary (5000-series), tax (2600), pension (2700)
      expect(accountCodes.has('5000')).toBe(true);
      expect(accountCodes.has('2600')).toBe(true);
      expect(accountCodes.has('2700')).toBe(true);
    });
  });

  describe('GET /api/v1/accounting-transactions/:id', () => {
    it('should return a single transaction', async () => {
      const listRes = await request(app).get('/api/v1/accounting-transactions?pageSize=1');
      const transactionId = listRes.body.data[0].transactionId;

      const res = await request(app).get(`/api/v1/accounting-transactions/${transactionId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactionId).toBe(transactionId);
    });

    it('should return 404 for non-existent transaction', async () => {
      const res = await request(app).get('/api/v1/accounting-transactions/non-existent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
