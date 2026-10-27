import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterStudents,
  isComplete,
  isValidISODate,
  summarizeStudents,
  validateDateRange,
  validateStudent,
} from '../legacy-prototype/LabTrack/data.mjs';

const roster = [
  { name: 'Alex Chen', studentId: 'CS26B042', section: 'Section B', registeredAt: '2026-10-14', status: 'Complete' },
  { name: 'Rohan Mukherjee', studentId: 'CS26B018', section: 'Section B', registeredAt: '2026-10-13', status: 'Incomplete' },
  { name: 'Priya Sharma', studentId: 'CS26B089', section: 'Section A', registeredAt: '2026-10-12', status: 'In Progress' },
];
const validStudent = {
  name: 'Taylor Example', studentId: 'CS26B777', section: 'Section A',
  registeredAt: '2026-10-14', status: 'In Progress',
};

test('rejects blank student name and whitespace-only ID', () => {
  assert.equal(validateStudent({ ...validStudent, name: '   ' }, roster).field, 'name');
  assert.equal(validateStudent({ ...validStudent, studentId: '  ' }, roster).field, 'studentId');
});

test('rejects duplicate IDs after trimming and case normalization', () => {
  const result = validateStudent({ ...validStudent, studentId: ' cs26b042 ' }, roster);
  assert.equal(result.ok, false);
  assert.equal(result.field, 'studentId');
  assert.match(result.message, /already in the register/);
});

test('counts only the exact Complete status as complete', () => {
  assert.equal(isComplete({ status: 'Complete' }), true);
  assert.equal(isComplete({ status: 'Incomplete' }), false);
  assert.equal(isComplete({ status: 'In Progress' }), false);
  assert.deepEqual(summarizeStudents(roster), { total: 3, complete: 1, incomplete: 1, inProgress: 1, completionRate: 33 });
});

test('status dropdown filter returns only records with that status', () => {
  const result = filterStudents(roster, { status: 'Incomplete' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.students.map((student) => student.studentId), ['CS26B018']);
});

test('search and section filters combine', () => {
  const result = filterStudents(roster, { query: 'cs26b', section: 'Section B' });
  assert.deepEqual(result.students.map((student) => student.studentId), ['CS26B042', 'CS26B018']);
});

test('registered date filters include both endpoints', () => {
  const result = filterStudents(roster, { from: '2026-10-13', to: '2026-10-14' });
  assert.deepEqual(result.students.map((student) => student.studentId), ['CS26B042', 'CS26B018']);
});

test('validates calendar dates and rejects free-form/impossible dates', () => {
  assert.equal(isValidISODate('2026-10-14'), true);
  assert.equal(isValidISODate('2026-02-30'), false);
  assert.equal(isValidISODate('Oct 14 2026'), false);
  assert.deepEqual(validateDateRange('2026-10-15', '2026-10-14').ok, false);
});

test('valid registration requires nonblank name, ID, section, date, and known status', () => {
  const result = validateStudent(validStudent, roster);
  assert.equal(result.ok, true);
  assert.equal(result.student.studentId, 'CS26B777');
  assert.equal(validateStudent({ ...validStudent, section: '' }, roster).field, 'section');
  assert.equal(validateStudent({ ...validStudent, registeredAt: 'not a date' }, roster).field, 'registeredAt');
  assert.equal(validateStudent({ ...validStudent, status: 'Unknown' }, roster).field, 'status');
});
