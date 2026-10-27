import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app.js';

const staticDirectory = await mkdtemp(path.join(os.tmpdir(), 'labtrack-static-'));
await writeFile(path.join(staticDirectory, 'index.html'), '<!doctype html><title>LabTrack test shell</title>');
const app = createApp({
  pool: { query: async () => [[{ ready: 1 }], undefined] },
  users: {},
  config: {
    environment: 'production',
    cookieName: 'labtrack_session',
    cookieSameSite: 'none',
    cookieSecure: true,
    cookieMaxAgeMs: 3_600_000,
    jwtSecret: 'test-secret-only-for-static-routing',
    jwtExpiresIn: '1h',
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMax: 10,
  },
  staticDirectory,
});

after(async () => {
  await rm(staticDirectory, { recursive: true, force: true });
});

test('production serves extensionless client routes from the SPA entrypoint', async () => {
  const response = await request(app)
    .get('/student/dashboard')
    .set('Accept', 'text/html')
    .expect(200);
  assert.match(response.text, /LabTrack test shell/);
});

test('production keeps missing static assets as 404 instead of returning the SPA shell', async () => {
  const response = await request(app)
    .get('/assets/missing.js')
    .set('Accept', '*/*')
    .expect(404);
  assert.match(response.headers['content-type'], /application\/json/);
  assert.deepEqual(response.body, { error: 'Route not found.' });
});

test('production keeps unknown API routes as JSON 404s instead of returning HTML', async () => {
  const response = await request(app)
    .get('/api/unknown')
    .set('Accept', 'text/html')
    .expect(404);
  assert.match(response.headers['content-type'], /application\/json/);
  assert.deepEqual(response.body, { error: 'Route not found.' });
});
