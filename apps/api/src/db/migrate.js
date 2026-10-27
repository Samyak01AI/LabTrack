import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const MIGRATION_LOCK = 'labtrack:schema-migrations';

export async function applyMigrations(pool, migrationDir) {
  const files = (await readdir(migrationDir)).filter((name) => name.endsWith('.sql')).sort();
  const applied = [];
  const connection = await pool.getConnection();
  let lockAcquired = false;

  try {
    const [lockRows] = await connection.execute('SELECT GET_LOCK(?, 30) AS acquired', [MIGRATION_LOCK]);
    lockAcquired = Number(lockRows[0]?.acquired) === 1;
    if (!lockAcquired) throw new Error('Could not obtain the MySQL schema migration lock.');

    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    for (const filename of files) {
      const [existingRows] = await connection.execute(
        'SELECT filename FROM schema_migrations WHERE filename = ? LIMIT 1',
        [filename],
      );
      if (existingRows.length > 0) continue;

      const source = await readFile(path.join(migrationDir, filename), 'utf8');
      const statements = source.split(';').map((statement) => statement.trim()).filter(Boolean);
      if (statements.length === 0) throw new Error(`Migration ${filename} contains no SQL statements.`);

      // MySQL DDL implicitly commits. Keep statements idempotent and record a file only after
      // every statement succeeds, so a partial run can be safely retried.
      for (const statement of statements) await connection.query(statement);
      await connection.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [filename]);
      applied.push(filename);
    }

    return { total: files.length, applied };
  } finally {
    if (lockAcquired) {
      try {
        await connection.execute('SELECT RELEASE_LOCK(?)', [MIGRATION_LOCK]);
      } catch {
        // Releasing the connection also releases its named lock.
      }
    }
    connection.release();
  }
}
