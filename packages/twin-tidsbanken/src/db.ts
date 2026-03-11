import Database from 'better-sqlite3';

/**
 * Initialize the SQLite database with all required tables.
 */
export function createDatabase(filename: string = ':memory:'): Database.Database {
  const db = new Database(filename);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS avdeling (
      AvdelingId TEXT PRIMARY KEY,
      Navn TEXT NOT NULL,
      Kode TEXT NOT NULL UNIQUE,
      OverordnetAvdelingId TEXT,
      Lokasjon TEXT NOT NULL,
      LokasjonNavn TEXT NOT NULL,
      Aktiv INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (OverordnetAvdelingId) REFERENCES avdeling(AvdelingId)
    );

    CREATE TABLE IF NOT EXISTS aktivitet (
      AktivitetId TEXT PRIMARY KEY,
      Kode TEXT NOT NULL UNIQUE,
      Navn TEXT NOT NULL,
      Beskrivelse TEXT,
      Aktiv INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS arbeidstype (
      ArbeidstypeId TEXT PRIMARY KEY,
      Kode TEXT NOT NULL UNIQUE,
      Navn TEXT NOT NULL,
      Beskrivelse TEXT,
      Aktiv INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS prosjekt (
      ProsjektId TEXT PRIMARY KEY,
      Kode TEXT NOT NULL UNIQUE,
      Navn TEXT NOT NULL,
      Beskrivelse TEXT,
      Aktiv INTEGER NOT NULL DEFAULT 1,
      StartDato TEXT,
      SluttDato TEXT
    );

    CREATE TABLE IF NOT EXISTS prosjektlinje (
      ProsjektlinjeId TEXT PRIMARY KEY,
      ProsjektId TEXT NOT NULL,
      AnsattNr INTEGER NOT NULL,
      Dato TEXT NOT NULL,
      Timer REAL NOT NULL DEFAULT 0,
      Beskrivelse TEXT,
      FOREIGN KEY (ProsjektId) REFERENCES prosjekt(ProsjektId)
    );

    CREATE TABLE IF NOT EXISTS skift (
      SkiftId TEXT PRIMARY KEY,
      Kode TEXT NOT NULL UNIQUE,
      Navn TEXT NOT NULL,
      StartTid TEXT,
      SluttTid TEXT,
      Timer REAL
    );

    CREATE TABLE IF NOT EXISTS ansatt (
      AnsattNr INTEGER PRIMARY KEY,
      Fornavn TEXT NOT NULL,
      Etternavn TEXT NOT NULL,
      Epost TEXT NOT NULL,
      Mobil TEXT NOT NULL,
      Stilling TEXT NOT NULL,
      Avdeling TEXT NOT NULL,
      AvdelingNavn TEXT NOT NULL,
      Lokasjon TEXT NOT NULL,
      LokasjonNavn TEXT NOT NULL,
      Aktiv INTEGER NOT NULL DEFAULT 1,
      Ansattdato TEXT NOT NULL,
      Stillingsprosent REAL NOT NULL DEFAULT 100,
      Arbeidstype TEXT NOT NULL,
      FOREIGN KEY (Avdeling) REFERENCES avdeling(Kode)
    );

    CREATE TABLE IF NOT EXISTS plan (
      PlanId TEXT PRIMARY KEY,
      AnsattNr INTEGER NOT NULL,
      Dato TEXT NOT NULL,
      Skift TEXT NOT NULL,
      SkiftNavn TEXT NOT NULL,
      StartTid TEXT,
      SluttTid TEXT,
      Timer REAL NOT NULL DEFAULT 0,
      Avdeling TEXT NOT NULL,
      FOREIGN KEY (AnsattNr) REFERENCES ansatt(AnsattNr)
    );

    CREATE TABLE IF NOT EXISTS stempling (
      StemplingId TEXT PRIMARY KEY,
      AnsattNr INTEGER NOT NULL,
      Tidspunkt TEXT NOT NULL,
      Type INTEGER NOT NULL,
      Kilde TEXT NOT NULL DEFAULT 'terminal',
      Lokasjon TEXT,
      Aktivitet TEXT,
      Prosjekt TEXT,
      FOREIGN KEY (AnsattNr) REFERENCES ansatt(AnsattNr)
    );

    CREATE TABLE IF NOT EXISTS timelinje (
      TimelinjeId TEXT PRIMARY KEY,
      AnsattNr INTEGER NOT NULL,
      Dato TEXT NOT NULL,
      Timer REAL NOT NULL DEFAULT 0,
      Overtid REAL NOT NULL DEFAULT 0,
      Fraverstype TEXT,
      Aktivitet TEXT,
      Prosjekt TEXT,
      Arbeidstype TEXT,
      Godkjent INTEGER NOT NULL DEFAULT 0,
      Kommentar TEXT,
      FOREIGN KEY (AnsattNr) REFERENCES ansatt(AnsattNr)
    );

    CREATE TABLE IF NOT EXISTS webhook (
      WebhookId TEXT PRIMARY KEY,
      Url TEXT NOT NULL,
      Event TEXT NOT NULL,
      Aktiv INTEGER NOT NULL DEFAULT 1,
      OpprettetDato TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ansatt_avdeling ON ansatt(Avdeling);
    CREATE INDEX IF NOT EXISTS idx_plan_ansatt ON plan(AnsattNr);
    CREATE INDEX IF NOT EXISTS idx_plan_dato ON plan(Dato);
    CREATE INDEX IF NOT EXISTS idx_stempling_ansatt ON stempling(AnsattNr);
    CREATE INDEX IF NOT EXISTS idx_stempling_tidspunkt ON stempling(Tidspunkt);
    CREATE INDEX IF NOT EXISTS idx_timelinje_ansatt ON timelinje(AnsattNr);
    CREATE INDEX IF NOT EXISTS idx_timelinje_dato ON timelinje(Dato);
  `);

  return db;
}

/** Check if the database has been seeded (has employees) */
export function isDatabaseSeeded(db: Database.Database): boolean {
  const row = db.prepare('SELECT COUNT(*) as count FROM ansatt').get() as { count: number };
  return row.count > 0;
}
