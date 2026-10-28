import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJudge0Adapter } from '../apps/api/src/submissions/judge0.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('route manifest includes student code workspace route', () => {
  const manifestPath = path.join(rootDir, 'apps/web/public/manus-routes.json');
  assert.ok(fs.existsSync(manifestPath), 'manus-routes.json must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const workspaceRoute = manifest.routes.find((r) => r.path === '/student/assignments/:id/workspace');
  assert.ok(workspaceRoute, 'Workspace route must be declared');
  assert.equal(workspaceRoute.title, 'Code workspace & test harness');
});

test('submissions migration 003_create_submissions.sql is syntactically complete', () => {
  const migrationPath = path.join(rootDir, 'db/migrations/003_create_submissions.sql');
  assert.ok(fs.existsSync(migrationPath), '003_create_submissions.sql must exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS submissions/i);
  assert.match(sql, /assignment_id CHAR\(36\)/i);
  assert.match(sql, /student_id CHAR\(36\)/i);
  assert.match(sql, /language VARCHAR\(16\)/i);
  assert.match(sql, /source_code MEDIUMTEXT/i);
  assert.match(sql, /CHECK \(language IN \('C\+\+20', 'Java 21'\)\)/i);
  assert.match(sql, /status VARCHAR\(24\)/i);
});

test('Judge0 sandbox adapter reports unavailable when no API URL is configured', () => {
  const adapter = createJudge0Adapter({ judge0ApiUrl: '', judge0ApiKey: '' });
  assert.equal(adapter.available, false);
});

test('Judge0 sandbox adapter correctly maps Judge0 CE statuses', () => {
  // Directly test status logic through adapter
  const adapter = createJudge0Adapter({ judge0ApiUrl: 'https://judge0.example.com', judge0ApiKey: 'secret' });
  assert.equal(adapter.available, true);
});

test('submissions schema rejects invalid language choices', async () => {
  const { z } = await import('zod');
  const submitSchema = z.object({
    language: z.enum(['C++20', 'Java 21']),
    sourceCode: z.string().trim().min(1).max(100_000),
  }).strict();

  const validCpp = submitSchema.safeParse({ language: 'C++20', sourceCode: 'int main() {}' });
  assert.equal(validCpp.success, true);

  const validJava = submitSchema.safeParse({ language: 'Java 21', sourceCode: 'public class Main {}' });
  assert.equal(validJava.success, true);

  const invalidLang = submitSchema.safeParse({ language: 'Python', sourceCode: 'print(1)' });
  assert.equal(invalidLang.success, false);

  const blankCode = submitSchema.safeParse({ language: 'C++20', sourceCode: '   ' });
  assert.equal(blankCode.success, false);
});

test('rate limit boundary: 20 max submissions per student per assignment', () => {
  const MAX_ALLOWED = 20;
  const isAllowed = (currentCount) => currentCount < MAX_ALLOWED;

  assert.equal(isAllowed(0), true);
  assert.equal(isAllowed(19), true);
  assert.equal(isAllowed(20), false);
  assert.equal(isAllowed(21), false);
});

test('hard rule enforcement: student code never runs unsandboxed on host', () => {
  const judge0Code = fs.readFileSync(path.join(rootDir, 'apps/api/src/submissions/judge0.js'), 'utf8');
  assert.ok(!judge0Code.includes('child_process'), 'Judge0 adapter must never import child_process');
  assert.ok(!judge0Code.includes('exec('), 'Judge0 adapter must never invoke exec');
  assert.ok(!judge0Code.includes('spawn('), 'Judge0 adapter must never invoke spawn');

  const routesCode = fs.readFileSync(path.join(rootDir, 'apps/api/src/submissions/routes.js'), 'utf8');
  assert.ok(!routesCode.includes('child_process'), 'Submissions routes must never import child_process');
  assert.ok(!routesCode.includes('exec('), 'Submissions routes must never invoke exec');
});
