import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';

export function createExpensesRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
    const employeeId = req.query.employeeId as string | undefined;
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const periodId = req.query.periodId as string | undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (employeeId) {
      conditions.push('e.employeeId = ?');
      params.push(employeeId);
    }
    if (status) {
      conditions.push('e.status = ?');
      params.push(status);
    }
    if (type) {
      conditions.push('e.type = ?');
      params.push(type);
    }
    if (periodId) {
      conditions.push('e.periodId = ?');
      params.push(periodId);
    }

    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    const countSql = `SELECT COUNT(*) as count FROM expenses e${whereClause}`;
    const totalCount = (db.prepare(countSql).get(...params) as { count: number }).count;
    const totalPages = Math.ceil(totalCount / pageSize);
    const offset = (page - 1) * pageSize;

    const dataSql = `SELECT e.*
                     FROM expenses e
                     ${whereClause}
                     ORDER BY e.submittedAt DESC
                     LIMIT ? OFFSET ?`;

    const rows = db.prepare(dataSql).all(...params, pageSize, offset) as Array<Record<string, unknown>>;

    res.json({
      data: rows.map(formatExpense),
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
    });
  });

  router.post('/', (_req: Request, res: Response) => {
    res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Expense creation is not supported through this API. Use the Visma Expense app.',
        details: [],
      },
    });
  });

  router.get('/:id', (req: Request, res: Response) => {
    const expense = db.prepare('SELECT * FROM expenses WHERE expenseId = ?')
      .get(req.params.id) as Record<string, unknown> | undefined;

    if (!expense) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Expense not found',
          details: [],
        },
      });
      return;
    }

    const lineItems = db.prepare('SELECT * FROM expense_line_items WHERE expenseId = ? ORDER BY date')
      .all(req.params.id) as Array<Record<string, unknown>>;

    res.json({
      data: {
        ...formatExpense(expense),
        lineItems: lineItems.map(formatLineItem),
      },
    });
  });

  return router;
}

function formatExpense(row: Record<string, unknown>) {
  return {
    expenseId: row.expenseId,
    employeeId: row.employeeId,
    type: row.type,
    status: row.status,
    submittedAt: row.submittedAt,
    approvedAt: row.approvedAt,
    totalAmount: row.totalAmount,
    currency: row.currency,
    description: row.description,
    periodId: row.periodId,
  };
}

function formatLineItem(row: Record<string, unknown>) {
  return {
    lineItemId: row.lineItemId,
    description: row.description,
    amount: row.amount,
    category: row.category,
    date: row.date,
    receiptUrl: row.receiptUrl,
    mileageKm: row.mileageKm,
    mileageRate: row.mileageRate,
  };
}
