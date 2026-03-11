import { Router } from 'express';
import type Database from 'better-sqlite3';

export function createCompaniesRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/meta/companies
  router.get('/', (_req, res) => {
    const companies = db.prepare('SELECT * FROM companies ORDER BY name').all();
    res.json({
      data: companies.map(formatCompany),
      total: companies.length,
    });
  });

  // GET /api/meta/companies/:id
  router.get('/:id', (req, res) => {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    if (!company) {
      res.status(404).json({
        error: 'NotFound',
        message: `Company with id '${req.params.id}' not found`,
        details: [],
      });
      return;
    }
    res.json(formatCompany(company));
  });

  return router;
}

function formatCompany(row: unknown): Record<string, unknown> {
  const r = row as Record<string, unknown>;
  return {
    id: r.id,
    name: r.name,
    orgNumber: r.org_number,
    address: r.address,
    postalCode: r.postal_code,
    city: r.city,
    country: r.country,
    createdAt: r.created_at,
  };
}
