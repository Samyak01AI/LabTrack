export const STORAGE_KEY = 'labtrack-faculty-register-v1';
export const STATUSES = Object.freeze(['Complete', 'Incomplete', 'In Progress']);

export function todayISO(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateStudent(input, existing = []) {
  const name = String(input?.name ?? '').trim();
  const studentId = String(input?.studentId ?? '').trim().toUpperCase();
  const section = String(input?.section ?? '').trim();
  const registeredAt = String(input?.registeredAt ?? '').trim();
  const status = String(input?.status ?? '').trim();

  if (!name) return { ok: false, field: 'name', message: 'Enter the student name.' };
  if (!studentId) return { ok: false, field: 'studentId', message: 'Enter a student ID.' };
  if (!/^[A-Z0-9-]{2,20}$/.test(studentId)) {
    return { ok: false, field: 'studentId', message: 'Use 2–20 letters, numbers, or hyphens for the student ID.' };
  }
  if (existing.some((student) => String(student.studentId ?? '').trim().toUpperCase() === studentId)) {
    return { ok: false, field: 'studentId', message: `Student ID ${studentId} is already in the register.` };
  }
  if (!section) return { ok: false, field: 'section', message: 'Select a section.' };
  if (!isValidISODate(registeredAt)) return { ok: false, field: 'registeredAt', message: 'Choose a valid registered date.' };
  if (!STATUSES.includes(status)) return { ok: false, field: 'status', message: 'Choose a valid status.' };
  return { ok: true, student: { name, studentId, section, registeredAt, status } };
}

export function isComplete(student) {
  return student?.status === 'Complete';
}

export function summarizeStudents(students) {
  const complete = students.filter(isComplete).length;
  const incomplete = students.filter((student) => student.status === 'Incomplete').length;
  return {
    total: students.length,
    complete,
    incomplete,
    inProgress: students.filter((student) => student.status === 'In Progress').length,
    completionRate: students.length ? Math.round((complete / students.length) * 100) : 0,
  };
}

export function validateDateRange(from, to) {
  if (from && !isValidISODate(from)) return { ok: false, message: 'Choose a valid “from” date.' };
  if (to && !isValidISODate(to)) return { ok: false, message: 'Choose a valid “to” date.' };
  if (from && to && from > to) return { ok: false, message: 'The “from” date must be on or before the “to” date.' };
  return { ok: true, message: '' };
}

export function filterStudents(students, filters = {}) {
  const query = String(filters.query ?? '').trim().toLowerCase();
  const status = filters.status ?? 'all';
  const section = filters.section ?? 'all';
  const from = filters.from ?? '';
  const to = filters.to ?? '';
  const range = validateDateRange(from, to);
  if (!range.ok) return { ok: false, message: range.message, students: [] };

  return {
    ok: true,
    message: '',
    students: students.filter((student) => {
      const matchesQuery = !query || student.name.toLowerCase().includes(query) || student.studentId.toLowerCase().includes(query);
      const matchesStatus = status === 'all' || student.status === status;
      const matchesSection = section === 'all' || student.section === section;
      const matchesFrom = !from || student.registeredAt >= from;
      const matchesTo = !to || student.registeredAt <= to;
      return matchesQuery && matchesStatus && matchesSection && matchesFrom && matchesTo;
    }),
  };
}

function shiftedDate(daysAgo, now) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  date.setDate(date.getDate() - daysAgo);
  return todayISO(date);
}

export function createDemoStudents(now = new Date()) {
  return [
    { name: 'Alex Chen', studentId: 'CS26B042', section: 'Section B', registeredAt: shiftedDate(0, now), status: 'Complete' },
    { name: 'Rohan Mukherjee', studentId: 'CS26B018', section: 'Section B', registeredAt: shiftedDate(1, now), status: 'Incomplete' },
    { name: 'Priya Sharma', studentId: 'CS26B089', section: 'Section A', registeredAt: shiftedDate(2, now), status: 'Complete' },
    { name: 'Karan Deshmukh', studentId: 'CS26B103', section: 'Section A', registeredAt: shiftedDate(3, now), status: 'In Progress' },
    { name: 'Ananya Roy', studentId: 'CS26B015', section: 'Section C', registeredAt: shiftedDate(4, now), status: 'Incomplete' },
    { name: 'Siddharth Kumar', studentId: 'CS26B067', section: 'Section B', registeredAt: shiftedDate(5, now), status: 'Complete' },
  ];
}
