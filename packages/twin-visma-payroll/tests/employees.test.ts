import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import type Database from 'better-sqlite3';
import { setupTestApp } from './helpers.js';

describe('Employees API', () => {
  let app: express.Express;
  let db: Database.Database;

  beforeAll(() => {
    ({ app, db } = setupTestApp());
  });

  describe('GET /api/v1/employees', () => {
    it('should return paginated employee list', async () => {
      const res = await request(app).get('/api/v1/employees');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.pageSize).toBe(25);
      expect(res.body.pagination.totalCount).toBeGreaterThanOrEqual(150);
      expect(res.body.pagination.totalPages).toBeGreaterThan(1);
      expect(res.body.data.length).toBe(25);
    });

    it('should respect page and pageSize parameters', async () => {
      const res = await request(app).get('/api/v1/employees?page=2&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.pageSize).toBe(10);
      expect(res.body.data.length).toBe(10);
    });

    it('should filter by departmentId', async () => {
      const res = await request(app).get('/api/v1/employees?departmentId=dept-hatchery');

      expect(res.status).toBe(200);
      expect(res.body.pagination.totalCount).toBe(15);
      res.body.data.forEach((emp: Record<string, unknown>) => {
        expect((emp.department as Record<string, unknown>).departmentId).toBe('dept-hatchery');
      });
    });

    it('should return employees with correct structure', async () => {
      const res = await request(app).get('/api/v1/employees?pageSize=1');

      expect(res.status).toBe(200);
      const emp = res.body.data[0];

      expect(emp).toHaveProperty('employeeId');
      expect(emp).toHaveProperty('firstName');
      expect(emp).toHaveProperty('lastName');
      expect(emp).toHaveProperty('dateOfBirth');
      expect(emp).toHaveProperty('email');
      expect(emp).toHaveProperty('department');
      expect(emp.department).toHaveProperty('departmentId');
      expect(emp.department).toHaveProperty('name');
      expect(emp.department).toHaveProperty('costCenter');
      expect(emp.department).toHaveProperty('siteLocation');
      expect(emp).toHaveProperty('employmentStartDate');
      expect(emp).toHaveProperty('employmentType');
      expect(emp).toHaveProperty('position');
      expect(emp).toHaveProperty('salary');
      expect(emp).toHaveProperty('taxCard');
      expect(emp.taxCard).toHaveProperty('taxTable');
      expect(emp.taxCard).toHaveProperty('taxPercentage');
      expect(emp).toHaveProperty('bankAccount');
      expect(emp).toHaveProperty('active');
    });

    it('should mask bank account numbers', async () => {
      const res = await request(app).get('/api/v1/employees?pageSize=5');

      res.body.data.forEach((emp: Record<string, unknown>) => {
        expect(emp.bankAccount).toMatch(/^\*\*\*\*\d{4}$/);
      });
    });

    it('should return correct department distribution', async () => {
      const res = await request(app).get('/api/v1/employees?pageSize=200');

      const deptCounts: Record<string, number> = {};
      res.body.data.forEach((emp: Record<string, unknown>) => {
        const deptId = (emp.department as Record<string, unknown>).departmentId as string;
        deptCounts[deptId] = (deptCounts[deptId] || 0) + 1;
      });

      expect(deptCounts['dept-hatchery']).toBe(15);
      expect(deptCounts['dept-sea-ops']).toBe(60);
      expect(deptCounts['dept-processing']).toBe(45);
      expect(deptCounts['dept-sales']).toBe(10);
      expect(deptCounts['dept-admin']).toBe(15);
      expect(deptCounts['dept-rnd']).toBe(10);
    });

    it('should have valid employment types', async () => {
      const res = await request(app).get('/api/v1/employees?pageSize=200');

      res.body.data.forEach((emp: Record<string, unknown>) => {
        expect(['full-time', 'part-time', 'seasonal']).toContain(emp.employmentType);
      });
    });

    it('should cap pageSize at 1000', async () => {
      const res = await request(app).get('/api/v1/employees?pageSize=5000');

      expect(res.body.pagination.pageSize).toBe(1000);
    });
  });

  describe('GET /api/v1/employees/:id', () => {
    it('should return a single employee', async () => {
      const listRes = await request(app).get('/api/v1/employees?pageSize=1');
      const employeeId = listRes.body.data[0].employeeId;

      const res = await request(app).get(`/api/v1/employees/${employeeId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.employeeId).toBe(employeeId);
      expect(res.body.data).toHaveProperty('department');
      expect(typeof res.body.data.active).toBe('boolean');
    });

    it('should return 404 for non-existent employee', async () => {
      const res = await request(app).get('/api/v1/employees/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Employee not found');
    });
  });
});
