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

before(async () => {
  await applyTestMigrations();
  await clearTestData();
});

after(async () => {
  await clearTestData();
  await pool.end();
});

function newEmail(prefix = 'student') {
  return `${prefix}-${randomUUID()}@example.edu`;
}

async function createStudent(email = newEmail(), password = `Student-${randomBytes(16).toString('hex')}!`) {
  const response = await request(app).post('/api/auth/register').send({
    displayName: '  Demo Student  ', email, password,
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return { email: email.trim().toLowerCase(), password, user: response.body.user };
}

test('health endpoint confirms MySQL connectivity', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true });
});

test('MySQL sessions use UTC and production security headers permit the Preview iframe', async () => {
  const [rows] = await pool.query('SELECT @@session.time_zone AS session_time_zone');
  assert.equal(rows[0].session_time_zone, '+00:00');
  const productionApp = createApp({
    pool,
    config: { ...config, environment: 'production', cookieSameSite: 'none', cookieSecure: true },
    users,
  });
  const response = await request(productionApp).get('/api/health').expect(200);
  assert.equal(response.headers['x-frame-options'], undefined);
  assert.doesNotMatch(response.headers['content-security-policy'] ?? '', /frame-ancestors/i);
  assert.match(response.headers['cache-control'], /private, no-store/);
});

test('student registration trims input, lowercases email, and stores a bcrypt hash', async () => {
  const email = newEmail();
  const password = `Pass-${randomBytes(16).toString('hex')}!`;
  const response = await request(app).post('/api/auth/register').send({
    displayName: '  Test Student  ', email: `  ${email.toUpperCase()}  `, password,
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.user.displayName, 'Test Student');
  assert.equal(response.body.user.email, email);
  assert.equal(response.body.user.role, 'student');
  assert.equal('password' in response.body.user, false);
  assert.equal('password_hash' in response.body.user, false);

  const stored = await users.findByEmail(email);
  assert.ok(stored.password_hash.startsWith('$2'));
  assert.notEqual(stored.password_hash, password);
  assert.equal(await bcrypt.compare(password, stored.password_hash), true);
});

test('public registration rejects teacher role self-assignment', async () => {
  const response = await request(app).post('/api/auth/register').send({
    displayName: 'Role Escalation Attempt', email: newEmail(), password: `Pass-${randomBytes(16).toString('hex')}!`, role: 'teacher',
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Invalid request.');
});

test('email uniqueness is case-insensitive and duplicate registration returns 409', async () => {
  const email = newEmail();
  await createStudent(email);
  const duplicate = await request(app).post('/api/auth/register').send({
    displayName: 'Duplicate', email: email.toUpperCase(), password: `Pass-${randomBytes(16).toString('hex')}!`,
  });
  assert.equal(duplicate.status, 409);
});

test('login issues an HTTP-only SameSite cookie and session endpoint returns no token', async () => {
  const account = await createStudent();
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ email: account.email, password: account.password });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'student');
  assert.equal('token' in login.body, false);
  const setCookie = login.headers['set-cookie']?.[0] ?? '';
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.doesNotMatch(setCookie, /; Secure/i);
  assert.match(setCookie, /Max-Age=7200/i);

  const session = await agent.get('/api/auth/me');
  assert.equal(session.status, 200);
  assert.equal(session.body.user.id, account.user.id);
  assert.equal(session.body.user.role, 'student');
});

test('invalid credentials and missing sessions do not authorize protected routes', async () => {
  const account = await createStudent();
  const badLogin = await request(app).post('/api/auth/login').send({ email: account.email, password: 'wrong-password' });
  assert.equal(badLogin.status, 401);
  assert.equal(badLogin.body.error, 'Email or password is incorrect.');
  const unauthenticated = await request(app).get('/api/student/me');
  assert.equal(unauthenticated.status, 401);
});

test('student route is allowed to students and forbidden to teachers', async () => {
  const account = await createStudent();
  const student = request.agent(app);
  await student.post('/api/auth/login').send({ email: account.email, password: account.password }).expect(200);
  await student.get('/api/student/me').expect(200);
  await student.get('/api/teacher/me').expect(403);
});

test('provisioned teacher can log in and access teacher-only routes', async () => {
  const email = newEmail('teacher');
  const password = `Teacher-${randomBytes(16).toString('hex')}!`;
  const passwordHash = await bcrypt.hash(password, 12);
  const teacher = await users.createOrUpdateTeacher({ displayName: 'Demo Teacher', email, passwordHash });
  assert.equal(teacher.role, 'teacher');
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  const response = await agent.get('/api/teacher/me').expect(200);
  assert.equal(response.body.user.role, 'teacher');
  await agent.get('/api/student/me').expect(403);
});

test('role changes in MySQL take effect for existing JWT sessions', async () => {
  const account = await createStudent();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: account.email, password: account.password }).expect(200);
  await pool.execute("UPDATE users SET role = 'teacher' WHERE id = ?", [account.user.id]);
  await agent.get('/api/student/me').expect(403);
  await agent.get('/api/teacher/me').expect(200);
});

test('logout expires the authentication cookie', async () => {
  const response = await request(app).post('/api/auth/logout').expect(204);
  const setCookie = response.headers['set-cookie']?.[0] ?? '';
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Expires=Thu, 01 Jan 1970/i);
});


test('explicit HTTPS cookie configuration issues Secure and SameSite=None attributes', async () => {
  const account = await createStudent();
  const httpsConfig = { ...config, cookieSameSite: 'none', cookieSecure: true };
  const httpsApp = createApp({ pool, config: httpsConfig, users });
  const response = await request(httpsApp).post('/api/auth/login').send({ email: account.email, password: account.password });
  assert.equal(response.status, 200);
  const setCookie = response.headers['set-cookie']?.[0] ?? '';
  assert.match(setCookie, /; Secure/i);
  assert.match(setCookie, /SameSite=None/i);
  assert.match(setCookie, /HttpOnly/i);
});

test('deactivated accounts lose access even when their JWT cookie is still present', async () => {
  const account = await createStudent();
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: account.email, password: account.password }).expect(200);
  await pool.execute('UPDATE users SET is_active = FALSE WHERE id = ?', [account.user.id]);
  await agent.get('/api/student/me').expect(401);
});


test('registration rejects blank names and passwords below the minimum length', async () => {
  const blankName = await request(app).post('/api/auth/register').send({
    displayName: '   ', email: newEmail(), password: `Pass-${randomBytes(16).toString('hex')}!`,
  });
  assert.equal(blankName.status, 400);
  const shortPassword = await request(app).post('/api/auth/register').send({
    displayName: 'Valid Name', email: newEmail(), password: 'short',
  });
  assert.equal(shortPassword.status, 400);
});
