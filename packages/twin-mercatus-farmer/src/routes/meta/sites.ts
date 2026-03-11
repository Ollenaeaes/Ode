import { Router } from 'express';
import type Database from 'better-sqlite3';

export function createSitesRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/meta/sites
  router.get('/', (_req, res) => {
    const sites = db.prepare('SELECT * FROM sites ORDER BY name').all();
    res.json({
      data: sites.map(formatSite),
      total: sites.length,
    });
  });

  // GET /api/meta/sites/:id
  router.get('/:id', (req, res) => {
    const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
    if (!site) {
      res.status(404).json({
        error: 'NotFound',
        message: `Site with id '${req.params.id}' not found`,
        details: [],
      });
      return;
    }
    res.json(formatSite(site));
  });

  return router;
}

function formatSite(row: unknown): Record<string, unknown> {
  const r = row as Record<string, unknown>;
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    municipality: r.municipality,
    postalCode: r.postal_code,
    city: r.city,
    latitude: r.latitude,
    longitude: r.longitude,
    capacityMt: r.capacity_mt,
    active: r.active === 1,
    createdAt: r.created_at,
  };
}
