import type Database from 'better-sqlite3';

/** Department definitions matching Ode's org structure */
export interface DepartmentDef {
  kode: string;
  navn: string;
  lokasjon: string;
  lokasjonNavn: string;
  headcount: number;
  parent?: string;
}

export const DEPARTMENTS: DepartmentDef[] = [
  // HQ departments
  { kode: 'LED', navn: 'Ledelse', lokasjon: 'HQ', lokasjonNavn: 'Ålesund HQ', headcount: 8 },
  { kode: 'ADM', navn: 'Administrasjon', lokasjon: 'HQ', lokasjonNavn: 'Ålesund HQ', headcount: 10 },
  { kode: 'SAL', navn: 'Salg', lokasjon: 'HQ', lokasjonNavn: 'Ålesund HQ', headcount: 8 },
  { kode: 'LOG', navn: 'Logistikk', lokasjon: 'HQ', lokasjonNavn: 'Ålesund HQ', headcount: 12 },
  // Hatcheries
  { kode: 'SET-RB', navn: 'Settefisk Rødberg', lokasjon: 'RB', lokasjonNavn: 'Rødberg', headcount: 12 },
  { kode: 'SET-TJ', navn: 'Settefisk Tjeldbergodden', lokasjon: 'TJ', lokasjonNavn: 'Tjeldbergodden', headcount: 10 },
  // Sea sites
  { kode: 'SJO-01', navn: 'Sjøanlegg Storfjorden', lokasjon: 'SJO-01', lokasjonNavn: 'Storfjorden', headcount: 5 },
  { kode: 'SJO-02', navn: 'Sjøanlegg Hjørundfjorden', lokasjon: 'SJO-02', lokasjonNavn: 'Hjørundfjorden', headcount: 5 },
  { kode: 'SJO-03', navn: 'Sjøanlegg Hareidlandet', lokasjon: 'SJO-03', lokasjonNavn: 'Hareidlandet', headcount: 5 },
  { kode: 'SJO-04', navn: 'Sjøanlegg Sula', lokasjon: 'SJO-04', lokasjonNavn: 'Sula', headcount: 5 },
  { kode: 'SJO-05', navn: 'Sjøanlegg Giske', lokasjon: 'SJO-05', lokasjonNavn: 'Giske', headcount: 5 },
  { kode: 'SJO-06', navn: 'Sjøanlegg Ellingsøya', lokasjon: 'SJO-06', lokasjonNavn: 'Ellingsøya', headcount: 5 },
  { kode: 'SJO-07', navn: 'Sjøanlegg Lepsøya', lokasjon: 'SJO-07', lokasjonNavn: 'Lepsøya', headcount: 5 },
  { kode: 'SJO-08', navn: 'Sjøanlegg Ona', lokasjon: 'SJO-08', lokasjonNavn: 'Ona', headcount: 5 },
  { kode: 'SJO-09', navn: 'Sjøanlegg Sandøya', lokasjon: 'SJO-09', lokasjonNavn: 'Sandøya', headcount: 5 },
  { kode: 'SJO-10', navn: 'Sjøanlegg Kvamsøya', lokasjon: 'SJO-10', lokasjonNavn: 'Kvamsøya', headcount: 5 },
  // Processing shifts
  { kode: 'PRO-D', navn: 'Foredling Dagskift', lokasjon: 'PRO', lokasjonNavn: 'Vartdal', headcount: 15 },
  { kode: 'PRO-K', navn: 'Foredling Kveldsskift', lokasjon: 'PRO', lokasjonNavn: 'Vartdal', headcount: 15 },
  { kode: 'PRO-N', navn: 'Foredling Nattskift', lokasjon: 'PRO', lokasjonNavn: 'Vartdal', headcount: 15 },
];

/** Activity codes */
export const ACTIVITIES = [
  { kode: 'NORM', navn: 'Normal arbeidstid', beskrivelse: 'Ordinær arbeidstid' },
  { kode: 'OVT', navn: 'Overtid', beskrivelse: 'Overtidsarbeid' },
  { kode: 'FERIE', navn: 'Ferie', beskrivelse: 'Feriefravær' },
  { kode: 'SYK', navn: 'Sykefravær', beskrivelse: 'Sykmelding/egenmelding' },
  { kode: 'PERM', navn: 'Permisjon', beskrivelse: 'Permisjon med/uten lønn' },
  { kode: 'KURS', navn: 'Kurs/opplæring', beskrivelse: 'Kurs og kompetanseutvikling' },
  { kode: 'REISE', navn: 'Reise', beskrivelse: 'Tjenestereise' },
  { kode: 'MØTE', navn: 'Møte', beskrivelse: 'Internt/eksternt møte' },
  { kode: 'HMS', navn: 'HMS-arbeid', beskrivelse: 'Helse, miljø og sikkerhet' },
  { kode: 'VEDL', navn: 'Vedlikehold', beskrivelse: 'Vedlikehold av anlegg/utstyr' },
];

/** Work type codes */
export const WORK_TYPES = [
  { kode: 'FAST', navn: 'Fast ansatt', beskrivelse: 'Fast stilling' },
  { kode: 'VIKAR', navn: 'Vikar', beskrivelse: 'Vikariat' },
  { kode: 'SESONG', navn: 'Sesongarbeider', beskrivelse: 'Sesongbasert arbeid' },
  { kode: 'LÆRLING', navn: 'Lærling', beskrivelse: 'Lærlingkontrakt' },
];

/** Shift definitions */
export const SHIFTS = [
  { kode: 'DAG', navn: 'Dagskift', startTid: '06:00', sluttTid: '14:00', timer: 8 },
  { kode: 'KVELD', navn: 'Kveldsskift', startTid: '14:00', sluttTid: '22:00', timer: 8 },
  { kode: 'NATT', navn: 'Nattskift', startTid: '22:00', sluttTid: '06:00', timer: 8 },
  { kode: 'KONTOR', navn: 'Kontortid', startTid: '08:00', sluttTid: '16:00', timer: 8 },
  { kode: 'SETTE', navn: 'Settefisktid', startTid: '07:00', sluttTid: '15:00', timer: 8 },
  { kode: 'SJO-PA', navn: 'Sjø på', startTid: '07:00', sluttTid: '19:00', timer: 12 },
  { kode: 'SJO-AV', navn: 'Sjø av', startTid: null, sluttTid: null, timer: 0 },
];

/** Projects */
export const PROJECTS = [
  { kode: 'P-001', navn: 'Torskeoppdrett Storfjorden', beskrivelse: 'Drift sjøanlegg Storfjorden', startDato: '2025-01-01', sluttDato: '2025-12-31' },
  { kode: 'P-002', navn: 'Settefisk produksjon', beskrivelse: 'Produksjon av settefisk og yngel', startDato: '2025-01-01', sluttDato: '2025-12-31' },
  { kode: 'P-003', navn: 'Foredling Vartdal', beskrivelse: 'Foredling og pakking av torsk', startDato: '2025-01-01', sluttDato: '2025-12-31' },
  { kode: 'P-004', navn: 'Vedlikehold sjøanlegg', beskrivelse: 'Løpende vedlikehold av merder og utstyr', startDato: '2025-01-01', sluttDato: '2025-12-31' },
  { kode: 'P-005', navn: 'HMS-prosjekt 2025', beskrivelse: 'Årlig HMS-gjennomgang og forbedring', startDato: '2025-03-01', sluttDato: '2025-09-30' },
  { kode: 'P-006', navn: 'IT-modernisering', beskrivelse: 'Oppgradering av IT-systemer', startDato: '2025-06-01', sluttDato: '2026-06-01' },
];

/** Norwegian public holidays 2025-2026 */
export const NORWEGIAN_HOLIDAYS: string[] = [
  // 2025
  '2025-01-01', // Nyttårsdag
  '2025-04-17', // Skjærtorsdag
  '2025-04-18', // Langfredag
  '2025-04-20', // 1. påskedag
  '2025-04-21', // 2. påskedag
  '2025-05-01', // Arbeidernes dag
  '2025-05-17', // Grunnlovsdag
  '2025-05-29', // Kristi himmelfartsdag
  '2025-06-08', // 1. pinsedag
  '2025-06-09', // 2. pinsedag
  '2025-12-25', // 1. juledag
  '2025-12-26', // 2. juledag
  // 2026
  '2026-01-01', // Nyttårsdag
  '2026-04-02', // Skjærtorsdag
  '2026-04-03', // Langfredag
  '2026-04-05', // 1. påskedag
  '2026-04-06', // 2. påskedag
  '2026-05-01', // Arbeidernes dag
  '2026-05-14', // Kristi himmelfartsdag
  '2026-05-17', // Grunnlovsdag
  '2026-05-24', // 1. pinsedag
  '2026-05-25', // 2. pinsedag
  '2026-12-25', // 1. juledag
  '2026-12-26', // 2. juledag
];

/** Positions by department type */
export const POSITIONS: Record<string, string[]> = {
  LED: ['Daglig leder', 'Økonomisjef', 'Driftsdirektør', 'Personalsjef', 'HMS-leder', 'Kvalitetsleder', 'IT-sjef', 'Utviklingssjef'],
  ADM: ['Regnskapsfører', 'Controller', 'HR-rådgiver', 'Lønnsspesialist', 'Resepsjonist', 'Kontormedarbeider', 'Innkjøper', 'Juridisk rådgiver', 'Sekretær', 'Arkivar'],
  SAL: ['Salgssjef', 'Selger', 'Key Account Manager', 'Markedskoordinator', 'Eksportansvarlig', 'Kundeservice', 'Logistikk salg', 'Markedssjef'],
  LOG: ['Logistikksjef', 'Transportplanlegger', 'Sjåfør', 'Lagermedarbeider', 'Skipsfører', 'Mannskap brønnbåt', 'Maskinsjef', 'Matros', 'Lagerarbeider', 'Transportkoordinator', 'Mannskap', 'Sjåfør tungtransport'],
  SET: ['Driftsleder settefisk', 'Røkter', 'Tekniker', 'Biolog', 'Driftsoperatør'],
  SJO: ['Anleggsleder', 'Røkter sjø', 'Dykker', 'Tekniker sjø', 'Driftsoperatør sjø'],
  PRO: ['Produksjonsleder', 'Operatør', 'Pakkerimedarbeider', 'Kvalitetskontrollør', 'Tekniker foredling'],
};

/** Seed reference data into the database */
export function seedReferenceData(db: Database): void {
  // Departments
  const insertDept = db.prepare(
    'INSERT INTO avdeling (AvdelingId, Navn, Kode, OverordnetAvdelingId, Lokasjon, LokasjonNavn, Aktiv) VALUES (?, ?, ?, ?, ?, ?, 1)'
  );
  for (const dept of DEPARTMENTS) {
    insertDept.run(
      crypto.randomUUID(),
      dept.navn,
      dept.kode,
      dept.parent || null,
      dept.lokasjon,
      dept.lokasjonNavn,
    );
  }

  // Activities
  const insertAct = db.prepare(
    'INSERT INTO aktivitet (AktivitetId, Kode, Navn, Beskrivelse, Aktiv) VALUES (?, ?, ?, ?, 1)'
  );
  for (const act of ACTIVITIES) {
    insertAct.run(crypto.randomUUID(), act.kode, act.navn, act.beskrivelse);
  }

  // Work types
  const insertWt = db.prepare(
    'INSERT INTO arbeidstype (ArbeidstypeId, Kode, Navn, Beskrivelse, Aktiv) VALUES (?, ?, ?, ?, 1)'
  );
  for (const wt of WORK_TYPES) {
    insertWt.run(crypto.randomUUID(), wt.kode, wt.navn, wt.beskrivelse);
  }

  // Shifts
  const insertShift = db.prepare(
    'INSERT INTO skift (SkiftId, Kode, Navn, StartTid, SluttTid, Timer) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const shift of SHIFTS) {
    insertShift.run(crypto.randomUUID(), shift.kode, shift.navn, shift.startTid, shift.sluttTid, shift.timer);
  }

  // Projects
  const insertProj = db.prepare(
    'INSERT INTO prosjekt (ProsjektId, Kode, Navn, Beskrivelse, Aktiv, StartDato, SluttDato) VALUES (?, ?, ?, ?, 1, ?, ?)'
  );
  for (const proj of PROJECTS) {
    insertProj.run(crypto.randomUUID(), proj.kode, proj.navn, proj.beskrivelse, proj.startDato, proj.sluttDato);
  }
}

/** Check if a date is a weekend */
export function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/** Check if a date is a Norwegian public holiday */
export function isHoliday(dateStr: string): boolean {
  return NORWEGIAN_HOLIDAYS.includes(dateStr);
}

/** Check if a date is a workday */
export function isWorkday(dateStr: string): boolean {
  return !isWeekend(dateStr) && !isHoliday(dateStr);
}
