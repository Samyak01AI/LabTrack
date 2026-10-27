import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssignmentRepository } from '../../apps/api/src/assignments/repository.js';

const assignmentRow = {
  id: '7295d0c2-e4e3-42d1-b6f2-2a06b5383e8d',
  created_by: '8f5a9365-9c95-4d38-aa60-59e94ba4078e',
  course_code: 'CS301',
  assignment_code: 'LAB-42',
  title: 'Least Recently Used Cache',
  topic: 'Hash Map / Linked List',
  summary: 'Implement a deterministic cache with constant-time operations.',
  problem_statement: 'Design an LRU cache with O(1) average get and put operations.',
  constraints_markdown: 'Capacity must be positive.',
  sample_cases: '[{"input":"get 7","expectedOutput":"-1","explanation":"Missing key."}]',
  due_at: '2026-10-28 12:00:00.000',
  max_score: 100,
  language_options: '["C++20","Java 21"]',
  status: 'draft',
  created_at: '2026-10-21 12:00:00.000',
  updated_at: '2026-10-21 12:00:00.000',
};

test('assignment update re-reads an owned row when MySQL reports zero changed fields', async () => {
  const calls = [];
  const pool = {
    async execute(sql) {
      calls.push(sql);
      if (sql.startsWith('UPDATE assignments SET')) return [{ affectedRows: 0 }, undefined];
      if (sql.includes('WHERE id = ? AND created_by = ?')) return [[assignmentRow], undefined];
      throw new Error('Unexpected query in repository unit test.');
    },
  };
  const repository = createAssignmentRepository(pool);
  const result = await repository.updateByTeacher(assignmentRow.id, assignmentRow.created_by, {
    courseCode: assignmentRow.course_code,
    assignmentCode: assignmentRow.assignment_code,
    title: assignmentRow.title,
    topic: assignmentRow.topic,
    summary: assignmentRow.summary,
    problemStatement: assignmentRow.problem_statement,
    constraintsMarkdown: assignmentRow.constraints_markdown,
    sampleCases: JSON.parse(assignmentRow.sample_cases),
    dueAt: '2026-10-28T12:00:00.000Z',
    maxScore: assignmentRow.max_score,
    languageOptions: JSON.parse(assignmentRow.language_options),
    status: assignmentRow.status,
  });

  assert.equal(result.id, assignmentRow.id);
  assert.deepEqual(result.sampleCases, JSON.parse(assignmentRow.sample_cases));
  assert.match(calls[1], /WHERE id = \? AND created_by = \? LIMIT 1/);
});
