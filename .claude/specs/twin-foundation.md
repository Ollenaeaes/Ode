# Feature Spec: Digital Twin Foundation Services

**Slug:** `twin-foundation`
**Created:** 2026-03-11
**Status:** draft
**Priority:** critical

---

## Overview

Foundation services that every digital twin in Ode's platform depends on. This includes shared authentication, Norwegian-locale data generation with Ode-specific domain knowledge, a unified API gateway for routing to individual twins, and a test harness for contract testing. These are the infrastructure primitives — no twin can function without them.

## Problem Statement

Each digital twin (Mercatus, Tidsbanken, Meltwater, etc.) needs authentication, realistic Norwegian test data, a unified entry point, and consistent testing tools. Building these independently per twin creates duplication, inconsistency, and integration pain. A shared foundation ensures all twins speak the same language, authenticate the same way, and can be tested uniformly.

## Out of Scope

- NOT: Any specific twin implementation (Mercatus, Tidsbanken, Meltwater, etc.)
- NOT: Real OAuth2 provider integration (this is mock/simulated auth)
- NOT: Production deployment configuration (Docker Compose for dev only)
- NOT: Persistent database beyond SQLite (no Postgres, no migrations infrastructure)
- NOT: Frontend/UI of any kind
- NOT: Real external API integrations
- NOT: Multi-tenant data isolation (tenant ID is in the token, enforcement is per-twin)

---

## User Stories

### Story 1: Shared Auth Service

**As a** digital twin developer
**I want to** plug in a shared auth middleware that validates Bearer tokens
**So that** every twin has consistent authentication without reimplementing it

**Acceptance Criteria:**

- GIVEN a request with a valid Bearer token in the Authorization header WHEN the auth middleware processes it THEN it extracts the token, validates the format (JWT-like structure: three base64url segments separated by dots), decodes the payload, and attaches a user context object to the request containing `userId`, `tenantId`, `roles`, and `name`
- GIVEN a request with an invalid Bearer token (malformed, empty payload, missing required fields) WHEN the auth middleware processes it THEN it returns 401 with `{ "error": "Unauthorized", "message": "<reason>" }`
- GIVEN a request with no Authorization header WHEN the auth middleware processes it THEN it returns 401 with `{ "error": "Unauthorized", "message": "No authorization header" }`
- GIVEN a request with a non-Bearer scheme (e.g., Basic) WHEN the auth middleware processes it THEN it returns 401 with `{ "error": "Unauthorized", "message": "Bearer token required" }`
- GIVEN a twin that needs custom auth behavior WHEN it configures the auth middleware THEN it can override token validation logic, required roles, or public routes via an options object passed to the middleware factory

**Test Requirements:**

- [ ] Test: valid Bearer token with properly structured payload returns 200 and attaches user context with correct `userId`, `tenantId`, `roles`, `name`
- [ ] Test: malformed token (not three segments) returns 401 with descriptive error
- [ ] Test: token with missing required fields in payload returns 401
- [ ] Test: missing Authorization header returns 401
- [ ] Test: non-Bearer scheme returns 401
- [ ] Test: per-twin configuration allows customizing required roles
- [ ] Test: per-twin configuration allows marking routes as public (no auth required)
- [ ] Test: token generator utility creates valid tokens for testing

**Technical Notes:**

- The auth service is a middleware factory: `createAuthMiddleware(options?)` returns Express middleware
- Mock tokens are base64url-encoded JSON payloads (no real JWT signing — this is simulation)
- Provide a `createTestToken(payload)` utility for generating tokens in tests
- Standard payload shape: `{ sub: string, tid: string, roles: string[], name: string, iat: number, exp: number }`
- Map: `sub` -> `userId`, `tid` -> `tenantId`
- The middleware should be importable as `@ode/twin-foundation/auth` or from a shared path

---

### Story 2: Data Generation Library

**As a** digital twin developer
**I want to** generate realistic Norwegian data and Ode-specific domain data
**So that** every twin has consistent, believable test data rooted in actual Ode operations

**Acceptance Criteria:**

- GIVEN a request for Norwegian personal data WHEN the generator runs THEN it produces realistic Norwegian first names, last names, street addresses with Norwegian formatting (e.g., "Kongensgate 12, 6003 Ålesund"), phone numbers (+47 format), and email addresses using Norwegian name patterns
- GIVEN a request for a Norwegian organization number WHEN the generator runs THEN it produces a 9-digit number with a valid MOD-11 check digit (same algorithm used by Brønnøysundregistrene)
- GIVEN a request for financial amounts WHEN the generator runs THEN it produces NOK-denominated values with Norwegian formatting (e.g., `1 234 567,89 kr`) and reasonable ranges for the context (feed costs, fish prices, salary amounts)
- GIVEN a request for dates WHEN the generator runs THEN it produces ISO 8601 formatted dates in the Europe/Oslo timezone
- GIVEN a request for Ode location data WHEN the generator runs THEN it returns from the canonical set of real Ode locations:
  - **Headquarters:** Ålesund
  - **Processing plant:** Vartdal
  - **Hatcheries:** Rødberg, Tjeldbergodden (Lumarine)
  - **Sea sites (10):** Provide realistic Møre og Romsdal coastal location names (fjord/island-based: e.g., Storfjorden, Hjørundfjorden, Hareidlandet, Sula, Giske, Ellingsøy, Lepsøya, Ona, Sandøy, Kvamsøya)
- GIVEN a request for cod farming terminology WHEN the generator runs THEN it uses correct Norwegian aquaculture terms: `settefisk` (smolt/juvenile), `yngel` (fry), `merd` (net pen/cage), `biomasse` (biomass), `lokalitet` (site/locality), `slaktevekt` (harvest weight), `fôrfaktor` (FCR/feed conversion ratio), `dødelighet` (mortality), `lusegrense` (lice threshold), `MTB` (maximum tillatt biomasse), `rognkjeks` (lumpfish — cleaner fish), `torskeyngel` (cod fry)
- GIVEN a request for Snow Cod product catalog data WHEN the generator runs THEN it produces products with: product names (e.g., "Snow Cod Loins", "Snow Cod Fileter", "Snow Cod Hel Fisk"), weight classes, packaging types (fresh/frozen/pre-rigor), EAN codes, price ranges in NOK
- GIVEN a request for customer data WHEN the generator runs THEN it produces customers categorized as: `retail` (Norwegian grocery chains: Norgesgruppen, REMA 1000, Coop), `horeca` (hotels, restaurants, catering), `distributor` (seafood distributors, export agents), `export` (international buyers) — each with Norwegian org numbers, contact persons, and addresses
- GIVEN a seed value WHEN the generator runs THEN it produces identical output for the same seed every time — fully deterministic and reproducible
- GIVEN a request for time-series data WHEN the generator runs THEN it produces seasonal patterns: cohort stocking is staggered across sites through the year, growth follows temperature-dependent curves (slower in winter, faster in summer), feed consumption correlates with growth rate and temperature, mortality has a baseline rate with occasional spike events

**Test Requirements:**

- [ ] Test: generated Norwegian org numbers pass MOD-11 check digit validation (verify with the actual algorithm, not just format)
- [ ] Test: all dates are valid ISO 8601 strings parseable by `new Date()`
- [ ] Test: seeded generator with same seed produces byte-identical output across runs
- [ ] Test: seeded generator with different seeds produces different output
- [ ] Test: all Ode locations are drawn from the canonical set (no invented locations)
- [ ] Test: generated phone numbers match +47 XXXX XXXX pattern
- [ ] Test: generated NOK amounts are positive numbers with at most 2 decimal places
- [ ] Test: product catalog entries have all required fields (name, weight, packaging, EAN, price)
- [ ] Test: customer org numbers are valid (MOD-11)
- [ ] Test: time-series data spans the requested period with no gaps

**Technical Notes:**

- Use Faker.js with `nb_NO` locale as the base for Norwegian data
- Layer Ode-specific generators on top of Faker (don't fight Faker — extend it)
- Seeding: use Faker's built-in seed mechanism (`faker.seed(value)`)
- Structure as a library with clear namespaces: `ode.person()`, `ode.company()`, `ode.location()`, `ode.product()`, `ode.customer()`, `ode.cohort()`, `ode.timeSeries()`
- MOD-11 algorithm for org numbers: weights [3, 2, 7, 6, 5, 4, 3, 2] applied right-to-left on first 8 digits, check digit = 11 - (sum % 11), if result is 11 use 0, if result is 10 skip (regenerate)
- Time-series generators should accept a date range and interval (hourly, daily, weekly) and return arrays of `{ timestamp, value }` objects
- Sea site names should be plausible Møre og Romsdal coastal locations — store as a constant array

---

### Story 3: API Gateway / Service Router

**As a** developer or test runner
**I want to** access all digital twins through a single entry point
**So that** I don't need to know individual twin ports and can monitor all traffic centrally

**Acceptance Criteria:**

- GIVEN a request to `GET /mercatus/products` WHEN the gateway processes it THEN it proxies the request to the Mercatus twin service, strips the service prefix from the path (Mercatus receives `GET /products`), and returns the twin's response with original status code and headers
- GIVEN a request to `GET /health` WHEN the gateway processes it THEN it queries each registered twin's health endpoint, aggregates the results, and returns `{ "status": "healthy"|"degraded"|"unhealthy", "services": { "<name>": { "status": "up"|"down", "responseTime": <ms> } } }` — status is "healthy" if all up, "degraded" if some down, "unhealthy" if all down
- GIVEN any request through the gateway WHEN it completes THEN a log entry is written containing: ISO 8601 timestamp, HTTP method, full original path, resolved service name, response status code, response time in milliseconds
- GIVEN a request with an unknown service prefix (e.g., `GET /nonexistent/foo`) WHEN the gateway processes it THEN it returns 404 with `{ "error": "Not Found", "message": "Unknown service: nonexistent" }`
- GIVEN a twin service that is not responding WHEN the gateway tries to proxy THEN it returns 502 with `{ "error": "Bad Gateway", "message": "Service <name> is not available" }` and the health check marks that service as "down"

**Test Requirements:**

- [ ] Test: request with valid service prefix is routed to correct twin and prefix is stripped
- [ ] Test: twin's response status code and body are passed through unchanged
- [ ] Test: `GET /health` returns aggregate status with per-service detail
- [ ] Test: health returns "degraded" when one service is down but others are up
- [ ] Test: request with unknown prefix returns 404 with service name in error
- [ ] Test: request to unavailable service returns 502
- [ ] Test: every request produces a log entry with all required fields (timestamp, method, path, service, status, response time)
- [ ] Test: gateway starts with zero registered services and returns healthy (vacuous truth)

**Technical Notes:**

- Use `http-proxy-middleware` or a simple `http.request` proxy — keep it lightweight
- Service registration is config-driven: an object mapping service names to `{ host, port }` targets, loaded at startup
- Gateway port defaults to 4000 (configurable via `GATEWAY_PORT` env var)
- Request logging should go to stdout as structured JSON (one line per request) for easy parsing
- Health check timeout per service: 2 seconds (configurable)
- The gateway itself does NOT enforce auth — individual twins use the shared auth middleware as they see fit

---

### Story 4: Test Harness

**As a** digital twin developer
**I want to** shared test utilities for writing contract tests against any twin
**So that** tests across all twins are consistent, readable, and can validate Norwegian data patterns

**Acceptance Criteria:**

- GIVEN a test that needs to call a twin API WHEN it uses the API client helper THEN it can make requests with: configurable base URL, automatic Bearer token injection, automatic JSON request/response handling, and response objects that expose `.status`, `.body`, and `.headers` cleanly
- GIVEN a test that checks response shapes WHEN it uses assertion helpers THEN it can validate: HTTP status codes with descriptive failure messages, response body matching partial shapes (like Jest's `expect.objectContaining`), arrays with length constraints, and specific field types
- GIVEN a test that checks Norwegian data WHEN it uses Norwegian validation helpers THEN it can validate: Norwegian org numbers (MOD-11), Norwegian phone numbers (+47 pattern), NOK amounts (positive, 2 decimal places max), ISO 8601 dates, and Norwegian postal codes (4 digits)
- GIVEN a test that needs a clean state WHEN it calls `POST /admin/reset` on a twin THEN the twin resets its data to the initial seeded state — all dynamically created data is removed, seeded data is restored
- GIVEN a test that needs to simulate time passing WHEN it calls `POST /admin/time/advance?hours=N` on a twin THEN the twin's internal clock advances by N hours, affecting any time-dependent data generation or business logic (e.g., cohort growth, feed schedules)
- GIVEN a test suite WHEN it starts THEN it can discover which twins are running and skip tests for unavailable twins with a clear "skipped: service not available" message

**Test Requirements:**

- [ ] Test: API client sends correct Authorization header from provided token
- [ ] Test: API client parses JSON responses automatically
- [ ] Test: API client handles non-JSON responses without crashing
- [ ] Test: assertion helper correctly validates partial object shapes (matching fields present, extra fields ignored)
- [ ] Test: assertion helper fails with descriptive message when shape doesn't match
- [ ] Test: Norwegian org number validator accepts valid numbers and rejects invalid ones (test with known-good and known-bad check digits)
- [ ] Test: Norwegian phone number validator accepts `+47 1234 5678` and rejects `+46 1234 5678`
- [ ] Test: data reset endpoint restores initial state (create data, reset, verify created data is gone)
- [ ] Test: time advance endpoint moves internal clock forward (advance 24h, verify time-dependent data reflects the change)
- [ ] Test: test harness gracefully handles unavailable twins

**Technical Notes:**

- The API client is a thin wrapper around `fetch` (Node 18+ built-in) — no Axios or other HTTP libraries
- Assertion helpers extend Vitest's `expect` with custom matchers (e.g., `expect(body).toMatchNorwegianOrg()`, `expect(response).toHaveStatus(200)`)
- The `/admin/reset` and `/admin/time/advance` endpoints are implemented per-twin, but the test harness provides a standard interface and documentation for how twins should implement them
- The test harness exports a `createTwinTestSuite(config)` factory that sets up the client, token, and reset lifecycle for a specific twin
- Time advancement uses a shared `clock` module that twins import — `clock.now()` replaces `Date.now()` so advancing time is centralized
- Expose a `describeTwin(name, baseUrl, fn)` wrapper that handles service discovery, setup/teardown, and skip logic

---

## Technical Design

### Project Structure

```
packages/
  twin-foundation/
    src/
      auth/
        middleware.ts        # createAuthMiddleware(options?)
        token.ts             # createTestToken(payload), decodeToken(token)
        types.ts             # AuthOptions, UserContext, TokenPayload
      data/
        index.ts             # Main ode generator namespace
        norwegian.ts         # Norwegian locale helpers (org numbers, phone, addresses)
        locations.ts         # Canonical Ode locations constant
        products.ts          # Snow Cod product catalog generator
        customers.ts         # Customer type generators
        aquaculture.ts       # Cod farming terminology and cohort generators
        time-series.ts       # Seasonal pattern generators
      gateway/
        server.ts            # Express app with proxy routing
        health.ts            # Health check aggregation
        logger.ts            # Structured JSON request logger
        types.ts             # ServiceConfig, HealthStatus
      test-harness/
        client.ts            # API client helper
        assertions.ts        # Custom Vitest matchers
        validators.ts        # Norwegian data validators
        suite.ts             # createTwinTestSuite(), describeTwin()
        clock.ts             # Advanceable clock module
        types.ts             # TestSuiteConfig, TwinClient
      index.ts               # Public API barrel exports
    tests/
      auth.test.ts
      data.test.ts
      gateway.test.ts
      test-harness.test.ts
    package.json
    tsconfig.json
    vitest.config.ts
```

### Data Model

No persistent database for the foundation layer itself. The data generation library is stateless. The gateway holds service registry in memory. The clock module holds current simulated time in memory.

Key data structures:

```typescript
// Auth
interface TokenPayload {
  sub: string;          // userId
  tid: string;          // tenantId
  roles: string[];      // e.g., ["admin", "operator"]
  name: string;         // display name
  iat: number;          // issued at (unix timestamp)
  exp: number;          // expires at (unix timestamp)
}

interface UserContext {
  userId: string;
  tenantId: string;
  roles: string[];
  name: string;
}

interface AuthOptions {
  requiredRoles?: string[];
  publicRoutes?: string[];
  validateToken?: (token: string) => TokenPayload | null;
}

// Gateway
interface ServiceConfig {
  name: string;
  host: string;
  port: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, { status: 'up' | 'down'; responseTime: number }>;
}

// Test Harness
interface TwinClient {
  get(path: string): Promise<ApiResponse>;
  post(path: string, body?: unknown): Promise<ApiResponse>;
  put(path: string, body?: unknown): Promise<ApiResponse>;
  delete(path: string): Promise<ApiResponse>;
  reset(): Promise<void>;
  advanceTime(hours: number): Promise<void>;
}
```

### API Surface

**Gateway (port 4000):**
- `GET /health` — aggregated health check
- `/{service}/*` — proxied to registered twin service

**Per-twin admin endpoints (implemented by each twin, documented here):**
- `GET /health` — individual twin health
- `POST /admin/reset` — reset to seeded state
- `POST /admin/time/advance?hours=N` — advance simulated clock

### Dependencies

- **express** — HTTP server for gateway
- **http-proxy-middleware** — request proxying (or lightweight custom proxy)
- **@faker-js/faker** — base data generation with `nb_NO` locale
- **vitest** — test runner
- **typescript** — type safety across all foundation code

No other runtime dependencies. Keep the foundation minimal.

### Security Considerations

- This is a simulation/development environment — no real secrets or credentials
- Mock tokens are not cryptographically signed; they exist to simulate auth flow structure
- The `/admin/reset` and `/admin/time/advance` endpoints must NEVER exist in production builds — guard with `NODE_ENV` check
- The gateway does not enforce auth — it is a transparent proxy. Auth is per-twin.

---

## Implementation Order

### Group 1 (parallel — no dependencies)

All four stories can run in parallel. They touch entirely separate files and have no interdependencies:

- **Story 1** — `src/auth/` directory (middleware.ts, token.ts, types.ts) + `tests/auth.test.ts`
- **Story 2** — `src/data/` directory (all data generators) + `tests/data.test.ts`
- **Story 3** — `src/gateway/` directory (server.ts, health.ts, logger.ts, types.ts) + `tests/gateway.test.ts`
- **Story 4** — `src/test-harness/` directory (client.ts, assertions.ts, validators.ts, suite.ts, clock.ts, types.ts) + `tests/test-harness.test.ts`

**Shared setup (before parallel work):** Create `packages/twin-foundation/` with `package.json`, `tsconfig.json`, `vitest.config.ts`, and `src/index.ts` barrel file. This takes 2 minutes and must happen first.

**Parallel safety:** Each story owns its own subdirectory under `src/` and its own test file. No file overlap. The barrel `index.ts` is updated after all stories complete.

---

## Development Approach

### Simplifications (what starts simple)

- **Auth tokens are base64-encoded JSON**, not signed JWTs. The structure mimics JWT (header.payload.signature) but the signature segment is a static placeholder. This is sufficient for simulating auth flows without crypto dependencies.
- **Gateway proxying is basic HTTP forwarding** — no WebSocket support, no streaming, no request body transformation. Sufficient for REST API twins.
- **Time-series generators use simple sine waves** with noise for seasonal patterns. Real aquaculture growth models are more complex but this is enough for believable demo data.
- **Clock module is in-memory only** — restarting a twin resets the clock. No persistence of simulated time.

### Upgrade Path (what changes for production)

- "Real JWT validation with JWKS endpoint" would replace the mock token decoder
- "Redis-backed clock persistence" would allow simulated time to survive restarts
- "Gateway rate limiting and circuit breakers" would be a separate hardening story
- "WebSocket proxy support" would be needed if any twin uses real-time data
- "Production data generators from actual Ode databases" would replace Faker-based simulation

### Architecture Decisions

- **Monorepo package structure** (`packages/twin-foundation/`) so twins can depend on it via workspace references rather than npm publishing. Each twin will be its own package under `packages/`.
- **Middleware factory pattern for auth** (`createAuthMiddleware(options)`) rather than a singleton, so each twin can customize behavior without monkey-patching.
- **Faker.js extension rather than replacement** — Ode-specific generators wrap Faker calls and add domain knowledge. This means we get Norwegian locale for free and only write what Faker doesn't know (aquaculture terms, Ode locations, product catalog).
- **Vitest custom matchers for Norwegian validation** — integrates with the existing test runner rather than requiring a separate validation library. Tests read naturally: `expect(org).toBeValidNorwegianOrg()`.
- **Structured JSON logging to stdout** for the gateway — no log library, just `JSON.stringify()` to stdout. Easy to pipe to any log aggregator later. Simple now, extensible later.
- **Clock module as dependency injection** — twins import `clock.now()` instead of calling `Date.now()`. This is the lightest-weight way to make time testable without mocking globals.

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
- [ ] MOD-11 check digit algorithm verified against known Norwegian org numbers
- [ ] All Norwegian characters (Å, Ø, Æ, å, ø, æ) handled correctly in generated data
- [ ] Gateway correctly proxies requests with Norwegian characters in paths/query params
- [ ] Seeded data generation is deterministic across runs (verified with snapshot comparison)
- [ ] Ready for human review
