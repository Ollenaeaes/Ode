import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';

export function createPayCodesRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const type = req.query.type as string | undefined;

    let sql = 'SELECT * FROM pay_codes';
    const params: unknown[] = [];

    if (type) {
      sql += ' WHERE type = ?';
      params.push(type);
    }

    sql += ' ORDER BY code';

    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

    res.json({
      data: rows.map(formatPayCode),
    });
  });

  router.get('/:id', (req: Request, res: Response) => {
    const row = db.prepare('SELECT * FROM pay_codes WHERE payCodeId = ?')
      .get(req.params.id) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Pay code not found',
          details: [],
        },
      });
      return;
    }

    res.json({ data: formatPayCode(row) });
  });

  return router;
}

function formatPayCode(row: Record<string, unknown>) {
  return {
    payCodeId: row.payCodeId,
    code: row.code,
    name: row.name,
    type: row.type,
    description: row.description,
    unit: row.unit,
    rate: row.rate,
  };
}
