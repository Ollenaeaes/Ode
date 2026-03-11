import type Database from 'better-sqlite3';
import { FIRST_NAMES, LAST_NAMES, pickName } from './names.js';
import { DEPARTMENTS, POSITIONS } from './reference-data.js';

/** Deterministic seeded random number generator */
function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Seed 155 employees across departments with correct distribution.
 */
export function seedEmployees(db: Database.Database, seed: number = 42): void {
  const rng = createRng(seed);

  const insert = db.prepare(`
    INSERT INTO ansatt (AnsattNr, Fornavn, Etternavn, Epost, Mobil, Stilling, Avdeling, AvdelingNavn, Lokasjon, LokasjonNavn, Aktiv, Ansattdato, Stillingsprosent, Arbeidstype)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `);

  let ansattNr = 1001;

  for (const dept of DEPARTMENTS) {
    const positionKey = dept.kode.startsWith('SET') ? 'SET'
      : dept.kode.startsWith('SJO') ? 'SJO'
      : dept.kode.startsWith('PRO') ? 'PRO'
      : dept.kode;
    const positions = POSITIONS[positionKey] || ['Medarbeider'];

    for (let i = 0; i < dept.headcount; i++) {
      const nameIdx = Math.floor(rng() * 10000);
      const fornavn = pickName(FIRST_NAMES, nameIdx);
      const etternavn = pickName(LAST_NAMES, Math.floor(rng() * 10000));

      const stilling = positions[i % positions.length];
      const epost = `${fornavn.toLowerCase().replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')}.${etternavn.toLowerCase().replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')}@ode.no`;
      const mobil = `+47 ${900 + Math.floor(rng() * 99)} ${10 + Math.floor(rng() * 89)} ${100 + Math.floor(rng() * 899)}`;

      // Generate a hire date between 2018-01-01 and 2025-06-01
      const hireStart = new Date('2018-01-01').getTime();
      const hireEnd = new Date('2025-06-01').getTime();
      const hireDate = new Date(hireStart + rng() * (hireEnd - hireStart));
      const ansattdato = hireDate.toISOString().split('T')[0];

      const stillingsprosent = rng() > 0.9 ? 80 : 100;

      // Most are fast, some seasonal in processing
      let arbeidstype = 'FAST';
      if (dept.kode.startsWith('PRO') && rng() > 0.8) {
        arbeidstype = 'SESONG';
      }

      insert.run(
        ansattNr,
        fornavn,
        etternavn,
        epost,
        mobil,
        stilling,
        dept.kode,
        dept.navn,
        dept.lokasjon,
        dept.lokasjonNavn,
        ansattdato,
        stillingsprosent,
        arbeidstype,
      );

      ansattNr++;
    }
  }
}
