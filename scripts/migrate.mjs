import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from '../apps/api/src/db/pool.js';
import { applyMigrations } from '../apps/api/src/db/migrate.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const target = process.env.LABTRACK_MIGRATION_TARGET;
let databaseUrl;
let mysqlSsl = false;
if (target === 'local') {
  databaseUrl = process.env.LABTRACK_LOCAL_DATABASE_URL;
} else if (target === 'managed') {
  databaseUrl = process.env.DATABASE_URL;
  mysqlSsl = true;
} else {
  throw new Error('Set LABTRACK_MIGRATION_TARGET to local or managed; migrations never infer a target.');
}
if (!databaseUrl) throw new Error(`No database URL is configured for migration target: ${target}.`);
if (target === 'managed' && databaseUrl === process.env.LABTRACK_TEST_DATABASE_URL) {
  throw new Error('The managed migration target must not use LABTRACK_TEST_DATABASE_URL.');
}
if (target === 'local') {
  const host = new URL(databaseUrl).hostname;
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    throw new Error('The local migration target must be a loopback MySQL URL.');
  }
}

const pool = createPool({ databaseUrl, mysqlSsl });
try {
  const result = await applyMigrations(pool, path.join(projectRoot, 'db', 'migrations'));
  for (const filename of result.applied) console.log(`Applied ${filename}`);
  console.log(`Migrations checked: ${result.total}; newly applied: ${result.applied.length}; target: ${target}.`);
} finally {
  await pool.end();
}
