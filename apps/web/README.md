# LabTrack React web client

React 19, React Router, Vite 6, and Tailwind CSS 4 implement the supplied Academic Precision sign-in/registration, student dashboard, assignment viewer, and teacher assignment-management surfaces. The client uses the existing Express API through a same-origin Vite `/api` proxy and never stores the JWT in browser storage; the API session remains an HTTP-only cookie.

## Routes

- `/login` — student/teacher sign-in; teacher accounts are provisioned out of band.
- `/register` — student-only account creation.
- `/student/dashboard` — API-backed published assignments, deadline counts, search/topic/status filters, and responsive table/cards.
- `/student/assignments/:id` — saved assignment specification, constraints, samples, deadline, score, and language options.
- `/teacher/assignments` — teacher-owned draft creation/editing, publishing, archive/restore, filtering, and persisted counts.

`public/manus-routes.json` declares client routes for preview tooling. The root `npm run web:dev` starts Vite on port 4174; `npm run web:build` generates a production bundle. API startup and database setup are documented in the root README.

When serving through a sandbox public hostname, set `MANUS_PREVIEW_HOST` to that exact hostname; Vite's host allow-list is not opened to arbitrary hosts.

## Iteration boundary

The code-workspace panel is deliberately locked in this iteration. No student code is run by the web server, client, shell, or test harness. Monaco and Judge0 execution belong to Iteration 3. AI disclosure, similarity analysis, marks, submission history, and reporting are later planned work, not simulated dashboard values.

## Browser tests

`npm run test:browser` includes real Chromium interactions. Start the vanilla preview (`npm run serve:prototype`), Vite (`npm run web:dev`), and the test-only API (`npm run api:browser`) in separate terminals. The test-only API launcher requires `LABTRACK_TEST_DATABASE_URL`, applies the migrations to that database, and sets `NODE_ENV=test`; browser fixtures and cleanup use only that same test database. Do not use the test launcher with development or production credentials/data.
