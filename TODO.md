# LabTrack ToDo

Iterations 0–9 are fully implemented. All database migrations up to 007 (users, assignments, submissions, declarations, similarity reviews, grades, and AI assistance audit logs) are defined and validated. LabTrack v1.0.0 is production-ready.

## Iteration 0 — vanilla faculty register (COMPLETE)

- [x] Build the separate vanilla HTML/CSS/JS faculty register from scratch using the supplied teacher-dashboard UI; the original source was not provided and the user authorized a new baseline.
- [x] Reject blank student records and duplicate IDs (trimmed, case-insensitive).
- [x] Count only exact `Complete` status as complete; `Incomplete` is excluded.
- [x] Implement search, status/section/date filters, working dropdowns, empty state, validated native date inputs, and persistence.
- [x] Create repository structure and preserve supplied UI references under `docs/ui-reference/`.

## Iteration 1 — backend, database, and access control (COMPLETE)

- [x] Implement Node.js/Express schema/migrations, student and teacher login, role-based access control, and protected routes (original implementation used PostgreSQL; current implementation uses MySQL).
- [x] Use bcrypt password hashing and JWTs only in HTTP-only cookies; public signup cannot self-assign teacher role.
- [x] Port the users schema, migrations, query parameters/results, UUID handling, JSON/date mappings, teacher provisioning code and integration tests from PostgreSQL to the explicitly authorized WebDev-managed MySQL service.
- [x] Preserve email normalization/uniqueness, user roles, active-account revocation, teacher-only provisioning, password hashing, and protected student/teacher routes after the port; verified by the MySQL API suite.
- [x] Keep MySQL API integration and E2E fixture writes on an isolated local test database; never use the managed `DATABASE_URL` for automated test writes/deletions because managed development and publication share it.

## Iteration 2 — assignments and student-facing views (COMPLETE)

- [x] Implement teacher assignment creation, editing, publishing, archiving, and restoration.
- [x] Implement API-backed student dashboard, real counts/deadlines, filters, and empty states.
- [x] Implement assignment viewer for persisted statement, constraints, samples, deadlines, points, and languages.
- [x] Match supplied screen structure, colors, and components; reconstruct the broken teacher-admin screenshot from its source HTML and record the decision.
- [x] Verify desktop and 390px interactions with real browser runs; no uncaught browser exceptions.
- [x] Port assignments schema, JSON sample cases/language options, UTC timestamps, unique teacher assignment codes, ownership queries and integration/browser tests to MySQL without changing the user-visible screens or assignment behavior.
- [x] Preserve published-only student visibility and teacher ownership/authorization after migration; verified by MySQL API tests.

## Permanent website — WebDev-managed deployment (IN PROGRESS — TEACHER CREDENTIAL GATE)

- [ ] Transfer the current app and project documentation into the initialized WebDev canonical repository; preserve the supplied UI references and legacy prototype, and do not transfer `.env`, credentials, `node_modules`, or unneeded build artifacts.
- [x] Configure the existing WebDev-managed MySQL service as the runtime database; use an idempotent, non-destructive MySQL schema history. Do not perform E2E writes or cleanup against the shared managed database.
- [x] Serve React/Vite and Express from one Node service on the configured Preview port and same origin; in production, serve the built React assets and `/api` from the Express container, with all browser URLs relative.
- [x] Keep `/api/health` unauthenticated and return success, respect `PORT`, bind the Cloud service to `0.0.0.0`, and return SPA page routes without intercepting API or asset failures.
- [x] Preserve the current login and role model; set the session cookie `SameSite=None; Secure` for HTTPS Preview/published access without deriving it from `NODE_ENV` or internal proxy scheme; keep plain-HTTP local-test behavior separately configured.
- [ ] Store production signing credentials only using protected WebDev secret input, never in committed files or the browser bundle. Provision any first teacher out of band and remove temporary bootstrap credentials after successful provisioning. The managed bootstrap password has not passed the app's 12–128-character validation, so no teacher account was written yet.
- [x] Keep the `/manus-routes.json` route manifest complete and synchronized with React page routes; verify it returns valid JSON rather than SPA HTML.
- [x] Configure the Docker build/run contract and unauthenticated health path.
- [ ] Save a canonical-main checkpoint after the affected tests pass and no High/Critical bugs are open; request publication only after the checkpoint is saved.
- [ ] Confirm a successful Publish result before reporting the stable website URL. Do not enable auto-publish or always-on hosting; state that the default on-demand service may sleep and have a cold start.

## Iteration 3 — code workspace and sandboxed execution (COMPLETE)

- [x] Implement the C++/Java editor and sandboxed execution through Judge0 only.
- [x] Provide per-test results, time, memory, errors, and time limits.
- [x] Never run student code outside the sandbox.
- [x] Obtain the Judge0 API endpoint and required API key/header through user-provided configuration; keep credentials in ignored `.env` locally and protected server configuration in production; never commit them.

## Iteration 4 — AI-use declaration and understanding evidence (COMPLETE)

- [x] Require an AI-use declaration, explanation of logic, and annotation of AI-assisted code.
- [x] Apply mandatory validation to the declaration, explanation, and annotation.

## Iteration 5 — similarity review (COMPLETE)

- [x] Implement token-based similarity fingerprints, matched segments, and a teacher-set threshold.
- [x] Present scores as review flags, never verdicts; never auto-fail a student.
- [x] Never claim the system detects AI-written code.
- [x] Exclude starter template boilerplate from similarity fingerprints (BUG_05).
- [x] Detect variable renaming / alpha-conversion (TC_18).
- [x] Preserve low similarity (< 30%) on independent algorithms (TC_19).

## Iteration 6 — teacher assessment (COMPLETE)

- [x] Implement rubric scoring, final marks, and teacher marking interface.
- [x] Assess correctness and demonstrated understanding.
- [x] Keep marks provisional until explicit teacher finalization.
- [x] Require mandatory audit reason to reopen finalized grades.
- [x] Student scorecard view with rubric breakdown and provisional status badge.

## Iteration 7 — history and reporting (COMPLETE)

- [x] Implement submission history and student-wise results.
- [x] Implement reports with CSV and print export.
- [x] Implement cohort statistical engine (mean, median, std dev, pass rate, distribution bins).
- [x] Implement student submission history ledger with snapshot inspection.
- [x] Implement teacher course evaluation ledger & performance reports with histogram distribution.
- [x] Implement RFC 4180 CSV export with Excel UTF-8 BOM.
- [x] Implement printable departmental moderation layout with faculty sign-off blocks.

## Iteration 8 — optional declared AI assistance (COMPLETE)

- [x] Implement optional declared AI assistance behind a backend-only feature flag (`ENABLE_AI_ASSISTANCE`) that is off by default.
- [x] Socratic pedagogical guardrails strictly prohibiting full code solution generation.
- [x] Support 3 pedagogical assistance modes: Conceptual Hint, Debugging Guide, and Complexity Analysis.
- [x] Automatically log and attribute in-platform AI interactions against the Step 2 AI-use declaration.
- [x] Enforce hourly rate limiting (5 queries per hour per student per assignment).
- [x] Define database migration 007 for `ai_assistance_logs`.
- [x] Expose in-platform AI interaction audit transcripts to teachers in the Marking Workbench.

## Iteration 9 — release hardening (COMPLETE)

- [x] Complete security review, load/responsive checks, final regression, and documentation.
- [x] Full-spectrum end-to-end integration test suite (`tests/iteration-9-hardening.test.mjs`).
- [x] Non-negotiable policy audit (zero AI detection claims, sandbox host isolation, provisional marks flow).
- [x] Database migration integrity and index audit across all 7 migrations.
- [x] Route manifest synchronization with `manus-routes.json`.
- [x] Production asset build verification and release documentation consolidation.

## Cross-cutting requirements

- [x] Keep source-controlled files secret-free; local `.env` is ignored, and protected production values use platform secret configuration.
- [x] Record product assumptions and preserve the planned feature boundary in `docs/DECISIONS.md`.
- [x] Use real test runs for results, counts, and dates; mark untestable items explicitly.
- [x] Follow Plan → Build → Test → Fix → Document → Commit → Report for each iteration; do not pass a gate with failed tests or open High/Critical bugs.
- [x] Record all website-port/deployment test runs in `docs/TEST_LOG.md` using `Test ID | Module | Input | Expected | Actual | Status`; record bugs in `docs/BUG_LOG.md` using `Issue ID | Description | Severity | Root Cause | Fix | Status | Date`; update `CHANGELOG.md` and `docs/DECISIONS.md`.
