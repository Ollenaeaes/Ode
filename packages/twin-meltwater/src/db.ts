import Database from 'better-sqlite3';

/**
 * Initialize the SQLite database with all required tables.
 */
export function createDatabase(filename: string = ':memory:'): Database.Database {
  const db = new Database(filename);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS mentions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      snippet TEXT NOT NULL,
      url TEXT NOT NULL,
      source TEXT NOT NULL,
      sourceType TEXT NOT NULL,
      publishedAt TEXT NOT NULL,
      language TEXT NOT NULL,
      sentimentLabel TEXT NOT NULL,
      sentimentScore REAL NOT NULL,
      reach INTEGER NOT NULL,
      topics TEXT NOT NULL,
      entities TEXT NOT NULL,
      country TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS mentions_fts USING fts5(
      title, snippet, content=mentions, content_rowid=rowid
    );

    CREATE TRIGGER IF NOT EXISTS mentions_ai AFTER INSERT ON mentions BEGIN
      INSERT INTO mentions_fts(rowid, title, snippet)
      VALUES (new.rowid, new.title, new.snippet);
    END;

    CREATE TRIGGER IF NOT EXISTS mentions_ad AFTER DELETE ON mentions BEGIN
      INSERT INTO mentions_fts(mentions_fts, rowid, title, snippet)
      VALUES ('delete', old.rowid, old.title, old.snippet);
    END;

    CREATE TRIGGER IF NOT EXISTS mentions_au AFTER UPDATE ON mentions BEGIN
      INSERT INTO mentions_fts(mentions_fts, rowid, title, snippet)
      VALUES ('delete', old.rowid, old.title, old.snippet);
      INSERT INTO mentions_fts(rowid, title, snippet)
      VALUES (new.rowid, new.title, new.snippet);
    END;

    CREATE TABLE IF NOT EXISTS streams (
      id TEXT PRIMARY KEY,
      apiKey TEXT NOT NULL,
      name TEXT NOT NULL,
      query TEXT NOT NULL,
      callbackUrl TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      deliveryCount INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exports (
      id TEXT PRIMARY KEY,
      apiKey TEXT NOT NULL,
      query TEXT NOT NULL,
      fromDate TEXT,
      toDate TEXT,
      format TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      documentCount INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      completedAt TEXT,
      expiresAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_mentions_published ON mentions(publishedAt);
    CREATE INDEX IF NOT EXISTS idx_mentions_source ON mentions(source);
    CREATE INDEX IF NOT EXISTS idx_mentions_language ON mentions(language);
    CREATE INDEX IF NOT EXISTS idx_mentions_sentiment ON mentions(sentimentLabel);
    CREATE INDEX IF NOT EXISTS idx_streams_apikey ON streams(apiKey);
    CREATE INDEX IF NOT EXISTS idx_exports_apikey ON exports(apiKey);
  `);

  return db;
}

/** Check if the database has been seeded */
export function isDatabaseSeeded(db: Database.Database): boolean {
  const row = db.prepare('SELECT COUNT(*) as count FROM mentions').get() as { count: number };
  return row.count > 0;
}
