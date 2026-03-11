import Database from 'better-sqlite3';

/**
 * Initialize the SQLite database with all required tables.
 * Pass ':memory:' for in-memory database (tests), or a file path for persistence.
 */
export function createDatabase(path: string = ':memory:'): Database.Database {
  const db = new Database(path);

  // Enable WAL mode for better concurrency (no-op for :memory:)
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createSchema(db);
  return db;
}

function createSchema(db: Database.Database): void {
  db.exec(`
    -- Sites (sea sites + hatcheries)
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('sea_site', 'hatchery')),
      municipality TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      city TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      capacity_mt REAL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Companies
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      org_number TEXT NOT NULL UNIQUE,
      address TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'Norway',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Fish groups (cohorts)
    CREATE TABLE IF NOT EXISTS fish_groups (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      species TEXT NOT NULL DEFAULT 'Gadus morhua',
      year_class INTEGER NOT NULL,
      stocking_date TEXT NOT NULL,
      initial_count INTEGER NOT NULL,
      initial_weight_grams REAL NOT NULL,
      current_count INTEGER,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'harvested', 'transferred')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Weight samples
    CREATE TABLE IF NOT EXISTS weight_samples (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      fish_group_id TEXT REFERENCES fish_groups(id),
      sample_date TEXT NOT NULL,
      count INTEGER NOT NULL,
      average_weight_grams REAL NOT NULL,
      min_weight_grams REAL,
      max_weight_grams REAL,
      std_dev_grams REAL,
      condition_factor REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Mortality records
    CREATE TABLE IF NOT EXISTS mortality (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      fish_group_id TEXT REFERENCES fish_groups(id),
      record_date TEXT NOT NULL,
      count INTEGER NOT NULL,
      cause TEXT NOT NULL CHECK(cause IN ('NATURAL', 'DISEASE', 'HANDLING', 'PREDATION', 'ENVIRONMENT', 'UNKNOWN')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Harvest imports
    CREATE TABLE IF NOT EXISTS harvest_imports (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      fish_group_id TEXT REFERENCES fish_groups(id),
      harvest_date TEXT NOT NULL,
      count INTEGER NOT NULL,
      total_weight_kg REAL NOT NULL,
      average_weight_grams REAL NOT NULL,
      quality_grade TEXT,
      destination TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Time series (shared for environment + custom)
    CREATE TABLE IF NOT EXISTS time_series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL REFERENCES sites(id),
      parameter TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      source TEXT NOT NULL DEFAULT 'sensor',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Financial values
    CREATE TABLE IF NOT EXISTS financial_values (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      metric TEXT NOT NULL CHECK(metric IN ('FEED_COST_PER_KG', 'FISH_COST_PER_KG', 'INVENTORY_VALUE', 'BIOMASS_VALUE')),
      period TEXT NOT NULL,
      value REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'NOK',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_weight_samples_site_date ON weight_samples(site_id, sample_date);
    CREATE INDEX IF NOT EXISTS idx_mortality_site_date ON mortality(site_id, record_date);
    CREATE INDEX IF NOT EXISTS idx_harvest_imports_site_date ON harvest_imports(site_id, harvest_date);
    CREATE INDEX IF NOT EXISTS idx_time_series_site_param_ts ON time_series(site_id, parameter, timestamp);
    CREATE INDEX IF NOT EXISTS idx_financial_values_site_metric ON financial_values(site_id, metric, period);
    CREATE INDEX IF NOT EXISTS idx_fish_groups_site ON fish_groups(site_id);
  `);
}

export type { Database };
