# Feature Spec: Hoseth StraQS / HeliX Twin

**Slug:** `twin-hoseth-straqs`
**Created:** 2026-03-11
**Status:** draft
**Priority:** high

---

## Overview

A digital twin that simulates Hoseth's StraQS camera-based quality assessment system and HeliX cooling/bleeding tanks as deployed at Ode's Vartdal processing plant. The real system uses OPC-UA protocol for StraQS camera data (fish counting, species identification, wound detection, spawner identification) and process control for HeliX tanks. The twin wraps these OPC-UA data points in a REST API and generates realistic processing data matching the Vartdal plant capacity of approximately 30-50 tonnes of cod per day.

## Problem Statement

Ode uses StraQS cameras and HeliX tanks at the intake stage of their Vartdal processing plant. StraQS provides automated quality assessment as fish enter the plant, while HeliX manages the critical bleeding and cooling step before processing. Integrating with the real OPC-UA protocol requires physical access to the plant network and specialized tooling. A digital twin provides REST access to the same data points with realistic quality distributions, throughput rates, and tank status for development and testing.

## Out of Scope

- NOT: OPC-UA protocol server (twin provides REST wrapper over OPC-UA data points)
- NOT: Camera image processing or machine learning model simulation
- NOT: HeliX tank control commands (twin is read-only for tank status)
- NOT: StraQS management software UI replication
- NOT: Multi-plant support (Vartdal only)
- NOT: Fish welfare scoring algorithms
- NOT: Integration with downstream Innova production control (that is a separate twin)
- NOT: Maintenance scheduling for cameras or tanks

---

## User Stories

### Story 1: Fish Counting Data

**As a** developer integrating with StraQS
**I want to** retrieve real-time and historical fish counts per processing batch
**So that** I can build intake tracking and batch traceability features

**Acceptance Criteria:**

- GIVEN the twin has data WHEN I GET /api/v1/counting/current THEN I receive the current batch count with fields: batchId, fishCount, totalWeightKg, averageWeightKg, startedAt, status (active/completed)
- GIVEN the twin has data WHEN I GET /api/v1/counting/batches THEN I receive a list of historical batches with summary data
- GIVEN the twin has data WHEN I GET /api/v1/counting/batches?date=:date THEN I receive batches for a specific date
- GIVEN the twin has data WHEN I GET /api/v1/counting/batches/:batchId THEN I receive full batch details including weight distribution histogram
- GIVEN the twin has data WHEN I GET /api/v1/counting/batches/:batchId/fish THEN I receive individual fish records within a batch (paginated)

**Test Requirements:**

- [ ] Test: Current batch returns real-time-style count data with all required fields
- [ ] Test: Batch fish counts are realistic (a batch from one well boat delivery: 5,000-50,000 fish)
- [ ] Test: Average weight per fish is realistic for harvest-size cod (3-6 kg for farmed cod)
- [ ] Test: Weight distribution shows natural bell curve variation (standard deviation ~15-20% of mean)
- [ ] Test: Historical batches cover 30 days of operation
- [ ] Test: Individual fish records include: fishId, batchId, weightKg, lengthCm, timestamp
- [ ] Test: Filtering by date returns correct batches
- [ ] Test: Batch status values include: active, completed, cancelled

**Technical Notes:**

StraQS cameras count and weigh each fish as it passes on a conveyor. At Vartdal, fish arrive from well boats (each boat carries fish from one or more sea sites). A batch corresponds to a delivery -- typically one well boat load. The camera system captures individual fish data at high speed (several fish per second). Weight is estimated from camera images. The twin pre-generates individual fish records per batch.

---

### Story 2: Quality Metrics

**As a** developer integrating with StraQS
**I want to** retrieve wound detection rates, spawner percentages, and grade distributions
**So that** I can build quality monitoring dashboards and supplier feedback features

**Acceptance Criteria:**

- GIVEN the twin has data WHEN I GET /api/v1/quality/metrics?batchId=:id THEN I receive quality metrics for that batch with fields: batchId, totalFish, woundRate, spawnerRate, grades (A/B/C/reject counts and percentages), meanConditionFactor
- GIVEN the twin has data WHEN I GET /api/v1/quality/metrics/summary?from=:date&to=:date THEN I receive aggregated quality metrics over a date range
- GIVEN the twin has data WHEN I GET /api/v1/quality/wounds?batchId=:id THEN I receive wound type breakdown (categories: bite, handling, net, lice, other)
- GIVEN the twin has data WHEN I GET /api/v1/quality/trends?metric=woundRate&from=:date&to=:date THEN I receive quality trends over time

**Test Requirements:**

- [ ] Test: Wound rate is realistic (typically 5-15% for well-managed farmed cod)
- [ ] Test: Spawner percentage varies by season (higher Oct-Mar during cod spawning season, typically 0-10%)
- [ ] Test: Grade distribution: A grade ~75-90%, B grade ~8-15%, C grade ~2-5%, Reject <1%
- [ ] Test: Wound categories include: bite_wound, handling_damage, net_mark, lice_damage, other
- [ ] Test: Condition factor (Fulton's K) is in realistic range for farmed cod (0.8-1.3, optimal ~1.0-1.1)
- [ ] Test: Quality trends show variation across batches and over time
- [ ] Test: Summary correctly aggregates across multiple batches
- [ ] Test: Metrics exist for all batches in the 30-day history

**Technical Notes:**

StraQS uses camera-based image analysis to detect wounds, classify fish quality, and identify spawners (sexually mature fish with different body shape/color). Spawner identification matters because spawner flesh quality is lower. Wound detection helps trace handling quality back to specific sea sites. Condition factor K = (weight in g) / (length in cm)^3 * 100 -- indicates body condition. Site-to-site quality variation should be visible in the data.

---

### Story 3: Tank Status (HeliX)

**As a** developer integrating with HeliX tank systems
**I want to** monitor tank temperatures, fill levels, and bleeding/cooling status
**So that** I can build tank management and process monitoring features

**Acceptance Criteria:**

- GIVEN the twin is running WHEN I GET /api/v1/tanks THEN I receive status of all HeliX tanks with fields: tankId, name, type (bleeding/cooling), temperature, targetTemperature, fillLevel, fishCount, batchId, status, startedAt, estimatedCompleteAt
- GIVEN the twin has data WHEN I GET /api/v1/tanks/:tankId THEN I receive full tank details including temperature history
- GIVEN the twin has data WHEN I GET /api/v1/tanks/:tankId/temperature?from=:date&to=:date THEN I receive temperature time series for that tank
- GIVEN the twin has data WHEN I GET /api/v1/tanks/:tankId/history THEN I receive batch history (which batches have been processed in this tank)

**Test Requirements:**

- [ ] Test: Vartdal has 4-8 HeliX tanks (mix of bleeding and cooling tanks)
- [ ] Test: Bleeding tank temperatures are 0-2C (near ice-water temperature)
- [ ] Test: Cooling tanks maintain 0-1C
- [ ] Test: Fill levels are expressed as percentage (0-100%)
- [ ] Test: Status values include: empty, filling, bleeding, cooling, draining, cleaning
- [ ] Test: Bleeding duration is realistic (minimum 30 minutes for cod per Norwegian regulations)
- [ ] Test: Temperature readings are generated every 5 minutes
- [ ] Test: Active tanks have batchId linking to the StraQS batch being processed
- [ ] Test: At any given time during operating hours, most tanks show active status (not all empty)

**Technical Notes:**

HeliX is Hoseth's automated bleeding and cooling tank system. After fish are stunned and bled, they enter HeliX tanks where they bleed out in ice-cold water. Norwegian food safety regulations require a minimum 30-minute bleed time. The tanks maintain precise temperature control. A typical cycle: fill with fish from StraQS intake -> bleed for 30-45 minutes -> drain -> transfer to processing lines. The Vartdal plant runs multiple tanks in parallel to maintain continuous throughput.

---

### Story 4: Processing Line Overview

**As a** developer integrating with StraQS management
**I want to** see current throughput, active lines, and batch progress
**So that** I can build a plant overview dashboard

**Acceptance Criteria:**

- GIVEN the twin is running WHEN I GET /api/v1/processing/overview THEN I receive a plant-wide overview with fields: activeBatches, totalFishToday, totalWeightTodayKg, activeLines, throughputFishPerHour, throughputKgPerHour, operatingHoursToday, currentShift
- GIVEN the twin has data WHEN I GET /api/v1/processing/overview/history?from=:date&to=:date THEN I receive daily overview summaries
- GIVEN the twin has data WHEN I GET /api/v1/processing/lines THEN I receive individual processing line status with current throughput
- GIVEN the twin has data WHEN I GET /api/v1/processing/batches/:batchId/progress THEN I receive batch progress showing how much of the batch has moved through counting, bleeding, and into processing

**Test Requirements:**

- [ ] Test: Daily throughput is 30-50 tonnes reflecting Vartdal capacity
- [ ] Test: Fish per hour throughput is realistic (2,000-6,000 fish/hour depending on fish size and line count)
- [ ] Test: Current shift is correctly determined (day: 06:00-14:00, evening: 14:00-22:00)
- [ ] Test: Active lines count reflects time of day (all lines during shift, zero outside hours)
- [ ] Test: Batch progress shows stages: counted, in_bleeding, bled, in_processing, processed
- [ ] Test: Processing line records include: lineId, name, status, currentBatchId, throughputFishPerHour, throughputKgPerHour
- [ ] Test: Historical summaries include daily totals matching sum of all batches
- [ ] Test: Non-production hours (nights, weekends) show zero or minimal activity

**Technical Notes:**

The processing overview aggregates data from StraQS counting, HeliX tank status, and downstream processing lines. This is the "management dashboard" view that shows plant managers the big picture. Throughput varies throughout the day -- ramp up at shift start, peak mid-shift, wind down at shift end. The Vartdal plant typically processes deliveries from 2-4 well boats per day during peak season. Batch progress tracks each delivery through the plant stages.

---

### Story 5: Data Generation

**As a** developer
**I want to** have realistic processing data matching Vartdal plant capacity
**So that** the twin provides a believable StraQS/HeliX environment

**Acceptance Criteria:**

- GIVEN the twin starts WHEN the data generator runs THEN it creates 30 days of processing history
- GIVEN the generated data WHEN I inspect batch data THEN daily throughput is 30-50 tonnes with realistic variation
- GIVEN the generated data WHEN I inspect quality metrics THEN wound rates and grade distributions vary by source site
- GIVEN the generated data WHEN I inspect tank data THEN tanks show realistic cycling patterns
- GIVEN the generated data WHEN I inspect fish records THEN individual weight/length data follows realistic distributions
- GIVEN the twin restarts WHEN data is regenerated with the same seed THEN identical data is produced

**Test Requirements:**

- [ ] Test: 30 days of processing history exists
- [ ] Test: Each day has 1-4 batches (well boat deliveries) during weekdays
- [ ] Test: Weekend production is reduced or absent
- [ ] Test: Each batch is linked to one of Ode's 10 sea sites as origin
- [ ] Test: Quality metrics vary by source site (some sites consistently better than others)
- [ ] Test: Individual fish weights follow normal distribution centered around 3-6 kg
- [ ] Test: Spawner rates peak during Oct-Mar period
- [ ] Test: Tank utilization shows realistic cycling (fill, bleed, drain, repeat)
- [ ] Test: Temperature logs for tanks show minor natural fluctuation around target
- [ ] Test: Processing line throughput varies realistically throughout each shift
- [ ] Test: Deterministic seeding produces identical output on re-run

**Technical Notes:**

Use the foundation data generation library. Batch origins should reference the same 10 sea sites defined in the feed systems twin. Quality differences between sites: sites with better feeding management tend to have better condition factor and fewer wounds. Spawner rates correlate with season and site management (some sites harvest before spawning season to avoid quality issues). Individual fish data: generate weight with normal distribution (mean 4.0 kg, std 0.8 kg), length correlated with weight via condition factor. Processing patterns: first delivery arrives ~06:30, last delivery typically by 14:00.

---

## Technical Design

### Data Model Changes

**Tables:**

| Table | Key Columns | Purpose |
|-------|------------|---------|
| batches | batchId, sourceSiteId, sourceSiteName, date, fishCount, totalWeightKg, avgWeightKg, status, startedAt, completedAt | Delivery batch records |
| fish_records | fishId, batchId, weightKg, lengthCm, conditionFactor, grade, hasWound, woundType, isSpawner, timestamp | Individual fish data |
| quality_metrics | id, batchId, woundRate, spawnerRate, gradeA, gradeB, gradeC, gradeReject, meanConditionFactor | Batch quality summary |
| tanks | tankId, name, type, capacity, targetTemperature | HeliX tank master data |
| tank_status | id, tankId, batchId, temperature, fillLevel, fishCount, status, timestamp | Tank status snapshots |
| tank_temperature_log | id, tankId, temperature, timestamp | Temperature time series |
| processing_lines | lineId, name, status, currentBatchId, throughputFishPerHour | Processing line config |
| daily_summary | id, date, shift, totalFish, totalWeightKg, batchCount, activeLinesCount, avgThroughputKgPerHour | Daily aggregates |

### API Changes

Base path: `/api/v1`

| Method | Path | Description |
|--------|------|-------------|
| GET | /counting/current | Current active batch count |
| GET | /counting/batches | List historical batches |
| GET | /counting/batches/:batchId | Single batch detail with weight distribution |
| GET | /counting/batches/:batchId/fish | Individual fish records (paginated) |
| GET | /quality/metrics | Quality metrics per batch |
| GET | /quality/metrics/summary | Aggregated quality metrics |
| GET | /quality/wounds | Wound type breakdown |
| GET | /quality/trends | Quality trends over time |
| GET | /tanks | All tank statuses |
| GET | /tanks/:tankId | Single tank detail |
| GET | /tanks/:tankId/temperature | Tank temperature history |
| GET | /tanks/:tankId/history | Batch processing history for tank |
| GET | /processing/overview | Plant-wide overview |
| GET | /processing/overview/history | Daily overview summaries |
| GET | /processing/lines | Processing line statuses |
| GET | /processing/batches/:batchId/progress | Batch stage progress |

### Dependencies

- Foundation auth library (bearer token authentication)
- Foundation data generation library (seeded random data)
- SQLite (data storage)
- Express.js (HTTP framework)

### Security Considerations

- All endpoints require valid bearer token (foundation auth)
- All endpoints are read-only (no control commands for StraQS/HeliX in this twin)
- No real production data -- all generated
- Source site names reference Ode's sea sites but contain no real operational data

---

## Implementation Order

### Group 1 (parallel -- foundational structures)
- Story 1: Fish counting data -- creates batch and fish record tables, counting endpoints
- Story 3: Tank status -- creates tank tables and status endpoints (independent of counting)

### Group 2 (parallel -- depends on Group 1)
- Story 2: Quality metrics -- depends on batches and fish records from Story 1
- Story 4: Processing line overview -- depends on batches (Story 1) and tanks (Story 3) for aggregation

### Group 3 (sequential -- depends on all above)
- Story 5: Data generation -- generates 30-day history using all models

**Parallel safety rules:**
- Stories in the same group must touch DIFFERENT files/folders
- If two stories might edit the same file, they go in different groups
- Database migrations must be sequential (never parallel)
- Shared utilities/helpers: the story that creates them goes first

---

## Development Approach

### Simplifications (what starts simple)

- OPC-UA data points exposed as REST endpoints, not actual OPC-UA protocol
- No real camera image data -- fish records are pre-generated data points
- Tank status is point-in-time snapshots, not real-time streaming
- Weight distribution histogram computed on read from individual fish records
- Processing line overview is aggregated on read, not maintained as a real-time counter

### Upgrade Path (what changes for production)

- "Add OPC-UA server for real protocol testing" would be a separate story
- "Add WebSocket/SSE for real-time counting and tank updates" would be a separate story
- "Add simulated camera frame data (images with fish outlines)" would be a separate story
- "Add tank control commands (start/stop bleeding cycle)" would be a separate story
- "Integrate with Marel Innova twin for end-to-end plant flow" would be a separate story

### Architecture Decisions

- Read-only API reflecting that StraQS/HeliX integration at Ode is primarily data collection, not control
- Individual fish records stored to enable realistic weight distribution analysis and per-fish quality data
- Quality metrics stored as both per-fish flags and per-batch aggregates for efficient querying at both levels
- Tank temperature logged separately from tank status to support high-frequency temperature monitoring without bloating the status table
- Batch source site references enable cross-twin analytics (feed quality at site X correlates with fish quality from site X)

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
- [ ] Fish counting data shows realistic weight distributions
- [ ] Quality grades match expected cod processing distributions
- [ ] HeliX tank cycling is realistic with proper bleed times
- [ ] 30 days of processing history at 30-50 tonnes/day
- [ ] Source sites reference Ode's 10 sea sites
- [ ] Ready for human review
