import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calculateMean,
  calculateMedian,
  calculateStdDev,
  calculatePassRate,
  calculateDistributionBins,
  calculateCohortMetrics,
  escapeCsvField,
  generateCohortCsv,
} from '../apps/api/src/reporting/analytics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('calculateMean handles empty array, single value, and normal distributions', () => {
  assert.equal(calculateMean([]), 0, 'Empty values should return 0 mean');
  assert.equal(calculateMean([85]), 85, 'Single value mean equals itself');
  assert.equal(calculateMean([80, 90, 70]), 80, 'Calculates correct arithmetic mean');
  assert.equal(calculateMean([80, 85, 90]), 85, 'Rounded to 1 decimal place');
  assert.equal(calculateMean([71, 72, 75]), 72.67, 'Handles decimal rounding correctly');
});

test('calculateMedian handles odd length, even length, and unsorted inputs', () => {
  assert.equal(calculateMedian([]), 0, 'Empty values should return 0 median');
  assert.equal(calculateMedian([75]), 75, 'Single value median equals itself');
  assert.equal(calculateMedian([50, 90, 70]), 70, 'Odd count returns middle element of sorted array');
  assert.equal(calculateMedian([60, 80, 70, 90]), 75, 'Even count returns average of two middle elements');
  assert.equal(calculateMedian([100, 20, 60, 80, 40]), 60, 'Unsorted array correctly sorted before median calculation');
});

test('calculateStdDev handles empty, N=1, identical values, and sample variance', () => {
  assert.equal(calculateStdDev([]), 0, 'Empty values should return 0 standard deviation');
  assert.equal(calculateStdDev([85]), 0, 'Sample size N=1 returns 0 due to N-1 Bessel correction');
  assert.equal(calculateStdDev([80, 80, 80, 80]), 0, 'Identical values have 0 variance and std dev');

  // Values [10, 20, 30] -> Mean = 20, sum of sq diffs = 100 + 0 + 100 = 200, variance = 200 / 2 = 100, std dev = 10
  assert.equal(calculateStdDev([10, 20, 30]), 10, 'Sample standard deviation using N-1 Bessel correction');
});

test('calculatePassRate and calculateDistributionBins place scores into correct brackets', () => {
  assert.equal(calculatePassRate([], 100), 0, 'Empty scores return 0% pass rate');

  // Pass threshold is 60% of maxScore (60/100)
  const scores = [50, 59.9, 60, 75, 95]; // 3 passed (60, 75, 95), 2 failed (50, 59.9)
  assert.equal(calculatePassRate(scores, 60), 60.0, '3 out of 5 passed = 60.0% pass rate');

  const bins = calculateDistributionBins(scores);
  assert.equal(bins.length, 5, 'Should generate 5 distribution intervals');

  const binMap = Object.fromEntries(bins.map((b) => [b.interval, b.count]));
  assert.equal(binMap['<60'], 2, 'Two scores below 60% (50, 59.9)');
  assert.equal(binMap['60–69'], 1, 'One score in 60-69 bracket (60)');
  assert.equal(binMap['70–79'], 1, 'One score in 70-79 bracket (75)');
  assert.equal(binMap['80–89'], 0, 'No scores in 80-89 bracket');
  assert.equal(binMap['90–100'], 1, 'One score in 90-100 bracket (95)');

  // Total percentages sum to 100%
  const totalPct = bins.reduce((acc, b) => acc + b.percentage, 0);
  assert.ok(Math.abs(totalPct - 100) < 0.1, 'Bin percentages sum to 100%');
});

test('calculateCohortMetrics calculates statistics, AI rates, and flag rates', () => {
  const cohort = [
    {
      studentId: 's1',
      studentName: 'Alice Smith',
      isFlagged: false,
      aiDeclared: false,
      grade: { status: 'finalised', totalScore: 92 },
    },
    {
      studentId: 's2',
      studentName: 'Bob Jones',
      isFlagged: false,
      aiDeclared: true,
      grade: { status: 'finalised', totalScore: 78 },
    },
    {
      studentId: 's3',
      studentName: 'Charlie Brown',
      isFlagged: true,
      aiDeclared: true,
      grade: { status: 'provisional', totalScore: 55 },
    },
    {
      studentId: 's4',
      studentName: 'Diana Prince',
      isFlagged: false,
      aiDeclared: false,
      grade: null, // Pending evaluation
    },
  ];

  const metrics = calculateCohortMetrics(cohort, 100);
  assert.equal(metrics.totalSubmissions, 4, 'Total submissions count');
  assert.equal(metrics.totalEvaluated, 3, 'Evaluated submissions count');
  assert.equal(metrics.passRate, 66.7, '2 out of 3 evaluated passed (>=60)');
  assert.equal(metrics.aiDeclarationRate, 50.0, '2 out of 4 declared AI = 50.0%');
  assert.equal(metrics.similarityFlagRate, 25.0, '1 out of 4 flagged = 25.0%');
  assert.equal(metrics.mean, 75.0, 'Mean of [92, 78, 55] = 75.0');
  assert.equal(metrics.median, 78.0, 'Median of [92, 78, 55] = 78.0');
});

test('escapeCsvField and generateCohortCsv comply with RFC 4180', () => {
  // RFC 4180 escaping checks
  assert.equal(escapeCsvField('SimpleText'), 'SimpleText');
  assert.equal(escapeCsvField('Text, with comma'), '"Text, with comma"');
  assert.equal(escapeCsvField('Text with "quotes"'), '"Text with ""quotes"""');
  assert.equal(escapeCsvField('Multi\nLine\r\nText'), '"Multi\nLine\r\nText"');
  assert.equal(escapeCsvField(100), '100');
  assert.equal(escapeCsvField(null), '');
  assert.equal(escapeCsvField(undefined), '');

  // CSV Generation check
  const assignment = {
    assignmentCode: 'LAB-06',
    title: 'LRU Cache Design',
    maxScore: 100,
  };
  const roster = [
    {
      studentId: 'stu-001',
      studentName: 'Alice, Wonder',
      studentEmail: 'alice@mit.edu',
      submissionId: 'sub-001',
      submittedAt: '2026-10-28T10:00:00Z',
      isFlagged: false,
      maxSimilarityPct: 0,
      aiDeclared: true,
      aiTools: ['GitHub Copilot', 'ChatGPT'],
      passedTests: 4,
      totalTests: 4,
      grade: {
        correctnessScore: 40,
        logicScore: 30,
        complexityScore: 15,
        transparencyScore: 15,
        totalScore: 100,
        status: 'finalised',
        feedback: 'Excellent doubly-linked list hashmap implementation.',
      },
    },
  ];

  const csv = generateCohortCsv(roster, assignment);
  assert.ok(csv.startsWith('\uFEFF'), 'CSV should include UTF-8 BOM for Microsoft Excel');

  const lines = csv.replace('\uFEFF', '').split('\r\n');
  assert.ok(lines[0].includes('Student ID,Student Name,Student Email'), 'Header row matches spec');
  assert.ok(lines[1].includes('"Alice, Wonder"'), 'Student name with comma is quoted');
  assert.ok(lines[1].includes('"GitHub Copilot; ChatGPT"'), 'AI tools joined with semicolon and quoted');
  assert.ok(lines[1].includes('finalised'), 'Status present in CSV');
  assert.ok(lines[1].includes('100'), 'Total score present in CSV');
});

test('Student submission history export provides accurate audit columns', () => {
  const historyRouterPath = path.join(rootDir, 'apps', 'api', 'src', 'reporting', 'routes.js');
  const code = fs.readFileSync(historyRouterPath, 'utf8');

  assert.ok(code.includes('/submissions/history'), 'Student history endpoint mounted');
  assert.ok(code.includes('/submissions/history/export'), 'Student export CSV endpoint mounted');
  assert.ok(code.includes('requireRole(\'student\')'), 'Student history routes strictly RBAC protected');
  assert.ok(code.includes('requireRole(\'teacher\')'), 'Teacher reports routes strictly RBAC protected');
  assert.ok(code.includes('assignments.getByTeacher'), 'Teacher routes enforce teacher assignment ownership');
});

test('UI Components: Student History and Teacher Reports views match Stitch specs', () => {
  const studentPage = fs.readFileSync(
    path.join(rootDir, 'apps', 'web', 'src', 'pages', 'StudentSubmissionHistoryPage.jsx'),
    'utf8',
  );
  assert.ok(studentPage.includes('Submission History'), 'Student history page title matches');
  assert.ok(studentPage.includes('Export Audit CSV'), 'Student history includes CSV export action');
  assert.ok(studentPage.includes('Print Ledger'), 'Student history includes print ledger action');
  assert.ok(studentPage.includes('Snapshot Inspection'), 'Student history includes code snapshot modal');

  const teacherPage = fs.readFileSync(
    path.join(rootDir, 'apps', 'web', 'src', 'pages', 'TeacherReportsPage.jsx'),
    'utf8',
  );
  assert.ok(teacherPage.includes('Course Evaluation Ledger'), 'Teacher reports title matches');
  assert.ok(teacherPage.includes('Cohort Final Mark Distribution'), 'Teacher reports includes histogram distribution');
  assert.ok(teacherPage.includes('Flags Audit'), 'Teacher reports surfaces similarity flag audit count');
  assert.ok(teacherPage.includes('Export CSV'), 'Teacher reports includes cohort CSV download');
  assert.ok(teacherPage.includes('Cohort Normalized GPA Projection'), 'Teacher reports includes GPA projection');
});

test('Hard Rule Safeguards: No AI code detection claims and similarity is review-only', () => {
  const analyticsCode = fs.readFileSync(
    path.join(rootDir, 'apps', 'api', 'src', 'reporting', 'analytics.js'),
    'utf8',
  );
  assert.ok(!analyticsCode.includes('aiDetectionProbability'), 'No AI detection probability fields allowed');
  assert.ok(!analyticsCode.includes('autoFail'), 'No auto-fail algorithms allowed');

  const teacherReportsCode = fs.readFileSync(
    path.join(rootDir, 'apps', 'web', 'src', 'pages', 'TeacherReportsPage.jsx'),
    'utf8',
  );
  assert.ok(teacherReportsCode.includes('AI Disclosed'), 'Must label as AI Disclosed or declared');
  assert.ok(!teacherReportsCode.includes('AI Generated Code'), 'Must not claim AI generated code detection');
});
