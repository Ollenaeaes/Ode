import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';

export function createVariableTransactionsRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const periodId = req.query.periodId as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;
    const status = req.query.status as string | undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (periodId) {
      conditions.push('vt.periodId = ?');
      params.push(periodId);
    }
    if (employeeId) {
      conditions.push('vt.employeeId = ?');
      params.push(employeeId);
    }
    if (status) {
      conditions.push('vt.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    const countSql = `SELECT COUNT(*) as count FROM variable_transactions vt${whereClause}`;
    const totalCount = (db.prepare(countSql).get(...params) as { count: number }).count;
    const totalPages = Math.ceil(totalCount / pageSize);
    const offset = (page - 1) * pageSize;

    const dataSql = `SELECT vt.*, pc.code as payCodeCode, pc.name as payCodeName
                     FROM variable_transactions vt
                     JOIN pay_codes pc ON vt.payCodeId = pc.payCodeId
                     ${whereClause}
                     ORDER BY vt.submittedAt DESC
                     LIMIT ? OFFSET ?`;

    const rows = db.prepare(dataSql).all(...params, pageSize, offset) as Array<Record<string, unknown>>;

    res.json({
      data: rows.map(formatTransaction),
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
    });
  });

  router.post('/', (req: Request, res: Response) => {
    const { employeeId, payCodeId, periodId, amount, quantity, unit, description } = req.body;

    // Validate required fields
    const missing: string[] = [];
    if (!employeeId) missing.push('employeeId');
    if (!payCodeId) missing.push('payCodeId');
    if (!periodId) missing.push('periodId');
    if (amount === undefined || amount === null) missing.push('amount');

    if (missing.length > 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Missing required fields: ${missing.join(', ')}`,
          details: missing.map(f => ({ field: f, message: `${f} is required` })),
        },
      });
      return;
    }

    // Validate periodId format
    if (!/^\d{4}-\d{2}$/.test(periodId)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'periodId must be in YYYY-MM format',
          details: [{ field: 'periodId', message: 'Invalid format' }],
        },
      });
      return;
    }

    // Verify employee exists
    const employee = db.prepare('SELECT employeeId FROM employees WHERE employeeId = ?').get(employeeId);
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
          details: [],
        },
      });
      return;
    }

    // Verify pay code exists
    const payCode = db.prepare('SELECT payCodeId FROM pay_codes WHERE payCodeId = ?').get(payCodeId);
    if (!payCode) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Pay code not found',
          details: [],
        },
      });
      return;
    }

    const transactionId = crypto.randomUUID();
    const submittedAt = new Date().toISOString();

    db.prepare(
      `INSERT INTO variable_transactions (transactionId, employeeId, payCodeId, periodId, amount, quantity, unit, status, submittedAt, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).run(transactionId, employeeId, payCodeId, periodId, amount, quantity ?? null, unit ?? null, submittedAt, description ?? null);

    const created = db.prepare(
      `SELECT vt.*, pc.code as payCodeCode, pc.name as payCodeName
       FROM variable_transactions vt
       JOIN pay_codes pc ON vt.payCodeId = pc.payCodeId
       WHERE vt.transactionId = ?`
    ).get(transactionId) as Record<string, unknown>;

    res.status(201).json({ data: formatTransaction(created) });
  });

  router.get('/:id', (req: Request, res: Response) => {
    const row = db.prepare(
      `SELECT vt.*, pc.code as payCodeCode, pc.name as payCodeName
       FROM variable_transactions vt
       JOIN pay_codes pc ON vt.payCodeId = pc.payCodeId
       WHERE vt.transactionId = ?`
    ).get(req.params.id) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Variable transaction not found',
          details: [],
        },
      });
      return;
    }

    res.json({ data: formatTransaction(row) });
  });

  return router;
}

function formatTransaction(row: Record<string, unknown>) {
  return {
    transactionId: row.transactionId,
    employeeId: row.employeeId,
    payCodeId: row.payCodeId,
    periodId: row.periodId,
    amount: row.amount,
    quantity: row.quantity,
    unit: row.unit,
    status: row.status,
    submittedAt: row.submittedAt,
    description: row.description,
  };
}
