import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';

export function createAccountingTransactionsRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const periodId = req.query.periodId as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const accountCode = req.query.accountCode as string | undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (periodId) {
      conditions.push('at.periodId = ?');
      params.push(periodId);
    }
    if (departmentId) {
      conditions.push('at.departmentId = ?');
      params.push(departmentId);
    }
    if (accountCode) {
      conditions.push('at.accountCode = ?');
      params.push(accountCode);
    }

    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    const countSql = `SELECT COUNT(*) as count FROM accounting_transactions at${whereClause}`;
    const totalCount = (db.prepare(countSql).get(...params) as { count: number }).count;
    const totalPages = Math.ceil(totalCount / pageSize);
    const offset = (page - 1) * pageSize;

    const dataSql = `SELECT at.*, d.name as departmentName
                     FROM accounting_transactions at
                     JOIN departments d ON at.departmentId = d.departmentId
                     ${whereClause}
                     ORDER BY at.transactionDate DESC, at.accountCode
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

  router.get('/:id', (req: Request, res: Response) => {
    const row = db.prepare(
      `SELECT at.*, d.name as departmentName
       FROM accounting_transactions at
       JOIN departments d ON at.departmentId = d.departmentId
       WHERE at.transactionId = ?`
    ).get(req.params.id) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Accounting transaction not found',
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
    periodId: row.periodId,
    accountCode: row.accountCode,
    departmentId: row.departmentId,
    department: {
      departmentId: row.departmentId,
      name: row.departmentName,
    },
    description: row.description,
    debitAmount: row.debitAmount,
    creditAmount: row.creditAmount,
    payCodeId: row.payCodeId,
    transactionDate: row.transactionDate,
  };
}
