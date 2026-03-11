import { Router } from 'express';
import type Database from 'better-sqlite3';
import { AppError } from '../../middleware/error.js';

const VALID_CAUSES = ['NATURAL', 'DISEASE', 'HANDLING', 'PREDATION', 'ENVIRONMENT', 'UNKNOWN'] as const;

export function createMortalityRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/biology/mortality
  router.get('/', (req, res) => {
    const { siteId, fromDate, toDate, fishGroupId, cause, limit: limitStr, offset: offsetStr } = req.query;

    const limit = Math.min(Math.max(parseInt(String(limitStr || '100'), 10) || 100, 1), 1000);
    const offset = Math.max(parseInt(String(offsetStr || '0'), 10) || 0, 0);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (siteId) {
      conditions.push('site_id = ?');
      params.push(siteId);
    }
    if (fishGroupId) {
      conditions.push('fish_group_id = ?');
      params.push(fishGroupId);
    }
    if (cause) {
      conditions.push('cause = ?');
      params.push(cause);
    }
    if (fromDate) {
      conditions.push('record_date >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('record_date <= ?');
      params.push(toDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM mortality ${where}`).get(...params) as { total: number };
    const rows = db.prepare(
      `SELECT * FROM mortality ${where} ORDER BY record_date DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({
      data: rows.map(formatMortality),
      total: countRow.total,
      limit,
      offset,
    });
  });

  // POST /api/biology/mortality
  router.post('/', (req, res) => {
    const { siteId, fishGroupId, recordDate, count, cause, notes } = req.body;

    const errors: string[] = [];
    if (!siteId) errors.push('siteId is required');
    if (!recordDate) errors.push('recordDate is required');
    if (!count || count < 1) errors.push('count must be a positive integer');
    if (!cause) errors.push('cause is required');
    if (cause && !VALID_CAUSES.includes(cause)) {
      errors.push(`cause must be one of: ${VALID_CAUSES.join(', ')}`);
    }

    if (errors.length > 0) {
      throw new AppError(400, 'ValidationError', 'Invalid mortality data', errors);
    }

    // Verify site exists
    const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
    if (!site) {
      throw new AppError(404, 'NotFound', `Site with id '${siteId}' not found`);
    }

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO mortality (id, site_id, fish_group_id, record_date, count, cause, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, siteId, fishGroupId || null, recordDate, count, cause, notes || null);

    const created = db.prepare('SELECT * FROM mortality WHERE id = ?').get(id);
    res.status(201).json(formatMortality(created));
  });

  return router;
}

function formatMortality(row: unknown): Record<string, unknown> {
  const r = row as Record<string, unknown>;
  return {
    id: r.id,
    siteId: r.site_id,
    fishGroupId: r.fish_group_id,
    recordDate: r.record_date,
    count: r.count,
    cause: r.cause,
    notes: r.notes,
    createdAt: r.created_at,
  };
}
