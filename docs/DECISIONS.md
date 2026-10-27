# Decisions

## D-001 — Keep the supplied UI archive as the visual source of truth

**Date:** 2026-10-14
**Decision:** Preserve the extracted Stitch archive at `docs/ui-reference/stitch_labtrack_dsa_evaluation_platform/`. It contains 11 screen folders, each with a source `code.html` and `screen.png`, plus `academic_precision/DESIGN.md`. The supplied UI is a required reference, not a prompt to redesign.
**Reason:** The request explicitly says to match the supplied screens, layout, colors, and components.
**Consequence:** Each implemented page must be compared with its corresponding reference. Any genuinely missing screen uses this system and is noted here before implementation.

## D-002 — Resolve the palette discrepancy from the reference code, not by inventing a hybrid

**Date:** 2026-10-14
**Decision:** For implementation, treat the theme values actually used by supplied `code.html` files as the exact screen token source. The teacher dashboard HTML uses primary `#03224D`, primary-container `#1F3864`, secondary `#006972`, and surface `#F8F9FF`; the prose in `academic_precision/DESIGN.md` also describes navy `#1F3864`, teal `#0E7C86`, and canvas `#F8FAFC`. Keep the difference visible in documentation; do not silently mix the two palettes.
**Reason:** The request prioritizes matching the supplied screens. The HTML theme is the closest implementation-level color specification.
**Consequence:** If later inspection establishes that a screen screenshot is the decisive variant for a specific route, record that route-level resolution here before styling it.

## D-003 — Build the faculty register from scratch because the original was not supplied

**Date:** 2026-10-14
**Decision:** No pre-existing `LabTrack_Prototype/LabTrack` source was found in the workspace or in the attached archive. After being asked for the source, the user explicitly instructed: “no you have to build it from scratch just refer the ui”. Therefore `legacy-prototype/LabTrack/` is a new vanilla HTML/CSS/JS faculty-register prototype, not a repaired copy of an original. It uses localStorage and labelled demo data, with no login, backend, or code execution.
**Reason:** This follows the user's clarification while keeping the first iteration bounded to the faculty register and visual reference.
**Consequence:** The project does not claim to preserve an unavailable original. Its new baseline and tests are recorded as such.

## D-004 — Iteration boundaries

**Date:** 2026-10-14
**Decision:** Complete Iteration 0 first, then begin Iteration 1 only after the final Iteration 0 suite passes and no High/Critical bugs remain open. The React app, backend, database integration, authentication, student code execution, and later capabilities are not represented as implemented in Iteration 0.
**Reason:** The user requires a pass-and-bug gate between iterations.
**Consequence:** Later requirements remain in `plan.md` and `TODO.md` and will be implemented in their assigned iteration.


## D-005 — Restrict public role self-assignment

**Date:** 2026-10-14
**Decision:** Public registration creates student accounts only. Teacher accounts are provisioned by an explicit backend command using values from local `.env`; there is no public teacher role selector.
**Reason:** A user can otherwise grant themselves teacher privileges, defeating RBAC. The user requested student/teacher login and roles but did not define teacher onboarding; this least-privilege assumption is easy to change if the course later supplies an approved invitation process.
**Consequence:** The teacher login works only for a teacher account provisioned out of band.

## D-006 — Configure auth-cookie policy explicitly

**Date:** 2026-10-14
**Decision:** Cookie security and SameSite attributes are explicit configuration, not inferred from `req.secure` or `NODE_ENV`. Local HTTP defaults to `SameSite=Lax` and `Secure=false`; public HTTPS configuration must set `SameSite=None` and `Secure=true`.
**Reason:** The app can run behind a proxy where the backend request protocol differs from the user's HTTPS origin, and cross-site Preview cookies require `None; Secure`.
**Consequence:** Deployment must configure the HTTPS cookie values explicitly and must not rely on request-protocol inference.


## D-007 — Apply a minimum password length

**Date:** 2026-10-14
**Decision:** Student registration and teacher provisioning require passwords of 12–128 characters.
**Reason:** The account stack needs a defined validation boundary; this is a conservative, user-adjustable baseline.
**Consequence:** The API returns a validation error for passwords outside that range; no password value is logged or stored in source.

## D-008 — Add baseline API login protections

**Date:** 2026-10-14
**Decision:** Add a request rate limit on login and Helmet security headers to the API.
**Reason:** These are low-impact safeguards for the requested public authentication surface, not additional user-facing product capabilities.
**Consequence:** Further threat modeling and hardening remain in Iteration 9.

## D-009 — Keep integration data isolated

**Date:** 2026-10-14
**Decision:** Run PostgreSQL integration tests against a distinct `labtrack_test` database and require `LABTRACK_TEST_DATABASE_URL`; do not fall back to the development connection.
**Reason:** Tests truncate test users and must never delete or modify development, shared, or production records.
**Consequence:** A test run fails closed if its dedicated test database URL is missing.


## D-010 — Reconstruct the administration screen from its supplied HTML

**Date:** 2026-10-14
**Decision:** The `labtrack_teacher_admin_dashboard_2/screen.png` in the supplied archive is black except for a small visible filter control, while its `code.html` contains the complete teacher administration page. Use the complete supplied HTML, the common design tokens, and the other relevant screen references to implement the intended assignment-management view. Do not copy the broken black screenshot as the page design.
**Reason:** The request requires matching all supplied screens; the archive includes usable source for the intended layout despite one invalid screenshot.
**Consequence:** Record a focused visual comparison against the reference HTML and preserve the noted mismatch rather than claiming pixel verification against the unusable screenshot.

## D-011 — Use persisted facts, not screenshot placeholder metrics

**Date:** 2026-10-14
**Decision:** Assignment rows, dashboard counts, topics, and deadline dates in the React application come from PostgreSQL/API responses. Do not copy the reference's illustrative student scores, test-pass counts, cohort analytics, or past hard-coded dates as live data. Where submissions/grades/execution do not exist yet, omit the value or label that later-iteration capability as unavailable.
**Reason:** The reference code contains presentation sample values; LabTrack's objective is evidence-centered evaluation and the required development rule prohibits fabricated test results, counts, or dates.
**Consequence:** Keep the visual hierarchy, table/card shapes and status language, but bind displayed facts to real records and render an explicit empty state when none exist.

## D-012 — Assignment publication governs student visibility

**Date:** 2026-10-14
**Decision:** Assignments have `draft`, `published`, and `archived` states. Teacher-owned records are created as drafts; teachers may edit drafts and publish or archive their own records. Student routes return only published assignments. Draft and archive state transitions remain teacher-only.
**Reason:** The requested assignment-management and student-viewing surfaces need a clear access rule; this minimal workflow prevents students seeing unfinished specifications and is consistent with the supplied admin/student references.
**Consequence:** The API enforces ownership and role checks, and UI actions reflect the persisted state. An archive is not a deletion and does not create submission behavior.


## D-013 — Reuse the supplied authentication design for student registration

**Date:** 2026-10-16
**Decision:** The supplied authentication reference presents a sign-in state rather than a separate registration screenshot. Student registration uses the same split-panel card, spacing, typography, colors, and form treatment; it adds only the required student fields and confirmation. Teachers remain out-of-band provisioned.
**Reason:** The user requires missing/unstated screens to follow the same design system and explicitly restricts public role assignment.
**Consequence:** Registration does not introduce a separate visual redesign or a public teacher-registration flow.

## D-014 — Teacher form convenience defaults are not demo records

**Date:** 2026-10-16
**Decision:** A newly opened teacher form defaults to course `CS301`, 100 maximum points, C++20 and Java 21, no sample cases, draft state, and a deadline seven days from the current client time. The teacher must save the form before any assignment row exists.
**Reason:** The references show these course/runtime conventions and require a fast, structured creation form, but do not specify initial values.
**Consequence:** These are editable form defaults, not seeded assignments, deadlines, grades, or test results. Persisted dashboard values continue to come only from PostgreSQL.

## D-015 — Keep browser E2E fixtures in the isolated test database

**Date:** 2026-10-16
**Decision:** The browser-test API launcher requires `LABTRACK_TEST_DATABASE_URL`, applies migrations there, sets test mode, and fails closed when that URL is missing. E2E teacher provisioning and cleanup use that same URL rather than `DATABASE_URL`.
**Reason:** The browser flow creates users and assignments and must not mutate development or production records.
**Consequence:** Run the browser suite only with the `api:browser` test launcher; run the normal development API separately for application development.


## D-016 — Run only saved assignment cases in Iteration 3

**Date:** 2026-10-16
**Decision:** Iteration 3 will report per-case Judge0 outcomes only for cases saved with an assignment and an expected output. These examples are not hidden tests and do not produce a full correctness grade. Do not create/generated hidden tests or label sample-case outcomes as comprehensive until a teacher-owned test-set model is explicitly added to scope.
**Reason:** Iteration 2 persists visible `sampleCases`, but the master plan does not yet define hidden-test authoring, access, or evaluation policy. The safe first behavior is to run only explicit saved cases and show their limited scope.
**Consequence:** The Iteration 3 editor and result panel may show sample-case outcomes, time, memory, and errors; rubric scoring and complete grading remain in Iteration 6.


## D-017 — Use WebDev-managed MySQL for the permanent website

**Date:** 2026-10-22
**Decision:** Follow the user's explicit authorization to replace PostgreSQL with WebDev-managed MySQL. Keep the users and assignments schema in additive, idempotent MySQL migrations and use the project-provided connection at runtime. Do not import a PostgreSQL dump or run automated E2E writes against the shared managed database.
**Reason:** WebDev's persistent database capability is MySQL-compatible, and the user selected it for the permanent deployment.
**Consequence:** The managed database was confirmed empty before the initial migration. Migrations `001_create_users.sql` and `002_create_assignments.sql` were applied under `GET_LOCK`; all automated MySQL integration and browser fixtures remain isolated to loopback test MySQL.

## D-018 — Require TLS for every non-loopback MySQL DSN

**Date:** 2026-10-22
**Decision:** A local `MYSQL_SSL=false` setting may disable TLS only for loopback MySQL. Every non-loopback host uses TLS, and explicit managed migration/provisioning commands set TLS regardless of `.env`.
**Reason:** The first live migration was rejected before DDL because a local plaintext flag was inherited by the managed target. Remote MySQL requires secure transport.
**Consequence:** The shared pool enforces TLS for remote hosts and has a regression test. The corrected managed connection passed the TLS and migration-lock preflight and applied both initial migrations.

## D-019 — Keep provisioning output free of teacher identifiers

**Date:** 2026-10-22
**Decision:** The teacher provisioner reports only whether provisioning succeeded and the explicitly selected target; it does not print the teacher's email.
**Reason:** Bootstrap identities are operational inputs and are not needed in terminal logs to establish success. Browser fixtures now assert the generic success message instead of matching the email.
**Consequence:** Protected values remain out of source and logs, and the test harness retains its success check without echoing identifying data.
