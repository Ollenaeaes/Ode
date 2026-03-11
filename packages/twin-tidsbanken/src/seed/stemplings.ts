import type Database from 'better-sqlite3';

/** Deterministic seeded random number generator */
function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Box-Muller transform for normal distribution */
function normalRandom(rng: () => number, mean: number, stdev: number): number {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 0.0001))) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdev;
}

/**
 * Generate stempling (clock-in/out) data from plans with realistic variance.
 */
export function seedStemplings(db: Database.Database, seed: number = 42): void {
  const rng = createRng(seed + 200);

  const plans = db.prepare(`
    SELECT p.PlanId, p.AnsattNr, p.Dato, p.Skift, p.StartTid, p.SluttTid, p.Avdeling,
           a.Lokasjon
    FROM plan p
    JOIN ansatt a ON a.AnsattNr = p.AnsattNr
    WHERE p.Skift != 'SJO-AV' AND p.StartTid IS NOT NULL
    ORDER BY p.Dato, p.AnsattNr
  `).all() as Array<{
    PlanId: string;
    AnsattNr: number;
    Dato: string;
    Skift: string;
    StartTid: string;
    SluttTid: string;
    Avdeling: string;
    Lokasjon: string;
  }>;

  const insert = db.prepare(`
    INSERT INTO stempling (StemplingId, AnsattNr, Tidspunkt, Type, Kilde, Lokasjon, Aktivitet, Prosjekt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTransaction = db.transaction(() => {
    for (const plan of plans) {
      // ~3% daily absence rate
      if (rng() < 0.03) continue;

      const dept = plan.Avdeling;
      let clockInMinutes: number;
      let clockOutMinutes: number;

      const [startH, startM] = plan.StartTid.split(':').map(Number);
      const [endH, endM] = plan.SluttTid.split(':').map(Number);
      const scheduledStart = startH * 60 + startM;
      let scheduledEnd = endH * 60 + endM;
      // Handle overnight shifts
      if (scheduledEnd <= scheduledStart) {
        scheduledEnd += 24 * 60;
      }

      if (dept.startsWith('PRO')) {
        // Processing: +/- 5 min of shift start/end
        clockInMinutes = scheduledStart + Math.round(normalRandom(rng, 0, 2));
        clockOutMinutes = scheduledEnd + Math.round(normalRandom(rng, 0, 2));
      } else if (dept.startsWith('SET')) {
        // Hatchery: 06:45-07:15 clock-in (mean 07:00, stdev 7.5 min)
        clockInMinutes = Math.round(normalRandom(rng, 7 * 60, 7.5));
        clockOutMinutes = clockInMinutes + (scheduledEnd - scheduledStart) + Math.round(normalRandom(rng, 0, 5));
      } else if (dept.startsWith('SJO')) {
        // Sea on-rotation: 06:30-07:30 to 18:30-19:30
        clockInMinutes = Math.round(normalRandom(rng, 7 * 60, 15));
        clockOutMinutes = Math.round(normalRandom(rng, 19 * 60, 15));
      } else {
        // Office: clock-in 07:30-08:30 (mean 08:00, stdev 15min)
        clockInMinutes = Math.round(normalRandom(rng, 8 * 60, 15));
        clockOutMinutes = clockInMinutes + (scheduledEnd - scheduledStart) + Math.round(normalRandom(rng, 0, 10));
      }

      // Ensure reasonable bounds
      clockInMinutes = Math.max(0, Math.min(23 * 60 + 59, clockInMinutes));
      clockOutMinutes = Math.max(clockInMinutes + 30, clockOutMinutes); // At least 30 min

      const clockInTime = formatMinutes(clockInMinutes);
      const clockOutTime = formatMinutes(clockOutMinutes % (24 * 60));

      // Clock-in is on the plan date; clock-out might be next day for night shifts
      const clockInDatetime = `${plan.Dato}T${clockInTime}:00`;
      let clockOutDate = plan.Dato;
      if (clockOutMinutes >= 24 * 60) {
        const nextDay = new Date(plan.Dato);
        nextDay.setDate(nextDay.getDate() + 1);
        clockOutDate = nextDay.toISOString().split('T')[0];
      }
      const clockOutDatetime = `${clockOutDate}T${clockOutTime}:00`;

      // Clock-in (Type 0)
      insert.run(
        crypto.randomUUID(),
        plan.AnsattNr,
        clockInDatetime,
        0,
        'terminal',
        plan.Lokasjon,
        'NORM',
        null,
      );

      // Clock-out (Type 1)
      insert.run(
        crypto.randomUUID(),
        plan.AnsattNr,
        clockOutDatetime,
        1,
        'terminal',
        plan.Lokasjon,
        'NORM',
        null,
      );
    }
  });

  insertTransaction();
}

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(Math.abs(m)).padStart(2, '0')}`;
}
