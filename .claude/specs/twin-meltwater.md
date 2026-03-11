# Feature Spec: Digital Twin — Meltwater Media Intelligence

**Slug:** `twin-meltwater`
**Created:** 2026-03-11
**Status:** draft
**Priority:** high
**AI Readiness Score:** 88/100 (AI Ready)

---

## Overview

A digital twin that simulates the Meltwater media intelligence REST API, providing realistic media mention data about Ode (Norway's largest farmed cod producer), its competitors, and the broader aquaculture industry. The twin enables development and testing of media monitoring, sentiment analysis, and PR analytics features without requiring a live Meltwater subscription or API credentials.

## Problem Statement

Ode uses Meltwater for media intelligence — tracking press coverage of Snow Cod product launches, Nautilus deep-farming technology, sustainability initiatives, and competitor activity. Building AI-powered media analytics (trend detection, sentiment dashboards, crisis alerts) requires a development environment with realistic data volumes and API behavior. The real API has monthly quotas (30,000 documents/month) and rate limits that make iterative development expensive and slow.

## Out of Scope

- NOT: Social Analytics endpoints (social media posts, engagement metrics) — separate twin if needed
- NOT: Mira AI endpoints (project management features) — Meltwater-internal AI tooling
- NOT: BYOC (Bring Your Own Content) import endpoints — data flows outward from Meltwater, not inward
- NOT: Explore+ endpoints — Listening endpoints cover the same search/analytics surface for our use case
- NOT: OAuth or multi-tenant auth flows — Meltwater uses simple API key auth
- NOT: Full-text article content — the twin returns titles, snippets, and metadata, not scraped article bodies
- NOT: Real Meltwater OpenAPI spec parsing — we model the endpoints we need, not the full 20+ endpoint surface

---

## User Stories

### Story 1: Search Media Mentions

**As a** developer building media analytics for Ode
**I want to** search for media mentions by keyword, date range, source, and language
**So that** I can build and test search interfaces and filtering logic against realistic data

**Acceptance Criteria:**

- GIVEN a valid API key in the `apikey` header WHEN I `GET /v2/search?q=Ode+cod+farming` THEN I receive a paginated list of mention objects with fields: `id`, `title`, `snippet`, `url`, `source`, `publishedAt`, `language`, `sentiment`, `reach`, `topics`
- GIVEN a query with `from` and `to` date parameters WHEN I search THEN only mentions within that date range are returned
- GIVEN a query with `source=NRK` WHEN I search THEN only mentions from that source are returned
- GIVEN a query with `language=no` WHEN I search THEN only Norwegian-language mentions are returned
- GIVEN a query with `limit=10&offset=20` WHEN I search THEN I receive page 3 of results with correct `total` count in the response metadata
- GIVEN a query matching no results WHEN I search THEN I receive an empty `documents` array with `total: 0`
- GIVEN no `apikey` header WHEN I search THEN I receive a `401 Unauthorized` response

**Test Requirements:**

- [ ] Test: keyword search returns mentions containing the search term in title or snippet
- [ ] Test: date range filtering excludes mentions outside the range
- [ ] Test: source filtering returns only mentions from the specified source
- [ ] Test: language filtering returns only mentions in the specified language
- [ ] Test: pagination returns correct slices and total count
- [ ] Test: combined filters (keyword + date + source) narrow results correctly
- [ ] Test: missing API key returns 401 with error body
- [ ] Test: invalid date format returns 400 with descriptive error

**Technical Notes:**

Uses SQLite full-text search (FTS5) for keyword matching against title and snippet fields. Sentiment is a pre-assigned value per mention (positive/neutral/negative with a -1.0 to 1.0 score), not computed at query time.

---

### Story 2: Analytics Aggregation

**As a** developer building media dashboards for Ode
**I want to** retrieve aggregated analytics (volume over time, sentiment distribution, top sources, top topics)
**So that** I can build trend charts and summary widgets without client-side aggregation

**Acceptance Criteria:**

- GIVEN a valid API key WHEN I `GET /v2/analytics/volume?q=Ode&from=2025-09-01&to=2026-03-01&interval=day` THEN I receive a time series of mention counts bucketed by day
- GIVEN `interval=week` or `interval=month` WHEN I request volume THEN results are bucketed accordingly
- GIVEN a valid API key WHEN I `GET /v2/analytics/sentiment?q=Ode&from=2025-09-01&to=2026-03-01` THEN I receive a breakdown: `{ positive: N, neutral: N, negative: N, averageScore: F }`
- GIVEN a valid API key WHEN I `GET /v2/analytics/top-sources?q=Ode&from=2025-09-01&to=2026-03-01&limit=10` THEN I receive the top 10 sources ranked by mention count
- GIVEN a valid API key WHEN I `GET /v2/analytics/top-topics?q=Ode&from=2025-09-01&to=2026-03-01&limit=10` THEN I receive the top 10 topic clusters ranked by mention count
- GIVEN no matching mentions for the query WHEN I request any analytics endpoint THEN I receive zero-filled results (empty time series, all-zero sentiment, empty source/topic lists)

**Test Requirements:**

- [ ] Test: volume by day returns one entry per day in the date range with correct counts
- [ ] Test: volume by week groups mentions into ISO weeks
- [ ] Test: volume by month groups mentions into calendar months
- [ ] Test: sentiment breakdown counts match the actual mention sentiment values in the database
- [ ] Test: top sources returns sources sorted by descending mention count
- [ ] Test: top topics returns topic clusters sorted by descending mention count
- [ ] Test: analytics with no matching data returns valid zero-filled response structure
- [ ] Test: missing required parameter `q` returns 400

**Technical Notes:**

All analytics are computed from the same mentions table using SQL aggregation. The `interval` parameter maps to SQLite date functions (`strftime`). Topic clusters are stored as tags on each mention and aggregated with `GROUP BY`.

---

### Story 3: Data Streams (Webhook Registration)

**As a** developer building real-time media alerts for Ode
**I want to** register webhooks that receive new mentions matching a query in real-time
**So that** I can build crisis detection and breaking news features without polling

**Acceptance Criteria:**

- GIVEN a valid API key WHEN I `POST /v2/streams` with body `{ "name": "Ode alerts", "query": "Ode OR \"Snow Cod\"", "callbackUrl": "https://example.com/webhook" }` THEN I receive a stream object with `id`, `name`, `query`, `callbackUrl`, `status: "active"`, `createdAt`
- GIVEN an active stream WHEN a new mention matching the query is generated THEN the twin sends a POST to the `callbackUrl` with the mention payload
- GIVEN a valid API key WHEN I `GET /v2/streams` THEN I receive a list of all registered streams for that API key
- GIVEN a valid API key WHEN I `GET /v2/streams/:id` THEN I receive the stream details including mention count delivered
- GIVEN a valid API key WHEN I `DELETE /v2/streams/:id` THEN the stream is deactivated and no more webhooks are sent
- GIVEN an invalid `callbackUrl` (not HTTPS, not a URL) WHEN I create a stream THEN I receive a 400 error
- GIVEN the maximum stream limit (5) is reached WHEN I create another stream THEN I receive a 409 error

**Test Requirements:**

- [ ] Test: creating a stream returns the stream object with active status
- [ ] Test: listing streams returns all streams for the authenticated API key
- [ ] Test: getting a stream by ID returns its details and delivery count
- [ ] Test: deleting a stream returns 204 and stops webhook delivery
- [ ] Test: creating a stream with invalid callback URL returns 400
- [ ] Test: creating a stream beyond the limit returns 409
- [ ] Test: webhook delivery sends correct mention payload to callback URL
- [ ] Test: deleted streams do not receive new mention deliveries

**Technical Notes:**

The twin simulates periodic mention generation (configurable interval, default every 60 seconds) and dispatches webhooks to registered stream callback URLs. In test mode, webhook delivery is synchronous and captured in-memory for assertion. In dev mode, it uses actual HTTP POST to the callback URL. Streams are scoped to the API key that created them.

---

### Story 4: Export Endpoints

**As a** developer building bulk data processing for Ode media reports
**I want to** create asynchronous exports of search results and retrieve them when ready
**So that** I can handle large result sets without timeout issues

**Acceptance Criteria:**

- GIVEN a valid API key WHEN I `POST /v2/exports` with body `{ "query": "aquaculture Norway", "from": "2025-09-01", "to": "2026-03-01", "format": "json" }` THEN I receive an export object with `id`, `status: "pending"`, `createdAt`, `query`, `format`
- GIVEN a pending export WHEN I `GET /v2/exports/:id` THEN I receive the export with `status: "processing"` or `status: "completed"` depending on elapsed time
- GIVEN a completed export WHEN I `GET /v2/exports/:id` THEN the response includes a `downloadUrl` field pointing to the export data
- GIVEN a completed export WHEN I `GET /v2/exports/:id/download` THEN I receive the full mention dataset as JSON (array of mention objects)
- GIVEN a valid API key WHEN I `GET /v2/exports` THEN I receive a list of all exports for that API key with their statuses
- GIVEN an export for a query with >1000 results WHEN the export completes THEN all matching results are included (no pagination limit)
- GIVEN `format: "csv"` WHEN the export completes THEN the download returns CSV-formatted data

**Test Requirements:**

- [ ] Test: creating an export returns pending status with export ID
- [ ] Test: polling an export transitions through pending -> processing -> completed
- [ ] Test: completed export includes a download URL
- [ ] Test: downloading a completed export returns all matching mentions
- [ ] Test: listing exports returns all exports for the API key
- [ ] Test: JSON format returns array of mention objects
- [ ] Test: CSV format returns comma-separated values with header row
- [ ] Test: export for query with zero results completes with empty dataset

**Technical Notes:**

Exports use a simulated async pattern. On creation, the export is "pending." After a configurable delay (default 2 seconds in test, 5 seconds in dev), it transitions to "processing," then "completed." The twin generates the full result set at creation time but delays availability to simulate real async behavior. Export data is stored in-memory or as temp files, cleaned up after 1 hour.

---

### Story 5: Seed Data Generation

**As a** developer working with the Meltwater twin
**I want to** have 500+ realistic media mentions pre-seeded spanning 6 months
**So that** search, analytics, and export features return meaningful data from the first request

**Acceptance Criteria:**

- GIVEN a freshly initialized twin WHEN I query for mentions THEN at least 500 mentions exist spanning 2025-09-01 to 2026-03-01
- GIVEN the seed data WHEN I examine mention sources THEN they include a realistic mix: NRK, Fiskeribladet, IntraFish, iLaks, Bergens Tidende, Sysla, E24, Nationen, Kyst.no, Financial Times, Seafood Source, Undercurrent News, The Fish Site, Aquaculture Magazine
- GIVEN the seed data WHEN I examine mention sentiment distribution THEN roughly 45% positive, 35% neutral, 20% negative
- GIVEN the seed data WHEN I examine mention topics THEN they cluster into: "cod farming," "aquaculture sustainability," "Norwegian seafood exports," "deep farming / Nautilus," "Snow Cod brand," "fish welfare," "competitor news," "industry regulation," "product launches," "food safety"
- GIVEN the seed data WHEN I examine mention subjects THEN they reference real entities: Ode, Snow Cod, Nautilus, Norcod, Lerøy, Mowi, Cermaq, SalMar, Norwegian Seafood Council, Fiskeridirektoratet, Mattilsynet
- GIVEN the seed data WHEN I examine the time distribution THEN mentions are not uniformly distributed — there are spikes around realistic events (product launches, quarterly reports, industry conferences like AquaNor, regulatory announcements)
- GIVEN the seed data WHEN I examine language distribution THEN roughly 60% Norwegian (`no`), 30% English (`en`), 10% other Nordic/European languages
- GIVEN the seed data WHEN I examine reach values THEN they range from 500 (niche trade press) to 2,000,000 (national media), with a realistic long-tail distribution

**Test Requirements:**

- [ ] Test: seed produces at least 500 mentions
- [ ] Test: mentions span the full 6-month date range without gaps longer than 3 days
- [ ] Test: at least 10 distinct sources are represented
- [ ] Test: sentiment distribution falls within expected ranges (40-50% positive, 30-40% neutral, 15-25% negative)
- [ ] Test: at least 8 distinct topic clusters are represented
- [ ] Test: mentions reference Ode/Snow Cod in at least 40% of entries
- [ ] Test: competitor mentions (Norcod, Lerøy, Mowi, etc.) appear in at least 15% of entries
- [ ] Test: reach values span at least 3 orders of magnitude
- [ ] Test: both Norwegian and English language mentions are present
- [ ] Test: seed is deterministic — running it twice produces the same dataset (seeded PRNG)

**Technical Notes:**

The seed generator uses the foundation data generation utilities (seeded PRNG, template expansion). Mention templates are organized by topic cluster and sentiment, then placed on the timeline with realistic clustering around event dates. Each mention gets a unique ID, deterministic content, and consistent cross-references (a mention about "Ode's Nautilus deep-farming" gets tagged with both "Ode" and "deep farming / Nautilus" topics).

Event dates for mention spikes:
- 2025-09-15: AquaNor conference (Trondheim)
- 2025-10-01: Ode Q3 production report
- 2025-11-20: Snow Cod winter product launch
- 2025-12-10: Sustainability certification announcement
- 2026-01-15: Ode Q4/annual production report (10,018t milestone)
- 2026-02-01: Nautilus deep-farming pilot results
- 2026-02-20: Norwegian seafood export statistics release

---

### Story 6: Rate Limiting

**As a** developer integrating with Meltwater
**I want to** the twin to enforce realistic rate limits and return proper limit headers
**So that** I can build and test rate-limit handling logic before hitting the real API

**Acceptance Criteria:**

- GIVEN a valid API key WHEN I make any successful request THEN the response includes headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `RateLimit-Day-Remaining`, `RateLimit-Day-Reset`
- GIVEN the per-minute general limit is 100 WHEN I exceed 100 requests in a rolling minute THEN I receive `429 Too Many Requests` with a `Retry-After` header (seconds until reset)
- GIVEN the per-minute analytics limit is 10 WHEN I exceed 10 analytics requests in a rolling minute THEN I receive `429` on analytics endpoints only — search still works
- GIVEN the per-minute export limit is 20 WHEN I exceed 20 export requests in a rolling minute THEN I receive `429` on export endpoints only
- GIVEN the hourly per-IP limit is 2,000 WHEN I exceed 2,000 requests in a rolling hour THEN all endpoints return `429`
- GIVEN the daily document quota is 30,000 WHEN cumulative search results fetched exceed 30,000 documents THEN search returns `429` with `RateLimit-Day-Remaining: 0`
- GIVEN a `429` response WHEN the `Retry-After` period elapses THEN subsequent requests succeed normally
- GIVEN the twin is in test mode WHEN rate limits are configured THEN limits can be set to low values (e.g., 5/minute) for easier testing

**Test Requirements:**

- [ ] Test: successful responses include all rate limit headers with correct values
- [ ] Test: exceeding general per-minute limit returns 429 with Retry-After
- [ ] Test: exceeding analytics-specific limit returns 429 only on analytics endpoints
- [ ] Test: exceeding export-specific limit returns 429 only on export endpoints
- [ ] Test: 429 response body includes descriptive error message and limit type
- [ ] Test: rate limit counters reset after the window elapses
- [ ] Test: daily document quota tracks cumulative documents returned across all search requests
- [ ] Test: rate limits in test mode can be configured to small values
- [ ] Test: different API keys have independent rate limit counters

**Technical Notes:**

Rate limiting uses the foundation rate limiter middleware with per-endpoint bucket configuration. Buckets are keyed by API key + endpoint category (general, analytics, export) and by IP for the hourly limit. The daily document quota tracks the sum of `documents.length` across all search responses for each API key. In test mode, all limits and windows are configurable via twin initialization options.

---

## Technical Design

### Data Model

```
mentions
  id              TEXT PRIMARY KEY    -- uuid
  title           TEXT NOT NULL
  snippet         TEXT NOT NULL       -- 200-300 char excerpt
  url             TEXT NOT NULL       -- simulated article URL
  source          TEXT NOT NULL       -- publication name
  sourceType      TEXT NOT NULL       -- "online_news", "print", "broadcast", "blog"
  publishedAt     TEXT NOT NULL       -- ISO 8601 datetime
  language        TEXT NOT NULL       -- ISO 639-1 code ("no", "en", "da", "sv")
  sentimentLabel  TEXT NOT NULL       -- "positive", "neutral", "negative"
  sentimentScore  REAL NOT NULL       -- -1.0 to 1.0
  reach           INTEGER NOT NULL    -- estimated audience size
  topics          TEXT NOT NULL       -- JSON array of topic strings
  entities        TEXT NOT NULL       -- JSON array of entity references
  country         TEXT NOT NULL       -- ISO 3166-1 alpha-2 ("NO", "GB", "US")

streams
  id              TEXT PRIMARY KEY    -- uuid
  apiKey          TEXT NOT NULL       -- owning API key
  name            TEXT NOT NULL
  query           TEXT NOT NULL
  callbackUrl     TEXT NOT NULL
  status          TEXT NOT NULL       -- "active", "paused", "deleted"
  deliveryCount   INTEGER DEFAULT 0
  createdAt       TEXT NOT NULL
  updatedAt       TEXT NOT NULL

exports
  id              TEXT PRIMARY KEY    -- uuid
  apiKey          TEXT NOT NULL
  query           TEXT NOT NULL
  fromDate        TEXT
  toDate          TEXT
  format          TEXT NOT NULL       -- "json", "csv"
  status          TEXT NOT NULL       -- "pending", "processing", "completed", "failed"
  documentCount   INTEGER DEFAULT 0
  createdAt       TEXT NOT NULL
  completedAt     TEXT
  expiresAt       TEXT                -- cleanup after 1 hour

rate_limit_counters
  key             TEXT PRIMARY KEY    -- "{apiKey}:{bucket}:{window}"
  count           INTEGER NOT NULL
  windowStart     TEXT NOT NULL
  windowSeconds   INTEGER NOT NULL
```

### API Surface

All endpoints are prefixed with the twin's mount path (e.g., `/twins/meltwater/v2/...`).

| Method | Path | Description | Rate Bucket |
|--------|------|-------------|-------------|
| GET | /v2/search | Search media mentions | general |
| GET | /v2/analytics/volume | Mention volume over time | analytics |
| GET | /v2/analytics/sentiment | Sentiment distribution | analytics |
| GET | /v2/analytics/top-sources | Top mention sources | analytics |
| GET | /v2/analytics/top-topics | Top mention topics | analytics |
| POST | /v2/streams | Register a webhook stream | general |
| GET | /v2/streams | List registered streams | general |
| GET | /v2/streams/:id | Get stream details | general |
| DELETE | /v2/streams/:id | Delete a stream | general |
| POST | /v2/exports | Create an async export | export |
| GET | /v2/exports | List exports | general |
| GET | /v2/exports/:id | Get export status | general |
| GET | /v2/exports/:id/download | Download export data | export |

### Auth Pattern

Meltwater uses a simple API token header:
```
apikey: your-api-token-here
```

The twin validates this against its configured API keys (from foundation auth). No OAuth, no Bearer prefix — just the raw token in the `apikey` header.

### Dependencies

- **Foundation auth module** — API key validation, tenant isolation
- **Foundation data generation** — seeded PRNG, template expansion, realistic data synthesis
- **Foundation rate limiter** — per-bucket rate limiting middleware with sliding windows
- **SQLite** — mention storage with FTS5 for keyword search
- **Express** — HTTP routing

### Security Considerations

- API keys are validated on every request — no unauthenticated access
- Stream callback URLs must be HTTPS (no plaintext webhook delivery)
- Export download URLs are scoped to the API key that created the export
- Rate limiting prevents resource exhaustion
- No real article content is stored or served — only simulated snippets

---

## Implementation Order

### Group 1 (parallel — no dependencies between stories)

- **Story 5** — Seed data generation: `src/twins/meltwater/seed.ts`, `src/twins/meltwater/data/templates/`. Creates the mention dataset that all other stories query against.
- **Story 6** — Rate limiting: `src/twins/meltwater/middleware/rate-limiter.ts`. Middleware that wraps all endpoints. Independent of data layer.

### Group 2 (parallel — after Group 1, depends on seed data existing)

- **Story 1** — Search endpoints: `src/twins/meltwater/routes/search.ts`, `src/twins/meltwater/services/search-service.ts`. Reads from seeded mentions table.
- **Story 2** — Analytics endpoints: `src/twins/meltwater/routes/analytics.ts`, `src/twins/meltwater/services/analytics-service.ts`. Aggregates from seeded mentions table.

### Group 3 (parallel — after Group 1, independent of Group 2)

- **Story 3** — Data Streams: `src/twins/meltwater/routes/streams.ts`, `src/twins/meltwater/services/stream-service.ts`, `src/twins/meltwater/workers/stream-dispatcher.ts`. Needs seed data for simulated mention generation.
- **Story 4** — Export endpoints: `src/twins/meltwater/routes/exports.ts`, `src/twins/meltwater/services/export-service.ts`. Needs seed data and search service for building export datasets.

**Parallel safety rules:**
- Stories in the same group touch DIFFERENT files/folders
- Group 2 and Group 3 are independent and could run simultaneously after Group 1
- Database migrations (creating tables) happen in Group 1 as part of Story 5
- Rate limiting middleware (Story 6) is applied to all routes in Groups 2 and 3

---

## Development Approach

### Simplifications (what starts simple)

- Webhook delivery is HTTP POST with no retry logic — if the callback fails, the mention is dropped
- Export "processing" is a simple setTimeout delay, not a real background job queue
- FTS5 keyword matching is basic — no boolean operators, proximity search, or field weighting
- Rate limit windows are fixed (not truly sliding) — resets at window boundary
- Stream mention generation runs on a fixed interval, not based on realistic arrival patterns
- No support for Meltwater's `tag` or `saved_search` concepts — just raw queries

### Upgrade Path (what changes for production)

- "Add webhook retry with exponential backoff" — separate story
- "Add boolean query syntax (AND/OR/NOT with field targeting)" — separate story
- "Add sliding window rate limiting" — swap fixed windows for token bucket
- "Add stream mention arrival patterns (Poisson-distributed)" — separate story
- "Add Meltwater tag and saved search management endpoints" — separate story

### Architecture Decisions

- **SQLite FTS5 for search** — avoids adding Elasticsearch as a dependency while still providing real full-text search. FTS5 handles the data volumes we need (500-2000 mentions) with sub-millisecond query times.
- **Header-based auth (`apikey`)** — matches real Meltwater API exactly. No Bearer prefix, no Basic auth. This is important because client code built against the twin must work against the real API without auth header changes.
- **Separate rate limit buckets per endpoint category** — matches real Meltwater behavior where analytics and export endpoints have stricter limits than general search. Prevents one endpoint's usage from blocking another.
- **Deterministic seed with event-based clustering** — produces realistic data distributions (spikes around events, long-tail reach values, topic clustering) rather than uniform random noise. Makes analytics charts look believable during development.
- **In-memory export storage with TTL cleanup** — exports are ephemeral by nature. No need for persistent storage. 1-hour TTL prevents memory leaks during long dev sessions.

---

## Verification Checklist

Before this feature is marked complete:

- [ ] All user stories implemented
- [ ] All acceptance criteria met
- [ ] All tests written and passing
- [ ] Tests verify real behavior (not just status codes)
- [ ] Edge cases handled (empty results, invalid params, expired exports)
- [ ] No regressions in existing tests
- [ ] Code committed with proper messages
- [ ] Seed data produces believable, Ode-specific media mention content
- [ ] Rate limiting matches documented Meltwater behavior
- [ ] Auth uses `apikey` header (not Bearer, not Basic)
- [ ] All response shapes match Meltwater API conventions (camelCase, pagination metadata)
- [ ] Ready for human review
