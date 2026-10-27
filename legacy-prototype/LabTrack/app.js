import {
  STORAGE_KEY,
  STATUSES,
  createDemoStudents,
  filterStudents,
  isValidISODate,
  summarizeStudents,
  todayISO,
  validateDateRange,
  validateStudent,
} from './data.mjs';

const $ = (selector) => document.querySelector(selector);
const elements = {
  total: $('#metric-total'),
  complete: $('#metric-complete'),
  incomplete: $('#metric-incomplete'),
  rate: $('#metric-rate'),
  rows: $('#student-rows'),
  emptyState: $('#empty-state'),
  recordCount: $('#record-count'),
  shownCount: $('#shown-count'),
  search: $('#search-input'),
  statusFilter: $('#status-filter'),
  sectionFilter: $('#section-filter'),
  dateFrom: $('#date-from'),
  dateTo: $('#date-to'),
  filterError: $('#filter-error'),
  dialog: $('#student-dialog'),
  form: $('#student-form'),
  formError: $('#form-error'),
  name: $('#student-name'),
  id: $('#student-id'),
  section: $('#student-section'),
  date: $('#student-date'),
  status: $('#student-status'),
  toast: $('#toast'),
  chartCanvas: $('#status-chart'),
  chartFallback: $('#chart-fallback'),
  chartSummary: $('#chart-summary'),
  storageState: $('#storage-state'),
};

let students = loadStudents();
let chart;
let toastTimer;

function loadStudents() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) {
      const seed = createDemoStudents();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      elements.storageState.textContent = 'Demo register initialized';
      return seed;
    }
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error('Stored student data is not a list');
    const safe = parsed.filter((student) => (
      student && typeof student.name === 'string' && student.name.trim() &&
      typeof student.studentId === 'string' && student.studentId.trim() &&
      typeof student.section === 'string' && student.section.trim() &&
      isValidISODate(student.registeredAt) && STATUSES.includes(student.status)
    ));
    elements.storageState.textContent = safe.length === parsed.length ? 'Saved in this browser' : 'Invalid records skipped';
    if (safe.length !== parsed.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return safe;
  } catch (error) {
    elements.storageState.textContent = 'Browser storage unavailable';
    showToast('Could not load saved data; this session will use the demo register.', true);
    return createDemoStudents();
  }
}

function persistStudents() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    elements.storageState.textContent = 'Saved in this browser';
    return true;
  } catch (error) {
    elements.storageState.textContent = 'Browser storage unavailable';
    showToast('Changes could not be saved to this browser.', true);
    return false;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function statusPresentation(status) {
  if (status === 'Complete') return { css: 'status-complete', icon: 'check_circle' };
  if (status === 'Incomplete') return { css: 'status-incomplete', icon: 'warning' };
  return { css: 'status-progress', icon: 'schedule' };
}

function renderMetrics() {
  const summary = summarizeStudents(students);
  elements.total.textContent = summary.total.toLocaleString();
  elements.complete.textContent = summary.complete.toLocaleString();
  elements.incomplete.textContent = summary.incomplete.toLocaleString();
  elements.rate.textContent = `${summary.completionRate}%`;
}

function renderSectionOptions() {
  const selected = elements.sectionFilter.value || 'all';
  const sections = [...new Set(students.map((student) => student.section))].sort();
  elements.sectionFilter.innerHTML = '<option value="all">All sections</option>' + sections
    .map((section) => `<option value="${escapeHtml(section)}">${escapeHtml(section)}</option>`).join('');
  elements.sectionFilter.value = sections.includes(selected) ? selected : 'all';
}

function renderTable() {
  const result = filterStudents(students, {
    query: elements.search.value,
    status: elements.statusFilter.value,
    section: elements.sectionFilter.value,
    from: elements.dateFrom.value,
    to: elements.dateTo.value,
  });
  elements.filterError.hidden = result.ok;
  elements.filterError.textContent = result.message;
  const visibleStudents = result.ok ? result.students : [];
  elements.recordCount.textContent = `${students.length} ${students.length === 1 ? 'student' : 'students'}`;
  elements.shownCount.textContent = `Showing ${visibleStudents.length} of ${students.length} ${students.length === 1 ? 'student' : 'students'}`;
  elements.emptyState.hidden = visibleStudents.length !== 0;
  elements.rows.innerHTML = visibleStudents.map((student) => {
    const presentation = statusPresentation(student.status);
    return `<tr>
      <td><span class="student-name">${escapeHtml(student.name)}</span></td>
      <td class="mono-text">${escapeHtml(student.studentId)}</td>
      <td>${escapeHtml(student.section)}</td>
      <td class="mono-text">${formatDate(student.registeredAt)}</td>
      <td><label class="sr-only" for="status-${escapeHtml(student.studentId)}">Status for ${escapeHtml(student.name)}</label>
        <select class="row-status ${presentation.css}" id="status-${escapeHtml(student.studentId)}" data-student-id="${escapeHtml(student.studentId)}" aria-label="Status for ${escapeHtml(student.name)}">
          ${STATUSES.map((status) => `<option value="${status}"${status === student.status ? ' selected' : ''}>${status}</option>`).join('')}
        </select>
      </td>
    </tr>`;
  }).join('');
}

function formatDate(isoDate) {
  if (!isValidISODate(isoDate)) return '—';
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function renderChart() {
  const summary = summarizeStudents(students);
  const labels = ['Complete', 'Incomplete', 'In Progress'];
  const values = [summary.complete, summary.incomplete, summary.inProgress];
  const colors = ['#15803d', '#d97706', '#1d4ed8'];
  elements.chartSummary.innerHTML = labels.map((label, index) => `<span class="chart-key"><i style="background:${colors[index]}"></i>${label}: ${values[index]}</span>`).join('');

  if (window.Chart && elements.chartCanvas) {
    elements.chartFallback.hidden = true;
    elements.chartCanvas.hidden = false;
    const data = {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderColor: '#ffffff', borderWidth: 3, hoverOffset: 5 }],
    };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => `${context.label}: ${context.parsed} ${context.parsed === 1 ? 'student' : 'students'}` } },
      },
    };
    if (chart) {
      chart.data = data;
      chart.update();
    } else {
      chart = new window.Chart(elements.chartCanvas, { type: 'doughnut', data, options });
    }
  } else {
    elements.chartCanvas.hidden = true;
    elements.chartFallback.hidden = false;
    elements.chartFallback.innerHTML = labels.map((label, index) => {
      const percent = summary.total ? (values[index] / summary.total) * 100 : 0;
      return `<div class="fallback-row"><span>${label}</span><span class="fallback-track"><span class="fallback-bar" style="display:block;width:${percent}%;background:${colors[index]}"></span></span><strong>${values[index]}</strong></div>`;
    }).join('');
  }
}

function render() {
  renderMetrics();
  renderSectionOptions();
  renderTable();
  renderChart();
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.style.background = isError ? '#fef2f2' : '#f0fdf4';
  elements.toast.style.color = isError ? '#991b1b' : '#166534';
  elements.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 3200);
}

function openDialog() {
  elements.form.reset();
  elements.date.value = todayISO();
  elements.status.value = 'In Progress';
  elements.formError.hidden = true;
  elements.formError.textContent = '';
  elements.dialog.showModal();
  window.setTimeout(() => elements.name.focus(), 0);
}

function closeDialog() {
  elements.dialog.close();
}

$('#open-add-student').addEventListener('click', openDialog);
$('#close-dialog').addEventListener('click', closeDialog);
$('#cancel-dialog').addEventListener('click', closeDialog);
elements.dialog.addEventListener('click', (event) => {
  if (event.target === elements.dialog) closeDialog();
});
elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const validation = validateStudent({
    name: elements.name.value,
    studentId: elements.id.value,
    section: elements.section.value,
    registeredAt: elements.date.value,
    status: elements.status.value,
  }, students);
  if (!validation.ok) {
    elements.formError.textContent = validation.message;
    elements.formError.hidden = false;
    const field = { name: elements.name, studentId: elements.id, section: elements.section, registeredAt: elements.date }[validation.field];
    field?.focus();
    return;
  }
  students = [...students, validation.student];
  if (persistStudents()) {
    render();
    closeDialog();
    showToast(`${validation.student.name} added to the register.`);
  }
});

elements.rows.addEventListener('change', (event) => {
  const select = event.target.closest('select[data-student-id]');
  if (!select) return;
  const id = select.dataset.studentId;
  students = students.map((student) => student.studentId === id ? { ...student, status: select.value } : student);
  persistStudents();
  render();
});

for (const control of [elements.search, elements.statusFilter, elements.sectionFilter, elements.dateFrom, elements.dateTo]) {
  control.addEventListener(control === elements.search ? 'input' : 'change', renderTable);
}
$('#clear-filters').addEventListener('click', () => {
  elements.search.value = '';
  elements.statusFilter.value = 'all';
  elements.sectionFilter.value = 'all';
  elements.dateFrom.value = '';
  elements.dateTo.value = '';
  elements.filterError.hidden = true;
  renderTable();
});

for (const field of [elements.dateFrom, elements.dateTo]) {
  field.addEventListener('change', () => {
    const range = validateDateRange(elements.dateFrom.value, elements.dateTo.value);
    elements.filterError.hidden = range.ok;
    elements.filterError.textContent = range.message;
    renderTable();
  });
}

render();
