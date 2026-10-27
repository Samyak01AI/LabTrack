import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { createPool } from '../apps/api/src/db/pool.js';
import { createUserRepository } from '../apps/api/src/auth/users.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const target = process.env.LABTRACK_PROVISION_TARGET;
let databaseUrl;
let mysqlSsl = false;
if (target === 'local') databaseUrl = process.env.LABTRACK_LOCAL_DATABASE_URL;
else if (target === 'test') databaseUrl = process.env.LABTRACK_TEST_DATABASE_URL;
else if (target === 'managed') {
  databaseUrl = process.env.DATABASE_URL;
  mysqlSsl = true;
} else {
  throw new Error('Set LABTRACK_PROVISION_TARGET to local, test, or managed; provisioning never infers a database target.');
}
if (!databaseUrl) throw new Error(`No database URL is configured for provisioning target: ${target}.`);
if (target !== 'managed') {
  const host = new URL(databaseUrl).hostname;
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    throw new Error('Local/test teacher provisioning refuses non-loopback MySQL hosts.');
  }
}
if (target === 'managed' && databaseUrl === process.env.LABTRACK_TEST_DATABASE_URL) {
  throw new Error('Managed teacher provisioning must not use LABTRACK_TEST_DATABASE_URL.');
}

const teacherSchema = z.object({
  TEACHER_NAME: z.string().trim().min(1).max(100),
  TEACHER_EMAIL: z.string().trim().email().max(254),
  TEACHER_PASSWORD: z.string().min(12).max(128),
});
const teacher = teacherSchema.safeParse(process.env);
if (!teacher.success) {
  throw new Error('Provide TEACHER_NAME, TEACHER_EMAIL, and a 12–128 character TEACHER_PASSWORD through the selected secure environment.');
}

const pool = createPool({ databaseUrl, mysqlSsl });
try {
  const users = createUserRepository(pool);
  const passwordHash = await bcrypt.hash(teacher.data.TEACHER_PASSWORD, 12);
  await users.createOrUpdateTeacher({
    displayName: teacher.data.TEACHER_NAME,
    email: teacher.data.TEACHER_EMAIL.toLowerCase(),
    passwordHash,
  });
  console.log(`Teacher account provisioned in the ${target} database.`);
} finally {
  await pool.end();
}
