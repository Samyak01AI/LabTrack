# LabTrack

LabTrack is a DSA assignment and evaluation platform for students and teachers. Iterations 0–2 are implemented: a separate vanilla faculty-register prototype, student/teacher login and role-based access control, teacher assignment management, the student dashboard, and assignment viewing. The faculty-register source was not supplied; at the user's direction it was built from scratch using the Stitch UI references. It uses labelled demo data and localStorage and is not connected to the authenticated application.

The application backend, migrations, and tests use MySQL. The hosted website uses WebDev-managed MySQL; local development and automated tests use loopback MySQL databases. Student pages show published assignments only. Public registration creates student accounts; teachers are provisioned out of band. Code submission and execution, AI-use declarations, similarity checks, and grading are not implemented yet. Student code must run only in Judge0 after Iteration 3 is implemented and configured.

## Run locally

1. Use Node.js 22+ and npm 10+, plus a local MySQL server. Install Python Playwright and Chromium only if running browser tests.
2. Copy `.env.example` to `.env`. Keep `DATABASE_URL` and `LABTRACK_LOCAL_DATABASE_URL` pointed at a loopback development database; set `LABTRACK_TEST_DATABASE_URL` to a separate loopback test database and use a private `JWT_SECRET` of at least 32 characters. `.env` is ignored by Git. Never use the managed WebDev database for automated test writes or cleanup.
3. Install with `npm install`, then apply local migrations explicitly: `LABTRACK_MIGRATION_TARGET=local npm run db:migrate`.
4. Run `npm run api:dev` to start the unified Express service with Vite middleware on port 3000. `GET /api/health` checks API/database readiness. The local HTTP cookie settings in `.env.example` are separate from the HTTPS Preview settings. Run the vanilla prototype separately with `npm run serve:prototype` on port 4173.
5. To create a local teacher, put `TEACHER_NAME`, `TEACHER_EMAIL`, and a 12–128-character `TEACHER_PASSWORD` only in the ignored local `.env`, then run `LABTRACK_PROVISION_TARGET=local npm run provision:teacher`.

## Checks

- `npm test` — Node unit tests for student validation, completion counts, filters, date rules, and other root-level regressions.
- `npm run test:api` — MySQL integration tests using `LABTRACK_TEST_DATABASE_URL`; the suite requires its isolated test database and does not fall back to the managed connection.
- `npm run web:build` — production React/Vite/Tailwind asset build.
- `npm run test:browser` — Playwright checks for both the legacy prototype and authenticated React flows. Start the prototype with `npm run serve:prototype` and the test-only unified server with `npm run api:browser` first. The browser API launcher refuses non-loopback/non-MySQL test URLs, overrides `DATABASE_URL` for its process, and browser fixtures are cleaned up from that isolated test database.
- `npm audit --audit-level=high` — dependency security audit.

The deployment image is built by the root `Dockerfile`; Express serves both `/api` and the compiled React app from one origin. Release results and real test runs are recorded in `docs/TEST_LOG.md`, defects in `docs/BUG_LOG.md`, decisions in `docs/DECISIONS.md`, and changes in `CHANGELOG.md`. The Stitch UI references remain under `docs/ui-reference/`.

## Planned work

Iteration 3 adds the C++/Java editor and sandboxed Judge0 execution with per-test results, runtime, memory, errors, and time limits. Later iterations add mandatory AI-use disclosure and explanation, similarity review flags (never AI-authorship claims or automatic failures), rubric marking, results/reports, optional backend-only AI assistance (off by default), and release hardening. Follow [plan.md](plan.md) and [TODO.md](TODO.md) for the full scope and iteration gates.
