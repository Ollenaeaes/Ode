import { Router } from 'express';
import type Database from 'better-sqlite3';
import { AppError } from '../../middleware/error.js';

const ENVIRONMENT_PARAMS = ['temperature', 'oxygen', 'salinity', 'current_speed', 'wave_height', 'light_intensity'] as const;

export function createEnvironmentRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/timeseries/environment/:siteId
  router.get('/:siteId', (req, res) => {
    const { siteId } = req.params;
    const { parameter, fromDate, toDate, aggregation, limit: limitStr, offset: offsetStr } = req.query;

    // Verify site exists
    const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
    if (!site) {
      throw new AppError(404, 'NotFound', `Site with id '${siteId}' not found`);
    }

    const limit = Math.min(Math.max(parseInt(String(limitStr || '100'), 10) || 100, 1), 1000);
    const offset = Math.max(parseInt(String(offsetStr || '0'), 10) || 0, 0);

    const conditions: string[] = ['site_id = ?', "source = 'sensor'"];
    const params: unknown[] = [siteId];

    if (parameter) {
      // Support comma-separated parameters
      const paramList = String(parameter).split(',').map((p) => p.trim());
      conditions.push(`parameter IN (${paramList.map(() => '?').join(', ')})`);
      params.push(...paramList);
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
    const agg = String(aggregation || 'raw');

    if (agg === 'raw') {
      const countRow = db.prepare(`SELECT COUNT(*) as total FROM time_series ${where}`).get(...params) as { total: number };
      const rows = db.prepare(
        `SELECT * FROM time_series ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
      ).all(...params, limit, offset);

      res.json({
        data: rows.map(formatTimeSeries),
        total: countRow.total,
        limit,
        offset,
        aggregation: 'raw',
      });
    } else if (agg === 'hourly' || agg === 'daily') {
      const truncFn = agg === 'hourly'
        ? "strftime('%Y-%m-%dT%H:00:00', timestamp)"
        : "strftime('%Y-%m-%d', timestamp)";

      const aggQuery = `
        SELECT
          ${truncFn} as period,
          parameter,
          site_id,
          AVG(value) as avg_value,
          MIN(value) as min_value,
          MAX(value) as max_value,
          COUNT(*) as sample_count
        FROM time_series ${where}
        GROUP BY ${truncFn}, parameter
        ORDER BY period DESC
        LIMIT ? OFFSET ?
      `;

      const countQuery = `
        SELECT COUNT(*) as total FROM (
          SELECT ${truncFn} as period, parameter
          FROM time_series ${where}
          GROUP BY ${truncFn}, parameter
        )
      `;

      const countRow = db.prepare(countQuery).get(...params) as { total: number };
      const rows = db.prepare(aggQuery).all(...params, limit, offset);

      res.json({
        data: rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            period: r.period,
            parameter: r.parameter,
            siteId: r.site_id,
            avgValue: r.avg_value,
            minValue: r.min_value,
            maxValue: r.max_value,
            sampleCount: r.sample_count,
          };
        }),
        total: countRow.total,
        limit,
        offset,
        aggregation: agg,
      });
    } else {
      throw new AppError(400, 'ValidationError', `Invalid aggregation: '${agg}'. Must be one of: raw, hourly, daily`);
    }
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
