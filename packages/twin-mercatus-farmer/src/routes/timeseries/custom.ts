import { Router } from 'express';
import type Database from 'better-sqlite3';
import { AppError } from '../../middleware/error.js';

export function createCustomTimeseriesRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/timeseries/custom
  router.get('/', (req, res) => {
    const { siteId, parameter, fromDate, toDate, limit: limitStr, offset: offsetStr } = req.query;

    const limit = Math.min(Math.max(parseInt(String(limitStr || '100'), 10) || 100, 1), 1000);
    const offset = Math.max(parseInt(String(offsetStr || '0'), 10) || 0, 0);

    const conditions: string[] = ["source = 'custom'"];
    const params: unknown[] = [];

    if (siteId) {
      conditions.push('site_id = ?');
      params.push(siteId);
    }
    if (parameter) {
      conditions.push('parameter = ?');
      params.push(parameter);
    }
    if (fromDate) {
      conditions.push('timestamp >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('timestamp <= ?');
      params.push(toDate);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM time_series ${where}`).get(...params) as { total: number };
    const rows = db.prepare(
      `SELECT * FROM time_series ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({
      data: rows.map(formatTimeSeries),
      total: countRow.total,
      limit,
      offset,
    });
  });

  // POST /api/timeseries/custom
  router.post('/', (req, res) => {
    const { siteId, parameter, timestamp, value, unit } = req.body;

    const errors: string[] = [];
    if (!siteId) errors.push('siteId is required');
    if (!parameter) errors.push('parameter is required');
    if (!timestamp) errors.push('timestamp is required');
    if (value === undefined || value === null) errors.push('value is required');

    if (errors.length > 0) {
      throw new AppError(400, 'ValidationError', 'Invalid custom time series data', errors);
    }

    // Verify site exists
    const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
    if (!site) {
      throw new AppError(404, 'NotFound', `Site with id '${siteId}' not found`);
    }

    db.prepare(`
      INSERT INTO time_series (site_id, parameter, timestamp, value, unit, source)
      VALUES (?, ?, ?, ?, ?, 'custom')
    `).run(siteId, parameter, timestamp, value, unit || null);

    const created = db.prepare('SELECT * FROM time_series WHERE rowid = last_insert_rowid()').get();
    res.status(201).json(formatTimeSeries(created));
  });

  return router;
}

function formatTimeSeries(row: unknown): Record<string, unknown> {
  const r = row as Record<string, unknown>;
  return {
    id: r.id,
    siteId: r.site_id,
    parameter: r.parameter,
    timestamp: r.timestamp,
    value: r.value,
    unit: r.unit,
    source: r.source,
    createdAt: r.created_at,
  };
}
