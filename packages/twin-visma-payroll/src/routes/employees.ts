import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { maskBankAccount } from '../seed.js';

export function createEmployeesRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(1000, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const departmentId = req.query.departmentId as string | undefined;

    let countSql = 'SELECT COUNT(*) as count FROM employees';
    let dataSql = `SELECT e.*, d.name as departmentName, d.costCenter, d.siteLocation
                   FROM employees e
                   JOIN departments d ON e.departmentId = d.departmentId`;
    const params: unknown[] = [];

    if (departmentId) {
      countSql += ' WHERE departmentId = ?';
      dataSql += ' WHERE e.departmentId = ?';
      params.push(departmentId);
    }

    dataSql += ' ORDER BY e.lastName, e.firstName LIMIT ? OFFSET ?';

    const totalCount = (db.prepare(countSql).get(...params) as { count: number }).count;
    const totalPages = Math.ceil(totalCount / pageSize);
    const offset = (page - 1) * pageSize;

    const rows = db.prepare(dataSql).all(...params, pageSize, offset) as Array<Record<string, unknown>>;

    const data = rows.map(formatEmployee);

    res.json({
      data,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
    });
  });

  router.get('/:id', (req: Request, res: Response) => {
    const row = db.prepare(
      `SELECT e.*, d.name as departmentName, d.costCenter, d.siteLocation
       FROM employees e
       JOIN departments d ON e.departmentId = d.departmentId
       WHERE e.employeeId = ?`
    ).get(req.params.id) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
          details: [],
        },
      });
      return;
    }

    res.json({ data: formatEmployee(row) });
  });

  return router;
}

function formatEmployee(row: Record<string, unknown>) {
  return {
    employeeId: row.employeeId,
    firstName: row.firstName,
    lastName: row.lastName,
    dateOfBirth: row.dateOfBirth,
    email: row.email,
    department: {
      departmentId: row.departmentId,
      name: row.departmentName,
      costCenter: row.costCenter,
      siteLocation: row.siteLocation,
    },
    employmentStartDate: row.employmentStartDate,
    employmentType: row.employmentType,
    position: row.position,
    salary: row.salary,
    taxCard: {
      taxTable: row.taxTable,
      taxPercentage: row.taxPercentage,
    },
    bankAccount: maskBankAccount(row.bankAccount as string),
    active: row.active === 1,
  };
}
