import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPistonAdapter, normalizePistonUrl } from '../apps/api/src/submissions/piston.js';
import { createJudge0Adapter } from '../apps/api/src/submissions/judge0.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Piston adapter reports unavailable when no API URL is configured', () => {
  const adapter = createPistonAdapter({ pistonApiUrl: '', pistonApiKey: '' });
  assert.equal(adapter.available, false);
  assert.equal(adapter.provider, 'piston');
});

test('Piston adapter reports available when API URL is configured', () => {
  const adapter = createPistonAdapter({ pistonApiUrl: 'http://localhost:2000', pistonApiKey: '' });
  assert.equal(adapter.available, true);
  assert.equal(adapter.provider, 'piston');
  assert.equal(adapter.executeUrl, 'http://localhost:2000/api/v2/execute');
});

test('Piston URL normalization handles root, subpath, and trailing slash variants', () => {
  assert.equal(normalizePistonUrl('http://localhost:2000'), 'http://localhost:2000/api/v2/execute');
  assert.equal(normalizePistonUrl('http://localhost:2000/'), 'http://localhost:2000/api/v2/execute');
  assert.equal(normalizePistonUrl('http://localhost:2000/api/v2'), 'http://localhost:2000/api/v2/execute');
  assert.equal(normalizePistonUrl('http://localhost:2000/api/v2/execute'), 'http://localhost:2000/api/v2/execute');
  assert.equal(normalizePistonUrl('https://emkc.org/api/v2/piston/execute'), 'https://emkc.org/api/v2/piston/execute');
  assert.equal(normalizePistonUrl(''), '');
});

test('Piston adapter correctly evaluates compilation error payload', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        language: 'cpp',
        version: '10.2.0',
        compile: {
          code: 1,
          output: 'solution.cpp:4:5: error: expected ";" before return',
          stderr: 'solution.cpp:4:5: error: expected ";" before return',
          stdout: '',
        },
        run: null,
      }),
    });

    const adapter = createPistonAdapter({ pistonApiUrl: 'http://localhost:2000' });
    const result = await adapter.executeSubmission(
      'int main() { int a = 5 return 0; }',
      'C++20',
      [{ input: '', expectedOutput: '5' }],
    );

    assert.equal(result.status, 'compilation_error');
    assert.match(result.compilerOutput, /error: expected/);
    assert.equal(result.results[0].status, 'compilation_error');
    assert.equal(result.results[0].exitCode, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Piston adapter correctly evaluates accepted output with whitespace tolerance', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        language: 'cpp',
        version: '10.2.0',
        compile: { code: 0, output: '', stderr: '', stdout: '' },
        run: { code: 0, stdout: 'Hello World\r\n', stderr: '', signal: null },
      }),
    });

    const adapter = createPistonAdapter({ pistonApiUrl: 'http://localhost:2000' });
    const result = await adapter.executeSubmission(
      '#include <iostream>\nint main() { std::cout << "Hello World\\n"; return 0; }',
      'C++20',
      [{ input: '', expectedOutput: 'Hello World\n' }],
    );

    assert.equal(result.status, 'accepted');
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].status, 'accepted');
    assert.equal(result.results[0].actualOutput, 'Hello World\r\n');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Piston adapter correctly evaluates wrong answer', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        language: 'cpp',
        version: '10.2.0',
        compile: { code: 0, output: '', stderr: '', stdout: '' },
        run: { code: 0, stdout: 'Wrong Answer Output\n', stderr: '', signal: null },
      }),
    });

    const adapter = createPistonAdapter({ pistonApiUrl: 'http://localhost:2000' });
    const result = await adapter.executeSubmission(
      '#include <iostream>\nint main() { return 0; }',
      'C++20',
      [{ input: '', expectedOutput: 'Expected Correct Output' }],
    );

    assert.equal(result.status, 'wrong_answer');
    assert.equal(result.results[0].status, 'wrong_answer');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Piston adapter correctly evaluates runtime error and SIGSEGV', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        language: 'cpp',
        version: '10.2.0',
        compile: { code: 0, output: '', stderr: '', stdout: '' },
        run: { code: 139, stdout: '', stderr: 'Segmentation fault (core dumped)\n', signal: 'SIGSEGV' },
      }),
    });

    const adapter = createPistonAdapter({ pistonApiUrl: 'http://localhost:2000' });
    const result = await adapter.executeSubmission(
      'int main() { int *p = nullptr; *p = 1; return 0; }',
      'C++20',
      [{ input: '', expectedOutput: '1' }],
    );

    assert.equal(result.status, 'runtime_error');
    assert.equal(result.results[0].status, 'runtime_error');
    assert.match(result.results[0].stderr, /Segmentation fault/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Piston adapter correctly evaluates time limit exceeded', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        language: 'cpp',
        version: '10.2.0',
        compile: { code: 0, output: '', stderr: '', stdout: '' },
        run: { code: null, stdout: '', stderr: 'Execution timed out', signal: 'SIGKILL', output: 'timed out' },
      }),
    });

    const adapter = createPistonAdapter({ pistonApiUrl: 'http://localhost:2000' });
    const result = await adapter.executeSubmission(
      'int main() { while(true) {} }',
      'C++20',
      [{ input: '', expectedOutput: 'done' }],
    );

    assert.equal(result.status, 'time_limit_exceeded');
    assert.equal(result.results[0].status, 'time_limit_exceeded');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Unified sandbox factory delegates to Piston when configured as default', () => {
  const adapter = createJudge0Adapter({
    sandboxProvider: 'piston',
    pistonApiUrl: 'http://localhost:2000',
    pistonApiKey: 'test-key',
  });

  assert.equal(adapter.available, true);
  assert.equal(adapter.provider, 'piston');
});

test('Hard rule audit: Piston adapter never imports or invokes process execution primitives', () => {
  const pistonCode = fs.readFileSync(path.join(rootDir, 'apps/api/src/submissions/piston.js'), 'utf8');
  assert.ok(!pistonCode.includes('child_' + 'process'), 'Piston adapter must never reference child_process');
  assert.ok(!pistonCode.includes('exec('), 'Piston adapter must never invoke exec');
  assert.ok(!pistonCode.includes('spawn('), 'Piston adapter must never invoke spawn');
});
