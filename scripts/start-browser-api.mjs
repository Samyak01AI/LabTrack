import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from '../apps/api/src/db/pool.js';
import { applyMigrations } from '../apps/api/src/db/migrate.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const testUrl = process.env.LABTRACK_TEST_DATABASE_URL;
if (!testUrl) throw new Error('LABTRACK_TEST_DATABASE_URL must point to an isolated local MySQL database before starting the browser-test API.');
const parsedUrl = new URL(testUrl);
if (!['mysql:', 'mysqls:'].includes(parsedUrl.protocol)
    || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedUrl.hostname)) {
  throw new Error('The browser-test API refuses non-loopback or non-MySQL test URLs.');
}

const migrationPool = createPool({ databaseUrl: testUrl, mysqlSsl: false });
try {
  const result = await applyMigrations(migrationPool, path.join(projectRoot, 'db', 'migrations'));
  console.log(`Isolated browser-test MySQL migrations checked: ${result.total}; newly applied: ${result.applied.length}.`);
} finally {
  await migrationPool.end();
}

// These assignments intentionally replace any managed WebDev values for this process only.
process.env.DATABASE_URL = testUrl;
process.env.MYSQL_SSL = 'false';
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.LABTRACK_TEST_PORT || '3000';
process.env.AUTH_COOKIE_SAME_SITE = 'lax';
process.env.AUTH_COOKIE_SECURE = 'false';
await import('../apps/api/src/server.js');
