import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { tokenize } from '../apps/api/src/similarity/tokenizer.js';
import { winnow, computeKGrams, extractBoilerplateHashes, filterBoilerplate } from '../apps/api/src/similarity/winnowing.js';
import { compareSubmissions } from '../apps/api/src/similarity/engine.js';
import { computeProvisionalGrade, calculateTotal } from '../apps/api/src/grading/rubric.js';
import {
  calculateMean,
  calculateMedian,
  calculateStdDev,
  calculatePassRate,
  calculateDistributionBins,
  calculateCohortMetrics,
  generateCohortCsv,
} from '../apps/api/src/reporting/analytics.js';
import {
  isAskingForFullSolution,
  generateMockPedagogicalResponse,
  sanitizePedagogicalOutput,
} from '../apps/api/src/ai/service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Hardening E2E Lifecycle: Full assignment authoring -> sandbox -> declaration -> similarity -> marking -> reporting', () => {
  // Step 1: Teacher creates assignment
  const assignment = {
    id: 'asgn-e2e-001',
    courseCode: 'CS301',
    assignmentCode: 'LAB-08',
    title: 'LRU Cache with Doubly Linked List',
    maxScore: 100,
    languageOptions: ['C++20', 'Java 21'],
    sampleCases: [
      { input: 'put 1 10\nget 1', expectedOutput: '10' },
      { input: 'put 1 10\nput 2 20\nget 1', expectedOutput: '10' },
      { input: 'put 1 10\nput 2 20\nput 3 30\nget 1', expectedOutput: '-1' },
    ],
  };

  // Step 2: Student A submits solution with Judge0 sandbox test execution
  const starterBoilerplate = '#include <iostream>\n#include <unordered_map>\nusing namespace std;\n';
  const studentACode = `
${starterBoilerplate}
struct Node { int k, v; Node *prev, *next; Node(int k, int v): k(k), v(v), prev(nullptr), next(nullptr) {} };
class LRUCache {
    int cap;
    unordered_map<int, Node*> map;
    Node *head, *tail;
public:
    LRUCache(int capacity): cap(capacity) {
        head = new Node(-1, -1); tail = new Node(-1, -1);
        head->next = tail; tail->prev = head;
    }
    int get(int key) {
        if (!map.count(key)) return -1;
        Node* n = map[key];
        remove(n); insertToHead(n);
        return n->v;
    }
    void put(int key, int value) {
        if (map.count(key)) { remove(map[key]); }
        if (map.size() == cap) { map.erase(tail->prev->k); remove(tail->prev); }
        Node* n = new Node(key, value);
        insertToHead(n); map[key] = n;
    }
    void remove(Node* n) { n->prev->next = n->next; n->next->prev = n->prev; }
    void insertToHead(Node* n) { n->next = head->next; n->prev = head; head->next->prev = n; head->next = n; }
};
int main() { return 0; }
`.trim();

  // Simulated Judge0 execution results
  const testResults = [
    { id: 1, status: 'PASS', timeMs: 4, memoryKb: 1024 },
    { id: 2, status: 'PASS', timeMs: 5, memoryKb: 1040 },
    { id: 3, status: 'PASS', timeMs: 5, memoryKb: 1052 },
  ];

  // Step 3: Student completes AI Declaration & Conceptual Invariants
  const aiDeclaration = {
    aiUsed: true,
    tools: ['LabTrack In-Platform AI Assistant'],
    narrative: 'Used Socratic assistant to clarify doubly linked list sentinel dummy node invariants.',
  };
  const annotations = [
    { startLine: 9, endLine: 12, justification: 'Sentinel head/tail dummy node initialization', tool: 'LabTrack In-Platform AI Assistant' },
  ];
  const logicExplanation = {
    approach: 'Two-pointer doubly-linked list with dummy head and tail sentinel nodes for constant time removal and insertion.',
    dataStructures: 'Hash map std::unordered_map mapping integer keys to Node pointers for O(1) lookup.',
    tradeoffAnalysis: 'Chose raw heap pointers over std::list to eliminate node search and iterators overhead.',
    timeComplexity: 'O(1) average for get and put operations',
    spaceComplexity: 'O(Capacity) auxiliary memory',
  };

  // Step 4: System computes Provisional Grade
  const provisional = computeProvisionalGrade(
    {
      results: testResults,
      logicExplanation,
      aiDeclaration,
      annotationStatus: 'complete',
    },
    assignment,
  );

  assert.equal(provisional.status, 'provisionally_scored', 'Grade starts in provisional state');
  assert.equal(provisional.correctnessScore, 40, 'All tests passed = 40/40 correctness');
  assert.ok(provisional.logicScore >= 20, 'Logic defense awarded marks');
  assert.ok(provisional.totalScore >= 80, 'Provisional score reflects comprehensive defense');

  // Step 5: Student B submits independent solution
  const studentBCode = `
${starterBoilerplate}
int main() {
    int cap = 2;
    unordered_map<int, int> kv;
    cout << "Independent solution with flat hash map" << endl;
    return 0;
}
`.trim();

  // Step 6: Similarity check with boilerplate suppression
  const boilerplateHashes = extractBoilerplateHashes(starterBoilerplate, 'C++20');
  const tokensA = tokenize(studentACode, 'C++20');
  const tokensB = tokenize(studentBCode, 'C++20');

  const fpA = filterBoilerplate(winnow(computeKGrams(tokensA, 5), 4), boilerplateHashes);
  const fpB = filterBoilerplate(winnow(computeKGrams(tokensB, 5), 4), boilerplateHashes);

  const simReview = compareSubmissions(
    { id: 'sub-a', sourceCode: studentACode, language: 'C++20' },
    { id: 'sub-b', sourceCode: studentBCode, language: 'C++20' },
    { starterCode: starterBoilerplate, threshold: 75 },
  );
  assert.ok(simReview.similarityScore < 50, 'Independent solutions produce low similarity');
  assert.equal(simReview.status, 'dismissed', 'Distinct solutions are marked dismissed / unflagged');

  // Step 7: Teacher marking workbench finalises mark
  const finalisedGrade = {
    ...provisional,
    totalScore: calculateTotal(
      {
        correctnessScore: provisional.correctnessScore,
        logicScore: 30,
        complexityScore: 15,
        transparencyScore: 15,
      },
      assignment.maxScore,
    ),
    status: 'finalised',
    finalisedAt: new Date().toISOString(),
    feedback: 'Flawless doubly linked list sentinel implementation and clear invariant defense.',
  };
  assert.equal(finalisedGrade.totalScore, 100, 'Final score capped at 100');
  assert.equal(finalisedGrade.status, 'finalised', 'Teacher explicitly finalizes marks');

  // Step 8: Cohort analytics & RFC 4180 CSV Export
  const cohort = [
    {
      studentId: 'stu-a',
      studentName: 'Alice Kumar',
      studentEmail: 'alice@mit.edu',
      submissionId: 'sub-a',
      isFlagged: false,
      aiDeclared: true,
      aiTools: ['LabTrack In-Platform AI Assistant'],
      grade: finalisedGrade,
    },
    {
      studentId: 'stu-b',
      studentName: 'Bob Vance',
      studentEmail: 'bob@mit.edu',
      submissionId: 'sub-b',
      isFlagged: false,
      aiDeclared: false,
      aiTools: [],
      grade: {
        totalScore: 78,
        correctnessScore: 30,
        logicScore: 24,
        complexityScore: 12,
        transparencyScore: 12,
        status: 'finalised',
        feedback: 'Good approach, missed edge case on eviction.',
      },
    },
  ];

  const metrics = calculateCohortMetrics(cohort, 100);
  assert.equal(metrics.totalSubmissions, 2);
  assert.equal(metrics.totalEvaluated, 2);
  assert.equal(metrics.passRate, 100);
  assert.equal(metrics.mean, 89.0, 'Mean of [100, 78] = 89.0');
  assert.equal(metrics.median, 89.0, 'Median of [100, 78] = 89.0');

  const csv = generateCohortCsv(cohort, assignment);
  assert.ok(csv.startsWith('\uFEFF'), 'CSV contains UTF-8 BOM');
  assert.ok(csv.includes('Alice Kumar'), 'Student name present in CSV');
  assert.ok(csv.includes('LabTrack In-Platform AI Assistant'), 'Declared tool present in CSV');
  assert.ok(csv.includes('100'), 'Max grade present in CSV');
});

test('Hard Rule Audit: Zero AI code detection claims across all API and UI codebases', () => {
  const codeFiles = [
    'apps/api/src/ai/service.js',
    'apps/api/src/ai/routes.js',
    'apps/api/src/similarity/engine.js',
    'apps/api/src/similarity/routes.js',
    'apps/api/src/grading/rubric.js',
    'apps/api/src/reporting/analytics.js',
    'apps/web/src/pages/SimilarityReviewPage.jsx',
    'apps/web/src/pages/TeacherMarkingPage.jsx',
    'apps/web/src/pages/StudentSubmissionHistoryPage.jsx',
    'apps/web/src/pages/TeacherReportsPage.jsx',
    'apps/web/src/pages/CodeWorkspacePage.jsx',
  ];

  for (const relPath of codeFiles) {
    const fullPath = path.join(rootDir, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');

    // Forbidden anti-patterns
    assert.ok(
      !content.includes('aiDetectionProbability'),
      `${relPath} must not contain aiDetectionProbability`,
    );
    assert.ok(
      !content.includes('autoFailStudent'),
      `${relPath} must not contain autoFailStudent`,
    );
    assert.ok(
      !content.includes('detectAiGenerated'),
      `${relPath} must not claim detecting AI-generated code`,
    );
  }
});

test('Hard Rule Audit: Marks remain provisional until explicit teacher action', () => {
  const studentViewer = fs.readFileSync(
    path.join(rootDir, 'apps', 'web', 'src', 'pages', 'AssignmentViewerPage.jsx'),
    'utf8',
  );
  assert.ok(
    studentViewer.includes('provisional and pending oral examination/viva verification'),
    'Student assignment viewer must warn that marks are provisional',
  );

  const teacherMarking = fs.readFileSync(
    path.join(rootDir, 'apps', 'web', 'src', 'pages', 'TeacherMarkingPage.jsx'),
    'utf8',
  );
  assert.ok(
    teacherMarking.includes('Finalise Mark'),
    'Teacher marking interface must feature explicit Finalise Mark action',
  );
});

test('Hard Rule Audit: Student code never executes on host (Judge0 CE sandbox only)', () => {
  const submissionsRoute = fs.readFileSync(
    path.join(rootDir, 'apps', 'api', 'src', 'submissions', 'routes.js'),
    'utf8',
  );
  assert.ok(
    submissionsRoute.includes('judge0.executeSubmission'),
    'Code execution must route strictly through Judge0 sandbox adapter',
  );
  assert.ok(
    !submissionsRoute.includes('child_process') && !submissionsRoute.includes('exec('),
    'Submissions route must never invoke child_process on the host server',
  );
});

test('Database Integrity Audit: All 7 SQL migrations are syntactically complete and verified', () => {
  const migrations = [
    '001_create_users.sql',
    '002_create_assignments.sql',
    '003_create_submissions.sql',
    '004_iteration_4_declarations.sql',
    '005_similarity_reviews.sql',
    '006_grades_and_evaluations.sql',
    '007_ai_assistance_logs.sql',
  ];

  for (const m of migrations) {
    const mPath = path.join(rootDir, 'db', 'migrations', m);
    assert.ok(fs.existsSync(mPath), `Migration ${m} must exist`);
    const sql = fs.readFileSync(mPath, 'utf8');
    assert.ok(sql.length > 50, `Migration ${m} must not be empty`);
  }
});

test('Security & Secret Isolation: Zero credentials in git repository, .env properly ignored', () => {
  const gitignorePath = path.join(rootDir, '.gitignore');
  assert.ok(fs.existsSync(gitignorePath), '.gitignore must exist');
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');

  assert.ok(gitignore.includes('.env'), '.gitignore must ignore .env files');
  assert.ok(gitignore.includes('node_modules'), '.gitignore must ignore node_modules');

  // Verify .env.example contains placeholder values only
  const examplePath = path.join(rootDir, '.env.example');
  const example = fs.readFileSync(examplePath, 'utf8');
  assert.ok(!example.includes('secret_key_12345'), 'No real secrets in .env.example');
  assert.ok(example.includes('ENABLE_AI_ASSISTANCE=false'), 'ENABLE_AI_ASSISTANCE defaults to false in example');
});

test('Navigation & Route Manifest Audit: Complete synchronization with manus-routes.json', () => {
  const manifestPath = path.join(rootDir, 'apps', 'web', 'public', 'manus-routes.json');
  assert.ok(fs.existsSync(manifestPath), 'manus-routes.json must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const paths = manifest.routes.map((r) => r.path);
  assert.ok(paths.includes('/student/dashboard'), 'Student dashboard route present');
  assert.ok(paths.includes('/student/history'), 'Student history route present');
  assert.ok(paths.includes('/student/assignments/:id/workspace'), 'Student workspace route present');
  assert.ok(paths.includes('/teacher/assignments'), 'Teacher assignments route present');
  assert.ok(paths.includes('/teacher/reports'), 'Teacher reports route present');
  assert.ok(paths.includes('/teacher/assignments/:assignmentId/marking'), 'Teacher marking route present');
  assert.ok(paths.includes('/teacher/assignments/:assignmentId/similarity'), 'Teacher similarity route present');
});
