import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeProvisionalGrade, calculateTotal, DEFAULT_RUBRIC_WEIGHTS } from '../apps/api/src/grading/rubric.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('computeProvisionalGrade scales correctness from Judge0 test results', () => {
  const perfectSubmission = {
    results: [
      { id: 1, status: 'PASS' },
      { id: 2, status: 'PASS' },
      { id: 3, status: 'PASS' },
      { id: 4, status: 'PASS' },
    ],
    logicExplanation: {
      approach: 'Two-pointer approach using doubly linked list with dummy head and tail sentinel nodes.',
      dataStructures: 'Hash map std::unordered_map mapping integer keys to Node pointers for O(1) lookup.',
      tradeoffAnalysis: 'Chose raw pointers over std::list to satisfy strict zero heap allocation overhead.',
    },
    aiDeclaration: { aiUsed: false },
    annotationStatus: 'not_required',
  };

  const provisional = computeProvisionalGrade(perfectSubmission, { maxScore: 100 });
  assert.equal(provisional.correctnessScore, 40, 'All 4 test cases passed = 40/40 correctness');
  assert.equal(provisional.status, 'provisionally_scored', 'Marks must start as provisionally scored');
  assert.ok(provisional.logicScore >= 20, 'Comprehensive logic defense should yield >= 20/30 pts');
  assert.ok(provisional.complexityScore >= 10, 'Data structure analysis should yield >= 10/15 pts');
  assert.equal(provisional.transparencyScore, 15, 'Independent work declaration should receive 15/15 pts');
  assert.ok(provisional.totalScore > 80, 'Total score should reflect comprehensive defense');
});

test('computeProvisionalGrade handles partial test failures proportionally', () => {
  const partialSubmission = {
    results: [
      { id: 1, status: 'PASS' },
      { id: 2, status: 'FAIL' },
    ],
    logicExplanation: {
      approach: 'Brief approach description.',
      dataStructures: 'Array list',
      tradeoffAnalysis: 'None',
    },
    aiDeclaration: { aiUsed: true, tools: ['ChatGPT-4o'] },
    annotationStatus: 'complete',
  };

  const provisional = computeProvisionalGrade(partialSubmission, { maxScore: 100 });
  assert.equal(provisional.correctnessScore, 20, '1 of 2 passed = 20/40 correctness');
  assert.equal(provisional.transparencyScore, 15, 'AI declared with complete annotations receives 15/15 transparency');
});

test('calculateTotal caps sum at maxScore and rejects negative scores', () => {
  const overMax = calculateTotal(
    { correctnessScore: 50, logicScore: 40, complexityScore: 20, transparencyScore: 20 },
    100,
  );
  assert.equal(overMax, 100, 'Total score must be capped at maxScore (100)');

  const negativeHandled = calculateTotal(
    { correctnessScore: -10, logicScore: 20, complexityScore: 10, transparencyScore: 10 },
    100,
  );
  assert.equal(negativeHandled, 40, 'Negative component scores must be bounded at 0');
});

test('Rubric weights sum to 100 points baseline', () => {
  const sum =
    DEFAULT_RUBRIC_WEIGHTS.correctness +
    DEFAULT_RUBRIC_WEIGHTS.logic +
    DEFAULT_RUBRIC_WEIGHTS.complexity +
    DEFAULT_RUBRIC_WEIGHTS.transparency;
  assert.equal(sum, 100, 'Baseline rubric weights must sum to exactly 100');
});

test('Reopening a finalised grade requires an audit reason and transitions status', () => {
  // Mock grade repository logic
  let gradeState = {
    id: 'grade-123',
    status: 'finalised',
    finalisedAt: new Date().toISOString(),
    reopenReason: null,
  };

  function reopenGrade(reason) {
    if (!reason || reason.trim().length < 5) {
      throw new Error('A valid reason is required to reopen a finalised grade.');
    }
    gradeState.status = 'reopened';
    gradeState.reopenReason = reason.trim();
    gradeState.finalisedAt = null;
    return gradeState;
  }

  // Attempt reopen with empty reason should throw
  assert.throws(() => reopenGrade(''), /valid reason is required/);
  assert.throws(() => reopenGrade('hi'), /valid reason is required/);

  // Valid reopen
  const reopened = reopenGrade('Student requested viva review for doubly linked list destructor reclamation.');
  assert.equal(reopened.status, 'reopened');
  assert.equal(reopened.finalisedAt, null, 'finalisedAt must be cleared on reopen');
  assert.ok(reopened.reopenReason.includes('viva review'));
});

test('Migration 006_grades_and_evaluations.sql contains required schema and constraints', () => {
  const migrationPath = path.join(rootDir, 'db', 'migrations', '006_grades_and_evaluations.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');

  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.match(content, /CREATE TABLE IF NOT EXISTS grades/i);
  assert.match(content, /submission_id CHAR\(36\)/i);
  assert.match(content, /assignment_id CHAR\(36\)/i);
  assert.match(content, /student_id CHAR\(36\)/i);
  assert.match(content, /teacher_id CHAR\(36\)/i);
  assert.match(content, /correctness_score DECIMAL/i);
  assert.match(content, /logic_score DECIMAL/i);
  assert.match(content, /complexity_score DECIMAL/i);
  assert.match(content, /transparency_score DECIMAL/i);
  assert.match(content, /total_score DECIMAL/i);
  assert.match(content, /CHECK \(status IN \('pending_review', 'provisionally_scored', 'finalised', 'reopened'\)\)/i);
  assert.match(content, /UNIQUE KEY uq_submission_grade \(submission_id\)/i);
});

test('Hard rule enforcement: teacher finalizes marks; student sees provisional warning', () => {
  const viewerPath = path.join(rootDir, 'apps', 'web', 'src', 'pages', 'AssignmentViewerPage.jsx');
  const content = fs.readFileSync(viewerPath, 'utf8');

  // Verify provisional warning is present in student view
  assert.ok(
    content.includes('This mark is provisional and pending oral examination/viva verification by your instructor.'),
    'Student view must clearly state provisional status until teacher finalization',
  );

  const markingPath = path.join(rootDir, 'apps', 'web', 'src', 'pages', 'TeacherMarkingPage.jsx');
  const markingContent = fs.readFileSync(markingPath, 'utf8');

  // Verify teacher marking interface has explicit Finalise Mark action
  assert.ok(markingContent.includes('Finalise Mark'), 'Teacher interface must have explicit Finalise Mark action');
  assert.ok(markingContent.includes('Save Provisional'), 'Teacher interface must allow saving provisional draft');
});

