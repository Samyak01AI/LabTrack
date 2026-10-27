import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPool } from '../../apps/api/src/db/pool.js';
import { applyMigrations } from '../../apps/api/src/db/migrate.js';

const databaseUrl = process.env.LABTRACK_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('LABTRACK_TEST_DATABASE_URL must point only to an isolated local MySQL test database.');

const parsedUrl = new URL(databaseUrl);
if (!['mysql:', 'mysqls:'].includes(parsedUrl.protocol)) {
  throw new Error('The isolated test DSN must use a MySQL URL.');
}
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedUrl.hostname)) {
  throw new Error('Automated tests refuse non-loopback MySQL hosts.');
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL === databaseUrl) {
  throw new Error('Automated tests refuse to use the active application DATABASE_URL.');
}

export const pool = createPool({ databaseUrl, mysqlSsl: false });
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export async function applyTestMigrations() {
  return applyMigrations(pool, path.join(projectRoot, 'db', 'migrations'));
}

export async function clearTestData() {
  await pool.execute('DELETE FROM assignments');
  await pool.execute('DELETE FROM users');
}
