# LabTrack

LabTrack is an Integrated DSA Assignment and Evaluation Platform with Responsible AI Assistance for students and teachers (Dept. of Computer Engineering, AY 2026–27). Iterations 0–8 are implemented: a separate vanilla faculty-register prototype, student/teacher login and role-based access control, teacher assignment management, student dashboard and assignment viewing, the student code workspace with sandboxed execution through Judge0, mandatory constructive AI-use declarations, code annotations, conceptual logic defense, structure-aware token-based similarity reviews with winnowing and boilerplate suppression, an integrated teacher evaluation workbench with multi-component rubric scoring, provisional marks, and student scorecards, student submission history with cohort performance analytics, score distribution histograms, RFC 4180 CSV exports, print-ready moderation ledgers, and optional declared in-platform generative AI assistance with strict Socratic pedagogical guardrails, hourly rate limiting, and automated attribution. The faculty-register source was not supplied; at the user's direction it was built from scratch using the Stitch UI references. It uses labelled demo data and localStorage and is not connected to the authenticated application.

The application backend, migrations, and tests use MySQL. The hosted website uses WebDev-managed MySQL; local development and automated tests use loopback MySQL databases. Student pages show published assignments only. Public registration creates student accounts; teachers are provisioned out of band. Student code executes exclusively within the Judge0 sandbox (never directly on the host application process). Final release hardening, performance profiling, and audit verification are scheduled for Iteration 9.

## Run locally

1. Use Node.js 22+ and npm 10+, plus a local MySQL server. Install Python Playwright and Chromium only if running browser tests.
2. Copy `.env.example` to `.env`. Keep `DATABASE_URL` and `LABTRACK_LOCAL_DATABASE_URL` pointed at a loopback development database; set `LABTRACK_TEST_DATABASE_URL` to a separate loopback test database and use a private `JWT_SECRET` of at least 32 characters. `.env` is ignored by Git. Never use the managed WebDev database for automated test writes or cleanup. Optionally configure `JUDGE0_API_URL` and `JUDGE0_API_KEY` for live sandboxed execution.
3. Install with `npm install`, then apply local migrations explicitly: `LABTRACK_MIGRATION_TARGET=local npm run db:migrate`.
4. Run `npm run api:dev` to start the unified Express service with Vite middleware on port 3000. `GET /api/health` checks API/database readiness. The local HTTP cookie settings in `.env.example` are separate from the HTTPS Preview settings. Run the vanilla prototype separately with `npm run serve:prototype` on port 4173.
5. To create a local teacher, put `TEACHER_NAME`, `TEACHER_EMAIL`, and a 12–128-character `TEACHER_PASSWORD` only in the ignored local `.env`, then run `LABTRACK_PROVISION_TARGET=local npm run provision:teacher`.

## Checks

- `npm test` — Node unit tests for student validation, completion counts, filters, date rules, submissions schemas, Judge0 adapter, AI declarations, tokenization, winnowing, boilerplate suppression, similarity checks, rubric scoring, audit reopening, cohort statistics, RFC 4180 CSV export, pedagogical AI assistance guardrails, rate limiting, and root-level regressions.
- `npm run test:api` — MySQL integration tests using `LABTRACK_TEST_DATABASE_URL`; the suite requires its isolated test database and does not fall back to the managed connection.
- `npm run web:build` — production React/Vite/Tailwind asset build including the 4-step DSA workbench, teacher review screens, similarity workbench, 3-pane teacher marking workbench, student submission history, cohort reporting views, and Socratic AI assistant tabs.
- `npm run test:browser` — Playwright checks for both the legacy prototype and authenticated React flows. Start the prototype with `npm run serve:prototype` and the test-only unified server with `npm run api:browser` first. The browser API launcher refuses non-loopback/non-MySQL test URLs, overrides `DATABASE_URL` for its process, and browser fixtures are cleaned up from that isolated test database.
- `npm audit --audit-level=high` — dependency security audit.

The deployment image is built by the root `Dockerfile`; Express serves both `/api` and the compiled React app from one origin. Release results and real test runs are recorded in `docs/TEST_LOG.md`, defects in `docs/BUG_LOG.md`, decisions in `docs/DECISIONS.md`, and changes in `CHANGELOG.md`. The Stitch UI references remain under `docs/ui-reference/`.

## Planned work

Iteration 9 delivers end-to-end auditability, performance profiling, responsive cross-device verification, documentation consolidation, and final release tagging for LabTrack v1.0.0. Follow [plan.md](plan.md) and [TODO.md](TODO.md) for the full scope and iteration gates.
