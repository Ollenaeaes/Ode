# Feature Spec: Digital Twin — Mercatus Farmer (ScaleAQ)

**Slug:** `twin-mercatus-farmer`
**Created:** 2026-03-11
**Status:** draft
**Priority:** high

---

## Overview

A digital twin simulating ScaleAQ's Mercatus Farmer biomass ERP REST API. The twin serves as a local, deterministic stand-in for the real API at developer.scaleaq.com, returning realistic aquaculture data modeled on Ode's actual operations: 10 sea sites and 2 hatcheries producing Atlantic cod (Gadus morhua) in the More og Romsdal region of Norway. This enables development, testing, and demos without depending on the real Mercatus Farmer system.

## Problem Statement

Ode needs to integrate with ScaleAQ's Mercatus Farmer for biomass tracking, environmental monitoring, and financial reporting. The real API is rate-limited, requires production credentials, and returns data for actual live fish — making it unsuitable for development and automated testing. A digital twin with realistic cod aquaculture data lets the team build integrations confidently, test edge cases, and demo the system without touching production.

## Out of Scope

- NOT: Webhooks or event-driven push (the real API is polling-only)
- NOT: Write-back to the real Mercatus Farmer system
- NOT: Multi-tenant support (this twin simulates Ode's single-tenant view)
- NOT: Real-time data streaming or WebSocket endpoints
- NOT: Authentication against ScaleAQ's identity provider (twin uses its own bearer tokens via the foundation auth library)
- NOT: Salmon-specific biology (lice counts, lice treatments) — Ode farms cod
- NOT: UI or dashboard — this is a headless API twin
- NOT: Batch processing or async job endpoints

---

## User Stories

### Story 1: Meta — Sites Endpoint

**As a** developer integrating with Mercatus Farmer
**I want to** query site metadata for Ode's facilities
**So that** I can enumerate locations and associate data with the correct site

**Acceptance Criteria:**

- GIVEN a valid bearer token WHEN I call `GET /api/meta/sites` THEN I receive a JSON array of 12 sites (10 sea sites + 2 hatcheries) with id, name, type, coordinates, and company reference
- GIVEN a valid bearer token WHEN I call `GET /api/meta/sites/{id}` with a known site ID THEN I receive the full detail for that single site including capacity and active status
- GIVEN a valid bearer token WHEN I call `GET /api/meta/sites/{id}` with an unknown ID THEN I receive 404 with a structured error body
- GIVEN no token or an invalid token WHEN I call any meta endpoint THEN I receive 401 Unauthorized
- GIVEN a valid request WHEN the `Scale-Version` header is present THEN it is accepted (logged) but does not alter behavior in this twin version

**Test Requirements:**

- [ ] Test: GET /api/meta/sites returns exactly 12 sites with correct names matching Ode's real sites
- [ ] Test: Each site has id (string UUID), name (string), type (enum: "SEA" | "HATCHERY"), latitude (number), longitude (number), companyId (string UUID)
- [ ] Test: GET /api/meta/sites/{id} returns the correct site for each of the 12 known IDs
- [ ] Test: GET /api/meta/sites/{id} returns 404 for a random UUID
- [ ] Test: All meta endpoints return 401 without a bearer token
- [ ] Test: Scale-Version header is accepted without error on any value

**Technical Notes:**

Site data is static seed data. Coordinates should be realistic for the More og Romsdal coastline (latitude ~62.3-63.5 N, longitude ~5.5-7.5 E). Site names: Apalset, Alida, Vorpneset, Aukan, Stoylen, Dysjaneset, Jonskjaer, Svartekari, Rekvika, Stokkeneset (sea), Rodberg, Tjeldbergodden (hatchery).

---

### Story 2: Meta — Companies Endpoint

**As a** developer integrating with Mercatus Farmer
**I want to** query company metadata
**So that** I can resolve company references on sites and financial records

**Acceptance Criteria:**

- GIVEN a valid bearer token WHEN I call `GET /api/meta/companies` THEN I receive a JSON array containing at least one company representing Ode
- GIVEN a valid bearer token WHEN I call `GET /api/meta/companies/{id}` THEN I receive the full company detail including name, organization number, and address

**Test Requirements:**

- [ ] Test: GET /api/meta/companies returns an array with Ode's company record
- [ ] Test: Company record includes id, name, organizationNumber, address fields
- [ ] Test: GET /api/meta/companies/{id} returns 404 for unknown ID
- [ ] Test: Returns 401 without bearer token

**Technical Notes:**

Ode's organization number is a realistic Norwegian org number format (9 digits). Address is Alesund, Norway.

---

### Story 3: Biology — Weight Samples

**As a** biologist recording fish growth data
**I want to** submit and retrieve weight sampling records per site
**So that** I can track cod growth from juvenile to harvest weight

**Acceptance Criteria:**

- GIVEN a valid bearer token WHEN I call `POST /api/biology/weight-samples` with a valid payload (siteId, sampleDate, averageWeight, sampleSize, fishGroupId) THEN the sample is stored and I receive 201 with the created record including a generated ID
- GIVEN a valid bearer token WHEN I call `GET /api/biology/weight-samples?siteId={id}&fromDate={date}&toDate={date}` THEN I receive weight samples filtered by site and date range
- GIVEN a valid bearer token WHEN I call `GET /api/biology/weight-samples?siteId={id}` without date filters THEN I receive all samples for that site (paginated, default 100)
- GIVEN an invalid payload (missing required fields, negative weight, future date) WHEN I POST THEN I receive 400 with field-level validation errors
- GIVEN seeded data WHEN I query weight samples for a site with active fish groups THEN the returned averageWeight values show a realistic growth trajectory over time

**Test Requirements:**

- [ ] Test: POST creates a weight sample and returns 201 with id, siteId, sampleDate, averageWeight (grams), sampleSize, fishGroupId, createdAt
- [ ] Test: GET with siteId + date range returns only matching records, sorted by sampleDate descending
- [ ] Test: GET without date filters returns all samples for the site, respects pagination (limit/offset query params)
- [ ] Test: POST with missing siteId returns 400 with error referencing the missing field
- [ ] Test: POST with averageWeight <= 0 returns 400
- [ ] Test: POST with sampleDate in the future returns 400
- [ ] Test: Seeded weight samples for a fish group show progressive growth (each subsequent sample averageWeight >= previous, within realistic variance)
- [ ] Test: Returns 401 without bearer token

**Technical Notes:**

Weight is stored in grams. Cod growth model: ~200g at sea transfer, ~800g at 6 months, ~1800g at 12 months, ~3000g at 18 months, ~4000g+ at harvest (20-24 months). Sample sizes typically 20-50 fish. Fish groups are cohorts deployed to a specific site.

---

### Story 4: Biology — Mortality Records

**As a** site manager tracking fish health
**I want to** submit and retrieve daily mortality data per site and fish group
**So that** I can monitor losses and detect health issues early

**Acceptance Criteria:**

- GIVEN a valid bearer token WHEN I call `POST /api/biology/mortality` with siteId, fishGroupId, date, deadCount, cause THEN the record is stored and I receive 201
- GIVEN a valid bearer token WHEN I call `GET /api/biology/mortality?siteId={id}&fromDate={date}&toDate={date}` THEN I receive mortality records filtered by site and date range
- GIVEN seeded data WHEN I query mortality for an active site THEN the daily counts reflect realistic cod mortality patterns (low background mortality of 0.01-0.05% per day, occasional spikes)

**Test Requirements:**

- [ ] Test: POST creates a mortality record and returns 201 with id, siteId, fishGroupId, date, deadCount, cause, createdAt
- [ ] Test: GET with date range returns only matching records
- [ ] Test: POST with deadCount < 0 returns 400
- [ ] Test: cause field accepts enum values: "NATURAL", "DISEASE", "HANDLING", "PREDATION", "ENVIRONMENT", "UNKNOWN"
- [ ] Test: Seeded mortality data has realistic daily values (not zero, not absurdly high)
- [ ] Test: Returns 401 without bearer token

**Technical Notes:**

Mortality cause is an enum. Background mortality for cod is typically 0.5-1.5% per month (higher in juveniles). Occasional spikes from handling events, jellyfish, or disease outbreaks.

---

### Story 5: Biology — Harvest Imports

**As a** production manager recording harvest events
**I want to** submit harvest data when fish are taken from a site
**So that** biomass records stay accurate and I can track yield

**Acceptance Criteria:**

- GIVEN a valid bearer token WHEN I call `POST /api/biology/harvest-imports` with siteId, fishGroupId, harvestDate, count, totalWeightKg, averageWeightKg THEN the harvest is recorded and I receive 201
- GIVEN a valid bearer token WHEN I call `GET /api/biology/harvest-imports?siteId={id}&fromDate={date}&toDate={date}` THEN I receive harvest records for that site and period
- GIVEN seeded data WHEN I query harvest imports THEN harvest weights reflect mature cod (3-4+ kg average)

**Test Requirements:**

- [ ] Test: POST creates a harvest record and returns 201 with all fields plus generated id and createdAt
- [ ] Test: GET with date range returns filtered records sorted by harvestDate descending
- [ ] Test: POST with count <= 0 or totalWeightKg <= 0 returns 400
- [ ] Test: averageWeightKg is validated against totalWeightKg / count (must be within 10% tolerance if both provided)
- [ ] Test: Seeded harvest records have averageWeightKg between 2.5 and 6.0 (realistic cod harvest range)
- [ ] Test: Returns 401 without bearer token

**Technical Notes:**

Harvest weight in kg (not grams like weight samples). Typical Ode harvest: 3-4+ kg fish, batches of hundreds to thousands of fish per harvest event. Staggered harvesting means multiple harvest events per site per month during harvest periods.

---

### Story 6: Time Series — Environmental Data

**As a** site operator monitoring water conditions
**I want to** retrieve environmental sensor data (temperature, oxygen, salinity, current) for a site over a time range
**So that** I can monitor conditions and correlate with fish performance

**Acceptance Criteria:**

- GIVEN a valid bearer token WHEN I call `GET /api/timeseries/environment/{siteId}?fromDate={iso}&toDate={iso}&parameters=temperature,oxygen,salinity,current` THEN I receive time series data points for the requested parameters within the date range
- GIVEN a valid bearer token WHEN I call `GET /api/timeseries/environment/{siteId}` with a parameter filter THEN only the requested parameters are returned
- GIVEN a valid bearer token WHEN I call `GET /api/timeseries/environment/{siteId}?aggregation=hourly` THEN data points are aggregated to hourly averages
- GIVEN a valid bearer token WHEN I call `GET /api/timeseries/environment/{siteId}?aggregation=daily` THEN data points are aggregated to daily averages
- GIVEN seeded data WHEN I query temperature for any sea site THEN values show realistic seasonal patterns for the More og Romsdal coast (5-7C winter, 12-15C summer)
- GIVEN an unknown siteId WHEN I query THEN I receive 404

**Test Requirements:**

- [ ] Test: GET returns data points with timestamp, parameter name, value, and unit
- [ ] Test: Temperature values for January are between 4-8C; for July/August between 11-16C
- [ ] Test: Oxygen values are between 6-12 mg/L (realistic coastal Norway range)
- [ ] Test: Salinity values are between 30-35 PSU (realistic fjord/coastal range)
- [ ] Test: Current speed values are between 0-0.8 m/s
- [ ] Test: Date range filtering works correctly (no data outside requested range)
- [ ] Test: Aggregation=hourly reduces data point count versus raw 15-minute intervals
- [ ] Test: Aggregation=daily reduces data point count versus hourly
- [ ] Test: Hatchery sites return 404 (environmental sensors are sea-site only)
- [ ] Test: Returns 401 without bearer token

**Technical Notes:**

Raw data points are at 15-minute intervals. Parameters and their units: temperature (C), oxygen (mg/L), salinity (PSU), current (m/s). Seasonal temperature model for More og Romsdal: sinusoidal with min ~5C in February, max ~14C in August, plus random noise of +/- 1C. Oxygen inversely correlated with temperature. Salinity relatively stable at 32-34 PSU with minor tidal variation. Current varies by site (sheltered vs exposed).

---

### Story 7: Time Series — Custom Telemetry

**As a** developer pushing sensor or device telemetry
**I want to** submit custom time series data points
**So that** the system can ingest non-standard measurements (e.g., feed barge levels, net tension, custom sensors)

**Acceptance Criteria:**

- GIVEN a valid bearer token WHEN I call `POST /api/timeseries/custom` with siteId, parameter, unit, dataPoints (array of {timestamp, value}) THEN the data is stored and I receive 201 with count of ingested points
- GIVEN a valid bearer token WHEN I call `GET /api/timeseries/custom/{siteId}?parameter={name}&fromDate={iso}&toDate={iso}` THEN I receive the stored custom data points
- GIVEN a batch of 1000+ data points WHEN I POST THEN all are ingested and the response includes the total count

**Test Requirements:**

- [ ] Test: POST with valid payload returns 201 with { ingested: <count> }
- [ ] Test: GET retrieves only the data points matching siteId + parameter + date range
- [ ] Test: POST with empty dataPoints array returns 400
- [ ] Test: POST with dataPoints containing missing timestamp or value returns 400
- [ ] Test: Batch of 500 data points is accepted in a single request
- [ ] Test: Returns 401 without bearer token

**Technical Notes:**

Custom telemetry is schema-flexible — the parameter name and unit are freeform strings. Data points are stored in the same time series table as environmental data but with a "custom" source flag.

---

### Story 8: Financials — Values Import

**As a** finance manager recording cost data
**I want to** submit financial values tied to sites and periods
**So that** feed cost, fish cost per kg, and inventory valuation are tracked alongside biology data

**Acceptance Criteria:**

- GIVEN a valid bearer token WHEN I call `POST /api/financials/values-import` with an array of value records (siteId, period, metric, value, currency) THEN the values are stored and I receive 201
- GIVEN a valid bearer token WHEN I call `GET /api/financials/values?siteId={id}&fromPeriod={YYYY-MM}&toPeriod={YYYY-MM}` THEN I receive financial values for that site and period range
- GIVEN a valid request WHEN metric is one of "FEED_COST_PER_KG", "FISH_COST_PER_KG", "INVENTORY_VALUE", "BIOMASS_VALUE" THEN the value is accepted
- GIVEN an unknown metric name WHEN I POST THEN I receive 400

**Test Requirements:**

- [ ] Test: POST with valid array of values returns 201 with { imported: <count> }
- [ ] Test: GET with siteId + period range returns only matching records
- [ ] Test: Period format is YYYY-MM (monthly granularity)
- [ ] Test: Supported metrics: FEED_COST_PER_KG, FISH_COST_PER_KG, INVENTORY_VALUE, BIOMASS_VALUE
- [ ] Test: Currency accepts "NOK" and "EUR"
- [ ] Test: POST with unknown metric returns 400 with error message
- [ ] Test: POST with negative value is accepted (write-downs, adjustments)
- [ ] Test: Seeded financial data has realistic NOK values (feed cost ~15-25 NOK/kg for cod)
- [ ] Test: Returns 401 without bearer token

**Technical Notes:**

Financial periods are monthly. Feed cost for cod is higher than salmon (~15-25 NOK/kg). Fish cost per kg tracks total production cost including feed, labor, smolt, depreciation. Inventory value is total biomass * fish cost per kg.

---

### Story 9: Data Seeding — Realistic Aquaculture Data

**As a** developer or demo operator
**I want to** seed the twin with realistic historical data
**So that** queries return meaningful, believable data without manual setup

**Acceptance Criteria:**

- GIVEN a fresh database WHEN the seed script runs THEN the database is populated with 12 months of historical data for all 10 sea sites
- GIVEN seeded data WHEN I query any sea site THEN it has at least one active fish group with progressive weight samples
- GIVEN seeded data WHEN I query environmental time series THEN there are data points at 15-minute intervals for the past 12 months with seasonal variation
- GIVEN seeded data WHEN I query financial values THEN there are monthly records for the past 12 months per active site
- GIVEN seeded data WHEN I examine fish groups across all sites THEN they represent staggered deployment dates (not all started on the same day) reflecting year-round production
- GIVEN seeded data WHEN I examine mortality records THEN daily mortality is present with low background rates and occasional realistic spikes

**Test Requirements:**

- [ ] Test: After seeding, GET /api/meta/sites returns 12 sites
- [ ] Test: After seeding, each sea site has 1-3 fish groups at different growth stages
- [ ] Test: After seeding, weight samples per fish group span from deployment to current date with monthly sampling
- [ ] Test: After seeding, environmental time series has data for all 4 parameters for the past 12 months
- [ ] Test: After seeding, financial values exist for each active site for the past 12 months
- [ ] Test: After seeding, fish groups have staggered start dates (at least 3 months spread across all groups)
- [ ] Test: Seed script is idempotent (running twice does not duplicate data)
- [ ] Test: Cod growth curve in weight samples follows the expected model within 20% variance (200g start -> 3000-4000g at 18-20 months)

**Technical Notes:**

The seed script uses the foundation data generation library to produce deterministic but realistic data. Fish groups are the central entity — each group is a cohort of fish deployed to a specific cage/site on a specific date. All biology data (weight samples, mortality, harvests) references a fish group. Environmental data is site-level (not group-level). Financial data is site-level and monthly.

Cod growth model for seed data:
- Day 0 (sea transfer): ~200g, from hatchery
- Month 3: ~500g
- Month 6: ~800g
- Month 9: ~1200g
- Month 12: ~1800g
- Month 15: ~2500g
- Month 18: ~3200g
- Month 20-24: ~3800-4500g (harvest window)

Growth rate slows in winter (cold water) and accelerates in summer (warmer water, longer days). Add +/- 15% random variation to each sample point.

Environmental data generation:
- Temperature: sinusoidal with period 12 months, min 5C (Feb), max 14C (Aug), noise +/- 1C
- Oxygen: inversely correlated with temperature, range 7-11 mg/L
- Salinity: stable baseline 33 PSU, noise +/- 1 PSU, occasional drops during heavy rain/runoff
- Current: site-specific baseline (0.05-0.3 m/s), noise +/- 50%, occasional storm spikes

---

### Story 10: Error Simulation — Realistic API Error Behavior

**As a** developer testing error handling in my integration
**I want to** the twin to return realistic errors matching the real Mercatus Farmer API
**So that** my error handling code is tested against realistic responses

**Acceptance Criteria:**

- GIVEN no Authorization header or an invalid bearer token WHEN I call any endpoint THEN I receive 401 with `{ "error": "Unauthorized", "message": "Invalid or missing bearer token" }`
- GIVEN a valid token WHEN I send a malformed request body (invalid JSON) THEN I receive 400 with `{ "error": "Bad Request", "message": "Invalid JSON in request body" }`
- GIVEN a valid token WHEN I send a request with validation errors THEN I receive 400 with `{ "error": "Bad Request", "message": "Validation failed", "details": [{ "field": "...", "issue": "..." }] }`
- GIVEN a valid token WHEN I request a resource that does not exist THEN I receive 404 with `{ "error": "Not Found", "message": "..." }`
- GIVEN a valid token WHEN I exceed 100 requests within 60 seconds THEN I receive 429 with `{ "error": "Too Many Requests", "message": "Rate limit exceeded" }` and a `Retry-After` header
- GIVEN the `X-Twin-Simulate-Error` header set to a status code (e.g., "503") WHEN I call any endpoint THEN the twin returns that error code with a matching error body (useful for testing resilience)

**Test Requirements:**

- [ ] Test: Missing Authorization header returns 401 with correct error body structure
- [ ] Test: Invalid bearer token returns 401
- [ ] Test: Malformed JSON body returns 400
- [ ] Test: Validation errors return 400 with details array listing each invalid field
- [ ] Test: Unknown resource ID returns 404
- [ ] Test: Sending 101 requests in under 60 seconds triggers 429 on the 101st request
- [ ] Test: 429 response includes Retry-After header with a positive integer
- [ ] Test: X-Twin-Simulate-Error header with "503" returns 503
- [ ] Test: X-Twin-Simulate-Error header with "500" returns 500 with a generic server error body
- [ ] Test: Rate limit counter resets after the window expires

**Technical Notes:**

Rate limiting uses a simple in-memory sliding window per token. The `X-Twin-Simulate-Error` header is a twin-only feature for testing — it does not exist on the real API. Error response format matches ScaleAQ's documented error schema.

---

## Technical Design

### Data Model

#### `sites`

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) PK | Site identifier |
| name | TEXT NOT NULL | Site name (e.g., "Apalset") |
| type | TEXT NOT NULL | "SEA" or "HATCHERY" |
| latitude | REAL NOT NULL | Decimal degrees |
| longitude | REAL NOT NULL | Decimal degrees |
| companyId | TEXT NOT NULL FK | Reference to companies.id |
| capacity | INTEGER | Max biomass capacity in tonnes |
| active | INTEGER NOT NULL DEFAULT 1 | 1 = active, 0 = inactive |
| createdAt | TEXT NOT NULL | ISO 8601 timestamp |

#### `companies`

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) PK | Company identifier |
| name | TEXT NOT NULL | "Ode AS" |
| organizationNumber | TEXT NOT NULL | Norwegian org number (9 digits) |
| address | TEXT | Company address |
| city | TEXT | "Alesund" |
| country | TEXT | "NO" |
| createdAt | TEXT NOT NULL | ISO 8601 timestamp |

#### `fish_groups`

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) PK | Fish group/cohort identifier |
| siteId | TEXT NOT NULL FK | Reference to sites.id |
| name | TEXT NOT NULL | Human-readable name (e.g., "APA-2025-01") |
| species | TEXT NOT NULL DEFAULT 'COD' | Species code |
| deploymentDate | TEXT NOT NULL | ISO 8601 date of sea transfer |
| initialCount | INTEGER NOT NULL | Number of fish deployed |
| initialAverageWeightG | REAL NOT NULL | Average weight at deployment (grams) |
| status | TEXT NOT NULL DEFAULT 'ACTIVE' | "ACTIVE", "HARVESTING", "HARVESTED" |
| createdAt | TEXT NOT NULL | ISO 8601 timestamp |

#### `weight_samples`

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) PK | Sample identifier |
| siteId | TEXT NOT NULL FK | Reference to sites.id |
| fishGroupId | TEXT NOT NULL FK | Reference to fish_groups.id |
| sampleDate | TEXT NOT NULL | ISO 8601 date |
| averageWeight | REAL NOT NULL | Average weight in grams |
| sampleSize | INTEGER NOT NULL | Number of fish sampled |
| minWeight | REAL | Minimum weight in sample (grams) |
| maxWeight | REAL | Maximum weight in sample (grams) |
| standardDeviation | REAL | Weight std dev in grams |
| createdAt | TEXT NOT NULL | ISO 8601 timestamp |

#### `mortality_records`

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) PK | Record identifier |
| siteId | TEXT NOT NULL FK | Reference to sites.id |
| fishGroupId | TEXT NOT NULL FK | Reference to fish_groups.id |
| date | TEXT NOT NULL | ISO 8601 date |
| deadCount | INTEGER NOT NULL | Number of dead fish |
| cause | TEXT NOT NULL | Enum: NATURAL, DISEASE, HANDLING, PREDATION, ENVIRONMENT, UNKNOWN |
| notes | TEXT | Optional notes |
| createdAt | TEXT NOT NULL | ISO 8601 timestamp |

#### `harvest_records`

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) PK | Record identifier |
| siteId | TEXT NOT NULL FK | Reference to sites.id |
| fishGroupId | TEXT NOT NULL FK | Reference to fish_groups.id |
| harvestDate | TEXT NOT NULL | ISO 8601 date |
| count | INTEGER NOT NULL | Number of fish harvested |
| totalWeightKg | REAL NOT NULL | Total harvest weight in kg |
| averageWeightKg | REAL NOT NULL | Average individual weight in kg |
| createdAt | TEXT NOT NULL | ISO 8601 timestamp |

#### `time_series`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK AUTOINCREMENT | Row identifier (integer for performance on large table) |
| siteId | TEXT NOT NULL FK | Reference to sites.id |
| parameter | TEXT NOT NULL | Parameter name (e.g., "temperature", "oxygen", "feed_level") |
| timestamp | TEXT NOT NULL | ISO 8601 timestamp |
| value | REAL NOT NULL | Measured value |
| unit | TEXT NOT NULL | Unit string (e.g., "C", "mg/L", "PSU", "m/s") |
| source | TEXT NOT NULL DEFAULT 'ENVIRONMENT' | "ENVIRONMENT" or "CUSTOM" |
| createdAt | TEXT NOT NULL | ISO 8601 timestamp |

Index: `(siteId, parameter, timestamp)` for range queries.
Index: `(siteId, source, parameter, timestamp)` for filtered range queries.

#### `financial_values`

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) PK | Record identifier |
| siteId | TEXT NOT NULL FK | Reference to sites.id |
| period | TEXT NOT NULL | YYYY-MM format |
| metric | TEXT NOT NULL | Enum: FEED_COST_PER_KG, FISH_COST_PER_KG, INVENTORY_VALUE, BIOMASS_VALUE |
| value | REAL NOT NULL | Numeric value |
| currency | TEXT NOT NULL DEFAULT 'NOK' | Currency code |
| createdAt | TEXT NOT NULL | ISO 8601 timestamp |

Unique constraint: `(siteId, period, metric)` — one value per metric per site per month.

### API Surface

All endpoints are prefixed with `/api` to match the twin routing convention. The twin mirrors the Mercatus Farmer REST API structure:

| Method | Path | Story |
|--------|------|-------|
| GET | /api/meta/sites | 1 |
| GET | /api/meta/sites/:id | 1 |
| GET | /api/meta/companies | 2 |
| GET | /api/meta/companies/:id | 2 |
| POST | /api/biology/weight-samples | 3 |
| GET | /api/biology/weight-samples | 3 |
| POST | /api/biology/mortality | 4 |
| GET | /api/biology/mortality | 4 |
| POST | /api/biology/harvest-imports | 5 |
| GET | /api/biology/harvest-imports | 5 |
| GET | /api/timeseries/environment/:siteId | 6 |
| POST | /api/timeseries/custom | 7 |
| GET | /api/timeseries/custom/:siteId | 7 |
| POST | /api/financials/values-import | 8 |
| GET | /api/financials/values | 8 |

All endpoints require `Authorization: Bearer <token>` header. All endpoints accept and log the optional `Scale-Version` header. All error responses follow the standard error schema (Story 10).

### Query Parameter Conventions

Shared across multiple endpoints:

| Parameter | Type | Description |
|-----------|------|-------------|
| siteId | UUID string | Filter by site |
| fromDate | ISO 8601 date | Inclusive start of date range |
| toDate | ISO 8601 date | Inclusive end of date range |
| limit | integer (default 100) | Pagination page size (max 1000) |
| offset | integer (default 0) | Pagination offset |

Time series endpoints add:

| Parameter | Type | Description |
|-----------|------|-------------|
| parameters | comma-separated string | Filter by parameter names |
| aggregation | "raw" / "hourly" / "daily" | Aggregation level (default "raw") |
| fromDate / toDate | ISO 8601 datetime | Supports full datetime for finer granularity |

### Dependencies

- **Foundation auth library** — Bearer token validation, token generation for tests
- **Foundation data generation library** — Deterministic seeding, realistic value generation
- **Node.js + Express** — HTTP server
- **SQLite** (via better-sqlite3) — Data storage
- **uuid** — ID generation

### Security Considerations

- Bearer token auth on every endpoint (via foundation auth middleware)
- Input validation on all POST bodies (reject unexpected fields, validate types and ranges)
- Rate limiting per token (100 requests / 60 seconds, in-memory)
- SQL parameterized queries only (no string interpolation in SQL)
- The `X-Twin-Simulate-Error` header is a testing affordance; document that it should be disabled in any production-facing deployment
- No CORS restrictions in the twin (it is a local development tool)

---

## Implementation Order

### Group 1: Foundation (sequential — database + middleware first)

- **Story 10** — Error handling middleware, rate limiting, auth middleware, standard error schema. Touches: `src/twins/mercatus-farmer/middleware/`, `src/twins/mercatus-farmer/errors.ts`
- These are shared infrastructure that all subsequent stories depend on.

### Group 2: Meta endpoints (parallel — no shared files)

- **Story 1** — Sites endpoint. Touches: `src/twins/mercatus-farmer/routes/meta/sites.ts`, `src/twins/mercatus-farmer/db/schema.ts` (sites + companies tables), seed data for sites
- **Story 2** — Companies endpoint. Touches: `src/twins/mercatus-farmer/routes/meta/companies.ts`, seed data for companies

Note: Stories 1 and 2 both touch the schema file, so if they must define tables there, run Story 1 first (it creates both the sites and companies tables since they are FK-linked), then Story 2 can add its route.

### Group 3: Biology endpoints (parallel — different route files)

- **Story 3** — Weight samples. Touches: `src/twins/mercatus-farmer/routes/biology/weight-samples.ts`, schema additions (weight_samples + fish_groups tables)
- **Story 4** — Mortality records. Touches: `src/twins/mercatus-farmer/routes/biology/mortality.ts`, schema additions (mortality_records table)
- **Story 5** — Harvest imports. Touches: `src/twins/mercatus-farmer/routes/biology/harvest-imports.ts`, schema additions (harvest_records table)

Story 3 must create the fish_groups table since Stories 4 and 5 depend on it. Run Story 3 first or extract fish_groups into Group 2.

### Group 4: Time Series + Financials (parallel — different route files)

- **Story 6** — Environmental time series. Touches: `src/twins/mercatus-farmer/routes/timeseries/environment.ts`, schema additions (time_series table)
- **Story 7** — Custom telemetry. Touches: `src/twins/mercatus-farmer/routes/timeseries/custom.ts` (shares time_series table from Story 6)
- **Story 8** — Financial values. Touches: `src/twins/mercatus-farmer/routes/financials/values.ts`, schema additions (financial_values table)

Story 6 must create the time_series table before Story 7 can use it. Run Story 6 first, then Story 7 in parallel with Story 8.

### Group 5: Data Seeding (sequential — depends on all tables)

- **Story 9** — Seed script. Touches: `src/twins/mercatus-farmer/seed.ts`. Depends on all tables and all route logic existing so seed data can be verified via API calls in tests.

**Parallel safety rules:**
- Stories in the same group must touch DIFFERENT files/folders
- If two stories might edit the same file, they go in different groups
- Database schema additions: the story that creates the table goes first
- Shared middleware (Story 10) must complete before any route stories begin

---

## Development Approach

### Simplifications (what starts simple)

- Rate limiting is in-memory (resets on server restart) — no persistent rate limit storage
- Environmental data aggregation uses simple averaging in SQL, not streaming aggregation
- Pagination uses limit/offset, not cursor-based pagination
- No data retention policies or automatic cleanup of old time series data
- The seed script generates 12 months of history; extending to longer periods is a future enhancement
- Scale-Version header is logged but has no behavioral effect (no API versioning logic)

### Upgrade Path (what changes for production)

- "Add persistent rate limiting with Redis" would be a separate story
- "Add cursor-based pagination for time series queries" would be a separate story
- "Add data retention / automatic time series pruning" would be a separate story
- "Add Scale-Version header routing for API version compatibility" would be a separate story
- "Add batch export endpoints for large data pulls" would be a separate story
- "Add OpenAPI / Swagger documentation auto-generation" would be a separate story

### Architecture Decisions

- **SQLite over Postgres:** The twin is a local development tool, not a production database. SQLite is zero-config, embedded, and fast enough for the data volumes involved. The schema is simple relational, so nothing is lost by not using Postgres.
- **Single time_series table for environment + custom:** Keeps query logic unified and allows mixed queries in the future. The `source` column distinguishes origin. Indexes on (siteId, parameter, timestamp) handle the query patterns.
- **Integer PK for time_series:** Unlike other tables that use UUID PKs, the time_series table uses autoincrement integers for insert performance with high-volume seed data (millions of rows for 12 months of 15-minute data across 10 sites and 4 parameters).
- **Fish groups as the central biology entity:** All biology data (weight, mortality, harvest) references a fish group, not just a site. This matches the real Mercatus Farmer data model where biology is tracked per cohort.
- **Deterministic seed with variance:** Seed data uses a seeded PRNG so that re-running produces identical data (idempotent), but the data itself has realistic variance and noise.

---

## Verification Checklist

Before this feature is marked complete:

- [ ] All user stories implemented
- [ ] All acceptance criteria met
- [ ] All tests written and passing
- [ ] Tests verify real behavior (not just status codes)
- [ ] Edge cases handled
- [ ] No regressions in existing tests
- [ ] Code committed with proper messages
- [ ] Seed data produces believable aquaculture data when queried
- [ ] Error responses match documented schema consistently across all endpoints
- [ ] Rate limiting works correctly under concurrent requests
- [ ] All 12 Ode sites are present with correct names and realistic coordinates
- [ ] Cod growth curve in seeded weight samples is biologically plausible
- [ ] Environmental time series shows seasonal patterns matching More og Romsdal climate
- [ ] Ready for human review
