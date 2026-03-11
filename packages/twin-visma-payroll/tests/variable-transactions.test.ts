import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import type Database from 'better-sqlite3';
import { setupTestApp } from './helpers.js';

describe('Variable Transactions API', () => {
  let app: express.Express;
  let db: Database.Database;

  beforeAll(() => {
    ({ app, db } = setupTestApp());
  });

  describe('GET /api/v1/variable-transactions', () => {
    it('should return paginated transactions', async () => {
      const res = await request(app).get('/api/v1/variable-transactions');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.totalCount).toBeGreaterThan(0);
    });

    it('should filter by periodId', async () => {
      const res = await request(app).get('/api/v1/variable-transactions?periodId=2025-10');

      expect(res.status).toBe(200);
      res.body.data.forEach((tx: Record<string, unknown>) => {
        expect(tx.periodId).toBe('2025-10');
      });
    });

    it('should filter by employeeId', async () => {
      // Get a known employee with transactions
      const empRes = await request(app).get('/api/v1/employees?departmentId=dept-sea-ops&pageSize=1');
      const employeeId = empRes.body.data[0].employeeId;

      const res = await request(app).get(`/api/v1/variable-transactions?employeeId=${employeeId}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((tx: Record<string, unknown>) => {
        expect(tx.employeeId).toBe(employeeId);
      });
    });

    it('should filter by status', async () => {
      const res = await request(app).get('/api/v1/variable-transactions?status=processed');

      expect(res.status).toBe(200);
      res.body.data.forEach((tx: Record<string, unknown>) => {
        expect(tx.status).toBe('processed');
      });
    });

    it('should have correct transaction structure', async () => {
      const res = await request(app).get('/api/v1/variable-transactions?pageSize=1');

      const tx = res.body.data[0];
      expect(tx).toHaveProperty('transactionId');
      expect(tx).toHaveProperty('employeeId');
      expect(tx).toHaveProperty('payCodeId');
      expect(tx).toHaveProperty('periodId');
      expect(tx).toHaveProperty('amount');
      expect(tx).toHaveProperty('quantity');
      expect(tx).toHaveProperty('unit');
      expect(tx).toHaveProperty('status');
      expect(tx).toHaveProperty('submittedAt');
      expect(tx).toHaveProperty('description');
    });

    it('should have transactions with valid statuses', async () => {
      const res = await request(app).get('/api/v1/variable-transactions?pageSize=100');

      res.body.data.forEach((tx: Record<string, unknown>) => {
        expect(['pending', 'approved', 'rejected', 'processed']).toContain(tx.status);
      });
    });
  });

  describe('POST /api/v1/variable-transactions', () => {
    it('should create a new transaction', async () => {
      const empRes = await request(app).get('/api/v1/employees?pageSize=1');
      const employeeId = empRes.body.data[0].employeeId;

      const res = await request(app)
        .post('/api/v1/variable-transactions')
        .send({
          employeeId,
          payCodeId: 'pc-overtid-50',
          periodId: '2026-03',
          amount: 5000,
          quantity: 10,
          unit: 'hours',
          description: 'Extra overtime during processing peak',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.transactionId).toBeDefined();
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.amount).toBe(5000);
      expect(res.body.data.employeeId).toBe(employeeId);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/variable-transactions')
        .send({
          employeeId: 'some-id',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid periodId format', async () => {
      const empRes = await request(app).get('/api/v1/employees?pageSize=1');
      const employeeId = empRes.body.data[0].employeeId;

      const res = await request(app)
        .post('/api/v1/variable-transactions')
        .send({
          employeeId,
          payCodeId: 'pc-overtid-50',
          periodId: '2026/03',
          amount: 5000,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent employee', async () => {
      const res = await request(app)
        .post('/api/v1/variable-transactions')
        .send({
          employeeId: 'non-existent',
          payCodeId: 'pc-overtid-50',
          periodId: '2026-03',
          amount: 5000,
        });

      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent pay code', async () => {
      const empRes = await request(app).get('/api/v1/employees?pageSize=1');
      const employeeId = empRes.body.data[0].employeeId;

      const res = await request(app)
        .post('/api/v1/variable-transactions')
        .send({
          employeeId,
          payCodeId: 'non-existent',
          periodId: '2026-03',
          amount: 5000,
        });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/variable-transactions/:id', () => {
    it('should return a single transaction', async () => {
      const listRes = await request(app).get('/api/v1/variable-transactions?pageSize=1');
      const transactionId = listRes.body.data[0].transactionId;

      const res = await request(app).get(`/api/v1/variable-transactions/${transactionId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactionId).toBe(transactionId);
    });

    it('should return 404 for non-existent transaction', async () => {
      const res = await request(app).get('/api/v1/variable-transactions/non-existent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
