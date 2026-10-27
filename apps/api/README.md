# LabTrack API

The Iteration 1–2 Node.js/Express API uses MySQL through `mysql2/promise`. The same Express server hosts the React/Vite client in development and serves the production React build from the container.

From the repository root, install Node.js 22+ dependencies, copy `.env.example` to `.env`, and configure loopback-only local and test MySQL databases plus a random `JWT_SECRET` of at least 32 characters. Apply local schema migrations explicitly with `LABTRACK_MIGRATION_TARGET=local npm run db:migrate`, then start the integrated development server with `npm run api:dev`.

Public registration creates student accounts only and requires a 12–128 character password. Teacher accounts are provisioned out of band with `LABTRACK_PROVISION_TARGET=local npm run provision:teacher` after setting `TEACHER_NAME`, `TEACHER_EMAIL`, and `TEACHER_PASSWORD` in the ignored local `.env`. Production bootstrap values belong only in protected WebDev configuration and must be removed after the first account is created. API auth uses bcrypt hashes and a signed JWT held only in an HTTP-only cookie. Authorization reads current role and active status from MySQL for protected requests.

Run `npm run test:api` for MySQL integration checks. It requires `LABTRACK_TEST_DATABASE_URL` to point to a separate loopback test database; tests never fall back to the managed development/production database. Remote MySQL connections always use TLS, regardless of local plaintext settings.

For embedded public HTTPS Preview, configure `AUTH_COOKIE_SAME_SITE=none` and `AUTH_COOKIE_SECURE=true`; local HTTP uses `lax`/`false`. Never infer cookie security from the backend request protocol. Do not commit `.env`, passwords, or database credentials.
