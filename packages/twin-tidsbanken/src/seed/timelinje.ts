import type Database from 'better-sqlite3';

/** Deterministic seeded random number generator */
function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Generate timelinje (time entries) from stemplings.
 * Timer = hours between clock-in/out.
 * Office: 37.5h/week, Shift: 36.5h/week
 * Overtime: ~5% of days, 1-3h extra
 * Absence entries: Fraverstype set, Timer = 0
 */
export function seedTimelinje(db: Database.Database, seed: number = 42): void {
  const rng = createRng(seed + 300);

  // Get all employees and their plans
  const employees = db.prepare('SELECT AnsattNr, Avdeling, Arbeidstype FROM ansatt WHERE Aktiv = 1').all() as Array<{
    AnsattNr: number;
    Avdeling: string;
    Arbeidstype: string;
  }>;

  // Get stemplings grouped by employee and date
  const stemplingsByDay = db.prepare(`
    SELECT AnsattNr,
           DATE(Tidspunkt) as Dato,
           MIN(CASE WHEN Type = 0 THEN Tidspunkt END) as ClockIn,
           MAX(CASE WHEN Type = 1 THEN Tidspunkt END) as ClockOut
    FROM stempling
    GROUP BY AnsattNr, DATE(Tidspunkt)
    ORDER BY AnsattNr, Dato
  `).all() as Array<{
    AnsattNr: number;
    Dato: string;
    ClockIn: string | null;
    ClockOut: string | null;
  }>;

  // Get all planned dates that have no stemplings (absences)
  const absenceDays = db.prepare(`
    SELECT p.AnsattNr, p.Dato, p.Avdeling
    FROM plan p
    WHERE p.Skift != 'SJO-AV' AND p.StartTid IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM stempling s
        WHERE s.AnsattNr = p.AnsattNr AND DATE(s.Tidspunkt) = p.Dato
      )
    ORDER BY p.AnsattNr, p.Dato
  `).all() as Array<{
    AnsattNr: number;
    Dato: string;
    Avdeling: string;
  }>;

  const empMap = new Map(employees.map((e) => [e.AnsattNr, e]));

  const insert = db.prepare(`
    INSERT INTO timelinje (TimelinjeId, AnsattNr, Dato, Timer, Overtid, Fraverstype, Aktivitet, Prosjekt, Arbeidstype, Godkjent, Kommentar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const absenceTypes = ['SYK', 'FERIE', 'PERM'];

  const insertTransaction = db.transaction(() => {
    // Normal work entries from stemplings
    for (const day of stemplingsByDay) {
      if (!day.ClockIn || !day.ClockOut) continue;

      const emp = empMap.get(day.AnsattNr);
      if (!emp) continue;

      const clockIn = new Date(day.ClockIn);
      const clockOut = new Date(day.ClockOut);
      const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

      if (hoursWorked <= 0 || hoursWorked > 24) continue;

      // Determine normal hours vs overtime
      const normalHoursLimit = emp.Avdeling.startsWith('PRO') || emp.Avdeling.startsWith('SJO') ? 8 : 8;
      let normalHours = Math.min(hoursWorked, normalHoursLimit);
      let overtime = 0;

      // ~5% of days have overtime (1-3h extra)
      if (rng() < 0.05 && hoursWorked > normalHoursLimit) {
        overtime = Math.min(hoursWorked - normalHoursLimit, 1 + rng() * 2);
        overtime = Math.round(overtime * 100) / 100;
      } else if (hoursWorked > normalHoursLimit) {
        normalHours = hoursWorked;
      }

      normalHours = Math.round(normalHours * 100) / 100;

      // ~80% are approved
      const godkjent = rng() < 0.8 ? 1 : 0;

      insert.run(
        crypto.randomUUID(),
        day.AnsattNr,
        day.Dato,
        normalHours,
        overtime,
        null,
        'NORM',
        null,
        emp.Arbeidstype,
        godkjent,
        null,
      );
    }

    // Absence entries
    for (const absence of absenceDays) {
      const emp = empMap.get(absence.AnsattNr);
      if (!emp) continue;

      const fraverstype = absenceTypes[Math.floor(rng() * absenceTypes.length)];

      insert.run(
        crypto.randomUUID(),
        absence.AnsattNr,
        absence.Dato,
        0,
        0,
        fraverstype,
        fraverstype,
        null,
        emp.Arbeidstype,
        1,
        fraverstype === 'SYK' ? 'Egenmelding' : null,
      );
    }
  });

  insertTransaction();
}
