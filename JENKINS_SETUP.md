# LabTrack Jenkins setup

These files are tailored to https://github.com/Samyak01AI/LabTrack.

## Existing repository commands

The current package.json defines:
- `npm test` - Node unit tests
- `npm run test:api` - MySQL API integration tests
- `npm run web:build` - React/Vite production build
- `npm run test:browser` - Python Playwright browser checks
- `npm audit --audit-level=high` - dependency security audit

The repository requires Node.js >=22.13.0 and npm 10+. It uses MySQL. The API and browser tests must use a dedicated loopback test database, never the hosted/managed database.

## 1. Add Jenkinsfile to GitHub

Copy `Jenkinsfile` into the repository root, beside `package.json`, then commit and push it.

## 2. Jenkins prerequisites

Install Jenkins plugins:
- Git
- Pipeline
- NodeJS
- Credentials Binding

Under **Manage Jenkins > Tools**, add a NodeJS installation named exactly `NodeJS-22`, using Node 22.13.0+ and npm 10+.

This Jenkinsfile uses Windows `bat` commands. Run it on a Windows Jenkins agent.

## 3. Configure a separate MySQL test database

Create a dedicated local MySQL database, e.g. `labtrack_test`, and a database user restricted to that database. Do not use the hosted WebDev database or your development database for automated test writes.

In **Manage Jenkins > Credentials > System > Global credentials**, add two credentials of type **Secret text**:

| ID | Secret |
|---|---|
| `labtrack-test-database-url` | `mysql://TEST_USER:TEST_PASSWORD@127.0.0.1:3306/labtrack_test` |
| `labtrack-test-jwt-secret` | A private random secret of at least 32 characters |

Replace the sample DB username/password. The MySQL server must be reachable from the Jenkins agent. Do not commit credentials or `.env` to Git.

## 4. Create the Jenkins job

1. Jenkins Dashboard > New Item.
2. Name: `LabTrack-CI`.
3. Choose **Pipeline**.
4. Under Pipeline, select **Pipeline script from SCM**.
5. SCM: Git.
6. Repository URL: `https://github.com/Samyak01AI/LabTrack.git`
7. Branch: `*/main`
8. Script Path: `Jenkinsfile`
9. Save, then click **Build Now**.

## 5. Enable API integration tests

The first build runs unit tests, the web build and the dependency audit.

After the isolated test database and Jenkins credentials are configured:
1. Open the job and select **Build with Parameters**.
2. Enable `RUN_API_TESTS`.
3. Start the build.

## 6. Browser tests

The repository README says `npm run test:browser` runs Python Playwright scripts. It also says the prototype server and test-only API server must be started first using `npm run serve:prototype` and `npm run api:browser`.

The browser stage is opt-in because it needs:
- Python 3 available as `python` to the Jenkins service account
- Playwright Python package and Chromium installed for that account
- The isolated loopback MySQL test database and credentials
- The prototype and test-only API servers started as required by the browser scripts

Do not enable `RUN_BROWSER_TESTS` until those prerequisites and server startup are configured.

## 7. Reports and limitations

This pipeline executes the test commands already present in the repository. It does not invent test cases or claim success before a real run.

The current package.json does not define a coverage command or include a JMeter `.jmx` test plan. Therefore this starter does not fabricate coverage or performance reports. For this Node.js project, add Node-compatible coverage instrumentation such as c8/Istanbul if coverage is required. JMeter needs an actual test plan and a running test environment.

## Troubleshooting

- `node` or `npm` not found: verify the NodeJS plugin and the exact tool name `NodeJS-22`.
- `npm ci` fails: verify package-lock.json is committed and the agent can access the npm registry.
- API tests cannot connect: verify MySQL is running and the credential URL points to the isolated test database from the Jenkins agent.
- Browser stage cannot find Python: install Python and Playwright for the Jenkins service account, then install Chromium.
- Jenkins service fails to start: start it through Windows Services (`services.msc`), not by launching a service executable directly.
