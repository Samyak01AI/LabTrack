# Changelog

All notable changes to this project will be documented in this file.

## [v1.0.0] — 2026-10-29

### Added
- **Full-Spectrum End-to-End Workflow Integration Test Suite** (`tests/iteration-9-hardening.test.mjs`):
  - Validates the complete academic core loop: Teacher assignment creation → Student code execution via Judge0 sandbox → 4-step stepper (Code, AI Declaration, Line Annotations, Logic Defense) → Token-based similarity & winnowing review → Multi-component rubric grading (40/30/15/15) → Provisional mark flow & audit reopening → Student scorecards → Cohort performance analytics & RFC 4180 CSV export.
- **Security & Non-Negotiable Policy Audit** (`tests/iteration-9-hardening.test.mjs`):
  - Codebase-wide automated regex scan verifying zero AI-detection probability claims or auto-fail routines.
  - Verification that student code never executes on host server (Judge0 sandbox adapter only).
  - Verification that marks remain provisional until explicit human instructor action.
  - Verification of strict RBAC isolation across all endpoints.
- **Database Schema & Index Audit** (`tests/iteration-9-hardening.test.mjs`):
  - Verification of all 7 migrations (`001_create_users.sql` through `007_ai_assistance_logs.sql`) with primary keys, foreign key cascade rules, check constraints, and composite indexes.
- **Route Manifest Synchronization** (`tests/iteration-9-hardening.test.mjs`):
  - Verification of `apps/web/public/manus-routes.json` synchronization with React Router route table.
- **Architecture Decision D-026** (`docs/DECISIONS.md`): Formally documented the Release Hardening, Audit Verification, and v1.0.0 Production Baseline.

### Changed
- `package.json`: Version bumped to v1.0.0 (Production Release).
- `README.md` and `TODO.md`: Updated to reflect full completion of Iterations 0–9.


## [v0.9.0] — 2026-10-28

### Added
- **Pedagogical Generative AI Service** (`apps/api/src/ai/service.js`):
  - Socratic guidance engine providing structured assistance across 3 modes: Conceptual Hints (`hint`), Debugging Guides (`debug`), and Asymptotic Complexity Analysis (`complexity`).
  - Strict solution refusal guardrail (`isAskingForFullSolution`) that detects requests to write code or complete solutions and redirects to invariant inquiry.
  - Output code sanitizer (`sanitizePedagogicalOutput`) that redacts code blocks longer than 4 lines to preserve independent problem-solving.
  - Safe, deterministic offline mock simulator allowing offline local execution and test suite runs without external network dependencies.
  - Google Gemini API provider adapter with structured system prompts and temperature controls when `LLM_API_KEY` is provided.
- **Database Schema Migration 007** (`db/migrations/007_ai_assistance_logs.sql`):
  - Created `ai_assistance_logs` table with columns for `id`, `assignment_id`, `student_id`, `mode`, `prompt`, `response`, `code_snippet`, `tokens_used`, and `created_at`.
  - Added CHECK constraint restricting modes to `'hint'`, `'debug'`, and `'complexity'`.
  - Added composite index `idx_ai_logs_rate_limit` on `(student_id, assignment_id, created_at)` for sub-millisecond rate limit lookups.
- **AI Audit & Rate Limiting Repository** (`apps/api/src/ai/repository.js`):
  - `logInteraction()`: Persists student queries and pedagogical responses.
  - `getRecentHourlyCount()`: Computes student queries in the trailing 1-hour window.
  - `getStudentLogs()`: Returns interaction history for student workspace.
  - `getTeacherAuditLogs()`: Exposes full interaction transcripts for instructor evaluation.
- **AI Assistance API Endpoints** (`apps/api/src/ai/routes.js`):
  - Student: `GET /api/student/assignments/:id/ai-status` (feature flag and hourly limit status), `GET /api/student/assignments/:id/ai-logs` (previous queries), and `POST /api/student/assignments/:id/ai-assist` (query pedagogical assistant with rate limit check).
  - Teacher: `GET /api/teacher/assignments/:assignmentId/students/:studentId/ai-logs` (inspected student transcript) with strict assignment ownership verification.
  - Strict feature flag enforcement: returns HTTP 503 when `ENABLE_AI_ASSISTANCE` is false; returns HTTP 429 when hourly query limit (default 5/hr) is exceeded.
- **Workspace Socratic Assistant UI** (`apps/web/src/pages/CodeWorkspacePage.jsx`):
  - Added `AI Socratic Assistant` workbench tab with mode selector (`Conceptual Hint`, `Debugging Guide`, `Complexity Analysis`), queries remaining counter, conversation transcript viewer, quick suggestion chips, and query input bar.
  - Policy disabled banner when feature flag is off.
  - Automatic attribution: each assistant inquiry automatically sets `aiDeclaration.aiUsed = true`, appends `'LabTrack In-Platform AI Assistant'` to declared tools, and appends the query summary to usage narrative.
  - Step 2 in-platform inquiries audit card reviewing logged questions.
- **Teacher Marking In-Platform AI Audit View** (`apps/web/src/pages/TeacherMarkingPage.jsx`):
  - Added `In-Platform AI Assistant Inquiries` audit card in the AI Disclosure inspection tab displaying verified student query transcripts, modes, and timestamps.
- **Iteration 8 Automated Test Suite** (`tests/iteration-8-ai-assistance.test.mjs`):
  - 9 comprehensive unit tests covering solution refusal detection, Socratic mode outputs, code redaction, mock query round-trips, hourly rate limiting, auto-attribution formatting, migration 007 DDL, and hard rule compliance.
- **Architecture Decision D-025** (`docs/DECISIONS.md`): Formally documented the Optional Declared AI Assistance & Pedagogical Guardrails architecture.

### Changed
- `apps/api/src/config.js` and `.env.example`: Added configuration variables for `ENABLE_AI_ASSISTANCE`, `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, and `AI_RATE_LIMIT_HOURLY_MAX`.
- `apps/api/src/app.js`: Mounted `createStudentAiRouter` and `createTeacherAiRouter`.
- `package.json`: Version bumped to v0.9.0.


## [v0.8.0] — 2026-10-28

### Added
- **Cohort Analytics & Statistical Engine** (`apps/api/src/reporting/analytics.js`):
  - Arithmetic Mean, Median, and Sample Standard Deviation with Bessel's correction $N-1$.
  - Benchmark Pass Rate ($\ge 60\%$) computed over evaluated submissions.
  - 5-interval score distribution histogram bins ($<60$, $60–69$, $70–79$, $80–89$, $90–100$).
  - AI declaration rate and similarity flag rate cohort calculations.
  - Robust handling of edge cases: empty cohorts $N=0$, single submission $N=1$, identical marks $\sigma=0$.
  - RFC 4180 compliant CSV export generator with UTF-8 byte order mark (`\uFEFF`) for Microsoft Excel.
- **Reporting Database Repository** (`apps/api/src/reporting/repository.js`):
  - `getStudentSubmissionHistory(studentId, assignmentId)`: Reverse-chronological timeline of student attempts (drafts and final submissions), test results, declared AI attributions, annotations count, and grade scorecards.
  - `getCohortResults(assignmentId)`: Deduplicated latest final submission per student joined with evaluation grades, rubric breakdown, and similarity review flags.
- **Reporting API Endpoints** (`apps/api/src/reporting/routes.js`):
  - Student: `GET /api/student/submissions/history` and `GET /api/student/submissions/history/export`.
  - Teacher: `GET /api/teacher/assignments/:assignmentId/cohort-metrics`, `GET /api/teacher/assignments/:assignmentId/cohort-results`, and `GET /api/teacher/assignments/:assignmentId/export/csv`.
- **Student Submission History UI** (`apps/web/src/pages/StudentSubmissionHistoryPage.jsx`): Matching `docs/ui-reference/labtrack_student_submission_history/` with metrics bento (Total Submissions, Evaluation Pipeline, Average Grade, Academic Integrity), filter console (All / Final / Draft, search), submissions table, and snapshot inspection modal.
- **Teacher Course Evaluation Ledger & Reports UI** (`apps/web/src/pages/TeacherReportsPage.jsx`): Matching `docs/ui-reference/labtrack_results_reports/` with assignment dropdown selector, score distribution histogram with median and top quartile benchmark lines, secondary stats band, KPI performance cards, filter workbench, results ledger table, breakdown modal, and print/PDF layout with faculty moderation sign-off block.
- **Iteration 7 Automated Test Suite** (`tests/iteration-7-reporting.test.mjs`): 9 comprehensive unit tests covering statistical functions, RFC 4180 escaping, UTF-8 BOM, RBAC ownership isolation, UI components, and platform safeguards.
- **Architecture Decision D-024** (`docs/DECISIONS.md`): Formally documented the Submission History and Cohort Reporting Architecture.

### Changed
- `apps/web/src/components/AppShell.jsx`: Added "History" navigation link for students and "Reports" navigation link for teachers.
- `apps/web/src/app/App.jsx`: Mounted `/student/history`, `/teacher/reports`, and `/teacher/assignments/:assignmentId/reports`.
- `apps/web/src/pages/TeacherAssignmentsPage.jsx`: Added "Reports" action link to assignment management rows.
- `apps/web/public/manus-routes.json`: Added routes for student history and teacher reports.
- `package.json`: Version bumped to v0.8.0.

### Fixed
- `I7-STAT-001`: Fixed un-graded pending submissions skewing class average and pass rate by computing stats over evaluated records.
- `I7-CSV-001`: Fixed Microsoft Excel garbling UTF-8 text on Windows by prefixing CSV downloads with byte order mark (`\uFEFF`).


## [v0.7.0] — 2026-10-28

### Added
- **Multi-Component Rubric Scoring Engine** (`apps/api/src/grading/rubric.js`): Combines automated correctness (Judge0 test results, 0–40 pts), algorithmic approach defense (0–30 pts), data structure & complexity bounds (0–15 pts), and constructive AI transparency adherence (0–15 pts). Provides `computeProvisionalGrade()` and score boundary validation.
- **Database Schema Migration 006** (`db/migrations/006_grades_and_evaluations.sql`): Added `grades` table with component scores, total score, max score, status (`'pending_review'`, `'provisionally_scored'`, `'finalised'`, `'reopened'`), rubric JSON, feedback text, reopen reason, and timestamps.
- **Teacher Marking API Endpoints** (`apps/api/src/grading/routes.js`): Added `GET /api/teacher/assignments/:assignmentId/submissions-queue`, `GET /api/teacher/submissions/:submissionId/evaluation`, `POST /api/teacher/submissions/:submissionId/evaluate` (save provisional / finalise mark), and `POST /api/teacher/submissions/:submissionId/reopen` (audit-logged reopening).
- **Student Scorecard Endpoint** (`apps/api/src/grading/routes.js`): Added `GET /api/student/assignments/:assignmentId/scorecard` displaying itemized category scores, provisional notices, and qualitative feedback.
- **Teacher Marking Workbench UI** (`apps/web/src/pages/TeacherMarkingPage.jsx`): 3-pane interface matching `docs/ui-reference/labtrack_teacher_marking_interface/`:
  - *Pane 1:* Filterable submissions queue with status indicators and quick student switchers.
  - *Pane 2:* Inspection viewport with tabs for Code Inspector, Test Telemetry, AI Disclosure, Logic Defense, and Annotations.
  - *Pane 3:* Rubric scoring sliders, live total score computation, teacher feedback textarea, and Provisional / Finalise / Reopen buttons.
- **Student Scorecard View** (`apps/web/src/pages/AssignmentViewerPage.jsx`): Itemized scorecard card with status badge (PROVISIONAL vs TEACHER FINALISED), category score cards, and instructor feedback.
- **Iteration 6 Automated Test Suite** (`tests/iteration-6-grading.test.mjs`): 7 unit tests covering provisional calculation, proportional test scaling, score capping, weight sums, audit reopening transitions, schema DDL, and hard rule compliance.
- **Architecture Decision D-023** (`docs/DECISIONS.md`): Formally documented the Teacher Evaluation, Rubric Scoring, and Provisional Marks Workflow.

### Changed
- `apps/web/src/pages/TeacherAssignmentsPage.jsx`: Added "Marking" action button linking directly to the assignment's marking queue.
- `apps/web/src/app/App.jsx`: Mounted teacher marking workbench routes (`/teacher/assignments/:assignmentId/marking` and `/teacher/submissions/:submissionId/marking`).
- `apps/api/src/app.js`: Mounted `createTeacherGradingRouter` and `createStudentGradingRouter`.
- `package.json`: Version bumped to v0.7.0.

## [v0.6.0] — 2026-10-28

### Added
- **Token-Based Lexer & Canonical Tokenizer** (`apps/api/src/similarity/tokenizer.js`): Full lexer for C++20 and Java 21 stripping comments/whitespace, preserving control-flow keywords and operators, normalizing identifiers to canonical placeholder `V` (alpha-conversion), and normalizing string/numeric/character/boolean literals to `S`/`N`/`C`/`B`.
- **K-Gram Rolling Hash & Winnowing Algorithm** (`apps/api/src/similarity/winnowing.js`): Deterministic 32-bit polynomial rolling hash ($k = 5$) and sliding window winnowing algorithm ($w = 4$) with rightmost-minimum selection.
- **Starter Template Boilerplate Suppression** (`apps/api/src/similarity/winnowing.js`): Automatic extraction of starter template $k$-grams to filter shared boilerplate out of student fingerprints, eliminating false-positive similarity on standard templates (`BUG_05`).
- **Pairwise Similarity Engine** (`apps/api/src/similarity/engine.js`): Structure-aware similarity engine computing Jaccard token overlap, containment, AST isomorphism, variable renaming detection (`High (Alpha-converted)` / `Moderate` / `None`), control-flow divergence, and matched code clusters.
- **Database Schema Migration 005** (`db/migrations/005_similarity_reviews.sql`): Added `similarity_reports` table with foreign keys, unique constraint on pairs, and CHECK constraint on status (`'flagged'`, `'reviewed'`, `'dismissed'`).
- **Teacher Similarity API Endpoints** (`apps/api/src/similarity/routes.js`): Added `GET /api/teacher/assignments/:assignmentId/similarity` (list pairs), `POST /api/teacher/assignments/:assignmentId/similarity/run` (recalculate similarity), `GET /api/teacher/similarity/:id` (pair inspection), and `PATCH /api/teacher/similarity/:id` (save teacher notes / update status) with strict teacher ownership verification.
- **Dual-Pane Similarity Comparison Workbench UI** (`apps/web/src/pages/SimilarityReviewPage.jsx`): Matching `docs/ui-reference/labtrack_similarity_comparison/` with AST sensitivity slider (50%–95%), dual code inspector with matched line highlights and cluster banners, structural equivalence cards, oral examination recommendation banner, and teacher evaluation notes textarea.
- **Iteration 5 Automated Test Suite** (`tests/iteration-5-similarity.test.mjs`): 8 comprehensive unit and integration tests covering tokenizer normalization, winnowing determinism, renamed variables/alpha-conversion (`TC_18`), independent algorithms (`TC_19`), boilerplate suppression (`BUG_05`), migration DDL, and non-negotiable review copy enforcement.
- **Architecture Decision D-022** (`docs/DECISIONS.md`): Formally documented the Token-Based Similarity Review & Winnowing Engine architecture.

### Changed
- `apps/web/src/pages/TeacherAssignmentsPage.jsx`: Added "Similarity" action link to assignment rows and enabled direct navigation to similarity reviews.
- `apps/web/src/app/App.jsx`: Mounted teacher similarity review routes (`/teacher/assignments/:assignmentId/similarity` and `/teacher/similarity/:reportId`).
- `apps/api/src/app.js`: Mounted `createTeacherSimilarityRouter` with role-based access control.
- `package.json`: Version bumped to v0.6.0.

### Fixed
- `TC_18`: Resolved variable renaming and whitespace variations bypassing text diffs by implementing structure-aware token normalization and winnowing.
- `TC_19`: Resolved false-positive risk on independent solutions by coupling winnowing with Jaccard containment and AST sensitivity threshold ($< 30\%$ on independent solutions).
- `BUG_05`: Fixed template boilerplate inflating similarity scores by implementing starter template fingerprint suppression (0% similarity on template-only code).

## [v0.5.0] — 2026-10-28

### Added
- **AI-Use Declaration Workflow (Step 2)** (`apps/web/src/pages/CodeWorkspacePage.jsx`): Interactive declaration choice between independent authoring and AI-assisted problem solving, with multi-tool selection (GitHub Copilot, ChatGPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro, Phind, Cursor, Local LLM) and usage narrative.
- **Code Annotations Feature** (`apps/web/src/pages/CodeWorkspacePage.jsx`): Code viewer with line numbers and highlighted AI-assisted line ranges, paired with annotation cards recording student-provided justifications and model citations.
- **Conceptual Logic & Algorithmic Defense (Step 3)** (`apps/web/src/pages/CodeWorkspacePage.jsx`): Structured defense fields for algorithmic invariants, trade-off analysis, and data structure complexity with real-time character counters and technical depth validation.
- **Review & Submit Screen (Step 4)** (`apps/web/src/pages/CodeWorkspacePage.jsx`): Pre-submission readiness audit and comprehensive summary review ensuring all declaration, annotation, and logic defense criteria are satisfied before submission.
- **Database Schema Migration 004** (`db/migrations/004_iteration_4_declarations.sql`): Added `ai_declaration`, `logic_explanation`, `annotations`, `annotation_status`, `is_final`, and `submitted_at` columns with CHECK constraints.
- **Submission Snapshot Immutability** (`apps/api/src/submissions/repository.js`): Finalized submissions are saved as immutable records (`is_final = 1`, `submitted_at = UTC_TIMESTAMP(3)`); subsequent draft edits never alter previous submission snapshots.
- **Teacher Submission Inspection View** (`apps/web/src/pages/TeacherAssignmentsPage.jsx`): Teacher drawer to inspect student submissions, view AI-use declarations, review line-annotated code ranges, and evaluate conceptual logic defenses.
- **Iteration 4 Automated Test Suite** (`tests/iteration-4-declarations.test.mjs`): 6 comprehensive unit tests covering annotation status logic, validation matrix, partial draft saving, schema DDL, language switch safety, and snapshot immutability.
- **Architecture Decision D-021** (`docs/DECISIONS.md`): Formally documented the Constructive AI Disclosure Protocol and 4-step submission pipeline.

### Changed
- `apps/api/src/submissions/routes.js`: Enforced server-side validation rejecting final submissions missing declarations, unannotated AI submissions, or explanations under 60 characters.
- `package.json`: Version bumped to v0.5.0.

### Fixed
- `TC_07`: Fixed language switch bug in editor by isolating `codeBuffers` per language, preventing code overwrite when toggling C++20 and Java 21.
- `TC_14`: Fixed missing AI declaration enforcement on final submissions.
- `TC_15`: Fixed persistence of AI declarations, annotations, and logic defense text.

## [v0.4.0] — 2026-10-28

### Added
- **Student Code Workspace & Test Harness** (`apps/web/src/pages/CodeWorkspacePage.jsx`): Multi-language in-browser editor for C++20 and Java 21 with line numbers, monospace font, indentation support, and responsive problem brief drawer matching `labtrack_code_workspace_test_harness` Stitch UI reference.
- **Submissions & Sandbox API** (`apps/api/src/submissions/`): Endpoints for submitting code and test runs (`POST /api/student/assignments/:id/submit`, `POST /api/student/assignments/:id/run`, `GET /api/student/assignments/:id/submissions`, `GET /api/student/assignments/:id/submissions/latest`).
- **Database Submissions Schema** (`db/migrations/003_create_submissions.sql`): Additive MySQL schema for submission tracking, results JSON, execution duration, memory, and compiler output.
- **Judge0 CE Adapter** (`apps/api/src/submissions/judge0.js`): Isolated execution runner with strict sandbox enforcement and fallback to safe pending state when Judge0 is unconfigured.
- **Workspace Navigation** (`apps/web/src/pages/AssignmentViewerPage.jsx`): Activated "Open Code Workspace" banner linking directly to the DSA Workbench.
- **Iteration 3 Unit & Regression Tests** (`tests/iteration-3-submissions.test.mjs`): 7 automated assertions covering route manifests, schema integrity, Judge0 status mapping, language validation, rate limits, and host-exec prohibition.
- **Iteration Plan & History** (`docs/ITERATIONS.md`): Formally established the iteration tracking log documenting Iterations 0–2 completion and Iteration 3 tasks/acceptance tests.
- **Architecture Decision D-020** (`docs/DECISIONS.md`): Documented Code Workspace and Sandboxed Execution design boundaries.

### Changed
- `apps/api/src/app.js`: Expanded JSON body limit from 16kb to 256kb to accommodate realistic C++/Java source files.
- `tests/api/db-test-support.mjs`: Updated test cleanup order to clear `submissions` before `assignments` to satisfy foreign key constraints.
- `package.json`: Version bumped to 0.4.0.

### Fixed
- `I3-FK-001`: Prevented foreign key constraint errors during test database cleanup.
- `I3-PAYLOAD-001`: Prevented HTTP 413 Payload Too Large on source code submissions.
- `I3-DRAWER-001`: Fixed grid column adjustments when collapsing problem drawer.

### Release gate check — 2026-10-22

A fresh-process validation of the latest secure-card value still failed the 12–128 character rule. The final read-only managed TLS query returned 0 users, 0 assignments, and no matching teacher account; provisioning was not attempted. The schema is migrated, but teacher provisioning, bootstrap-key withdrawal, canonical checkpoint, and publication remain blocked.
