# LabTrack — implementation and permanent-site plan

## Product and delivery boundary

LabTrack is a DSA assignment and evaluation platform for students and teachers. Students submit C++/Java code, declare any AI use, explain their logic, and annotate AI-assisted code. Teachers review code, test outcomes, similarity flags, and explanations before finalizing marks. Evaluation considers correctness and demonstrated understanding. LabTrack never claims to detect AI-written code; similarity scores are review flags, not verdicts, and can never auto-fail a student.

The current completed application covers Iterations 0–2: the separately labelled vanilla faculty-register prototype, student/teacher login and RBAC, teacher assignment management, the student dashboard, and the assignment viewer. The site conversion does not imply completion of Iterations 3–9. In particular, live code execution remains disabled until Judge0 is configured and tested. Preserve later iteration items as open work.

The user explicitly authorized replacing the initial PostgreSQL requirement with WebDev-managed MySQL and porting schema, API, and tests. This is the selected architecture for the permanent site. The managed database is shared by development and published production; it is not a safe automated-test database. Use an isolated local MySQL database for migrations, API integration tests, browser E2E fixtures, and cleanup. Never point those test commands at the managed DSN. The fresh managed DB receives only the additive initial application schema after the MySQL port is verified; there is no PostgreSQL-to-production data import in scope.

## Serving and application architecture

Use the already initialized Manus WebDev project `wdp_59ce29f880018956b511d4fd`, its canonical `main` repository, server capability, and managed MySQL database. Keep one Node/Express service on `PORT` (default 3000). In development, use Vite middleware within the same Express listener, so the stable Cloud Preview serves the React UI and same-origin `/api` requests without requiring a second public port. In production, build Vite assets during the Docker image build and let Express serve `apps/web/dist` plus the API from the same origin. Keep all browser-facing URLs root-relative; never derive public links from the proxy's internal Host header.

Use the existing React, Vite, Tailwind and Express workspaces. Replace `pg` with `mysql2` and retain the existing bcrypt, JWT, cookie, Express, validation, role and route protections. Preserve the supplied Academic Precision HTML/screens and current page structure; do not redesign the screens. Preserve the vanilla faculty register as the legacy reference rather than conflating it with the authenticated assignment platform.

### MySQL migration strategy

- Use WebDev-injected `DATABASE_URL` for the managed MySQL service at runtime; do not read or hard-code its value in the repository, build output, browser bundle, or logs.
- Use `mysql2/promise` pooling and `?` bind parameters. Replace PostgreSQL-only `$n` placeholders, `RETURNING`, `ON CONFLICT`, `JSONB`, arrays, UUID generation, partial indexes, `TIMESTAMPTZ`, and pg result shapes with verified MySQL-compatible equivalents.
- Keep UUIDs as canonical `CHAR(36)` values generated in Node; store sample cases and language options in JSON columns; use UTC consistently for due/created/updated dates and map returned date values explicitly. Preserve normalized unique emails, role/active state, teacher ownership, foreign keys, unique assignment codes per teacher, publication states, and all API validation/authorization.
- Keep the migration history deterministic and idempotent. MySQL DDL may implicitly commit, so design each migration for safe retry after partial completion; record a migration as applied only after its statements succeed. Do not destructively drop or reset tables.
- Add a separately explicit local test DSN; test setup must require this value and never silently fall back to `DATABASE_URL`. Integration/browser tests and cleanup must run solely against the local test schema. No E2E writes/deletes against the managed WebDev database.

## Login, security and runtime

Preserve public student registration, out-of-band teacher provisioning, bcrypt password hashing, server-verified roles, route protection, and JWTs only in HTTP-only cookies. Keep the existing cookie name unless a concrete platform conflict is found. For HTTPS Preview and the published site, the session cookie is `SameSite=None; Secure` regardless of `NODE_ENV` or the internal proxy request scheme; local plain-HTTP testing uses an explicit separate configuration. Do not enable Preview auto-login or invent a user. Use the real login flow.

Configure required `JWT_SECRET` only through WebDev’s protected secret input, never a checked-in `.env`. Managed `DATABASE_URL` is platform-owned and must not be shadowed. Any initial production teacher password is also a protected, temporary bootstrap input; remove one-time credential variables after provisioning. Keep HTTPS, Helmet, body limits, auth rate limits, ownership checks, and safe error responses. The unauthenticated health endpoint returns success only when the application is ready enough to serve.

## Container, Preview, and publication

The root Dockerfile installs from the committed npm workspace lockfile, builds the web workspace, and starts the Express production entrypoint. Respect the platform-supplied `PORT`; expose 3000 as the documented local/default container port. Declare the required container health path as an unauthenticated success response. The public site is a container deployment backed by the persistent managed MySQL service; no separate static build contract is needed because Express serves the compiled assets.

Development Preview listens on configured port 3000 at `0.0.0.0`. Keep the React page route manifest synchronized with the source and verify `/manus-routes.json` returns JSON, not SPA fallback HTML. Keep APIs, health, and the Vite development server distinct from browser page routes.

The user's ask is for a permanent website URL; use the platform's normal published domain and publish only after a canonical-main checkpoint exists. Do not turn on always-on hosting or auto-publish. The default on-demand deployment may sleep while idle and exhibit a cold start; a durable URL and managed database do not mean uninterrupted process residency. Report the published URL only after the Publish job reports success. Set a durable HTTPS project-logo URL in `app.config.ts` before the checkpoint.

## Iteration workflow and constraints

Maintain `docs/TEST_LOG.md` (`Test ID | Module | Input | Expected | Actual | Status`), `docs/BUG_LOG.md` (`Issue ID | Description | Severity | Root Cause | Fix | Status | Date`), `CHANGELOG.md`, and `docs/DECISIONS.md`. Each iteration follows Plan → Build → Test using real runs → Fix → Document → Commit → Report. Do not pass an iteration with failed checks or open High/Critical issues. Never run student code outside a configured sandbox. No out-of-plan feature without a recorded decision. Mark unavailable validation as untestable; do not manufacture counts, results, or dates.

## Repository layout

- `legacy-prototype/LabTrack/` — vanilla localStorage faculty-register prototype; demo-only and not the authenticated platform.
- `apps/web/` — React/Vite/Tailwind authenticated UI, route manifest, assignment views, and later Monaco workspace.
- `apps/api/` — Express API, config, cookie auth, role checks, MySQL repositories, migration entry point and later sandbox/optional AI adapters.
- `db/migrations/` — MySQL schema history for users and assignments, then later iteration tables.
- `scripts/` — safe local migrations, teacher provisioning, isolated browser-test server, and build/run commands.
- `tests/` — Node unit tests, isolated local-MySQL API integration tests, and Chromium/browser flows.
- `docs/ui-reference/` — supplied screen HTML, screenshots and design specification; preserve them unchanged.
- `docs/` — decisions, test log and bug log.

## Preserved visual system

Follow the supplied Academic Precision design and existing React screens without redesign: dense but legible institutional data, explicit state labels, clear navigation, and human review. Retain navy navigation, restrained teal actions, cool light surfaces, Inter interface text, and JetBrains Mono for technical metadata. Keep the provided layouts and responsive behavior. Treat screenshot demo numbers and dates as presentation placeholders, not live product facts. Similarity language must remain neutral and non-verdictive.

## Original feature sequence

0. Fix the faculty register's blank records/students, duplicate IDs, completion count, filters, and dates; create the repository structure and preserve source under `legacy-prototype/`.
1. Backend/database, student and teacher login, roles, route protection.
2. Assignment management, student dashboard, assignment viewer.
3. Code editor and sandboxed execution; per-test results, time, memory, errors, limits.
4. AI-use declaration, explanation and annotation with mandatory validation.
5. Token-based similarity fingerprints, matched segments and teacher-set threshold; flags only.
6. Rubric scoring, final marks, teacher marking interface.
7. Submission history, student-wise results, reports, CSV/print export.
8. Optional declared AI assistance, logged against declaration.
9. Security, load/responsive checks, final regression and documentation.

Iterations 0–2 are already implemented and have prior real-test evidence in the source repository. The website task transports and revalidates that current scope after the database and runtime port; it does not mark Iterations 3–9 complete.
