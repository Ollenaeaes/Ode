# Feature Spec: Digital Twin — Tidsbanken Time Registration

**Slug:** `twin-tidsbanken`
**Created:** 2026-03-11
**Status:** draft
**Priority:** high
**Readiness Score:** 73/100 (Gaps)

---

## Overview

A digital twin that simulates the Tidsbanken time registration REST API (OData v3), pre-loaded with realistic attendance data for Ode's 150+ employees across all locations. The twin enables development, testing, and demo of integrations without touching the production Tidsbanken system.

## Problem Statement

Integrations against Tidsbanken require realistic time-registration data — clock-in/out events, time entries, shift plans, and employee records — but the production API contains real employee data and cannot be used freely for development. A digital twin provides an identical API surface with synthetic but realistic data reflecting Ode's actual organizational structure, shift patterns, and Norwegian labor rules.

## Out of Scope

- NOT: Payroll calculation logic (Timelinje stores hours, not pay)
- NOT: Full Omsetning (revenue) or Art entity simulation
- NOT: Melding (message) endpoints beyond stub responses
- NOT: Eksport endpoint implementation beyond triggering the payroll-complete webhook
- NOT: OData v3 `$count`, `$inlinecount`, or `$batch` support
- NOT: Real Azure API Management gateway emulation (auth is simulated via header check)
- NOT: Multi-tenant support (this twin simulates a single Tidsbanken tenant for Ode)
- NOT: Write-back to any real system

---

## Data Models

### Ansatt (Employee)

```
{
  AnsattNr: number,          // Employee number (unique ID)
  Fornavn: string,           // First name
  Etternavn: string,         // Last name
  Epost: string,             // Email
  Mobil: string,             // Mobile phone
  Stilling: string,          // Job title
  Avdeling: string,          // Department code
  AvdelingNavn: string,      // Department name
  Lokasjon: string,          // Location code
  LokasjonNavn: string,     // Location name
  Aktiv: boolean,            // Active employee flag
  Ansattdato: string,        // Employment start date (ISO 8601)
  Stillingsprosent: number,  // Employment percentage (100 = full-time)
  Arbeidstype: string        // Work type code
}
```

### Avdeling (Department)

```
{
  AvdelingKode: string,      // Department code
  Navn: string,              // Department name
  Overordnet: string | null, // Parent department code
  Lokasjon: string,          // Location code
  LokasjonNavn: string       // Location name
}
```

### Stempling (Clock-in/out)

```
{
  StemplingId: number,       // Unique ID
  AnsattNr: number,          // Employee number
  Tidspunkt: string,         // Timestamp (ISO 8601)
  Type: number,              // 0 = clock-in, 1 = clock-out, 2 = switch
  Kilde: string,             // Source (terminal, app, web)
  Lokasjon: string,          // Location code
  Aktivitet: string | null,  // Activity code (for switch type)
  Prosjekt: string | null    // Project code (optional)
}
```

### Timelinje (Time Entry)

```
{
  TimelinjeId: number,       // Unique ID
  AnsattNr: number,          // Employee number
  Dato: string,              // Date (ISO 8601 date only)
  Timer: number,             // Hours worked (decimal)
  Overtid: number,           // Overtime hours (decimal)
  Fraverstype: string | null,// Absence type code (null = worked)
  Aktivitet: string,         // Activity code
  Prosjekt: string | null,   // Project code (optional)
  Arbeidstype: string,       // Work type code
  Godkjent: boolean,         // Approved by manager
  Kommentar: string | null   // Comment
}
```

### Plan (Schedule)

```
{
  PlanId: number,            // Unique ID
  AnsattNr: number,          // Employee number
  Dato: string,              // Date (ISO 8601 date only)
  Skift: string,             // Shift code
  SkiftNavn: string,         // Shift name (e.g. "Dagskift", "Kveldsskift")
  StartTid: string,          // Shift start time (HH:mm)
  SluttTid: string,          // Shift end time (HH:mm)
  Timer: number,             // Planned hours
  Avdeling: string           // Department code
}
```

### Aktivitet (Activity)

```
{
  AktivitetKode: string,     // Activity code
  Navn: string,              // Activity name
  Aktiv: boolean
}
```

### Arbeidstype (Work Type)

```
{
  ArbeidstypeKode: string,   // Work type code
  Navn: string,              // Work type name
  Aktiv: boolean
}
```

### Prosjekt (Project)

```
{
  ProsjektKode: string,      // Project code
  Navn: string,              // Project name
  Aktiv: boolean,
  StartDato: string,         // Start date
  SluttDato: string | null   // End date (null = ongoing)
}
```

### Prosjektlinje (Project Line)

```
{
  ProsjektlinjeId: number,
  ProsjektKode: string,
  AnsattNr: number,
  Dato: string,
  Timer: number,
  Kommentar: string | null
}
```

### Webhook Registration

```
{
  WebhookId: number,
  Url: string,               // Callback URL
  Hendelser: string[],       // Event types: ["stempling", "payroll-complete"]
  Aktiv: boolean,
  Opprettet: string          // Created timestamp
}
```

---

## Ode Organization Reference Data

### Departments

| Code | Name | Location | Parent |
|------|------|----------|--------|
| LED | Ledelse (Management) | Ålesund HQ | null |
| ADM | Admin | Ålesund HQ | LED |
| SAL | Salg (Sales) | Ålesund HQ | LED |
| LOG | Logistikk (Logistics) | Ålesund HQ | LED |
| SET-RB | Settefisk Rødberg (Hatchery) | Rødberg | null |
| SET-TJ | Settefisk Tjeldbergodden (Hatchery) | Tjeldbergodden | null |
| SJO | Sjø (Sea farming) | Various | null |
| SJO-01 through SJO-10 | Sea Site 1-10 | Site-specific | SJO |
| PRO | Prosessering (Processing) | Vartdal | null |
| PRO-D | Prosessering Dagskift | Vartdal | PRO |
| PRO-K | Prosessering Kveldsskift | Vartdal | PRO |
| PRO-N | Prosessering Nattskift | Vartdal | PRO |

### Locations

| Code | Name | Type |
|------|------|------|
| ALE | Ålesund HQ | Office |
| VAR | Vartdal | Processing plant |
| ROD | Rødberg | Hatchery |
| TJE | Tjeldbergodden | Hatchery |
| SJ01-SJ10 | Sea Site 1-10 | Sea site |

### Employee Distribution (target: ~155 employees)

| Department | Headcount | Work Pattern |
|------------|-----------|--------------|
| Ledelse | 8 | Office 08:00-16:00 |
| Admin | 10 | Office 08:00-16:00 |
| Salg | 8 | Office 08:00-16:00 |
| Logistikk | 6 | Office 08:00-16:00 |
| Settefisk Rødberg | 12 | Hatchery 07:00-15:00, some weekends |
| Settefisk Tjeldbergodden | 10 | Hatchery 07:00-15:00, some weekends |
| Sjø (10 sites x ~5) | 50 | Rotating: 2 weeks on / 2 weeks off |
| Prosessering (3 shifts) | 45 | Shifts: 06-14, 14-22, 22-06 |
| Vessel crew (under Logistikk) | 6 | Variable, follows sea site rotations |

### Shift Definitions

| Code | Name | Start | End | Departments |
|------|------|-------|-----|-------------|
| DAG | Dagskift (Day) | 06:00 | 14:00 | PRO-D |
| KVELD | Kveldsskift (Evening) | 14:00 | 22:00 | PRO-K |
| NATT | Nattskift (Night) | 22:00 | 06:00 | PRO-N |
| KONTOR | Kontortid (Office) | 08:00 | 16:00 | LED, ADM, SAL, LOG |
| SETTE | Settefisktid (Hatchery) | 07:00 | 15:00 | SET-RB, SET-TJ |
| SJO-PA | Sjø på (Sea on-rotation) | 07:00 | 19:00 | SJO-* |
| SJO-AV | Sjø av (Sea off-rotation) | — | — | SJO-* |

### Norwegian Work Rules (for data generation)

- Standard work week: 37.5 hours (7.5h/day)
- Shift workers: 36.5 hours/week (per Arbeidsmiljoloven)
- Overtime: hours beyond standard, capped at 10h/week, 25h/4 weeks
- Public holidays 2025-2026: Jan 1, Easter (Thu-Mon), May 1, May 17, Ascension, Whit Monday, Dec 25-26
- Lunch: typically 30 min unpaid (not in Stempling)
- Flex arrival: office workers +/- 30 min, shift workers +/- 5 min

### Absence Types

| Code | Name |
|------|------|
| SYK | Sykmelding (Sick leave) |
| EGM | Egenmelding (Self-certified sick) |
| FER | Ferie (Vacation) |
| PER | Permisjon (Leave of absence) |
| AVS | Avspasering (Time off in lieu) |
| KUR | Kurs (Training/course) |

---

## User Stories

### Story 1: Foundation — Auth and OData Query Engine

**As a** developer integrating with the twin
**I want to** authenticate with subscription-key + tb-key headers and use OData v3 query parameters
**So that** my integration code works identically against the twin and the real API

**Acceptance Criteria:**

- GIVEN a request without `subscription-key` header WHEN any endpoint is called THEN return 401 `{ "statusCode": 401, "message": "Access denied due to missing subscription key" }`
- GIVEN a request without `tb-key` header WHEN any endpoint is called THEN return 401 `{ "statusCode": 401, "message": "Access denied due to missing tb-key" }`
- GIVEN valid headers WHEN `GET /api/v3/ansatt?$select=AnsattNr,Fornavn` THEN return only the selected fields
- GIVEN valid headers WHEN `GET /api/v3/ansatt?$filter=Avdeling eq 'PRO'` THEN return only processing employees
- GIVEN valid headers WHEN `GET /api/v3/ansatt?$orderby=Etternavn asc` THEN return employees sorted by last name
- GIVEN valid headers WHEN `GET /api/v3/ansatt?$expand=Avdeling` THEN return employees with nested department objects
- GIVEN a result set larger than page size WHEN paginating THEN response includes `@odata.nextLink` with skip token
- GIVEN a `$filter` with `eq`, `ne`, `gt`, `ge`, `lt`, `le`, `and`, `or`, `not` operators THEN filtering works correctly
- GIVEN a `$filter` with `startswith()`, `endswith()`, `substringof()` string functions THEN filtering works correctly
- GIVEN a `$filter` on date fields like `Tidspunkt gt datetime'2025-12-01T00:00:00'` THEN date comparison works correctly

**Test Requirements:**

- [ ] Test: Request without subscription-key returns 401 with correct message
- [ ] Test: Request without tb-key returns 401 with correct message
- [ ] Test: Request with both valid headers returns 200
- [ ] Test: `$select` with single field returns only that field plus entity key
- [ ] Test: `$select` with multiple fields returns only those fields
- [ ] Test: `$filter` with `eq` on string field returns correct subset
- [ ] Test: `$filter` with `gt` on date field returns correct subset
- [ ] Test: `$filter` with `and`/`or` combines conditions correctly
- [ ] Test: `$filter` with `substringof('text', Field)` works correctly
- [ ] Test: `$orderby` with `asc` and `desc` sorts correctly
- [ ] Test: `$expand` on navigation property returns nested object
- [ ] Test: Pagination returns max page size items and valid `@odata.nextLink`
- [ ] Test: Following `@odata.nextLink` returns next page with no duplicates
- [ ] Test: Invalid OData syntax returns 400 with descriptive error message

**Technical Notes:**

Build a reusable OData query parser middleware that all entity endpoints use. This is the most critical piece — every endpoint depends on it. The parser should handle:
- `$select` → SQL column selection
- `$filter` → SQL WHERE clause generation (with parameterized queries to prevent injection)
- `$orderby` → SQL ORDER BY
- `$expand` → SQL JOIN
- `$skip` / `$top` → SQL OFFSET / LIMIT (default page size: 100, max: 10000)
- `@odata.nextLink` generation when results exceed page size

Auth middleware checks for `subscription-key` and `tb-key` headers. The values are configurable via environment variables (default: `test-subscription-key` and `test-tb-key`).

All responses wrapped in OData envelope: `{ "value": [...], "@odata.nextLink": "..." }`.

---

### Story 2: Employee Endpoints — Ansatt CRUD

**As a** developer
**I want to** query and create employees via `GET/POST /api/v3/ansatt`
**So that** I can read the workforce directory and simulate onboarding

**Acceptance Criteria:**

- GIVEN valid auth WHEN `GET /api/v3/ansatt` THEN return all active employees in OData format
- GIVEN valid auth WHEN `GET /api/v3/ansatt?$filter=Avdeling eq 'SJO-03'` THEN return only sea site 3 employees
- GIVEN valid auth WHEN `GET /api/v3/ansatt?$filter=Aktiv eq true` THEN return only active employees
- GIVEN valid auth WHEN `GET /api/v3/ansatt(1001)` THEN return employee with AnsattNr 1001
- GIVEN valid auth WHEN `GET /api/v3/ansatt(99999)` THEN return 404
- GIVEN valid auth WHEN `POST /api/v3/ansatt` with valid body THEN create employee and return 201
- GIVEN valid auth WHEN `POST /api/v3/ansatt` with missing required fields THEN return 400 with field-level errors
- GIVEN valid auth WHEN `GET /api/v3/ansatt?$filter=LokasjonNavn eq 'Vartdal'` THEN return all Vartdal-based employees

**Test Requirements:**

- [ ] Test: GET returns 155 employees with correct OData envelope
- [ ] Test: GET with department filter returns only matching employees
- [ ] Test: GET with location filter returns only matching employees
- [ ] Test: GET by ID returns single employee with all fields
- [ ] Test: GET by non-existent ID returns 404
- [ ] Test: POST with valid body creates employee and returns 201 with new AnsattNr
- [ ] Test: POST with missing Fornavn returns 400 with validation error
- [ ] Test: POST with duplicate AnsattNr returns 409
- [ ] Test: Employee distribution matches expected headcount per department (+/- 10%)

**Technical Notes:**

Seed data uses Norwegian name generator. Names should reflect realistic Norwegian demographics. Employee numbers start at 1001. Department distribution must match the Ode Organization Reference Data table above.

---

### Story 3: Department and Reference Data Endpoints

**As a** developer
**I want to** query departments, activities, work types, and projects
**So that** I can populate dropdowns and validate codes in my integration

**Acceptance Criteria:**

- GIVEN valid auth WHEN `GET /api/v3/avdeling` THEN return all departments with hierarchy
- GIVEN valid auth WHEN `GET /api/v3/avdeling?$filter=Lokasjon eq 'VAR'` THEN return only Vartdal departments
- GIVEN valid auth WHEN `GET /api/v3/aktivitet` THEN return all activity codes
- GIVEN valid auth WHEN `GET /api/v3/arbeidstype` THEN return all work type codes
- GIVEN valid auth WHEN `GET /api/v3/prosjekt` THEN return all projects
- GIVEN valid auth WHEN `GET /api/v3/prosjekt?$filter=Aktiv eq true` THEN return only active projects
- GIVEN valid auth WHEN `GET /api/v3/prosjektlinje?$filter=ProsjektKode eq 'P001'` THEN return time entries for that project

**Test Requirements:**

- [ ] Test: GET avdeling returns all departments with correct parent hierarchy
- [ ] Test: GET avdeling with location filter returns correct subset
- [ ] Test: GET aktivitet returns realistic activity codes (minimum 8)
- [ ] Test: GET arbeidstype returns realistic work types (minimum 4)
- [ ] Test: GET prosjekt returns projects with start/end dates
- [ ] Test: GET prosjektlinje filtered by project code returns correct entries
- [ ] Test: All reference data endpoints support $select and $filter

**Technical Notes:**

Reference data seeding:

Activities: Produksjon (production), Vedlikehold (maintenance), Administrasjon, Opplaring (training), Rengjoring (cleaning), Transport, Foring (feeding), Kvalitetskontroll (quality control), Pakking (packing), Slakting (slaughter).

Work types: Fast (permanent), Vikar (temp), Sesong (seasonal), Lærling (apprentice).

Projects: At least 5 active projects reflecting Ode operations — e.g., "Nytt settefiskanlegg" (new hatchery facility), "ISO-sertifisering", "Digitaliseringsprosjektet", "Vedlikehold merd 7" (net pen 7 maintenance), "Sommer 2026 sesong" (summer 2026 season).

---

### Story 4: Clock-in/out Endpoints — Stempling

**As a** developer
**I want to** query and create clock-in/out events via `GET/POST /api/v3/stempling`
**So that** I can read attendance data and simulate real-time clock events

**Acceptance Criteria:**

- GIVEN valid auth WHEN `GET /api/v3/stempling?$filter=AnsattNr eq 1001` THEN return all clock events for that employee
- GIVEN valid auth WHEN `GET /api/v3/stempling?$filter=Tidspunkt gt datetime'2025-12-01T00:00:00' and Tidspunkt lt datetime'2025-12-31T23:59:59'` THEN return December 2025 stemplings
- GIVEN valid auth WHEN `GET /api/v3/stempling?$filter=Type eq 0 and Lokasjon eq 'VAR'` THEN return all clock-ins at Vartdal
- GIVEN valid auth WHEN `POST /api/v3/stempling` with Type 0 (clock-in) THEN create stempling and fire webhook
- GIVEN valid auth WHEN `POST /api/v3/stempling` with Type 1 (clock-out) THEN create stempling and fire webhook
- GIVEN valid auth WHEN `POST /api/v3/stempling` with Type 2 (switch) THEN create stempling with activity code and fire webhook
- GIVEN seeded data WHEN querying a working day THEN each working employee has paired clock-in and clock-out events
- GIVEN seeded data for processing plant WHEN querying shifts THEN clock-in times cluster around 06:00, 14:00, 22:00 with +/- 5 min variance

**Test Requirements:**

- [ ] Test: GET stemplings filtered by employee returns correct events
- [ ] Test: GET stemplings filtered by date range returns correct events
- [ ] Test: GET stemplings filtered by type and location returns correct subset
- [ ] Test: POST clock-in creates stempling with Type 0 and returns 201
- [ ] Test: POST clock-out creates stempling with Type 1 and returns 201
- [ ] Test: POST switch creates stempling with Type 2, Aktivitet field populated
- [ ] Test: Seeded data for office worker has clock-ins around 08:00 +/- 30 min
- [ ] Test: Seeded data for processing shift worker has clock-ins within +/- 5 min of shift start
- [ ] Test: Seeded data for sea site on-rotation employees has 12h work days
- [ ] Test: Seeded data for sea site off-rotation employees has no stemplings
- [ ] Test: No stemplings exist on public holidays or weekends (except shift/sea workers)
- [ ] Test: Pagination works correctly with large result sets

**Technical Notes:**

Seeded attendance data covers 3 calendar months ending at "today" (configurable via env var `TWIN_REFERENCE_DATE`, default: current date). Each working day generates clock-in/out pairs for active employees based on their department pattern.

Variance model:
- Office: clock-in 07:30-08:30 (normal distribution, mean 08:00, stdev 15 min), clock-out 15:30-16:30
- Processing shifts: clock-in within +/- 5 min of shift start, clock-out within +/- 5 min of shift end
- Hatchery: clock-in 06:45-07:15, clock-out 14:45-15:15
- Sea sites on-rotation: clock-in 06:30-07:30, clock-out 18:30-19:30 (12h days)
- Sea sites off-rotation: no stemplings for that 2-week block

Absence: ~3% daily random absence rate (no stempling generated, Timelinje gets absence entry instead).

---

### Story 5: Time Entries — Timelinje

**As a** developer
**I want to** query and create time entries via `GET/POST /api/v3/timelinje`
**So that** I can read aggregated hours, overtime, and absence records

**Acceptance Criteria:**

- GIVEN valid auth WHEN `GET /api/v3/timelinje?$filter=AnsattNr eq 1001 and Dato ge datetime'2025-12-01' and Dato le datetime'2025-12-31'` THEN return December time entries for employee 1001
- GIVEN valid auth WHEN `GET /api/v3/timelinje?$filter=Fraverstype eq 'SYK'` THEN return all sick leave entries
- GIVEN valid auth WHEN `GET /api/v3/timelinje?$filter=Overtid gt 0` THEN return entries with overtime
- GIVEN valid auth WHEN `POST /api/v3/timelinje` with valid body THEN create time entry and return 201
- GIVEN seeded data WHEN querying a standard office worker's week THEN Timer sums to ~37.5h
- GIVEN seeded data WHEN querying overtime THEN overtime entries are realistic (not every day, clustered in busy periods)
- GIVEN seeded data with absence WHEN employee was absent THEN Fraverstype is populated and Timer is 0

**Test Requirements:**

- [ ] Test: GET timelinje filtered by employee and date range returns correct entries
- [ ] Test: GET timelinje filtered by absence type returns only absence entries
- [ ] Test: GET timelinje filtered by overtime > 0 returns entries with overtime
- [ ] Test: POST with valid body creates entry and returns 201
- [ ] Test: POST with invalid AnsattNr returns 400
- [ ] Test: Seeded office worker weekly hours average 37.5h (+/- 1h)
- [ ] Test: Seeded shift worker weekly hours average 36.5h (+/- 1h)
- [ ] Test: Seeded overtime entries exist but represent < 10% of total entries
- [ ] Test: Absence entries have Fraverstype set and Timer = 0
- [ ] Test: Pagination with @odata.nextLink works for large date ranges

**Technical Notes:**

Time entries are derived from Stempling data during seeding. For each day an employee has a clock-in/clock-out pair, compute Timer = hours between. If Timer exceeds standard (7.5h office, varies by shift), the excess goes to Overtid.

Overtime pattern: ~5% of working days have 1-3h overtime, more frequent in processing during peak season (configurable).

Absence entries are generated independently — when an employee is absent, there is no Stempling but a Timelinje entry with Fraverstype and Timer = 0.

---

### Story 6: Schedule/Plan Endpoints

**As a** developer
**I want to** query schedules via `GET /api/v3/plan`
**So that** I can see planned shifts and crew rotations

**Acceptance Criteria:**

- GIVEN valid auth WHEN `GET /api/v3/plan?$filter=AnsattNr eq 1001` THEN return schedule for employee 1001
- GIVEN valid auth WHEN `GET /api/v3/plan?$filter=Avdeling eq 'PRO-D' and Dato ge datetime'2025-12-01'` THEN return day shift schedules from December
- GIVEN valid auth WHEN `GET /api/v3/plan?$filter=Skift eq 'SJO-PA'` THEN return all on-rotation sea schedules
- GIVEN seeded data for processing WHEN querying plan for PRO employees THEN shifts rotate correctly (each employee cycles through DAG/KVELD/NATT)
- GIVEN seeded data for sea sites WHEN querying plan for SJO employees THEN 2-weeks-on/2-weeks-off pattern is visible
- GIVEN seeded data WHEN querying office worker plan THEN all entries show KONTOR shift, Mon-Fri only

**Test Requirements:**

- [ ] Test: GET plan filtered by employee returns schedule entries
- [ ] Test: GET plan filtered by department and date returns correct shift entries
- [ ] Test: GET plan filtered by shift code returns correct entries
- [ ] Test: Processing workers rotate through 3 shifts over the seeded period
- [ ] Test: Sea site workers show 14 consecutive SJO-PA days followed by 14 SJO-AV days
- [ ] Test: Office workers have KONTOR entries only on weekdays
- [ ] Test: No plan entries on public holidays for office workers
- [ ] Test: Hatchery workers have weekend entries at reduced frequency (~1 in 4 weekends)

**Technical Notes:**

Schedule generation rules:
- Processing plant: 3-shift rotation. Each employee in PRO starts on a random shift and rotates weekly (DAG -> KVELD -> NATT -> DAG).
- Sea sites: each site has ~5 crew, split into 2 groups. Group A is on-rotation weeks 1-2, off weeks 3-4. Group B is the inverse. On-rotation days are every day including weekends.
- Hatchery: weekday schedule with ~25% of staff assigned one weekend per month for feeding/monitoring.
- Office: Mon-Fri only, no weekends, no public holidays.

---

### Story 7: Webhook Simulation

**As a** developer
**I want to** register webhook URLs and receive real-time events when stemplings are created
**So that** I can build event-driven integrations

**Acceptance Criteria:**

- GIVEN valid auth WHEN `POST /admin/webhooks/register` with `{ "Url": "https://example.com/hook", "Hendelser": ["stempling"] }` THEN webhook is registered and returns 201
- GIVEN a registered stempling webhook WHEN a new Stempling is created via POST THEN the webhook URL receives a POST with the stempling data
- GIVEN a registered payroll-complete webhook WHEN `POST /admin/eksport/trigger` is called THEN the webhook URL receives a payroll-complete event
- GIVEN a registered webhook WHEN the callback URL returns non-2xx THEN the twin retries up to 3 times with exponential backoff (1s, 5s, 25s)
- GIVEN valid auth WHEN `GET /admin/webhooks` THEN return all registered webhooks
- GIVEN valid auth WHEN `DELETE /admin/webhooks/{id}` THEN deactivate the webhook

**Test Requirements:**

- [ ] Test: POST register creates webhook and returns 201 with WebhookId
- [ ] Test: POST register with invalid URL returns 400
- [ ] Test: POST register with empty Hendelser returns 400
- [ ] Test: Creating a stempling fires webhook to registered URL with correct payload
- [ ] Test: Webhook payload includes event type, timestamp, and full entity data
- [ ] Test: Triggering export fires payroll-complete webhook
- [ ] Test: GET webhooks returns all registered hooks
- [ ] Test: DELETE webhook deactivates it (no more events sent)
- [ ] Test: Failed webhook delivery retries 3 times
- [ ] Test: Webhook is not fired for events not in the Hendelser list

**Technical Notes:**

Webhook payloads follow the real Tidsbanken webhook format:

```json
{
  "HendelseType": "stempling",
  "Tidspunkt": "2025-12-15T08:02:33Z",
  "Data": {
    "StemplingId": 50001,
    "AnsattNr": 1023,
    "Type": 0,
    "Tidspunkt": "2025-12-15T08:02:33Z",
    "Lokasjon": "VAR"
  }
}
```

Webhook delivery uses fire-and-forget with retry queue. For the twin, use an in-memory retry queue (no external message broker needed). The retry logic is best-effort — if the twin restarts, pending retries are lost. This is acceptable for a dev tool.

The `/admin/` prefix distinguishes twin management endpoints from the simulated Tidsbanken API surface.

---

### Story 8: Data Generation — 3 Months of Realistic History

**As a** developer
**I want to** start the twin and immediately have 3 months of realistic attendance data
**So that** I can test integrations against a populated dataset without manual setup

**Acceptance Criteria:**

- GIVEN a fresh twin database WHEN the server starts THEN seed data is generated automatically
- GIVEN seeded data WHEN querying employees THEN 155 employees exist with correct department distribution
- GIVEN seeded data WHEN querying stemplings for a weekday THEN ~140 employees have clock-in/out pairs (accounting for ~3% absence and off-rotation sea crew)
- GIVEN seeded data WHEN querying timelinje for a month THEN entries sum to realistic totals per employee
- GIVEN seeded data WHEN querying plan THEN shift patterns are consistent with stempling data
- GIVEN seeded data WHEN examining Norwegian names THEN names appear Norwegian (not English/American defaults)
- GIVEN seeded data WHEN examining dates THEN no data exists on Dec 25, Dec 26, Jan 1, May 1, May 17 for office workers
- GIVEN the env var `TWIN_SEED` WHEN set to a specific value THEN identical data is generated (deterministic seeding)
- GIVEN the env var `TWIN_REFERENCE_DATE` WHEN set to `2026-01-15` THEN data covers Oct 16, 2025 to Jan 15, 2026

**Test Requirements:**

- [ ] Test: Fresh start generates 155 employees across correct departments
- [ ] Test: 3 months of stempling data exists for each active non-absent employee
- [ ] Test: Timelinje entries exist for every working day per employee
- [ ] Test: Plan entries exist for the full 3-month period
- [ ] Test: Norwegian public holidays have no office/hatchery stemplings
- [ ] Test: Employee names are Norwegian (spot-check against Norwegian name list)
- [ ] Test: Same TWIN_SEED produces identical data on two fresh starts
- [ ] Test: TWIN_REFERENCE_DATE shifts the data window correctly
- [ ] Test: Sea site rotation pattern has correct 2-on/2-off cadence across 3 months
- [ ] Test: Processing shift rotation cycles correctly across 3 months
- [ ] Test: Absence rate is approximately 3% (+/- 1%) across the dataset
- [ ] Test: Total seeded records: ~155 employees, ~19,000 stemplings, ~9,500 timelinje entries, ~14,000 plan entries (order-of-magnitude check)

**Technical Notes:**

Data generation runs at server startup if the database is empty. Use a seeded PRNG (e.g., `seedrandom` npm package) so that `TWIN_SEED` produces deterministic output.

Generation order (must be sequential due to foreign key dependencies):
1. Departments and reference data (activities, work types, projects)
2. Employees (with department assignments)
3. Plans (shift schedules for the 3-month window)
4. Stemplings (clock events derived from plans, with variance and absence)
5. Timelinje (time entries derived from stemplings)
6. Prosjektlinje (project time entries, subset of timelinje)

Norwegian name data: use a hardcoded list of ~100 Norwegian first names (mix of male/female) and ~80 Norwegian last names. These are real common Norwegian names, not transliterations.

Volume estimates for 3 months (90 days):
- 155 employees
- ~130 working employees/day (accounting for off-rotation, absence) x 2 stemplings x 65 working days = ~17,000 stemplings
- ~130 employees x 65 working days + ~450 absence entries = ~8,900 timelinje entries
- 155 employees x 90 days = ~14,000 plan entries

---

## Technical Design

### Stack

- **Runtime:** Node.js + Express
- **Database:** SQLite (via `better-sqlite3` for synchronous queries)
- **OData Parser:** Custom middleware (no heavy OData library — the subset needed is small)
- **Auth:** Header-check middleware (`subscription-key` + `tb-key`)
- **Data Generation:** Seeded PRNG (`seedrandom`), Norwegian name lists
- **Webhooks:** In-memory queue with `axios` or `fetch` for delivery

### API Surface

| Method | Path | Entity | OData |
|--------|------|--------|-------|
| GET | /api/v3/ansatt | Employee list | Yes |
| GET | /api/v3/ansatt(:id) | Single employee | Yes |
| POST | /api/v3/ansatt | Create employee | — |
| GET | /api/v3/avdeling | Departments | Yes |
| GET | /api/v3/aktivitet | Activities | Yes |
| GET | /api/v3/arbeidstype | Work types | Yes |
| GET | /api/v3/prosjekt | Projects | Yes |
| GET | /api/v3/prosjektlinje | Project lines | Yes |
| GET | /api/v3/stempling | Clock events | Yes |
| POST | /api/v3/stempling | Create clock event | — |
| GET | /api/v3/timelinje | Time entries | Yes |
| POST | /api/v3/timelinje | Create time entry | — |
| GET | /api/v3/plan | Schedules | Yes |
| POST | /admin/webhooks/register | Register webhook | — |
| GET | /admin/webhooks | List webhooks | — |
| DELETE | /admin/webhooks/:id | Delete webhook | — |
| POST | /admin/eksport/trigger | Trigger payroll export | — |
| GET | /admin/health | Health check | — |

### Database Schema

SQLite tables mirror the data models above. All tables have auto-increment integer primary keys. Foreign keys enforced via `PRAGMA foreign_keys = ON`.

Indexes needed for query performance:
- `stempling(AnsattNr, Tidspunkt)` — primary query pattern
- `timelinje(AnsattNr, Dato)` — primary query pattern
- `plan(AnsattNr, Dato)` — primary query pattern
- `ansatt(Avdeling)` — department filtering

### Dependencies

- Foundation auth middleware (reusable from other twins if available, otherwise built here)
- Foundation data generation utilities (reusable seeded PRNG wrapper, Norwegian name lists)
- SQLite — no external database service needed
- No other twins or external services

### Security Considerations

- Auth headers are checked but not validated against a real identity provider — this is intentional for a dev tool
- OData filter parsing must use parameterized SQL queries — never string-concatenate filter values into SQL
- The twin should bind to localhost by default (configurable via `TWIN_HOST` env var)
- No real employee data is used — all data is synthetic
- Webhook URLs are not validated beyond URL format — the twin will POST to whatever URL is registered

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3100 | Server port |
| `TWIN_HOST` | `127.0.0.1` | Bind address |
| `TWIN_SUBSCRIPTION_KEY` | `test-subscription-key` | Expected subscription-key header value |
| `TWIN_TB_KEY` | `test-tb-key` | Expected tb-key header value |
| `TWIN_SEED` | `ode-tidsbanken-2025` | PRNG seed for deterministic data |
| `TWIN_REFERENCE_DATE` | (current date) | End date of the 3-month data window |
| `TWIN_DB_PATH` | `./data/tidsbanken.db` | SQLite database file path |
| `TWIN_PAGE_SIZE` | `100` | Default OData page size |
| `TWIN_MAX_PAGE_SIZE` | `10000` | Maximum allowed page size |

---

## Implementation Order

### Group 1 (parallel — no shared files)
- **Story 1** — Auth middleware + OData query engine (`src/middleware/auth.ts`, `src/odata/`)
- **Story 8 (partial: name lists + reference data generation)** — Norwegian names, department/activity/work-type seed data (`src/seed/names.ts`, `src/seed/reference-data.ts`)

### Group 2 (parallel — after Group 1)
- **Story 2** — Employee endpoints + employee seed generation (`src/routes/ansatt.ts`, `src/seed/employees.ts`)
- **Story 3** — Reference data endpoints (`src/routes/avdeling.ts`, `src/routes/aktivitet.ts`, `src/routes/arbeidstype.ts`, `src/routes/prosjekt.ts`)

### Group 3 (parallel — after Group 2, needs employees)
- **Story 6** — Plan endpoints + schedule generation (`src/routes/plan.ts`, `src/seed/plans.ts`)
- **Story 8 (partial: plan generation)** — feeds into Story 4 and 5

### Group 4 (sequential — after Group 3, needs plans)
- **Story 4** — Stempling endpoints + stempling seed generation (`src/routes/stempling.ts`, `src/seed/stemplings.ts`)

### Group 5 (sequential — after Group 4, needs stemplings)
- **Story 5** — Timelinje endpoints + timelinje seed generation (`src/routes/timelinje.ts`, `src/seed/timelinje.ts`)

### Group 6 (parallel — after Group 4, needs stempling POST working)
- **Story 7** — Webhook registration + event delivery (`src/routes/webhooks.ts`, `src/webhooks/`)

**Parallel safety rules:**
- Stories in the same group touch DIFFERENT files/folders
- Database migration is a single schema file created in Story 1 and extended — each story adds its table(s) to the same schema file sequentially, or each story owns its own table creation
- The seed orchestrator (`src/seed/index.ts`) is created in Group 1 and extended by each subsequent group — to avoid conflicts, each story writes to its own seed module and the orchestrator imports them in order

---

## Development Approach

### Simplifications (what starts simple)

- OData: only the operators listed in Story 1 — no `$count`, `$inlinecount`, `$batch`, `$format`, or lambda expressions
- Auth: header-value comparison, no JWT validation or token refresh
- Webhooks: in-memory queue, retries lost on restart
- Data generation: runs on startup if DB is empty — no incremental seeding or migration
- Single SQLite file — no concurrent write handling beyond SQLite's built-in WAL mode

### Upgrade Path (what changes for production)

- "Add full OData v3 compliance" — would be a separate story if integrations need `$count` or `$batch`
- "Add persistent webhook retry queue" — swap in-memory queue for SQLite-backed queue
- "Add live data streaming" — generate stemplings in real-time on a timer (simulating a live workday)
- "Add multi-tenant support" — separate DB per tenant, configurable org structures
- "Add write-back proxy" — forward certain POST requests to the real Tidsbanken API

### Architecture Decisions

- **SQLite over Postgres:** The twin is a single-user dev tool. SQLite needs zero setup, ships as a single file, and handles the data volume (~20K stemplings) without effort.
- **Custom OData parser over a library:** The OData v3 subset we need ($select, $filter, $orderby, $expand, pagination) is small. A custom parser avoids the dependency weight and complexity of full OData libraries while giving us control over error messages and SQLite-specific SQL generation.
- **Deterministic seeding:** Using a seeded PRNG means tests can assert on specific data. Changing the seed generates a different but equally valid dataset — useful for testing edge cases.
- **Express over Fastify/Hono:** Consistency with other twins in the project. Express is well-understood and sufficient for the request volume.

---

## Verification Checklist

Before this feature is marked complete:

- [ ] All user stories implemented
- [ ] All acceptance criteria met
- [ ] All tests written and passing
- [ ] Tests verify real behavior (not just status codes)
- [ ] Edge cases handled (empty results, invalid filters, date boundaries)
- [ ] No regressions in existing tests
- [ ] Code committed with proper messages
- [ ] OData queries produce correct SQL (no injection vectors)
- [ ] 155 employees generated with correct department distribution
- [ ] 3 months of realistic attendance data seeded
- [ ] Norwegian names and work patterns used throughout
- [ ] Webhooks fire on stempling creation and export trigger
- [ ] Pagination works correctly across all entity endpoints
- [ ] Server starts and seeds in under 10 seconds
- [ ] Ready for human review
