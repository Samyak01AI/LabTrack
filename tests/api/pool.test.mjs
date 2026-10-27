import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldUseMysqlTls } from '../../apps/api/src/db/pool.js';

test('MySQL TLS cannot be disabled for a non-loopback server by local environment flags', () => {
  assert.equal(shouldUseMysqlTls('127.0.0.1', false), false);
  assert.equal(shouldUseMysqlTls('localhost', false), false);
  assert.equal(shouldUseMysqlTls('::1', false), false);
  assert.equal(shouldUseMysqlTls('127.0.0.1', true), true);
  assert.equal(shouldUseMysqlTls('gateway01.eu-central-1.prod.aws.tidbcloud.com', false), true);
});
