# Lessons Learned

This file is read at the start of every session. It captures mistakes, patterns, and decisions learned from code reviews, debugging sessions, and implementation experience. The agent uses these to avoid repeating mistakes.

**Rules for this file:**
- Keep each lesson to 1-3 lines
- Be specific: "Don't do X because Y" not "be careful with X"
- Include the date so stale lessons can be pruned
- Max 150 lines — when it gets long, archive old lessons and keep only what's still relevant

---

## Coding Patterns

- [2026-03-11] Each twin must export a `createApp()` factory function that accepts `{ dbPath?: string }` (defaults to `:memory:`) so tests can create isolated instances without starting a server.
- [2026-03-11] Don't use `workspace:*` protocol in package.json — npm doesn't support it. Use the actual version (e.g., `"0.1.0"`) for workspace dependencies. Only pnpm supports `workspace:*`.
- [2026-03-11] `crypto.randomUUID()` is NOT deterministic — don't use it when seed reproducibility matters (e.g., for ORDER BY on UUID columns in determinism tests). Order by a deterministic field instead.

## Mistakes to Avoid

- [2026-03-11] Always do verification/smoke testing after implementing a twin: start the actual server, hit real endpoints, and confirm responses. Unit tests with supertest are necessary but not sufficient — the PR was flagged for missing this step. Add a smoke test that boots the app and queries key endpoints end-to-end.
- [2026-03-11] When mounting an Express router at a prefix (e.g., `app.use('/api/financials', router)`), the router's own routes are relative to that prefix. `router.get('/')` matches `/api/financials`, NOT `/api/financials/values`. If the test expects `/api/financials/values`, the router needs `router.get('/values')`.
- [2026-03-11] When setting a max pageSize, make sure it's large enough for tests that need to fetch all records (e.g., 155 employees). A pageSize cap of 100 broke a test that needed pageSize=200. Use 1000 as a safe max for dev twins.

## Project-Specific Gotchas

- [2026-03-11] Subagents spawned with `bypassPermissions` may still hit permission denials if the project's `.claude/settings.local.json` has a restrictive allow list. When spawning agents that need Bash access (npm install, test runs), either pre-install dependencies and pre-create configs from the main context, or ensure settings allow the needed commands.

## Architecture Decisions

- [2026-03-11] Each twin uses its own auth pattern matching the real system: Mercatus uses Bearer tokens (foundation middleware), Tidsbanken uses `subscription-key` + `tb-key` headers, Meltwater uses `apikey` header. This ensures integration code built against the twin works against the real API without auth header changes.
