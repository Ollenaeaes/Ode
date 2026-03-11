import type Database from 'better-sqlite3';
import { SHIFTS, isWorkday, isWeekend } from './reference-data.js';

/** Deterministic seeded random number generator */
function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Generate schedule data for 3 months from reference date.
 */
export function seedPlans(db: Database.Database, referenceDate: string, seed: number = 42): void {
  const rng = createRng(seed + 100); // Different seed offset from employees

  const employees = db.prepare('SELECT AnsattNr, Avdeling, Lokasjon FROM ansatt WHERE Aktiv = 1').all() as Array<{
    AnsattNr: number;
    Avdeling: string;
    Lokasjon: string;
  }>;

  const insert = db.prepare(`
    INSERT INTO plan (PlanId, AnsattNr, Dato, Skift, SkiftNavn, StartTid, SluttTid, Timer, Avdeling)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Generate 3 months of dates
  const startDate = new Date(referenceDate);
  const endDate = new Date(referenceDate);
  endDate.setMonth(endDate.getMonth() + 3);

  const dates: string[] = [];
  const current = new Date(startDate);
  while (current < endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  // Processing shift rotation: employees rotate DAG -> KVELD -> NATT weekly
  const processingShifts = ['DAG', 'KVELD', 'NATT'];
  const shiftMap = Object.fromEntries(SHIFTS.map((s) => [s.kode, s]));

  const insertTransaction = db.transaction(() => {
    for (const emp of employees) {
      const dept = emp.Avdeling;

      if (dept.startsWith('PRO')) {
        // Processing: 3-shift rotation
        const shiftIdx = dept === 'PRO-D' ? 0 : dept === 'PRO-K' ? 1 : 2;
        for (let dayIdx = 0; dayIdx < dates.length; dayIdx++) {
          const date = dates[dayIdx];
          // Rotate shift weekly
          const weekNum = Math.floor(dayIdx / 7);
          const currentShift = processingShifts[(shiftIdx + weekNum) % 3];
          const shift = shiftMap[currentShift];

          // Processing works Mon-Sat, off Sunday
          const dayOfWeek = new Date(date).getUTCDay();
          if (dayOfWeek === 0) continue; // Sunday off

          insert.run(
            crypto.randomUUID(),
            emp.AnsattNr,
            date,
            shift.kode,
            shift.navn,
            shift.startTid,
            shift.sluttTid,
            shift.timer,
            dept,
          );
        }
      } else if (dept.startsWith('SJO')) {
        // Sea sites: 2-weeks-on / 2-weeks-off rotation
        // Stagger start by employee number so not everyone is on/off same time
        const offset = (emp.AnsattNr * 7) % 28;
        for (let dayIdx = 0; dayIdx < dates.length; dayIdx++) {
          const date = dates[dayIdx];
          const cycleDay = (dayIdx + offset) % 28;
          const isOnRotation = cycleDay < 14;

          if (isOnRotation) {
            const shift = shiftMap['SJO-PA'];
            insert.run(
              crypto.randomUUID(),
              emp.AnsattNr,
              date,
              shift.kode,
              shift.navn,
              shift.startTid,
              shift.sluttTid,
              shift.timer,
              dept,
            );
          } else {
            const shift = shiftMap['SJO-AV'];
            insert.run(
              crypto.randomUUID(),
              emp.AnsattNr,
              date,
              shift.kode,
              shift.navn,
              null,
              null,
              0,
              dept,
            );
          }
        }
      } else if (dept.startsWith('SET')) {
        // Hatchery: weekdays SETTE shift + ~25% weekend duty
        for (const date of dates) {
          if (isWeekend(date)) {
            // ~25% chance of weekend duty
            if (rng() < 0.25) {
              const shift = shiftMap['SETTE'];
              insert.run(
                crypto.randomUUID(),
                emp.AnsattNr,
                date,
                shift.kode,
                shift.navn,
                shift.startTid,
                shift.sluttTid,
                shift.timer,
                dept,
              );
            }
          } else if (isWorkday(date)) {
            const shift = shiftMap['SETTE'];
            insert.run(
              crypto.randomUUID(),
              emp.AnsattNr,
              date,
              shift.kode,
              shift.navn,
              shift.startTid,
              shift.sluttTid,
              shift.timer,
              dept,
            );
          }
        }
      } else {
        // Office (LED, ADM, SAL, LOG): Mon-Fri KONTOR shift
        for (const date of dates) {
          if (isWorkday(date)) {
            const shift = shiftMap['KONTOR'];
            insert.run(
              crypto.randomUUID(),
              emp.AnsattNr,
              date,
              shift.kode,
              shift.navn,
              shift.startTid,
              shift.sluttTid,
              shift.timer,
              dept,
            );
          }
        }
      }
    }
  });

  insertTransaction();
}
