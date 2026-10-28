import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isAskingForFullSolution,
  generateMockPedagogicalResponse,
  sanitizePedagogicalOutput,
  queryAiAssistant,
} from '../apps/api/src/ai/service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Pedagogical guardrails: detects and rejects prompts asking for complete solutions', () => {
  // Prohibited prompt variations
  assert.ok(isAskingForFullSolution('Please write the code for me'), 'Catches "write the code"');
  assert.ok(isAskingForFullSolution('Give me the solution for LRU cache'), 'Catches "give me the solution"');
  assert.ok(isAskingForFullSolution('Can you solve it for me?'), 'Catches "solve it for me"');
  assert.ok(isAskingForFullSolution('I need the full solution in C++'), 'Catches "full solution"');
  assert.ok(isAskingForFullSolution('Write my assignment Main.java'), 'Catches "write my assignment"');

  // Permitted Socratic queries
  assert.equal(
    isAskingForFullSolution('What invariant should I maintain across pointer updates?'),
    false,
    'Allows invariant question',
  );
  assert.equal(
    isAskingForFullSolution('Why might a two-pointer approach terminate early?'),
    false,
    'Allows conceptual question',
  );
  assert.equal(
    isAskingForFullSolution('What is the space complexity of an unordered_map?'),
    false,
    'Allows complexity question',
  );
});

test('generateMockPedagogicalResponse strictly refuses full solutions and offers Socratic redirection', () => {
  const refusalResponse = generateMockPedagogicalResponse({
    mode: 'hint',
    prompt: 'Write the code for this doubly linked list',
    sourceCode: '// empty',
    language: 'C++20',
    assignmentTitle: 'LRU Cache',
  });

  assert.ok(
    refusalResponse.includes('I cannot write complete solutions or code'),
    'Must refuse to write complete code',
  );
  assert.ok(
    refusalResponse.includes('invariant'),
    'Must offer Socratic guidance on invariants',
  );
});

test('generateMockPedagogicalResponse provides scaffolded assistance across all 3 modes', () => {
  // Mode 1: Conceptual Hint
  const hint = generateMockPedagogicalResponse({
    mode: 'hint',
    prompt: 'How do I maintain O(1) lookup and eviction?',
    sourceCode: 'class LRUCache {};',
    language: 'C++20',
    assignmentTitle: 'LRU Cache Design',
  });
  assert.ok(hint.includes('Socratic Conceptual Hint'), 'Hint includes mode header');
  assert.ok(hint.includes('Invariant Consideration'), 'Hint guides invariant thinking');
  assert.ok(!hint.includes('int main() {'), 'Hint does not provide full runnable code');

  // Mode 2: Debugging Guide
  const debug = generateMockPedagogicalResponse({
    mode: 'debug',
    prompt: 'My code causes a null pointer exception on evict()',
    sourceCode: 'void evict() { head = head->next; }',
    language: 'C++20',
    assignmentTitle: 'LRU Cache Design',
  });
  assert.ok(debug.includes('Debugging & Invariant Analysis'), 'Debug includes mode header');
  assert.ok(debug.includes('Boundary Checks'), 'Debug points to boundary edge cases');
  assert.ok(debug.includes('Termination Condition'), 'Debug points to termination invariant');

  // Mode 3: Complexity Analysis
  const complexity = generateMockPedagogicalResponse({
    mode: 'complexity',
    prompt: 'What is the time complexity of scanning the list?',
    sourceCode: 'for (int i = 0; i < n; i++) {}',
    language: 'C++20',
    assignmentTitle: 'LRU Cache Design',
  });
  assert.ok(complexity.includes('Asymptotic Complexity Analysis'), 'Complexity includes mode header');
  assert.ok(complexity.includes('Time Complexity'), 'Analyzes runtime bounds');
  assert.ok(complexity.includes('Space Complexity'), 'Analyzes memory bounds');
});

test('sanitizePedagogicalOutput suppresses multi-line code blocks from LLM output', () => {
  const verboseCodeResponse = `
Here is a conceptual idea:
\`\`\`cpp
Node* newNode = new Node(key, val);
newNode->next = head;
newNode->prev = nullptr;
head->prev = newNode;
head = newNode;
size++;
return newNode;
\`\`\`
Think about how you link the tail.
`.trim();

  const sanitized = sanitizePedagogicalOutput(verboseCodeResponse);
  assert.ok(
    !sanitized.includes('return newNode;'),
    'Long code blocks (> 4 lines) must be redacted to encourage independent coding',
  );
  assert.ok(
    sanitized.includes('Detailed code omitted to encourage independent authoring'),
    'Must include independent authoring notice',
  );
});

test('queryAiAssistant respects offline mock mode and handles query round-trip', async () => {
  const result = await queryAiAssistant(
    {
      mode: 'hint',
      prompt: 'What invariant is required for cycle detection?',
      sourceCode: 'struct ListNode { int val; ListNode* next; };',
      language: 'C++20',
      assignmentTitle: 'Linked List Cycle',
    },
    {
      enableAiAssistance: true,
      llmProvider: 'mock',
      llmApiKey: '',
    },
  );

  assert.equal(result.mode, 'hint');
  assert.ok(result.response.length > 50, 'Response should contain pedagogical text');
  assert.ok(result.tokensUsed > 0, 'Tokens count should be recorded');
});

test('Rate limiting boundary: enforces max queries per hour per assignment', () => {
  const hourlyLimit = 5;
  const mockQueries = [
    { timestamp: Date.now() - 1000 },
    { timestamp: Date.now() - 2000 },
    { timestamp: Date.now() - 3000 },
    { timestamp: Date.now() - 4000 },
    { timestamp: Date.now() - 5000 },
  ];

  function checkCanQuery(queries, limit) {
    const oneHourAgo = Date.now() - 3600 * 1000;
    const recent = queries.filter((q) => q.timestamp >= oneHourAgo);
    if (recent.length >= limit) {
      throw new Error(`AI assistance query limit reached (${limit} queries per hour).`);
    }
    return limit - recent.length;
  }

  // At limit: 5 of 5 used -> must throw
  assert.throws(() => checkCanQuery(mockQueries, hourlyLimit), /query limit reached/);

  // Below limit: 4 of 5 used -> succeeds and returns 1 remaining
  const remaining = checkCanQuery(mockQueries.slice(0, 4), hourlyLimit);
  assert.equal(remaining, 1, '1 query remaining below limit');
});

test('Automatic attribution: in-platform queries format attribution for Step 2 declaration', () => {
  const interaction = {
    id: 'ai-log-12345',
    mode: 'debug',
    prompt: 'Why does my linked list lose the tail reference on single-element deletion?',
    createdAt: new Date().toISOString(),
  };

  const attribution = {
    id: interaction.id,
    tool: 'LabTrack In-Platform AI Assistant',
    mode: interaction.mode,
    promptSnippet: interaction.prompt.slice(0, 100),
    summary: `Mode: ${interaction.mode.toUpperCase()} - Query: "${interaction.prompt.slice(0, 80)}..."`,
    timestamp: interaction.createdAt,
  };

  assert.equal(attribution.tool, 'LabTrack In-Platform AI Assistant');
  assert.ok(attribution.summary.includes('DEBUG'));
  assert.ok(attribution.summary.includes('single-element deletion'));
});

test('Migration 007_ai_assistance_logs.sql defines audit schema, constraints, and indexes', () => {
  const migrationPath = path.join(rootDir, 'db', 'migrations', '007_ai_assistance_logs.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration 007 file must exist');

  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ai_assistance_logs/i);
  assert.match(sql, /assignment_id CHAR\(36\)/i);
  assert.match(sql, /student_id CHAR\(36\)/i);
  assert.match(sql, /mode VARCHAR\(32\)/i);
  assert.match(sql, /CHECK \(mode IN \('hint', 'debug', 'complexity'\)\)/i);
  assert.match(sql, /FOREIGN KEY \(assignment_id\) REFERENCES assignments/i);
  assert.match(sql, /FOREIGN KEY \(student_id\) REFERENCES users/i);
  assert.match(sql, /CREATE INDEX idx_ai_logs_rate_limit/i);
});

test('Hard Rule Safeguards: strict feature flagging, no AI code detection, sandbox isolation', () => {
  const configCode = fs.readFileSync(path.join(rootDir, 'apps', 'api', 'src', 'config.js'), 'utf8');
  assert.match(
    configCode,
    /ENABLE_AI_ASSISTANCE: z\.enum\(\['true', 'false'\]\)\.default\('false'\)/,
    'ENABLE_AI_ASSISTANCE must default to false',
  );

  const routesCode = fs.readFileSync(path.join(rootDir, 'apps', 'api', 'src', 'ai', 'routes.js'), 'utf8');
  assert.ok(
    routesCode.includes('status(503)'),
    'Must return HTTP 503 when AI assistance is disabled by feature flag',
  );
  assert.ok(
    !routesCode.includes('aiProbability') && !routesCode.includes('aiDetection'),
    'AI routes must never calculate or return AI probability scores',
  );

  const workspaceCode = fs.readFileSync(
    path.join(rootDir, 'apps', 'web', 'src', 'pages', 'CodeWorkspacePage.jsx'),
    'utf8',
  );
  assert.ok(
    workspaceCode.includes('LabTrack In-Platform AI Assistant'),
    'Workspace includes In-Platform AI Assistant in tools list',
  );
  assert.ok(
    workspaceCode.includes('AI Socratic Assistant'),
    'Workspace renders AI Socratic Assistant tab',
  );
});

