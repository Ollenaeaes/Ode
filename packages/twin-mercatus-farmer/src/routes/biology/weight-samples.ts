import { Router } from 'express';
import type Database from 'better-sqlite3';
import { AppError } from '../../middleware/error.js';

export function createWeightSamplesRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/biology/weight-samples
  router.get('/', (req, res) => {
    const { siteId, fromDate, toDate, fishGroupId, limit: limitStr, offset: offsetStr } = req.query;

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
    if (fromDate) {
      conditions.push('sample_date >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('sample_date <= ?');
      params.push(toDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM weight_samples ${where}`).get(...params) as { total: number };
    const rows = db.prepare(
      `SELECT * FROM weight_samples ${where} ORDER BY sample_date DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({
      data: rows.map(formatWeightSample),
      total: countRow.total,
      limit,
      offset,
    });
  });

  // POST /api/biology/weight-samples
  router.post('/', (req, res) => {
    const { siteId, fishGroupId, sampleDate, count, averageWeightGrams, minWeightGrams, maxWeightGrams, stdDevGrams, conditionFactor } = req.body;

    const errors: string[] = [];
    if (!siteId) errors.push('siteId is required');
    if (!sampleDate) errors.push('sampleDate is required');
    if (!count || count < 1) errors.push('count must be a positive integer');
    if (!averageWeightGrams || averageWeightGrams <= 0) errors.push('averageWeightGrams must be positive');

    if (errors.length > 0) {
      throw new AppError(400, 'ValidationError', 'Invalid weight sample data', errors);
    }

    // Verify site exists
    const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
    if (!site) {
      throw new AppError(404, 'NotFound', `Site with id '${siteId}' not found`);
    }

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO weight_samples (id, site_id, fish_group_id, sample_date, count, average_weight_grams, min_weight_grams, max_weight_grams, std_dev_grams, condition_factor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, siteId, fishGroupId || null, sampleDate, count, averageWeightGrams, minWeightGrams || null, maxWeightGrams || null, stdDevGrams || null, conditionFactor || null);

    const created = db.prepare('SELECT * FROM weight_samples WHERE id = ?').get(id);
    res.status(201).json(formatWeightSample(created));
  });

  return router;
}

function formatWeightSample(row: unknown): Record<string, unknown> {
  const r = row as Record<string, unknown>;
  return {
    id: r.id,
    siteId: r.site_id,
    fishGroupId: r.fish_group_id,
    sampleDate: r.sample_date,
    count: r.count,
    averageWeightGrams: r.average_weight_grams,
    minWeightGrams: r.min_weight_grams,
    maxWeightGrams: r.max_weight_grams,
    stdDevGrams: r.std_dev_grams,
    conditionFactor: r.condition_factor,
    createdAt: r.created_at,
  };
}
