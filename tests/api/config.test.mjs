import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../../apps/api/src/config.js';

const base = {
  DATABASE_URL: 'mysql://test.invalid/labtrack',
  JWT_SECRET: 'unused-test-secret-material-at-least-32-chars',
};

test('API config defaults to HTTPS-eligible cookies in the managed environment', () => {
  const config = loadConfig({ ...base, NODE_ENV: 'development' });
  assert.equal(config.port, 3000);
  assert.equal(config.mysqlSsl, true);
  assert.equal(config.cookieSameSite, 'none');
  assert.equal(config.cookieSecure, true);
});

test('API config rejects SameSite=None without Secure', () => {
  assert.throws(() => loadConfig({
    ...base,
    AUTH_COOKIE_SAME_SITE: 'none',
    AUTH_COOKIE_SECURE: 'false',
  }), /requires AUTH_COOKIE_SECURE=true/);
});

test('API config accepts explicitly secure cross-site cookies', () => {
  const config = loadConfig({
    ...base,
    AUTH_COOKIE_SAME_SITE: 'none',
    AUTH_COOKIE_SECURE: 'true',
  });
  assert.equal(config.cookieSameSite, 'none');
  assert.equal(config.cookieSecure, true);
});

test('API config rejects undersized JWT secrets', () => {
  assert.throws(() => loadConfig({ ...base, JWT_SECRET: 'too-short' }), /Invalid API configuration/);
});
