/**
 * Sandboxed Execution Engine Adapter (Unified Sandbox Adapter).
 *
 * Supports both Piston and Judge0 isolated execution engines.
 * Default provider is Piston with seamless fallback to Judge0 when configured.
 *
 * Language mappings:
 *   C++20 (GCC / Piston cpp)
 *   Java 21 (OpenJDK 21 / Piston java)
 *
 * Hard rule constraint: Student code is NEVER executed on the host server process.
 * Host process execution is strictly prohibited.
 */

import { createPistonAdapter } from './piston.js';

export { createPistonAdapter };

const LANGUAGE_IDS = {
  'C++20': 76,
  'Java 21': 91,
};

// Judge0 status IDs -> LabTrack submission statuses
const STATUS_MAP = {
  1: 'queued',
  2: 'running',
  3: 'accepted',
  4: 'wrong_answer',
  5: 'time_limit_exceeded',
  6: 'compilation_error',
  7: 'runtime_error',
  8: 'runtime_error',
  9: 'runtime_error',
  10: 'runtime_error',
  11: 'runtime_error',
  12: 'runtime_error',
  13: 'internal_error',
  14: 'internal_error',
  15: 'memory_limit_exceeded',
};

function mapJudge0Status(statusId) {
  return STATUS_MAP[statusId] ?? 'internal_error';
}

function buildUnavailableAdapter(provider = 'sandbox') {
  return {
    provider,
    available: false,
    async submit() { return null; },
    async poll() { return null; },
    async executeSubmission() { return null; },
  };
}

function createJudge0DedicatedAdapter(config) {
  const apiUrl = config.judge0ApiUrl;
  const apiKey = config.judge0ApiKey;

  if (!apiUrl) {
    return buildUnavailableAdapter('judge0');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-Auth-Token': apiKey } : {}),
  };

  async function createBatchSubmissions(sourceCode, language, testCases, timeLimitSeconds = 5) {
    const languageId = LANGUAGE_IDS[language];
    if (!languageId) throw new Error(`Unsupported language: ${language}`);

    const submissions = testCases.map((testCase) => ({
      source_code: sourceCode,
      language_id: languageId,
      stdin: testCase.input || '',
      expected_output: testCase.expectedOutput || '',
      cpu_time_limit: timeLimitSeconds,
      memory_limit: 262144, // 256 MB in KB
      wall_time_limit: timeLimitSeconds * 2,
    }));

    const response = await fetch(`${apiUrl}/submissions/batch?base64_encoded=false&wait=false`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ submissions }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Judge0 batch create failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    return data.map((item) => item.token);
  }

  async function getBatchResults(tokens) {
    const tokenStr = tokens.join(',');
    const response = await fetch(
      `${apiUrl}/submissions/batch?tokens=${tokenStr}&base64_encoded=false&fields=token,status,stdout,stderr,compile_output,time,memory,exit_code`,
      { headers },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Judge0 batch get failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    return data.submissions;
  }

  async function pollUntilDone(tokens, maxAttempts = 30, intervalMs = 2000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const results = await getBatchResults(tokens);
      const allDone = results.every((r) => r.status && r.status.id > 2);
      if (allDone) return results;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return getBatchResults(tokens);
  }

  return {
    provider: 'judge0',
    available: true,

    async executeSubmission(sourceCode, language, sampleCases) {
      if (!sampleCases || sampleCases.length === 0) {
        return {
          status: 'accepted',
          results: [],
          executionTimeMs: 0,
          memoryKb: 0,
          compilerOutput: null,
        };
      }

      const tokens = await createBatchSubmissions(sourceCode, language, sampleCases);
      const judge0Results = await pollUntilDone(tokens);

      let worstStatus = 'accepted';
      let totalTimeMs = 0;
      let maxMemoryKb = 0;
      let compilerOutput = null;

      const perTestResults = judge0Results.map((r, index) => {
        const testStatus = mapJudge0Status(r.status?.id ?? 13);
        const timeMs = r.time ? Math.round(parseFloat(r.time) * 1000) : 0;
        const memKb = r.memory ?? 0;

        totalTimeMs += timeMs;
        if (memKb > maxMemoryKb) maxMemoryKb = memKb;

        if (r.compile_output && !compilerOutput) {
          compilerOutput = r.compile_output;
        }

        if (testStatus !== 'accepted' && worstStatus === 'accepted') {
          worstStatus = testStatus;
        }

        return {
          testIndex: index,
          input: sampleCases[index]?.input ?? '',
          expectedOutput: sampleCases[index]?.expectedOutput ?? '',
          actualOutput: r.stdout ?? '',
          status: testStatus,
          timeMs,
          memoryKb: memKb,
          stderr: r.stderr ?? null,
          exitCode: r.exit_code ?? null,
        };
      });

      return {
        status: worstStatus,
        results: perTestResults,
        executionTimeMs: totalTimeMs,
        memoryKb: maxMemoryKb,
        compilerOutput,
      };
    },
  };
}

export function createJudge0Adapter(config = {}) {
  const provider = config.sandboxProvider || 'piston';

  if (provider === 'judge0') {
    if (config.judge0ApiUrl) {
      return createJudge0DedicatedAdapter(config);
    }
    if (config.pistonApiUrl) {
      return createPistonAdapter(config);
    }
    return buildUnavailableAdapter('judge0');
  }

  // Provider is 'piston' (default)
  if (config.pistonApiUrl) {
    return createPistonAdapter(config);
  }
  if (config.judge0ApiUrl) {
    return createJudge0DedicatedAdapter(config);
  }
  return buildUnavailableAdapter('piston');
}
