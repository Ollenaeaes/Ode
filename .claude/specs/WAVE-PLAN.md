# Digital Twin Wave Plan — Ode

## Overview
- **Company**: Ode (Norway's largest farmed cod producer)
- **Systems assessed**: 24
- **Specs generated**: 8 (foundation + 7 system twins)
- **AI Readiness Score**: 31/100 overall
- **Distribution**: 1 AI Ready, 6 Gaps, 6 Limited, 11 Blocker
- **Full assessment**: see `ai-readiness-report.pdf` in project root

## Prerequisites
- [ ] SDD kit initialized (`/spec-init`)
- [ ] Node.js 20+ installed
- [ ] Docker installed (for ecosystem orchestration)
- [ ] ScaleAQ API access requested (support.digital@scaleaq.com) — enhances Mercatus twin realism
- [ ] Marel SmartBase API documentation requested — enhances Innova twin
- [ ] Seaqloud API documentation requested (support@seaqloud.no) — future twin candidate

## Execution

### Wave 1: Foundation (all parallel, no dependencies)

| Spec | Stories | Est. Time |
|------|---------|-----------|
| `twin-foundation.md` Story 1: Auth Service | 1 | ~20 min |
| `twin-foundation.md` Story 2: Data Gen Library | 1 | ~30 min |
| `twin-foundation.md` Story 3: API Gateway | 1 | ~20 min |
| `twin-foundation.md` Story 4: Test Harness | 1 | ~20 min |

**Run:** `/spec-implement twin-foundation`
All four stories run via subagents in parallel.

### Wave 2: Core Systems (after Wave 1, all parallel)

| Spec | System | Score | Stories | Est. Time |
|------|--------|-------|---------|-----------|
| `twin-mercatus-farmer.md` | Mercatus Farmer (Biomass ERP) | 51/100 | 10 | ~90 min |
| `twin-tidsbanken.md` | Tidsbanken (Time Registration) | 73/100 | 8 | ~60 min |
| `twin-meltwater.md` | Meltwater (Communications) | 88/100 | 6 | ~45 min |
| `twin-visma-payroll.md` | Visma Payroll & Expense | 54/100 | 6 | ~45 min |

**Run each:** `/spec-implement twin-mercatus-farmer`, `/spec-implement twin-tidsbanken`, etc.
All Wave 2 specs are independent — run simultaneously in separate sessions.

### Wave 3: Connected Systems (after relevant Wave 2 specs complete)

| Spec | System | Score | Depends On | Stories | Est. Time |
|------|--------|-------|------------|---------|-----------|
| `twin-marel-innova.md` | Marel Innova (Production) | 47/100 | foundation | 7 | ~90 min |
| `twin-hoseth-straqs.md` | Hoseth StraQS/HeliX (Counting/Cooling) | 54/100 | foundation | 5 | ~60 min |
| `twin-feed-systems.md` | Feed Systems (ScaleAQ) | 50/100 | twin-mercatus-farmer | 6 | ~60 min |

**Run each after dependencies complete:** `/spec-implement twin-marel-innova`, etc.
Innova and StraQS can run in parallel. Feed Systems waits for Mercatus Farmer (shared site data).

### Wave 4: Integration & Polish

| Spec | What | Stories | Est. Time |
|------|------|---------|-----------|
| `twin-integration-tests.md` | End-to-end cross-twin scenarios | 4-5 | ~45 min |
| `twin-ecosystem.md` | Docker compose, seeding, orchestration | 3-4 | ~30 min |

**Create these specs after Waves 2-3 complete** — they need to reference actual twin implementations.

## Execution Timeline

```
Wave 1:  [Auth] [DataGen] [Gateway] [TestHarness]       <- /spec-implement twin-foundation
         ════════════════════════════════════════

Wave 2:  [Mercatus] [Tidsbanken] [Meltwater] [Payroll]  <- parallel /spec-implement
         ══════════════════════════════════════════

Wave 3:  [Innova]────────→depends on foundation
         [StraQS]────────→depends on foundation
         [Feed]──────────→depends on Mercatus
         ══════════════════════════════════════════

Wave 4:  [Integration Tests] [Docker Ecosystem]          <- after all twins
         ══════════════════════════════════════════
```

## Pending Items (vendor engagement needed)

| Priority | Item | Blocks | Contact |
|----------|------|--------|---------|
| High | ScaleAQ Mercatus API access | Improves twin-mercatus-farmer realism | support.digital@scaleaq.com |
| High | Marel SmartBase API docs | Improves twin-marel-innova | Marel professional services |
| Medium | Seaqloud API documentation | Future twin candidate (sensors) | support@seaqloud.no |
| Medium | Hoseth StraQS OPC-UA node specs | Improves twin-hoseth-straqs | Hoseth Technology |
| Medium | Maritech API access | Future twin candidate (sales) | Maritech/CAI Software |
| Low | Anteo API access | Future twin candidate (logistics) | post@anteo.no |
| Low | Dottie HR API docs | Future twin candidate (HR) | Dottie/Visma |

## Future Twins (when vendor APIs become available)

Systems scoring 20-49 that could be twinned with more information:
- **Seaqloud** (37/100) — environmental sensors, confirmed open API. High value for cod growth analytics.
- **Maritech** (23/100) — sales & logistics. Critical for order-to-delivery flow.
- **Capitech** (47/100) — processing plant time system. Moderate value.
- **Marel Innova upgrade** — when SmartBase APIs are documented, the twin can be upgraded from staging-table simulation to real REST API simulation.

## Tech Stack

- **Runtime**: Node.js 20+ with Express
- **Database**: SQLite (via better-sqlite3) — zero-config, file-based, easy to reset
- **Data generation**: Faker.js with nb_NO locale + custom Ode generators
- **Testing**: Vitest
- **Container**: Dockerfile per twin + docker-compose for full ecosystem
- **Monorepo**: packages/twin-foundation, packages/twin-mercatus-farmer, etc.
