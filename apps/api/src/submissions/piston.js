/**
 * Piston Sandbox Adapter.
 *
 * Implements isolated code execution conforming to the official Piston API v2 specification:
 * https://piston.readthedocs.io/en/latest/api-v2/
 *
 * Supported endpoints:
 *   POST /api/v2/execute - Execute code in an isolated container
 *   GET  /api/v2/runtimes - List installed language runtimes and versions
 *
 * Supported DSA languages:
 *   C++20 (GCC / Piston cpp)
 *   Java 21 (OpenJDK / Piston java)
 *
 * Hard rule constraint: Student code is NEVER executed on the host server process.
 * Host process execution is strictly prohibited.
 */

export const PUBLIC_PISTON_EXECUTE_URL = 'https://emkc.org/api/v2/piston/execute';
export const PUBLIC_PISTON_RUNTIMES_URL = 'https://emkc.org/api/v2/piston/runtimes';

function normalizeOutput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\r\n/g, '\n').trim();
}

export function normalizePistonUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim().replace(/\/+$/, '');
  if (!url) return '';
  if (url.includes('emkc.org')) {
    if (url.endsWith('/execute')) return url;
    if (url.endsWith('/runtimes')) return url.replace(/\/runtimes$/, '/execute');
    if (url.endsWith('/piston')) return `${url}/execute`;
    if (url.endsWith('/api/v2')) return `${url}/piston/execute`;
    return `${url}/api/v2/piston/execute`;
  }
  if (url.endsWith('/execute')) return url;
  if (url.endsWith('/api/v2')) return `${url}/execute`;
  if (url.includes('/api/v2/')) return `${url}/execute`;
  return `${url}/api/v2/execute`;
}

function resolveJavaFileName(sourceCode) {
  const match = sourceCode.match(/public\s+(?:final\s+|abstract\s+)?class\s+([A-Za-z0-9_]+)/);
  if (match && match[1]) {
    return `${match[1]}.java`;
  }
  return 'Main.java';
}

function getPistonLanguageConfig(language, sourceCode) {
  if (language === 'C++20') {
    return {
      language: 'cpp',
      version: '*',
      files: [{ name: 'solution.cpp', content: sourceCode }],
    };
  }
  if (language === 'Java 21') {
    return {
      language: 'java',
      version: '*',
      files: [{ name: resolveJavaFileName(sourceCode), content: sourceCode }],
    };
  }
  throw new Error(`Unsupported language for Piston execution: ${language}`);
}

const STATUS_PRIORITY = {
  compilation_error: 5,
  runtime_error: 4,
  time_limit_exceeded: 3,
  wrong_answer: 2,
  internal_error: 1,
  accepted: 0,
};

export function createPistonAdapter(config = {}) {
  const rawUrl = config.pistonApiUrl || '';
  const executeUrl = normalizePistonUrl(rawUrl);
  const apiKey = config.pistonApiKey || '';

  if (!executeUrl) {
    return {
      provider: 'piston',
      available: false,
      executeUrl: '',
      runtimesUrl: '',
      async getRuntimes() { return []; },
      async executeSubmission() { return null; },
    };
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey ? {
      'Authorization': `Bearer ${apiKey}`,
      'X-Api-Key': apiKey,
    } : {}),
  };

  async function executeSingleTestCase(sourceCode, language, testCase, testIndex, timeLimitSeconds = 5) {
    const langConfig = getPistonLanguageConfig(language, sourceCode);
    const startMs = Date.now();

    const payload = {
      language: langConfig.language,
      version: langConfig.version,
      files: langConfig.files,
      stdin: testCase.input ?? '',
      args: [],
      compile_timeout: 10000,
      run_timeout: Math.max(1000, timeLimitSeconds * 1000),
      compile_memory_limit: -1,
      run_memory_limit: 268435456, // 256 MB in bytes
    };

    let response;
    try {
      response = await fetch(executeUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(Math.max(15000, (timeLimitSeconds + 5) * 1000)),
      });
    } catch (networkErr) {
      throw new Error(`Piston connection error (${networkErr.message}) connecting to ${executeUrl}`);
    }

    const elapsedMs = Date.now() - startMs;

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Piston API execution failed (HTTP ${response.status}): ${errText}`);
    }

    const data = await response.json();
    const compile = data.compile || null;
    const run = data.run || null;

    // 1. Compilation Error
    if (compile && ((compile.code !== 0 && compile.code !== null) || compile.signal)) {
      const compilerOutput = compile.output || compile.stderr || compile.stdout || 'Compilation error';
      return {
        testIndex,
        input: testCase.input ?? '',
        expectedOutput: testCase.expectedOutput ?? '',
        actualOutput: '',
        status: 'compilation_error',
        timeMs: elapsedMs,
        memoryKb: 0,
        stderr: compile.stderr || null,
        exitCode: compile.code ?? 1,
        compilerOutput,
      };
    }

    // 2. Time Limit Exceeded
    const isTimeout =
      (run?.signal === 'SIGKILL' || run?.signal === 'SIGTERM' || run?.signal === 'SIGXCPU') ||
      (typeof run?.output === 'string' && /timed?\s*out/i.test(run.output)) ||
      (typeof run?.stderr === 'string' && /timed?\s*out/i.test(run.stderr));

    if (isTimeout) {
      return {
        testIndex,
        input: testCase.input ?? '',
        expectedOutput: testCase.expectedOutput ?? '',
        actualOutput: run?.stdout ?? '',
        status: 'time_limit_exceeded',
        timeMs: Math.max(elapsedMs, timeLimitSeconds * 1000),
        memoryKb: 0,
        stderr: run?.stderr || 'Time limit exceeded',
        exitCode: run?.code ?? 137,
        compilerOutput: compile?.output || null,
      };
    }

    // 3. Runtime Error (Crash signal or non-zero exit code)
    if ((run && run.code !== 0 && run.code !== null) || run?.signal) {
      return {
        testIndex,
        input: testCase.input ?? '',
        expectedOutput: testCase.expectedOutput ?? '',
        actualOutput: run?.stdout ?? '',
        status: 'runtime_error',
        timeMs: elapsedMs,
        memoryKb: 1024,
        stderr: run?.stderr || run?.output || `Runtime error (${run?.signal || run?.code})`,
        exitCode: run?.code ?? (run?.signal ? 139 : 1),
        compilerOutput: compile?.output || null,
      };
    }

    // 4. Normal Output Evaluation
    const actualOutput = run?.stdout ?? '';
    const expectedOutput = testCase.expectedOutput ?? '';
    const isAccepted = normalizeOutput(actualOutput) === normalizeOutput(expectedOutput);

    return {
      testIndex,
      input: testCase.input ?? '',
      expectedOutput,
      actualOutput,
      status: isAccepted ? 'accepted' : 'wrong_answer',
      timeMs: elapsedMs,
      memoryKb: 1024,
      stderr: run?.stderr || null,
      exitCode: 0,
      compilerOutput: compile?.output || null,
    };
  }

  const runtimesUrl = executeUrl ? executeUrl.replace(/\/execute$/, '/runtimes') : '';

  return {
    provider: 'piston',
    available: true,
    executeUrl,
    runtimesUrl,

    /**
     * Query available runtimes from GET /api/v2/runtimes
     */
    async getRuntimes() {
      try {
        const response = await fetch(runtimesUrl, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return [];
        return await response.json();
      } catch {
        return [];
      }
    },

    /**
     * Execute a submission against an assignment's sample cases using Piston.
     * Returns { status, results, executionTimeMs, memoryKb, compilerOutput }.
     */
    async executeSubmission(sourceCode, language, sampleCases, timeLimitSeconds = 5) {
      if (!sampleCases || sampleCases.length === 0) {
        return {
          status: 'accepted',
          results: [],
          executionTimeMs: 0,
          memoryKb: 0,
          compilerOutput: null,
        };
      }

      // Execute sample cases concurrently in Piston sandbox
      const perTestResults = await Promise.all(
        sampleCases.map((tc, index) =>
          executeSingleTestCase(sourceCode, language, tc, index, timeLimitSeconds),
        ),
      );

      let worstStatus = 'accepted';
      let totalTimeMs = 0;
      let maxMemoryKb = 0;
      let compilerOutput = null;

      for (const res of perTestResults) {
        totalTimeMs += res.timeMs;
        if (res.memoryKb > maxMemoryKb) maxMemoryKb = res.memoryKb;
        if (res.compilerOutput && !compilerOutput) {
          compilerOutput = res.compilerOutput;
        }

        const currentRank = STATUS_PRIORITY[res.status] ?? 0;
        const worstRank = STATUS_PRIORITY[worstStatus] ?? 0;
        if (currentRank > worstRank) {
          worstStatus = res.status;
        }
      }

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
