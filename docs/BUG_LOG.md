# Bug Log

| Issue ID | Description | Severity | Root Cause | Fix | Status | Date |
|---|---|---|---|---|---|---|
| I0-UI-001 | Populated register showed the empty state and duplicate status text. | Medium | Empty-state `hidden` logic was inverted; component CSS overrode its hidden state; status appeared in both a select and badge. | Corrected hidden visibility, added explicit `[hidden]` CSS, and kept one status-colored select; browser suite passed. | Closed | 2026-10-14 |
| I1-DEP-001 | Initial API dependency set included 2 High and 1 Critical vulnerability. | Critical | bcrypt 5.1.1 brought a vulnerable `@mapbox/node-pre-gyp`/`tar` dependency tree. | Upgrade to bcrypt 6.0.0; `npm audit --audit-level=high` returned 0 vulnerabilities. | Closed | 2026-10-14 |
| I1-AUTH-001 | Login requests returned HTTP 500; initial API suite had 5 failing checks. | High | `express-rate-limit` received a boolean instead of its `skip` callback. | Supply `skip: () => ...`; PostgreSQL-backed API retest passed. | Closed | 2026-10-14 |
| I1-ENV-001 | API process failed when launched through the npm workspace. | Medium | `dotenv/config` searched the workspace cwd instead of the repository-root `.env`. | Resolve repository root from the server module and load that `.env`; local/public startup and health checks passed. | Closed | 2026-10-14 |
| I2-API-001 | PATCHing an assignment without changing its deadline (for example, publish/archive) failed merged-resource validation. | Medium | PostgreSQL returned `dueAt` as a JavaScript `Date`, while the validation schema requires ISO text. | Normalize the persisted date with `new Date(current.dueAt).toISOString()` before validating the merged PATCH. The final API suite passed 23/23. | Closed | 2026-10-16 |
| I2-BUILD-001 | Initial React production build failed on JSX/sample-case markup and then on missing Tailwind 4 theme utilities. | Medium | A malformed placeholder was left in JSX and custom `on-error-container`/`tertiary` palette values were not defined. | Replace the placeholder and complete the Academic Precision palette tokens; final Vite build passed. | Closed | 2026-10-16 |
| I2-MOBILE-001 | Mobile navigation labels were hidden and the active label had insufficient contrast. | Medium | Desktop-only label utility was reused in the white mobile menu, and the active state inherited the inactive navy text utility. | Always display mobile labels; style inactive links navy and active labels white. Chromium assertions and visual review passed at 390px. | Closed | 2026-10-16 |
| I2-TEST-001 | Early browser-test attempts timed out on UI selectors and then hit HTTP 429 after repeated development logins. | Low | Exact-text selectors did not match combined table text/material-symbol labels; the normal in-memory development login limit accumulated across repeated runs. | Use stable IDs, row/status-pill assertions, and `api:browser`, which requires and targets only the isolated test database in test mode. Final browser suite passed and cleaned up its fixtures. | Closed | 2026-10-16 |
| I2-PREVIEW-001 | The public sandbox preview returned HTTP 403 while localhost worked. | Low | Vite's default Host validation rejected the platform-provided preview hostname. | Added an optional exact-host `MANUS_PREVIEW_HOST` allow-list; did not enable wildcard/all hosts. Local and public root, route manifest, and API health then returned HTTP 200. | Closed | 2026-10-16 |

No open High/Critical issues remain. This does not substitute for the separate Iteration 9 security review.


## Release-preparation issues — 2026-10-22

| Issue ID | Description | Severity | Root Cause | Fix | Status | Date |
|---|---|---|---|---|---|---|
| REL-DB-001 | Initial managed MySQL migration was rejected at the connection handshake. | High | The managed migration script inherited `MYSQL_SSL=false` from the local development `.env`, so mysql2 attempted an insecure remote connection. | Force TLS for the managed target and enforce TLS for every non-loopback DSN in the shared pool; regression and real managed preflight/migrations passed. No DDL ran during the failed attempt. | Closed | 2026-10-22 |
| REL-DEV-001 | `npm run api:dev` repeatedly restarted while Vite initialized, so the first readiness request landed during a restart gap. | Low | The Node watch restart was observed after Vite dependency optimization; the trigger was not isolated. | Stopped the watcher and used the existing non-watch `npm run api:start` entrypoint; the refreshed managed runtime then served health, SPA, and route-manifest requests successfully. | Open — investigate local watcher separately | 2026-10-22 |

No open High/Critical issues remain from this release-preparation check. The open Low watcher issue does not affect the production Docker entrypoint, which starts `node apps/api/src/server.js` without watch mode.
