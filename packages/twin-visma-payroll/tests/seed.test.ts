import { describe, it, expect, beforeAll } from 'vitest';
import { createDatabase } from '../src/db.js';
import { seedDatabase, DEPARTMENTS, PAY_CODES, PERIODS, DEPT_EMPLOYEE_COUNTS } from '../src/seed.js';
import type Database from 'better-sqlite3';

describe('Data Generation (Seed)', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = createDatabase();
    seedDatabase(db, 42);
  });

  it('should create all departments', () => {
    const depts = db.prepare('SELECT COUNT(*) as count FROM departments').get() as { count: number };
    expect(depts.count).toBe(DEPARTMENTS.length);
  });

  it('should create all pay codes', () => {
    const pcs = db.prepare('SELECT COUNT(*) as count FROM pay_codes').get() as { count: number };
    expect(pcs.count).toBe(PAY_CODES.length);
  });

  it('should create 155 employees', () => {
    const emps = db.prepare('SELECT COUNT(*) as count FROM employees').get() as { count: number };
    expect(emps.count).toBe(155);
  });

  it('should have correct employees per department', () => {
    for (const [deptId, expectedCount] of Object.entries(DEPT_EMPLOYEE_COUNTS)) {
      const result = db.prepare('SELECT COUNT(*) as count FROM employees WHERE departmentId = ?').get(deptId) as { count: number };
      expect(result.count).toBe(expectedCount);
    }
  });

  it('should have realistic salaries', () => {
    const salaries = db.prepare('SELECT salary, departmentId FROM employees').all() as Array<{ salary: number; departmentId: string }>;

    const processingEmps = salaries.filter(s => s.departmentId === 'dept-processing');
    const seaOpsEmps = salaries.filter(s => s.departmentId === 'dept-sea-ops');
    const adminEmps = salaries.filter(s => s.departmentId === 'dept-admin');

    // Check salary ranges
    processingEmps.forEach(e => {
      expect(e.salary).toBeGreaterThanOrEqual(350000);
      expect(e.salary).toBeLessThanOrEqual(450000);
    });

    seaOpsEmps.forEach(e => {
      expect(e.salary).toBeGreaterThanOrEqual(450000);
      expect(e.salary).toBeLessThanOrEqual(550000);
    });

    adminEmps.forEach(e => {
      expect(e.salary).toBeGreaterThanOrEqual(500000);
      expect(e.salary).toBeLessThanOrEqual(800000);
    });
  });

  it('should generate variable transactions across 6 periods', () => {
    for (const period of PERIODS) {
      const result = db.prepare('SELECT COUNT(*) as count FROM variable_transactions WHERE periodId = ?').get(period) as { count: number };
      expect(result.count).toBeGreaterThan(0);
    }
  });

  it('should generate variable transactions primarily for sea ops and processing', () => {
    const seaOpsCount = db.prepare(
      `SELECT COUNT(*) as count FROM variable_transactions vt
       JOIN employees e ON vt.employeeId = e.employeeId
       WHERE e.departmentId = 'dept-sea-ops'`
    ).get() as { count: number };

    const processingCount = db.prepare(
      `SELECT COUNT(*) as count FROM variable_transactions vt
       JOIN employees e ON vt.employeeId = e.employeeId
       WHERE e.departmentId = 'dept-processing'`
    ).get() as { count: number };

    const totalCount = db.prepare('SELECT COUNT(*) as count FROM variable_transactions').get() as { count: number };

    // Sea ops + processing should be the vast majority
    expect(seaOpsCount.count + processingCount.count).toBe(totalCount.count);
  });

  it('should generate expenses across periods', () => {
    const result = db.prepare('SELECT COUNT(*) as count FROM expenses').get() as { count: number };
    expect(result.count).toBeGreaterThan(50);

    for (const period of PERIODS) {
      const periodResult = db.prepare('SELECT COUNT(*) as count FROM expenses WHERE periodId = ?').get(period) as { count: number };
      expect(periodResult.count).toBeGreaterThan(0);
    }
  });

  it('should generate expense line items for each expense', () => {
    const expenses = db.prepare('SELECT expenseId FROM expenses').all() as Array<{ expenseId: string }>;

    for (const exp of expenses) {
      const lineItems = db.prepare('SELECT COUNT(*) as count FROM expense_line_items WHERE expenseId = ?').get(exp.expenseId) as { count: number };
      expect(lineItems.count).toBeGreaterThan(0);
    }
  });

  it('should generate accounting transactions with balanced debits and credits', () => {
    for (const period of PERIODS) {
      const result = db.prepare(
        `SELECT SUM(debitAmount) as totalDebit, SUM(creditAmount) as totalCredit
         FROM accounting_transactions WHERE periodId = ?`
      ).get(period) as { totalDebit: number; totalCredit: number };

      expect(Math.abs(result.totalDebit - result.totalCredit)).toBeLessThan(1);
    }
  });

  it('should produce deterministic output with same seed', () => {
    const db2 = createDatabase();
    seedDatabase(db2, 42);

    const emps1 = db.prepare('SELECT firstName, lastName FROM employees ORDER BY firstName, lastName').all();
    const emps2 = db2.prepare('SELECT firstName, lastName FROM employees ORDER BY firstName, lastName').all();

    expect(emps1).toEqual(emps2);
  });

  it('should have Norwegian-style emails at ode.no', () => {
    const emails = db.prepare('SELECT email FROM employees').all() as Array<{ email: string }>;

    emails.forEach(e => {
      expect(e.email).toMatch(/@ode\.no$/);
    });
  });

  it('should have valid employment types', () => {
    const types = db.prepare('SELECT DISTINCT employmentType FROM employees').all() as Array<{ employmentType: string }>;
    const typeSet = new Set(types.map(t => t.employmentType));

    expect(typeSet.has('full-time')).toBe(true);
    // Should have some seasonal (processing) and part-time
    expect(typeSet.has('seasonal')).toBe(true);
    expect(typeSet.has('part-time')).toBe(true);
  });

  it('should have mileage expenses with correct rate', () => {
    const mileageItems = db.prepare(
      `SELECT eli.mileageRate, eli.mileageKm FROM expense_line_items eli
       JOIN expenses e ON eli.expenseId = e.expenseId
       WHERE e.type = 'mileage'`
    ).all() as Array<{ mileageRate: number; mileageKm: number }>;

    expect(mileageItems.length).toBeGreaterThan(0);
    mileageItems.forEach(item => {
      expect(item.mileageRate).toBe(3.5);
      expect(item.mileageKm).toBeGreaterThan(0);
    });
  });
});
