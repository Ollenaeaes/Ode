import { Router } from 'express';
import type Database from 'better-sqlite3';
import { AppError } from '../../middleware/error.js';

export function createHarvestImportsRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/biology/harvest-imports
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
      conditions.push('harvest_date >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('harvest_date <= ?');
      params.push(toDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM harvest_imports ${where}`).get(...params) as { total: number };
    const rows = db.prepare(
      `SELECT * FROM harvest_imports ${where} ORDER BY harvest_date DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({
      data: rows.map(formatHarvestImport),
      total: countRow.total,
      limit,
      offset,
    });
  });

  // POST /api/biology/harvest-imports
  router.post('/', (req, res) => {
    const { siteId, fishGroupId, harvestDate, count, totalWeightKg, averageWeightGrams, qualityGrade, destination } = req.body;

    const errors: string[] = [];
    if (!siteId) errors.push('siteId is required');
    if (!harvestDate) errors.push('harvestDate is required');
    if (!count || count < 1) errors.push('count must be a positive integer');
    if (!totalWeightKg || totalWeightKg <= 0) errors.push('totalWeightKg must be positive');
    if (!averageWeightGrams || averageWeightGrams <= 0) errors.push('averageWeightGrams must be positive');

    if (errors.length > 0) {
      throw new AppError(400, 'ValidationError', 'Invalid harvest import data', errors);
    }

    // Verify site exists
    const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
    if (!site) {
      throw new AppError(404, 'NotFound', `Site with id '${siteId}' not found`);
    }

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO harvest_imports (id, site_id, fish_group_id, harvest_date, count, total_weight_kg, average_weight_grams, quality_grade, destination)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, siteId, fishGroupId || null, harvestDate, count, totalWeightKg, averageWeightGrams, qualityGrade || null, destination || null);

    const created = db.prepare('SELECT * FROM harvest_imports WHERE id = ?').get(id);
    res.status(201).json(formatHarvestImport(created));
  });

  return router;
}

function formatHarvestImport(row: unknown): Record<string, unknown> {
  const r = row as Record<string, unknown>;
  return {
    id: r.id,
    siteId: r.site_id,
    fishGroupId: r.fish_group_id,
    harvestDate: r.harvest_date,
    count: r.count,
    totalWeightKg: r.total_weight_kg,
    averageWeightGrams: r.average_weight_grams,
    qualityGrade: r.quality_grade,
    destination: r.destination,
    createdAt: r.created_at,
  };
}
