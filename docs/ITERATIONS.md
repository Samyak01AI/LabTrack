# LabTrack Iterations Plan & Log

## Completed Iterations

### Iteration 0 — Vanilla Faculty Register (COMPLETE)
- **Goal:** Standalone faculty register prototype matching teacher dashboard reference with client-side persistence and search/filter controls.
- **Scope:** Zero-backend prototype under `legacy-prototype/LabTrack/`, duplicate ID rejection, strict `Complete` status accounting, date range filters, empty state handling.
- **Exit Gate:** Verified with 8 root Node unit tests (`npm test`).

### Iteration 1 — Backend, Database & Access Control (COMPLETE)
- **Goal:** Full-stack Node.js/Express backend with MySQL database, password hashing, JWT HTTP-only cookies, and role-based access control.
- **Scope:** User schema and migration (`001_create_users.sql`), student registration, out-of-band teacher provisioning, login/logout, rate limiting, and RBAC middleware.
- **Exit Gate:** Verified with MySQL API integration suite and security audits.

### Iteration 2 — Assignment Management & Student Views (COMPLETE)
- **Goal:** Teacher assignment CRUD, publication lifecycle, and student dashboard/viewer.
- **Scope:** Assignment schema (`002_create_assignments.sql`), draft/published/archived states, student dashboard with real deadline and status counts, assignment viewer matching Academic Precision design system.
- **Exit Gate:** Verified with API integration tests, responsive browser verification at 390px and desktop, clean production Vite build.

### Iteration 3 — Code Workspace & Sandboxed Execution (COMPLETE)
- **Goal:** Student code workspace matching `docs/ui-reference/labtrack_code_workspace_test_harness/`.
- **Scope:** Submissions schema (`003_create_submissions.sql`), Judge0 CE sandbox adapter, per-test case outcome evaluation, compiler/console output tabs, draft autosave.
- **Exit Gate:** Verified with unit tests, Vite build, and hard rule enforcement (zero host code execution).

---

## Iteration 4 — AI-Use Declaration, Logic Explanation, Code Annotations (COMPLETE)

### Goal
Make the 4-step workflow's Steps 2–4 real, validated, persisted in MySQL, and visible to teachers.

### Requirements Covered
- **FR-401 (AI-Use Declaration):** Mandatory student attribution choice (*no AI used* / *AI used*). If AI used: multi-select tools (GitHub Copilot, ChatGPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro, Phind, Cursor, Local LLM, Other) and usage narrative.
- **FR-402 (Code-Assistance Annotations):** Interactive code annotation tool allowing students to tag AI-assisted line ranges with personalized justifications. Automatic calculation of `annotation_status`: `'not_required'` (no AI), `'complete'` (AI with annotations), `'incomplete'` (AI with 0 annotations).
- **FR-403 (Conceptual Logic & Algorithmic Defense):** Structured defense text covering algorithmic logic, trade-off analysis, and data structure/complexity justification with real-time character counters and minimum technical depth checks (total $\ge 60$ characters).
- **FR-404 (Review & Submit Step 4):** Comprehensive review matrix of code snapshot, test results, declaration, and logic explanation with pre-submission readiness checklist.
- **FR-405 (Immutable Submissions Snapshot):** Final submission stores an immutable snapshot (`is_final = 1`, `submitted_at = UTC_TIMESTAMP(3)`). Subsequent draft edits cannot alter a submitted record.
- **FR-406 (Teacher Submission Detail View):** Teacher inspection drawer displays student declaration details, annotation status badges, annotated line ranges, and logic defense cards.
- **FR-407 (Language Switch Bug Fix - TC_07):** Independent code buffers for C++20 and Java 21 prevent accidental code destruction when toggling languages.
- **NFR-401 (Server-Side Validation):** Strict server-side Zod mirroring of all submission requirements. Incomplete final submissions are blocked with descriptive 400 Bad Request responses.
- **NFR-402 (Non-Punitive Constructive Disclosure):** Department transparency policy with zero punitive grading penalty for honest AI usage declaration.

### Acceptance Tests
- **AT-401 (Declaration Enforcement):** Final submission is blocked if declaration is absent or AI is declared with zero annotations.
- **AT-402 (Explanation Enforcement):** Final submission is blocked if logic explanation is absent or $< 60$ characters.
- **AT-403 (Draft Round-Trip):** Partial drafts (even with incomplete declarations/explanations) save successfully and restore on page reload.
- **AT-404 (Snapshot Immutability):** Finalized submissions cannot be overwritten or mutated by subsequent draft saves.
- **AT-405 (Teacher Visibility):** Teachers can view student declarations, annotated line ranges, and logic defenses for their owned assignments.

---

## Iteration 5 — Token-Based Similarity Review (COMPLETE)

### Goal
Deliver a structure-aware, AST/token-based similarity comparison engine with k-gram hashing and winnowing across same-language final submissions, boilerplate suppression, and teacher review flags.

### Requirements Covered
- **FR-501 (Lexer & Canonical Tokenizer):** Full tokenizer for C++20 and Java 21 stripping comments/whitespace, preserving control-flow keywords and operators, normalizing identifiers to canonical placeholder `V` (alpha-conversion), and normalizing string/numeric/character literals to `S`/`N`/`C`.
- **FR-502 (Boilerplate Suppression - BUG_05):** Automatic extraction and suppression of starter template $k$-grams from student fingerprints, preventing empty or shared boilerplate templates from inflating similarity scores.
- **FR-503 (K-Gram Hashing & Winnowing):** Deterministic polynomial rolling hashing ($k = 5$) with sliding window winnowing ($w = 4$) picking rightmost minimums for dense boundary sensitivity.
- **FR-504 (Pairwise Similarity Comparison Engine):** Structure-aware analysis evaluating Jaccard token overlap, containment, AST isomorphism, variable renaming detection (`High (Alpha-converted)` / `Moderate` / `None`), and control flow divergence.
- **FR-505 (Matched Code Clusters & Highlighting):** Groups contiguous matching line ranges into labeled cluster blocks with AST match scores.
- **FR-506 (Database Persistence & Schema):** Migration `005_similarity_reviews.sql` creating `similarity_reports` table with unique constraint on `(assignment_id, submission_a_id, submission_b_id)`, check constraint on status (`'flagged'`, `'reviewed'`, `'dismissed'`), and teacher notes.
- **FR-507 (Teacher Review Workbench UI):** Dual-split code inspector matching `docs/ui-reference/labtrack_similarity_comparison/` with AST sensitivity slider (50%–95%), matched line highlights with cluster banners, instructor notes textarea, oral examination recommendation card, and pair switcher controls.
- **NFR-501 (Non-Negotiable Copy Enforcement):** System UI and copy explicitly state: *"Automated structural analysis signal. Intended for instructor review and viva inquiry, not an automated verdict of misconduct."* Zero auto-failing, zero claims of detecting AI-written code.
- **NFR-502 (Strict RBAC & Privacy Isolation):** Students cannot view peer submissions, similarity scores, or flags. Teachers can only run and view similarity analysis for assignments they authored.

### Acceptance Tests
- **AT-501 (Renamed Variables / TC_18):** Submissions with renamed identifiers and reformatted whitespace produce high similarity ($\ge 80\%$) and are flagged for review.
- **AT-502 (Independent Solutions / TC_19):** Distinct algorithms (e.g. QuickSort vs MergeSort) produce low similarity ($< 30\%$) and are marked dismissed.
- **AT-503 (Boilerplate Suppression / BUG_05):** Starter template code alone produces 0% similarity after boilerplate suppression.
- **AT-504 (Determinism):** Same pair of submissions consistently generates identical hashes, similarity scores, and cluster ranges.
- **AT-505 (Teacher Review & Notes):** Teachers can save confidential viva inquiry notes and toggle status between flagged, reviewed, and dismissed.

---

## Iteration 6 — Teacher Evaluation, Rubric Scoring & Provisional Marks (COMPLETE)

### Goal
Provide teachers with an integrated grading workbench combining automated correctness, algorithmic approach defense, and AI disclosure transparency into teacher-finalized marks.

### Requirements Covered
- **FR-601 (Multi-Component Rubric Model):** Combined evaluation combining:
  1. *Automated Correctness (0–40 pts):* Scaled from Judge0 sandbox test case pass ratio.
  2. *Algorithmic Approach & Invariants (0–30 pts):* Evaluated against student logic defense text.
  3. *Data Structure & Complexity (0–15 pts):* Justification of time/space bounds and memory topology.
  4. *AI Disclosure Adherence & Viva Defense (0–15 pts):* Transparency in attribution, complete annotations, and oral exam defense.
- **FR-602 (Provisional vs Finalised State Flow):**
  - Marks start as `pending_review` or `provisionally_scored`.
  - Prominently labeled **PROVISIONAL** until explicit teacher action.
  - Teacher clicks "Finalise Mark" to move to `finalised` state (recording `finalised_at`).
  - Finalised marks cannot be edited without an explicit "Reopen" action with mandatory reason logging.
- **FR-603 (Teacher Marking Workbench UI):** 3-pane responsive interface matching `docs/ui-reference/labtrack_teacher_marking_interface/`:
  - *Pane 1 (Submissions Queue):* Filterable list of students with pending/provisional/finalized status pills and quick `Prev` / `Next` student navigation.
  - *Pane 2 (Inspection Canvas):* Tabs for Code Inspector, Test Results Telemetry, AI Disclosure, Logic Invariants, and Code Annotations.
  - *Pane 3 (Evaluation & Rubric Scoring):* Real-time rubric sliders/inputs, live total score computation, teacher feedback textarea, and Provisional / Finalize / Reopen actions.
- **FR-604 (Student Scorecard View):** Student assignment viewer displays verified breakdown of correctness, rubric scores, provisional/finalized status badge, and teacher feedback.
- **FR-605 (Database Persistence):** Migration `006_grades_and_evaluations.sql` creating `grades` table with component scores, total score, max score, status, JSON rubric scores, feedback text, reopen reason, and timestamps.
- **NFR-601 (Hard Rule — Teacher Finalizes Marks):** All computed marks remain provisional until an authorized instructor saves or finalizes them. The system never assigns permanent marks autonomously.
- **NFR-602 (Ownership & RBAC Isolation):** Teachers can only grade submissions for assignments they authored. Students can only view their own scorecards.

### Acceptance Tests
- **AT-601 (Provisional Calculation):** System calculates provisional score combining test results and rubric defaults, capped at assignment `max_score`.
- **AT-602 (State Transitions):** Grade smoothly transitions from `provisionally_scored` to `finalised` upon teacher action, recording `finalised_at`.
- **AT-603 (Audit Reopening):** Editing a finalized grade requires an explicit `reopen` action with a mandatory non-blank audit reason.
- **AT-604 (Score Capping):** Total score cannot exceed assignment `max_score` and component scores cannot be negative.
- **AT-605 (Teacher Ownership Isolation):** A teacher cannot grade or reopen submissions belonging to an assignment authored by another instructor.
- **AT-606 (Student Scorecard Privacy):** Student sees scorecard only for their own submission, with provisional banner if unfinalized.

### Assumptions
- Default total max score is 100 points, broken into 40/30/15/15 rubric distribution. If an assignment specifies a custom `max_score`, rubric weights scale proportionally.
- Reopening a finalized mark sets status to `'reopened'`, clears `finalised_at`, and preserves the audit trail in `reopen_reason`.

---

## Iteration 7 — Submission History, Cohort Results & Exportable Reporting (COMPLETE — v0.8.0)

### Goal
Implement student submission history and teacher cohort performance analytics with CSV export and print-ready departmental moderation reports.

### Requirements Covered
- **FR-701 (Student Submission History Ledger):** Reverse-chronological timeline of student submission attempts (drafts and final submissions) displaying timestamp, language, Judge0 test telemetry (passed/total), AI disclosure status, and evaluation scorecard link. Implemented in `apps/api/src/reporting/repository.js` and `apps/web/src/pages/StudentSubmissionHistoryPage.jsx`.
- **FR-702 (Cohort Results & Statistical Analytics):** Aggregated metrics across all student final submissions for an assignment:
  - *Mean (Class Average):* Arithmetic average of student total scores.
  - *Median:* 50th percentile mark.
  - *Standard Deviation ($\sigma$):* Cohort spread calculation with Bessel's correction $N-1$.
  - *Pass Rate:* Percentage of cohort meeting benchmark ($\ge 60\%$).
  - *AI Declaration Rate:* Percentage of submissions declaring AI tool usage.
  - *Similarity Flag Rate:* Percentage of submissions flagged by AST similarity review ($\ge 75\%$).
  - *Score Distribution Bins:* 5 histogram intervals ($<60$, $60–69$, $70–79$, $80–89$, $90–100$).
  Implemented in `apps/api/src/reporting/analytics.js`.
- **FR-703 (Cohort Results Ledger Table):** Comprehensive roster with student ID/email, submission status, correctness score, logic score, AI declaration, similarity flag status, final marks, and quick action to inspect in Marking Workbench. Implemented in `apps/web/src/pages/TeacherReportsPage.jsx`.
- **FR-704 (RFC 4180 CSV Export):** Export cohort results to clean, properly escaped CSV with UTF-8 BOM and academic headers (Course Code, Assignment, Student ID, Email, Correctness, Logic, Complexity, AI Transparency, Final Mark, Status).
- **FR-705 (Print & PDF Moderation Report):** Print-ready HTML document formatted for official departmental filing with course metadata, cohort statistics summary table, student roster, and faculty sign-off / moderation signature block.
- **NFR-701 (Statistical Mathematical Integrity):** Statistical formulas handle all edge cases safely (empty cohort $N=0$, single submission $N=1$, identical marks $\sigma=0$).
- **NFR-702 (Strict Privacy & RBAC Isolation):** Students can only view and export their own submission history. Teachers can only view and export cohort reports for assignments they authored.

### Acceptance Tests
- **AT-701 (Submission History Ordering & Privacy):** Submissions are returned in reverse-chronological order. Students cannot access other students' submission history. [PASSED]
- **AT-702 (Mathematical Correctness of Metrics):** Mean, median, standard deviation, pass rate, declaration rate, and flag rate are verified against hand-calculated datasets. [PASSED]
- **AT-703 (Edge Case Handling):** $N=0$ returns zeros without division-by-zero errors; $N=1$ calculates $\sigma=0$ without crashing. [PASSED]
- **AT-704 (CSV Formatting & Escaping):** CSV export correctly escapes commas, quotes, and newlines per RFC 4180. [PASSED]
- **AT-705 (Teacher Ownership on Reporting):** A teacher cannot generate or export cohort results for assignments owned by another faculty member. [PASSED]

### Assumptions
- Cohort statistics are computed over the latest final submission per student (`is_final = 1`). Drafts are excluded from cohort analytics.
- If a submission has not yet been graded by a teacher, its provisional score is used for cohort projections until finalized.

---

## Iteration 8 — Optional Declared AI Assistance (COMPLETE — v0.9.0)

### Goal
Implement optional, backend-only generative AI assistance behind a strict feature flag (disabled by default) that automatically logs all tool interactions into the student's AI-use declaration.

### Requirements Covered
- **FR-801 (Strict Feature Flagging & Safe Defaults):** Generative AI assistance is controlled by `ENABLE_AI_ASSISTANCE=false` by default. When disabled, all AI assistance UI components are policy-disabled and endpoints return HTTP 503 Service Unavailable with a clear message. Implemented in `apps/api/src/config.js` and `apps/api/src/ai/routes.js`.
- **FR-802 (Scaffolded AI Assistance Modes):** Structured, pedagogical assistance modes (never entire code dumps):
  - *Conceptual Hint / Socratic Guidance:* Explains underlying algorithmic pattern without giving code.
  - *Debugging Assistant:* Analyzes compiler error output or failed test case and points to the conceptual error.
  - *Complexity Explainer:* Helps analyze theoretical time/space recurrence relations.
  Implemented in `apps/api/src/ai/service.js`.
- **FR-803 (Automatic Attribution & Audit Logging):** Every interaction with the in-platform AI assistant automatically appends to the student's AI-use declaration (recording timestamp, prompt type, and assist summary) and stores an audit record in `ai_assistance_logs`. Implemented in `apps/api/src/ai/repository.js` and `apps/web/src/pages/CodeWorkspacePage.jsx`.
- **FR-804 (Rate Limiting & Token Budgeting):** Per-student, per-assignment query limits (default 5 queries per hour) enforced server-side with HTTP 429 to promote independent struggle.
- **FR-805 (Teacher Visibility into In-Platform Logs):** Instructors inspecting submissions in `TeacherMarkingPage.jsx` can view the student's exact in-platform AI assistance queries and responses.
- **NFR-801 (Zero Host Execution & Key Security):** LLM API keys loaded strictly via server-side environment variables (`LLM_API_KEY`). No secrets in frontend or git commits. Offline mock simulator guarantees full testability without external network calls.
- **NFR-802 (Pedagogical Safeguards):** AI system prompts strictly instruct the model to act as a university computer science teaching assistant that guides thinking rather than writing complete solutions. Output sanitizer strips code blocks longer than 4 lines.

### Acceptance Tests
- **AT-801 (Pedagogical Guardrails & Solution Refusal):** Detects prompts asking to "write code" and redirects to Socratic inquiry. [PASSED]
- **AT-802 (Scaffolded Assistance Modes):** Verifies hint, debug, and complexity outputs without full runnable solutions. [PASSED]
- **AT-803 (Output Sanitizer):** Long code blocks (>4 lines) are redacted to prevent spoonfeeding. [PASSED]
- **AT-804 (Offline Determinism):** Mock provider handles query round-trip with zero network dependence. [PASSED]
- **AT-805 (Hourly Rate Limiting):** Blocks requests exceeding 5 queries/hour per student per assignment. [PASSED]
- **AT-806 (Automatic Attribution):** Queries auto-populate tool name and summary in Step 2 declaration. [PASSED]
- **AT-807 (Database Migration 007):** Schema defines `ai_assistance_logs` with foreign keys and check constraints. [PASSED]
- **AT-808 (Hard Rule Safeguards):** Safe defaults (`ENABLE_AI_ASSISTANCE=false`), HTTP 503 on disabled, zero AI detection claims. [PASSED]

### Assumptions
- AI assistance is off by default. When enabled, rate limits apply per student per assignment per hour.
- Student code and prompts are processed strictly in-memory or logged in local MySQL; no student identifiable info is forwarded to public model training.

---

## Iteration 9 — Release Hardening, Performance Profiling & Documentation (UPCOMING — v1.0.0)

### Goal
Execute end-to-end auditability, performance profiling, responsive cross-device verification, documentation consolidation, and final release tagging for LabTrack v1.0.0.

### Requirements to Cover
- **FR-901 (Full Workflow Integration Smoke Tests):** End-to-end verification covering complete assignment lifecycle: Authoring → Student Sandbox Run → Stepper Declarations → AST Similarity Check → Rubric Evaluation → Ledger Reporting.
- **FR-902 (Database Index Optimization & Security Audit):** Verification of foreign keys, cascade integrity, index usage, and prepared statement safety across all migrations 001–007.
- **FR-903 (Mobile & Responsive Verification):** Complete viewport verification across 390px mobile, tablet, and 1440px desktop layouts.
- **NFR-901 (Non-Negotiable Policy Audit):** Verification of zero AI-detection claims, teacher finalization of marks, sandbox host isolation, and zero secrets in repository.
- **NFR-902 (Performance & Bundle Budget):** Production build bundle verification and API endpoint latency bounds under load.
