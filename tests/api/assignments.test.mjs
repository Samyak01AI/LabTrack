import 'dotenv/config';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app.js';
import { createUserRepository } from '../../apps/api/src/auth/users.js';
import { pool, applyTestMigrations, clearTestData } from './db-test-support.mjs';

const databaseUrl = process.env.LABTRACK_TEST_DATABASE_URL;
const config = {
  environment: 'test',
  port: 3000,
  databaseUrl,
  mysqlSsl: false,
  jwtSecret: randomBytes(32).toString('base64url'),
  jwtExpiresIn: '2h',
  cookieName: 'labtrack_session',
  cookieSameSite: 'lax',
  cookieSecure: false,
  cookieMaxAgeMs: 7_200_000,
  loginRateLimitWindowMs: 60_000,
  loginRateLimitMax: 100,
};
const users = createUserRepository(pool);
const app = createApp({ pool, config, users });
const newEmail = (prefix) => `${prefix}-${randomUUID()}@example.edu`;

before(async () => {
  await applyTestMigrations();
  await clearTestData();
});

after(async () => {
  await clearTestData();
  await pool.end();
});

async function createAccount(role, prefix) {
  const email = newEmail(prefix);
  const password = `${prefix}-${randomBytes(18).toString('hex')}!`;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = role === 'teacher'
    ? await users.createOrUpdateTeacher({ displayName: 'Assignment Teacher', email, passwordHash })
    : await users.create({ displayName: 'Assignment Student', email, passwordHash, role: 'student' });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return { user, agent };
}

function assignmentInput(overrides = {}) {
  return {
    courseCode: 'CS301',
    assignmentCode: `LAB-${randomUUID().slice(0, 8)}`,
    title: 'Least Recently Used Cache',
    topic: 'Hash Map / Linked List',
    summary: 'Implement a deterministic cache with constant-time operations.',
    problemStatement: 'Design an LRU cache. Both get and put operations must run in O(1) average time.',
    constraintsMarkdown: 'Capacity must be positive. Keys and values are signed integers.',
    sampleCases: [{ input: 'get 7', expectedOutput: '-1', explanation: 'The key is not present.' }],
    dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    maxScore: 100,
    languageOptions: ['C++20', 'Java 21'],
    status: 'draft',
    ...overrides,
  };
}

test('student and teacher assignment routes are protected by role', async () => {
  const student = await createAccount('student', 'student');
  const teacher = await createAccount('teacher', 'teacher');
  await request(app).get('/api/student/assignments').expect(401);
  await request(app).get('/api/teacher/assignments').expect(401);
  await student.agent.get('/api/teacher/assignments').expect(403);
  await teacher.agent.get('/api/student/assignments').expect(403);
});

test('teacher creates a persisted draft and student cannot view it', async () => {
  const teacher = await createAccount('teacher', 'teacher');
  const student = await createAccount('student', 'student');
  const input = assignmentInput();
  const created = await teacher.agent.post('/api/teacher/assignments').send(input).expect(201);
  assert.equal(created.body.assignment.title, input.title);
  assert.equal(created.body.assignment.status, 'draft');
  assert.equal(created.body.assignment.courseCode, input.courseCode);
  assert.deepEqual(created.body.assignment.sampleCases, input.sampleCases);
  assert.equal(created.body.assignment.createdBy, undefined);
  const draftId = created.body.assignment.id;
  await student.agent.get(`/api/student/assignments/${draftId}`).expect(404);
  const list = await teacher.agent.get('/api/teacher/assignments').expect(200);
  assert.equal(list.body.assignments.length, 1);
  assert.equal(list.body.assignments[0].id, draftId);
});

test('only the owning teacher may read, update, or delete a draft', async () => {
  const owner = await createAccount('teacher', 'teacher');
  const other = await createAccount('teacher', 'teacher');
  const created = await owner.agent.post('/api/teacher/assignments').send(assignmentInput()).expect(201);
  const id = created.body.assignment.id;
  await other.agent.get(`/api/teacher/assignments/${id}`).expect(404);
  await other.agent.patch(`/api/teacher/assignments/${id}`).send({ title: 'Changed title' }).expect(404);
  await other.agent.delete(`/api/teacher/assignments/${id}`).expect(404);
  await owner.agent.patch(`/api/teacher/assignments/${id}`).send({ title: 'Updated cache assignment' }).expect(200);
  await owner.agent.delete(`/api/teacher/assignments/${id}`).expect(204);
});

test('publishing exposes only the saved assignment fields to students', async () => {
  const teacher = await createAccount('teacher', 'teacher');
  const student = await createAccount('student', 'student');
  const input = assignmentInput({ problemStatement: 'Build a cache that maintains recency in constant time.' });
  const created = await teacher.agent.post('/api/teacher/assignments').send(input).expect(201);
  const published = await teacher.agent.patch(`/api/teacher/assignments/${created.body.assignment.id}`)
    .send({ status: 'published' }).expect(200);
  assert.equal(published.body.assignment.status, 'published');
  const list = await student.agent.get('/api/student/assignments').expect(200);
  assert.equal(list.body.assignments.length, 1);
  assert.equal(list.body.assignments[0].id, published.body.assignment.id);
  const detail = await student.agent.get(`/api/student/assignments/${published.body.assignment.id}`).expect(200);
  assert.equal(detail.body.assignment.problemStatement, input.problemStatement);
  assert.deepEqual(detail.body.assignment.languageOptions, ['C++20', 'Java 21']);
});

test('archiving removes an assignment from student views without deleting it', async () => {
  const teacher = await createAccount('teacher', 'teacher');
  const student = await createAccount('student', 'student');
  const created = await teacher.agent.post('/api/teacher/assignments')
    .send(assignmentInput({ status: 'published' })).expect(201);
  await student.agent.get(`/api/student/assignments/${created.body.assignment.id}`).expect(200);
  await teacher.agent.patch(`/api/teacher/assignments/${created.body.assignment.id}`)
    .send({ status: 'archived' }).expect(200);
  await student.agent.get(`/api/student/assignments/${created.body.assignment.id}`).expect(404);
  const teacherView = await teacher.agent.get(`/api/teacher/assignments/${created.body.assignment.id}`).expect(200);
  assert.equal(teacherView.body.assignment.status, 'archived');
});

test('assignment validation rejects blank required fields, invalid dates, unsupported languages, and unknown keys', async () => {
  const teacher = await createAccount('teacher', 'teacher');
  for (const overrides of [
    { title: '   ' },
    { dueAt: 'not-a-date' },
    { languageOptions: ['Python 3.12'] },
    { unexpected: 'role escalation' },
  ]) {
    const response = await teacher.agent.post('/api/teacher/assignments').send(assignmentInput(overrides));
    assert.equal(response.status, 400, JSON.stringify(response.body));
  }
});

test('duplicate teacher assignment codes return 409 and draft-only delete preserves published work', async () => {
  const teacher = await createAccount('teacher', 'teacher');
  const code = `DUP-${randomUUID().slice(0, 8)}`;
  const first = await teacher.agent.post('/api/teacher/assignments').send(assignmentInput({ assignmentCode: code })).expect(201);
  await teacher.agent.post('/api/teacher/assignments').send(assignmentInput({ assignmentCode: code })).expect(409);
  await teacher.agent.patch(`/api/teacher/assignments/${first.body.assignment.id}`).send({ status: 'published' }).expect(200);
  await teacher.agent.delete(`/api/teacher/assignments/${first.body.assignment.id}`).expect(404);
  await teacher.agent.get(`/api/teacher/assignments/${first.body.assignment.id}`).expect(200);
});
