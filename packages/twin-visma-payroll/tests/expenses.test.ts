import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { setupTestApp } from './helpers.js';

describe('Expenses API', () => {
  let app: express.Express;

  beforeAll(() => {
    ({ app } = setupTestApp());
  });

  describe('GET /api/v1/expenses', () => {
    it('should return paginated expenses', async () => {
      const res = await request(app).get('/api/v1/expenses');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.totalCount).toBeGreaterThan(0);
    });

    it('should filter by employeeId', async () => {
      // Find an employee with expenses
      const allExpenses = await request(app).get('/api/v1/expenses?pageSize=1');
      const employeeId = allExpenses.body.data[0].employeeId;

      const res = await request(app).get(`/api/v1/expenses?employeeId=${employeeId}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((exp: Record<string, unknown>) => {
        expect(exp.employeeId).toBe(employeeId);
      });
    });

    it('should filter by status', async () => {
      const res = await request(app).get('/api/v1/expenses?status=reimbursed');

      expect(res.status).toBe(200);
      res.body.data.forEach((exp: Record<string, unknown>) => {
        expect(exp.status).toBe('reimbursed');
      });
    });

    it('should filter by type', async () => {
      const res = await request(app).get('/api/v1/expenses?type=mileage');

      expect(res.status).toBe(200);
      res.body.data.forEach((exp: Record<string, unknown>) => {
        expect(exp.type).toBe('mileage');
      });
    });

    it('should have correct expense structure', async () => {
      const res = await request(app).get('/api/v1/expenses?pageSize=1');

      const exp = res.body.data[0];
      expect(exp).toHaveProperty('expenseId');
      expect(exp).toHaveProperty('employeeId');
      expect(exp).toHaveProperty('type');
      expect(exp).toHaveProperty('status');
      expect(exp).toHaveProperty('submittedAt');
      expect(exp).toHaveProperty('totalAmount');
      expect(exp).toHaveProperty('currency');
      expect(exp).toHaveProperty('description');
      expect(exp).toHaveProperty('periodId');
    });

    it('should have valid expense types', async () => {
      const res = await request(app).get('/api/v1/expenses?pageSize=100');

      res.body.data.forEach((exp: Record<string, unknown>) => {
        expect(['travel', 'mileage', 'expense']).toContain(exp.type);
      });
    });

    it('should have valid statuses', async () => {
      const res = await request(app).get('/api/v1/expenses?pageSize=100');

      res.body.data.forEach((exp: Record<string, unknown>) => {
        expect(['draft', 'submitted', 'approved', 'rejected', 'reimbursed']).toContain(exp.status);
      });
    });
  });

  describe('POST /api/v1/expenses', () => {
    it('should return 405 Method Not Allowed', async () => {
      const res = await request(app)
        .post('/api/v1/expenses')
        .send({ type: 'travel', description: 'test' });

      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });
  });

  describe('GET /api/v1/expenses/:id', () => {
    it('should return a single expense with line items', async () => {
      const listRes = await request(app).get('/api/v1/expenses?pageSize=1');
      const expenseId = listRes.body.data[0].expenseId;

      const res = await request(app).get(`/api/v1/expenses/${expenseId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.expenseId).toBe(expenseId);
      expect(res.body.data.lineItems).toBeDefined();
      expect(Array.isArray(res.body.data.lineItems)).toBe(true);
      expect(res.body.data.lineItems.length).toBeGreaterThan(0);
    });

    it('should have correct line item structure', async () => {
      const listRes = await request(app).get('/api/v1/expenses?pageSize=1');
      const expenseId = listRes.body.data[0].expenseId;

      const res = await request(app).get(`/api/v1/expenses/${expenseId}`);

      const item = res.body.data.lineItems[0];
      expect(item).toHaveProperty('lineItemId');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('amount');
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('date');
    });

    it('should return 404 for non-existent expense', async () => {
      const res = await request(app).get('/api/v1/expenses/non-existent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should include mileage data for mileage expenses', async () => {
      const mileageRes = await request(app).get('/api/v1/expenses?type=mileage&pageSize=1');
      if (mileageRes.body.data.length === 0) return; // skip if no mileage expenses

      const expenseId = mileageRes.body.data[0].expenseId;
      const res = await request(app).get(`/api/v1/expenses/${expenseId}`);

      const mileageItem = res.body.data.lineItems.find((li: Record<string, unknown>) => li.mileageKm !== null);
      expect(mileageItem).toBeDefined();
      expect(mileageItem.mileageRate).toBe(3.5);
    });
  });
});
