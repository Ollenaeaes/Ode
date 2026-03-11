# Project Configuration

## Development Methodology: Spec-Driven Development (SDD)

This project uses Spec-Driven Development. **Never write implementation code without an approved spec.**

### Workflow

1. `/spec-create` → Interactive conversation that produces a structured spec
2. Human approves the spec
3. `/spec-implement` → Autonomous implementation with self-healing verification
4. `/spec-review` → Audit implementation against the spec

### Spec Location

All specs live in `.claude/specs/`. Progress tracking lives in `.claude/specs/progress.md`.

### Roles

- **The human is the product owner.** They describe features, functionality, and access rules in business language. They don't need to know about JWT, middleware, or RLS implementation details.
- **The AI is the technical lead.** It translates business requirements into architecture, makes engineering decisions, and implements them. It explains decisions in progress.md but doesn't burden the human with technical choices.

### Development Philosophy

**Build the right skeleton with simple organs.**

- Architecture, folder structure, and interfaces between components should be correct from day one. These are hard to change later.
- Implementations behind those interfaces start as the simplest working version. A login system might start with basic email/password before adding OAuth. Data access rules start with simple filters before becoming database-level policies.
- Upgrading a simple implementation to a production one should be a normal user story, not a rewrite. If upgrading requires restructuring the app, the architecture was wrong — fix that first.
- Config-driven behavior over hard-coded decisions. Use environment variables so the same code can run simply in dev and robustly in production.
- Never add complexity that no story has asked for. No premature optimization, no gold-plating, no "while we're at it."

### Implementation Rules

1. **Read the spec first.** Always.
2. **Read progress.md first.** It tells you where we left off and what's been done.
3. **Read LESSONS.md.** It contains mistakes and patterns learned from past reviews. Don't repeat them.
4. **One story at a time, or one group in parallel.** Stories within a parallel group can run simultaneously via subagents. Groups run sequentially. See the spec's Implementation Order.
4. **Tests verify real behavior.** Not just status codes — actual data, state changes, side effects.
5. **Self-healing loop.** Run tests → if fail → read error → fix → rerun → repeat until pass.
6. **Update progress.md after each story.** Record what was done, decisions made, issues found.
7. **Use subagents for implementation.** Each story should be implemented by a subagent to keep context clean.
8. **Never skip tests.** If you can't write a meaningful test, stop and ask.
9. **Check for regressions** after each story.
10. **Commit after each story.** Format: `feat(<slug>): implement story <n> - <title>`

### Context Management Rules

- **CLAUDE.md files are hierarchical.** Each major folder can have its own CLAUDE.md. Read them when working in that area.
- **Don't memorize the whole codebase.** Search and read files just-in-time. Only load what's relevant to the current story.
- **Describe capabilities, not file paths.** Paths go stale. Describe what lives where conceptually.
- **Compact intentionally.** After each story, write learnings to progress.md before moving on.

### Common Commands

```bash
# Run all tests
npx vitest run

# Run a single test file
npx vitest run path/to/test.test.ts

# Start all twins (via gateway)
node packages/twin-foundation/src/gateway/index.js

# Start individual twin
node packages/twin-mercatus-farmer/src/index.js

# Lint
npx eslint .
```

### Tech Stack

- Language: JavaScript/TypeScript (Node.js 20+)
- Framework: Express.js
- Test Runner: Vitest
- Database: SQLite (via better-sqlite3)
- Data Generation: Faker.js (nb_NO locale) + custom generators
- Container: Docker + docker-compose for full ecosystem

### Architecture Overview

Monorepo of digital twin services simulating Ode's IT landscape for development/testing:
- `packages/twin-foundation/` — shared auth, data gen, gateway, test harness
- `packages/twin-mercatus-farmer/` — biomass ERP twin (ScaleAQ Mercatus)
- `packages/twin-tidsbanken/` — time registration twin
- `packages/twin-meltwater/` — media intelligence twin
- `packages/twin-visma-payroll/` — payroll & expense twin
- `packages/twin-marel-innova/` — production control twin (Vartdal plant)
- `packages/twin-hoseth-straqs/` — fish counting & cooling twin
- `packages/twin-feed-systems/` — feed systems twin (ScaleAQ Edge/Cloud)

Each twin is an Express app with SQLite, exposing the same API surface as the real system. Gateway routes all traffic through a single entry point.

### Domain Terminology

| Norwegian | English | Context |
|-----------|---------|---------|
| Torsk | Cod | The species Ode farms (Gadus morhua) |
| Oppdrett | Aquaculture/farming | Fish farming |
| Settefisk | Juvenile fish | Young fish for stocking sea cages |
| Yngel | Fry/larvae | Very young fish |
| Merd | Net pen/cage | Sea cage for farming |
| Biomasse | Biomass | Standing weight of fish (MTB = max permitted) |
| Lokalitet | Site/location | Approved farming site |
| Konsesjon | License/concession | Aquaculture license |
| Fôr | Feed | Fish feed |
| Pre-rigor | Pre-rigor | Processing before rigor mortis — premium quality |
| H&G | Head & Gutted | Standard whole fish product form |
| HoReCa | Hotels, Restaurants, Catering | Foodservice sector |
| Brønnbåt | Wellboat | Vessel for transporting live fish |
| Slakteri | Processing plant | Where fish are harvested and processed |
| FCR | Feed Conversion Ratio | Feed kg per kg fish growth (cod: ~1.1-1.5) |
