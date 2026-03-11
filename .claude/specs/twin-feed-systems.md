# Feature Spec: Feed Systems Twin (ScaleAQ AkvaFeed / Steinsvik)

**Slug:** `twin-feed-systems`
**Created:** 2026-03-11
**Status:** draft
**Priority:** high

---

## Overview

A digital twin that simulates ScaleAQ's feed management system (AkvaFeed/Steinsvik FeedStation) as deployed across Ode's 10 cod sea sites. The twin replicates both the Edge API (local hardware control for feeding lines, units, pipes, and cameras) and the Cloud API (time series data for feed consumption analytics). It generates realistic feed consumption patterns reflecting cod biology -- reduced feeding in cold water, seasonal appetite variation, and site-specific FCR (Feed Conversion Ratio) data.

## Problem Statement

Ode operates 10 sea sites with ScaleAQ feeding systems. The Edge API runs on local hardware at each site controlling physical feeding lines, while the Cloud API aggregates feed data across all sites. Developing against live feeding hardware is impractical (requires site access, risks disrupting feeding schedules, no test data control). A digital twin provides deterministic feed data with realistic seasonal patterns for all 10 sites.

## Out of Scope

- NOT: Actual hardware control signals (twin simulates responses, does not connect to PLCs or feeding hardware)
- NOT: Real-time video streaming from cameras (twin provides camera status and static snapshot URLs)
- NOT: Feed recipe formulation or nutritional analysis
- NOT: Biomass estimation or growth modeling (separate system)
- NOT: Weather integration for feeding decisions
- NOT: Multi-species support (cod only for Ode)
- NOT: Feed purchase ordering or supplier integration
- NOT: Acoustic/hydroacoustic feed detection

---

## User Stories

### Story 1: Feeding Line Status

**As a** developer integrating with the ScaleAQ Edge API
**I want to** retrieve feeding line status and configuration per site
**So that** I can build monitoring dashboards for feeding operations

**Acceptance Criteria:**

- GIVEN the twin is running WHEN I GET /api/v1/process/feeding-lines THEN I receive a list of all feeding lines across all sites with fields: lineId, siteId, siteName, name, status, feedType, feedRate, lastFeedingAt, pipeCount, unitId
- GIVEN the twin has data WHEN I GET /api/v1/process/feeding-lines?siteId=:id THEN I receive only feeding lines for that site
- GIVEN the twin has data WHEN I GET /api/v1/process/feeding-lines/:lineId THEN I receive full line details including pipe assignments and current configuration
- GIVEN the twin has data WHEN I GET /api/v1/process/units THEN I receive feeding units (physical hardware) with their assigned lines
- GIVEN the twin has data WHEN I GET /api/v1/process/pipes?lineId=:id THEN I receive pipe details for a feeding line

**Test Requirements:**

- [ ] Test: Each of the 10 sites has 2-6 feeding lines (varies by site size/cage count)
- [ ] Test: Line status values include: idle, feeding, paused, maintenance, offline
- [ ] Test: Feed types include cod-specific feeds (dry pellet sizes appropriate for fish size)
- [ ] Test: Feed rate is expressed in kg/minute
- [ ] Test: Each line has 1-4 pipes connecting to different cages
- [ ] Test: Units represent physical FeedStation hardware with firmware version and serial number
- [ ] Test: Filtering by siteId returns only matching lines

**Technical Notes:**

ScaleAQ FeedStation hardware sits on each site. A unit is a physical machine. Each unit manages multiple feeding lines. Each line connects via pipes to one or more cages/pens. Ode's 10 sites vary in size: some have 4-6 cages, others up to 10+. Feed types for cod: starter pellets (small fish), grower pellets (medium), finisher pellets (pre-harvest). Site names should reflect Norwegian coastal naming around Alesund/Sunnmore region.

---

### Story 2: Feed Commands

**As a** developer integrating with the ScaleAQ Edge API
**I want to** send commands to start, stop, and adjust feeding on lines
**So that** I can build feeding control interfaces

**Acceptance Criteria:**

- GIVEN a valid feeding line WHEN I POST /api/v1/process/feeding-lines/:lineId/commands with action "start" THEN the line status changes to "feeding" and a command acknowledgment is returned
- GIVEN a feeding line with status "feeding" WHEN I POST with action "stop" THEN the line status changes to "idle"
- GIVEN a feeding line WHEN I POST with action "adjust" and a new feedRate THEN the feed rate is updated
- GIVEN a feeding line WHEN I POST with action "pause" THEN the line status changes to "paused"
- GIVEN an offline feeding line WHEN I POST any command THEN I receive 409 Conflict with explanation
- GIVEN invalid command data WHEN I POST THEN I receive 400 with validation error

**Test Requirements:**

- [ ] Test: Start command changes status from idle to feeding and returns commandId, lineId, action, status, timestamp
- [ ] Test: Stop command changes status from feeding to idle
- [ ] Test: Adjust command updates feedRate and returns the new rate
- [ ] Test: Pause command changes status from feeding to paused
- [ ] Test: Command to offline line returns 409
- [ ] Test: Invalid action value returns 400
- [ ] Test: Feed rate adjustment must be within valid range (0.1-50.0 kg/min)
- [ ] Test: Command history is recorded and retrievable via GET /commands?lineId=:id

**Technical Notes:**

The Edge API processes commands locally -- in the real system these translate to PLC signals. The twin simulates command acceptance with realistic state transitions. Commands have a small processing delay in real hardware; the twin can simulate this or return immediately. Command history is valuable for auditing feeding schedules.

---

### Story 3: Feed Consumption Data

**As a** developer integrating with the ScaleAQ Cloud API
**I want to** retrieve time series of feed delivered per site per day
**So that** I can build feed consumption analytics and cost tracking

**Acceptance Criteria:**

- GIVEN the twin has data WHEN I GET /api/v1/feed/consumption?siteId=:id&from=:date&to=:date THEN I receive daily feed consumption records for that site and period
- GIVEN the twin has data WHEN I GET /api/v1/feed/consumption/summary?from=:date&to=:date THEN I receive aggregated consumption across all 10 sites
- GIVEN the twin has data WHEN I GET /api/v1/feed/consumption?siteId=:id&resolution=hourly&date=:date THEN I receive hourly breakdown for a single day
- GIVEN the twin has data WHEN I GET /api/v1/feed/fcr?siteId=:id&from=:date&to=:date THEN I receive FCR (Feed Conversion Ratio) data

**Test Requirements:**

- [ ] Test: Daily consumption records include fields: date, siteId, siteName, totalFeedKg, feedType, feedingEvents, averageFeedRateKgMin, waterTemperature, daylight hours
- [ ] Test: Feed consumption shows seasonal variation (cod eat significantly less in cold water < 4C, appetite peaks at 8-12C)
- [ ] Test: Winter months (Dec-Feb) show 30-60% less feeding than summer (Jun-Aug)
- [ ] Test: Daily totals per site are realistic (100-2000 kg/day depending on biomass and season)
- [ ] Test: Hourly resolution shows feeding concentrated during daylight hours
- [ ] Test: FCR data includes: periodFCR, cumulativeFCR, biomassFeedRatio (realistic cod FCR: 1.1-1.5)
- [ ] Test: Summary across all 10 sites aggregates correctly
- [ ] Test: 6 months of historical data exists

**Technical Notes:**

Cod feeding is heavily temperature-dependent. Below 2C, cod barely eat. Optimal feeding temperature is 8-12C. Norwegian coastal water temperatures around Alesund: winter 4-6C, summer 10-14C. Feeding happens primarily during daylight (varies dramatically in Norway: ~6h daylight in December vs ~19h in June). FCR for farmed cod is typically 1.1-1.5 (kg feed per kg fish growth). Each site's consumption depends on its biomass (fish count x average weight).

---

### Story 4: Feed Silo Levels

**As a** developer integrating with the ScaleAQ system
**I want to** monitor current silo fill levels per site
**So that** I can build feed inventory management and reorder alerting

**Acceptance Criteria:**

- GIVEN the twin is running WHEN I GET /api/v1/feed/silos THEN I receive current silo levels for all sites
- GIVEN the twin has data WHEN I GET /api/v1/feed/silos?siteId=:id THEN I receive silos for a specific site
- GIVEN the twin has data WHEN I GET /api/v1/feed/silos/:siloId THEN I receive detailed silo information including fill history
- GIVEN the twin has data WHEN I GET /api/v1/feed/silos/:siloId/history?from=:date&to=:date THEN I receive silo level history as time series

**Test Requirements:**

- [ ] Test: Each site has 2-4 silos with fields: siloId, siteId, siteName, name, capacityKg, currentLevelKg, fillPercentage, feedType, lastDeliveryDate, estimatedEmptyDate
- [ ] Test: Fill percentages vary realistically (some near full after delivery, some getting low)
- [ ] Test: Estimated empty date is calculated from current level and recent consumption rate
- [ ] Test: Silo history shows step-up on delivery days and gradual decline during feeding
- [ ] Test: Total silo capacity per site is realistic (10-50 tonnes per silo depending on site size)
- [ ] Test: At least one site has a silo below 20% to test low-level alerting scenarios

**Technical Notes:**

Feed silos on fish farms are typically large cylindrical containers holding 10-50 tonnes each. Deliveries come by feed boat every 1-4 weeks depending on site size and consumption. Silo levels decrease daily as feed is consumed. The twin should show a mix: some recently filled, some mid-level, some getting low. Feed types in different silos may vary (different pellet sizes for different cage groups).

---

### Story 5: Camera Feeds

**As a** developer integrating with the ScaleAQ Visual API
**I want to** retrieve camera status and simulated snapshot data
**So that** I can build feeding observation interfaces

**Acceptance Criteria:**

- GIVEN the twin is running WHEN I GET /api/v1/visual/cameras THEN I receive a list of all cameras across all sites
- GIVEN the twin has data WHEN I GET /api/v1/visual/cameras?siteId=:id THEN I receive cameras for a specific site
- GIVEN the twin has data WHEN I GET /api/v1/visual/cameras/:cameraId THEN I receive camera details including current status
- GIVEN a camera with status "online" WHEN I GET /api/v1/visual/cameras/:cameraId/snapshot THEN I receive a simulated snapshot reference (URL/placeholder)

**Test Requirements:**

- [ ] Test: Each site has 1-3 cameras with fields: cameraId, siteId, siteName, name, type (surface/underwater), cageId, status, resolution, lastFrameAt
- [ ] Test: Camera types include "surface" (above-water monitoring) and "underwater" (feeding observation)
- [ ] Test: Status values include: online, offline, maintenance
- [ ] Test: Most cameras are online (~85%+), a few are offline or in maintenance
- [ ] Test: Snapshot endpoint returns a JSON object with snapshotUrl (placeholder URL), capturedAt timestamp, cameraId
- [ ] Test: Offline cameras return 503 on snapshot request

**Technical Notes:**

Underwater cameras are critical for observing feeding behavior -- operators watch for uneaten pellets sinking to know when to stop feeding. Surface cameras monitor cage infrastructure and weather conditions. The twin does not stream video but provides camera status and metadata. Snapshot URLs can be placeholder/static image references since actual video simulation is out of scope.

---

### Story 6: Data Generation

**As a** developer
**I want to** have realistic feed data for 10 cod sites with seasonal variation
**So that** the twin provides a believable feed management environment

**Acceptance Criteria:**

- GIVEN the twin starts WHEN the data generator runs THEN it creates 6 months of feed consumption history for all 10 sites
- GIVEN the generated data WHEN I inspect consumption patterns THEN seasonal variation is evident (less feeding in winter)
- GIVEN the generated data WHEN I inspect site data THEN each site has distinct characteristics (different biomass, different number of cages/lines)
- GIVEN the generated data WHEN I inspect silo levels THEN current levels reflect recent consumption and delivery patterns
- GIVEN the generated data WHEN I inspect feeding line configurations THEN each site has a realistic number of lines and pipes matching its cage count
- GIVEN the twin restarts WHEN data is regenerated with the same seed THEN identical data is produced

**Test Requirements:**

- [ ] Test: 10 sites exist with Norwegian coastal names from the Alesund/Sunnmore region
- [ ] Test: Sites have varying sizes: small (4 cages, 2 lines), medium (6-8 cages, 3-4 lines), large (10+ cages, 5-6 lines)
- [ ] Test: 6 months of daily consumption data exists per site
- [ ] Test: Water temperature follows realistic seasonal curve for Norwegian coast (4-6C winter, 10-14C summer)
- [ ] Test: Feed consumption correlates with water temperature (R-squared > 0.5)
- [ ] Test: Daylight hours match latitude ~62N (Alesund) for each date
- [ ] Test: Total daily feed across all sites is 5-20 tonnes depending on season
- [ ] Test: FCR values are in realistic range (1.1-1.5 for cod)
- [ ] Test: Silo deliveries occur periodically with realistic intervals
- [ ] Test: Deterministic seeding produces identical output on re-run

**Technical Notes:**

Use the foundation data generation library. Norwegian sea site names: use real-sounding locations like Storfjorden, Hareidlandet, Gurskoy, Sulafjorden, Godoya, Vigra, Valderoya, Ellingsoya, Sula, Ulstein. Water temperature model: sinusoidal with baseline ~8C, amplitude ~4C, peak in August, trough in February. Feed consumption = f(biomass, temperature, daylight). Add some noise and site-to-site variation. Weekend feeding is slightly reduced but not zero (fish still need to eat). Occasional zero-feed days for treatment/delousing events.

---

## Technical Design

### Data Model Changes

**Tables:**

| Table | Key Columns | Purpose |
|-------|------------|---------|
| sites | siteId, name, latitude, longitude, cageCount, currentBiomassKg | Sea site master data |
| feeding_lines | lineId, siteId, unitId, name, status, feedType, feedRateKgMin, pipeCount | Feeding line config |
| feeding_units | unitId, siteId, serialNumber, firmwareVersion, status | Physical hardware |
| feeding_pipes | pipeId, lineId, cageId, name, status | Pipe to cage mapping |
| feed_commands | commandId, lineId, action, feedRate, status, createdAt | Command history |
| feed_consumption | id, siteId, date, resolution, totalFeedKg, feedType, feedingEvents, waterTemp, daylightHours | Time series data |
| feed_silos | siloId, siteId, name, capacityKg, currentLevelKg, feedType | Silo master |
| silo_history | id, siloId, date, levelKg, event (consumption/delivery) | Silo level history |
| feed_fcr | id, siteId, periodStart, periodEnd, periodFCR, cumulativeFCR | FCR tracking |
| cameras | cameraId, siteId, name, type, cageId, status, resolution | Camera inventory |

### API Changes

Base path: `/api/v1`

| Method | Path | Description |
|--------|------|-------------|
| GET | /process/feeding-lines | List feeding lines (filterable by site) |
| GET | /process/feeding-lines/:lineId | Get single line with pipes |
| POST | /process/feeding-lines/:lineId/commands | Send feed command |
| GET | /process/feeding-lines/:lineId/commands | Command history |
| GET | /process/units | List feeding units |
| GET | /process/pipes | List pipes (filterable by line) |
| GET | /feed/consumption | Feed consumption time series |
| GET | /feed/consumption/summary | Aggregated consumption across sites |
| GET | /feed/fcr | FCR data per site |
| GET | /feed/silos | Current silo levels |
| GET | /feed/silos/:siloId | Single silo detail |
| GET | /feed/silos/:siloId/history | Silo level history |
| GET | /visual/cameras | List cameras |
| GET | /visual/cameras/:cameraId | Camera detail |
| GET | /visual/cameras/:cameraId/snapshot | Simulated snapshot |

### Dependencies

- Foundation auth library (bearer token authentication)
- Foundation data generation library (seeded random data)
- SQLite (data storage)
- Express.js (HTTP framework)

### Security Considerations

- All endpoints require valid bearer token (foundation auth)
- Feed commands require specific scope (write access to process endpoints)
- Camera snapshot URLs are internal references, not publicly accessible
- No real site location data -- coordinates are approximate

---

## Implementation Order

### Group 1 (parallel -- foundational site and hardware config)
- Story 1: Feeding line status -- creates sites, units, lines, pipes structure
- Story 5: Camera feeds -- creates camera inventory (depends only on site IDs, can share site table creation)

### Group 2 (parallel -- depends on Group 1 for lines and sites)
- Story 2: Feed commands -- depends on feeding lines existing
- Story 4: Feed silo levels -- depends on sites existing

### Group 3 (sequential -- depends on Group 1 and 2)
- Story 3: Feed consumption data -- depends on sites, lines, silos for realistic consumption modeling

### Group 4 (sequential -- depends on all above)
- Story 6: Data generation -- generates 6-month history using all models

**Parallel safety rules:**
- Stories in the same group must touch DIFFERENT files/folders
- If two stories might edit the same file, they go in different groups
- Database migrations must be sequential (never parallel)
- Shared utilities/helpers: the story that creates them goes first

---

## Development Approach

### Simplifications (what starts simple)

- Edge API and Cloud API served from same Express server (in reality they are separate)
- Camera snapshots return placeholder metadata, not actual images
- Water temperature is calculated from a seasonal model, not pulled from real sensors
- Feed commands update state immediately (no simulated hardware delay)
- No role-based access for commands vs. read-only endpoints

### Upgrade Path (what changes for production)

- "Add separate Edge API server per site for realistic network topology" would be a separate story
- "Add simulated camera image generation" would be a separate story
- "Add real water temperature integration from environmental sensors" would be a separate story
- "Add command queuing with simulated hardware delays" would be a separate story
- "Add WebSocket/SSE for real-time feeding line status updates" would be a separate story

### Architecture Decisions

- Combined Edge + Cloud API in single server because the twin's purpose is data fidelity, not network topology simulation
- Time series data stored as rows per day (or per hour for hourly resolution) rather than using a time-series DB -- SQLite is sufficient for the data volume
- Water temperature modeled as sinusoidal function of day-of-year at latitude 62N -- simple but realistic enough for feed correlation testing
- Feed consumption derived from temperature + biomass + daylight using a simple multiplicative model with noise

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
- [ ] 10 cod sites with distinct characteristics
- [ ] Seasonal feed variation is clearly visible in data
- [ ] Feed consumption correlates with water temperature
- [ ] Silo levels reflect consumption/delivery patterns
- [ ] 6 months of historical feed data
- [ ] Ready for human review
