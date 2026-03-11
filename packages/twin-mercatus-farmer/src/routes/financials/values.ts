import { Router } from 'express';
import type Database from 'better-sqlite3';
import { AppError } from '../../middleware/error.js';

const VALID_METRICS = ['FEED_COST_PER_KG', 'FISH_COST_PER_KG', 'INVENTORY_VALUE', 'BIOMASS_VALUE'] as const;

export function createFinancialsRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/financials/values
  router.get('/values', (req, res) => {
    const { siteId, metric, fromPeriod, toPeriod, limit: limitStr, offset: offsetStr } = req.query;

    const limit = Math.min(Math.max(parseInt(String(limitStr || '100'), 10) || 100, 1), 1000);
    const offset = Math.max(parseInt(String(offsetStr || '0'), 10) || 0, 0);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (siteId) {
      conditions.push('site_id = ?');
      params.push(siteId);
    }
    if (metric) {
      conditions.push('metric = ?');
      params.push(metric);
    }
    if (fromPeriod) {
      conditions.push('period >= ?');
      params.push(fromPeriod);
    }
    if (toPeriod) {
      conditions.push('period <= ?');
      params.push(toPeriod);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM financial_values ${where}`).get(...params) as { total: number };
    const rows = db.prepare(
      `SELECT * FROM financial_values ${where} ORDER BY period DESC, metric LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({
      data: rows.map(formatFinancialValue),
      total: countRow.total,
      limit,
      offset,
    });
  });

  // POST /api/financials/values-import
  router.post('/values-import', (req, res) => {
    const records = Array.isArray(req.body) ? req.body : [req.body];
    const created: unknown[] = [];
    const errors: string[] = [];

    const insertStmt = db.prepare(`
      INSERT INTO financial_values (id, site_id, metric, period, value, currency)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: Array<Record<string, unknown>>) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemErrors: string[] = [];
        if (!item.siteId) itemErrors.push(`[${i}] siteId is required`);
        if (!item.metric) itemErrors.push(`[${i}] metric is required`);
        if (item.metric && !VALID_METRICS.includes(item.metric as typeof VALID_METRICS[number])) {
          itemErrors.push(`[${i}] metric must be one of: ${VALID_METRICS.join(', ')}`);
        }
        if (!item.period) itemErrors.push(`[${i}] period is required`);
        if (item.value === undefined || item.value === null) itemErrors.push(`[${i}] value is required`);

        if (itemErrors.length > 0) {
          errors.push(...itemErrors);
          continue;
        }

        const id = crypto.randomUUID();
        insertStmt.run(id, item.siteId, item.metric, item.period, item.value, item.currency || 'NOK');
        const row = db.prepare('SELECT * FROM financial_values WHERE id = ?').get(id);
        created.push(formatFinancialValue(row));
      }
    });

    insertMany(records);

    if (errors.length > 0 && created.length === 0) {
      throw new AppError(400, 'ValidationError', 'All records failed validation', errors);
    }

    res.status(201).json({
      data: created,
      imported: created.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  });

  return router;
}

function formatFinancialValue(row: unknown): Record<string, unknown> {
  const r = row as Record<string, unknown>;
  return {
    id: r.id,
    siteId: r.site_id,
    metric: r.metric,
    period: r.period,
    value: r.value,
    currency: r.currency,
    createdAt: r.created_at,
  };
}
