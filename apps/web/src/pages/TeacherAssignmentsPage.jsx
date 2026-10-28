import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

const DAY = 86_400_000;
const blankForm = () => ({
  courseCode: 'CS301', assignmentCode: '', title: '', topic: '', summary: '',
  problemStatement: '', constraintsMarkdown: '', sampleCasesText: '[]',
  dueAt: toLocalInput(new Date(Date.now() + 7 * DAY)), maxScore: '100',
  languageOptions: ['C++20', 'Java 21'], status: 'draft',
});
function toLocalInput(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function fromAssignment(item) {
  return {
    courseCode: item.courseCode, assignmentCode: item.assignmentCode, title: item.title,
    topic: item.topic, summary: item.summary, problemStatement: item.problemStatement,
    constraintsMarkdown: item.constraintsMarkdown, sampleCasesText: JSON.stringify(item.sampleCases, null, 2),
    dueAt: toLocalInput(item.dueAt), maxScore: String(item.maxScore),
    languageOptions: item.languageOptions, status: item.status,
  };
}

export default function TeacherAssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);

  // Submissions drawer state for Teacher review
  const [viewingSubmissionsAssignment, setViewingSubmissionsAssignment] = useState(null);
  const [submissionsList, setSubmissionsList] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [activeSubmissionDetail, setActiveSubmissionDetail] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api('/api/teacher/assignments');
      setAssignments(result.assignments);
      setError('');
    } catch (fetchError) { setError(fetchError.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const published = assignments.filter((item) => item.status === 'published').length;
  const drafts = assignments.filter((item) => item.status === 'draft').length;
  const archived = assignments.filter((item) => item.status === 'archived').length;
  const dueSoon = assignments.filter((item) => item.status === 'published' && new Date(item.dueAt).getTime() >= Date.now() && new Date(item.dueAt).getTime() <= Date.now() + 7 * DAY).length;
  const visible = useMemo(() => assignments.filter((item) => `${item.assignmentCode} ${item.title} ${item.topic}`.toLowerCase().includes(query.trim().toLowerCase())), [assignments, query]);

  function openCreate() {
    setEditing(null); setForm(blankForm()); setError(''); setNotice(''); setDialogOpen(true);
  }
  function openEdit(item) {
    setEditing(item); setForm(fromAssignment(item)); setError(''); setNotice(''); setDialogOpen(true);
  }
  function setField(name, value) { setForm((current) => ({ ...current, [name]: value })); }
  function toggleLanguage(language) {
    setForm((current) => ({ ...current, languageOptions: current.languageOptions.includes(language)
      ? current.languageOptions.filter((item) => item !== language)
      : [...current.languageOptions, language] }));
  }

  async function openSubmissionsViewer(assignment) {
    setViewingSubmissionsAssignment(assignment);
    setActiveSubmissionDetail(null);
    setSubmissionsLoading(true);
    try {
      const res = await api(`/api/teacher/assignments/${assignment.id}/submissions`);
      setSubmissionsList(res.submissions || []);
    } catch (err) {
      setError(`Could not load submissions: ${err.message}`);
    } finally {
      setSubmissionsLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    let sampleCases;
    try { sampleCases = JSON.parse(form.sampleCasesText || '[]'); }
    catch { setError('Sample cases must be valid JSON. Use an array of input/expectedOutput objects.'); setBusy(false); return; }
    if (!Array.isArray(sampleCases)) { setError('Sample cases must be a JSON array.'); setBusy(false); return; }
    if (!form.dueAt || Number.isNaN(new Date(form.dueAt).getTime())) { setError('Enter a valid deadline.'); setBusy(false); return; }
    const payload = {
      courseCode: form.courseCode, assignmentCode: form.assignmentCode, title: form.title,
      topic: form.topic, summary: form.summary, problemStatement: form.problemStatement,
      constraintsMarkdown: form.constraintsMarkdown, sampleCases,
      dueAt: new Date(form.dueAt).toISOString(), maxScore: Number(form.maxScore),
      languageOptions: form.languageOptions, status: form.status,
    };
    try {
      if (editing) await api(`/api/teacher/assignments/${editing.id}`, { method: 'PATCH', body: payload });
      else await api('/api/teacher/assignments', { method: 'POST', body: payload });
      setDialogOpen(false); setEditing(null); setNotice(editing ? 'Assignment updated.' : 'Draft assignment created.');
      await refresh();
    } catch (saveError) { setError(saveError.payload?.message || saveError.message); }
    finally { setBusy(false); }
  }

  async function changeStatus(item, status) {
    setError(''); setNotice('');
    try {
      await api(`/api/teacher/assignments/${item.id}`, { method: 'PATCH', body: { status } });
      setNotice(status === 'published' ? 'Assignment published for students.' : status === 'archived' ? 'Assignment archived.' : 'Assignment returned to draft.');
      await refresh();
    } catch (changeError) { setError(changeError.message); }
  }

  return (
    <div className="page-wrap">
      <section className="page-hero flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div><div className="flex items-center gap-2"><span className="tag tag-code">COURSE ADMINISTRATION</span><span className="tag tag-topic">TEACHER</span></div><h1 className="page-title mt-2">Assignment management</h1><p className="mt-1 max-w-3xl text-sm text-on-surface-variant">Create and maintain the DSA assignments students can access. Drafts are private to you until published.</p></div>
        <button type="button" className="primary-button shrink-0" onClick={openCreate}><span className="material-symbols-outlined">add_circle</span>Create assignment</button>
      </section>

      {notice && <div className="notice-banner" role="status" aria-live="polite">{notice}</div>}
      {error && !dialogOpen && <div className="error-banner" role="alert">{error}</div>}

      <section className="metric-grid teacher-metrics" aria-label="Assignment overview">
        <Metric label="Total assignments" value={assignments.length} icon="assignment" foot="Owned by your account" />
        <Metric label="Published" value={published} icon="publish" foot="Visible to students" accent />
        <Metric label="Drafts" value={drafts} icon="edit_note" foot="Not visible to students" />
        <Metric label="Due within 7 days" value={dueSoon} icon="event_upcoming" foot="Published assignments" />
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="section-title">Course assignments</h2><p className="mt-1 text-xs text-on-surface-variant">Counts and deadlines are calculated from saved records.</p></div>
          <label className="relative"><span className="sr-only">Filter assignments</span><span className="material-symbols-outlined absolute left-3 top-2.5 text-lg text-outline">search</span><input className="filter-input w-full pl-10 sm:w-64" type="search" placeholder="Filter title, code, or topic…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-on-surface-variant">Loading assignments…</div> : visible.length === 0 ? <div className="empty-state m-5"><span className="material-symbols-outlined text-3xl text-secondary">inbox</span><h3 className="mt-2 font-semibold">{assignments.length ? 'No matching assignments' : 'No assignments created yet'}</h3><p className="mt-1 text-sm text-on-surface-variant">{assignments.length ? 'Try a different search.' : 'Create a draft, review its specification, and publish it when ready.'}</p>{!assignments.length && <button className="primary-button mt-4" onClick={openCreate} type="button">Create first assignment</button>}</div> : (
          <div className="overflow-x-auto"><table className="data-table min-w-[840px]"><thead><tr><th>Assignment</th><th>Topic</th><th>Deadline</th><th>Status</th><th className="text-center">Points</th><th className="text-right">Actions</th></tr></thead><tbody>
            {visible.map((item) => <tr key={item.id}><td><span className="table-title">{item.assignmentCode}: {item.title}</span><span className="table-subtitle">{item.courseCode} · {item.summary}</span></td><td><span className="tag tag-topic">{item.topic}</span></td><td className="font-mono text-xs">{new Date(item.dueAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td><td><span className={`status-pill ${item.status === 'published' ? 'status-open' : item.status === 'archived' ? 'status-archived' : 'status-draft'}`}><span className="material-symbols-outlined text-sm">{item.status === 'published' ? 'check_circle' : item.status === 'archived' ? 'archive' : 'edit_note'}</span>{item.status}</span></td><td className="text-center font-mono text-sm">{item.maxScore}</td><td><div className="flex justify-end gap-2">
              <button className="table-action" type="button" onClick={() => openSubmissionsViewer(item)} title="View student submissions, declarations, and annotations">
                Submissions
              </button>
              <Link
                className="table-action"
                to={`/teacher/assignments/${item.id}/marking`}
                title="Open teacher marking workbench and evaluate submissions"
              >
                Marking
              </Link>
              <Link
                className="table-action"
                to={`/teacher/assignments/${item.id}/similarity`}
                title="View token-based similarity review and flagged pairs"
              >
                Similarity
              </Link>
              <Link
                className="table-action"
                to={`/teacher/assignments/${item.id}/reports`}
                title="View cohort evaluation metrics and grade reports"
              >
                Reports
              </Link>
              <button className="table-action" type="button" onClick={() => openEdit(item)}>Edit</button>
              {item.status === 'draft' && <button className="table-action table-action-primary" type="button" onClick={() => changeStatus(item, 'published')}>Publish</button>}
              {item.status === 'published' && <button className="table-action" type="button" onClick={() => changeStatus(item, 'draft')}>Unpublish</button>}
              {item.status !== 'archived' && <button className="table-action" type="button" onClick={() => changeStatus(item, 'archived')}>Archive</button>}
              {item.status === 'archived' && <button className="table-action" type="button" onClick={() => changeStatus(item, 'draft')}>Restore draft</button>}
            </div></td></tr>)}
          </tbody></table></div>
        )}
        {!loading && assignments.length > 0 && <div className="flex flex-wrap justify-between gap-2 border-t border-outline-variant/40 px-5 py-3 text-xs text-on-surface-variant"><span>Showing <strong>{visible.length}</strong> of <strong>{assignments.length}</strong> assignments</span><span className="font-mono">{archived} archived</span></div>}
      </section>

      {/* Submissions Review Modal for Teachers */}
      {viewingSubmissionsAssignment && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setViewingSubmissionsAssignment(null); }}>
          <section className="assignment-dialog max-w-4xl" role="dialog" aria-modal="true">
            <header className="flex items-start justify-between gap-4 border-b border-outline-variant/40 p-5 bg-surface-container-low">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-secondary tracking-wider">Submissions &amp; Declarations</span>
                <h2 className="text-lg font-bold text-primary">{viewingSubmissionsAssignment.title}</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Review student code implementations, constructive AI declarations, and logic defenses.
                </p>
              </div>
              <button type="button" className="icon-button" aria-label="Close dialog" onClick={() => setViewingSubmissionsAssignment(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="p-5 max-h-[75vh] overflow-y-auto">
              {submissionsLoading ? (
                <div className="p-8 text-center text-xs text-on-surface-variant">Loading submissions…</div>
              ) : submissionsList.length === 0 ? (
                <div className="p-8 text-center text-xs text-on-surface-variant">
                  No submissions recorded for this assignment yet.
                </div>
              ) : activeSubmissionDetail ? (
                // Detailed inspection of single submission
                <div className="flex flex-col gap-5">
                  <button
                    type="button"
                    className="self-start flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline"
                    onClick={() => setActiveSubmissionDetail(null)}
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    <span>Back to submissions list</span>
                  </button>

                  <div className="p-4 rounded-xl bg-surface-container-low flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-on-surface">{activeSubmissionDetail.studentName}</p>
                      <p className="text-xs text-on-surface-variant font-mono">{activeSubmissionDetail.studentEmail}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        activeSubmissionDetail.isFinal ? 'bg-green-100 text-green-800' : 'bg-surface-container-high text-on-surface'
                      }`}>
                        {activeSubmissionDetail.isFinal ? 'Final Submission' : 'Draft'}
                      </span>
                      <span className="font-mono text-xs text-on-surface-variant">
                        {new Date(activeSubmissionDetail.submittedAt || activeSubmissionDetail.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Declaration & Completeness Status */}
                  <div className="p-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base text-secondary">policy</span>
                        <span>AI-Use Declaration</span>
                      </h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        activeSubmissionDetail.annotationStatus === 'complete'
                          ? 'bg-green-100 text-green-800'
                          : activeSubmissionDetail.annotationStatus === 'not_required'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-error-container text-on-error-container'
                      }`}>
                        Annotations: {activeSubmissionDetail.annotationStatus}
                      </span>
                    </div>

                    <p className="text-xs text-on-surface">
                      <strong>Attribution Mode:</strong>{' '}
                      {activeSubmissionDetail.aiDeclaration?.aiUsed ? 'AI-Assisted' : 'Independent Authoring (No AI used)'}
                    </p>

                    {activeSubmissionDetail.aiDeclaration?.aiUsed && (
                      <div className="text-xs text-on-surface-variant flex flex-col gap-1 pt-1 border-t border-outline-variant/30">
                        <p><strong>Tools Declared:</strong> {activeSubmissionDetail.aiDeclaration.tools?.join(', ') || activeSubmissionDetail.aiDeclaration.otherTool || 'None specified'}</p>
                        {activeSubmissionDetail.aiDeclaration.narrative && (
                          <p className="italic bg-surface-container-low p-2 rounded">"{activeSubmissionDetail.aiDeclaration.narrative}"</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Code Annotations List */}
                  {activeSubmissionDetail.annotations && activeSubmissionDetail.annotations.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                        AI-Assisted Code Annotations ({activeSubmissionDetail.annotations.length})
                      </h4>
                      <div className="grid gap-2">
                        {activeSubmissionDetail.annotations.map((ann, i) => (
                          <div key={i} className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 text-xs">
                            <div className="flex items-center justify-between font-mono font-semibold text-primary">
                              <span>Lines {ann.startLine}–{ann.endLine}</span>
                              <span className="text-[10px] text-secondary font-sans">{ann.tool || 'AI Tool'}</span>
                            </div>
                            <p className="mt-1 text-on-surface italic">"{ann.justification}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Logic Explanation */}
                  <div className="p-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-secondary">menu_book</span>
                      <span>Conceptual Logic &amp; Algorithmic Defense</span>
                    </h4>
                    <div className="text-xs space-y-2">
                      <div>
                        <strong className="text-on-surface">Algorithmic Approach &amp; Invariants:</strong>
                        <p className="text-on-surface-variant mt-0.5">{activeSubmissionDetail.logicExplanation?.approach || '—'}</p>
                      </div>
                      <div>
                        <strong className="text-on-surface">Approach &amp; Trade-off Analysis:</strong>
                        <p className="text-on-surface-variant mt-0.5">{activeSubmissionDetail.logicExplanation?.tradeoffAnalysis || '—'}</p>
                      </div>
                      <div>
                        <strong className="text-on-surface">Data Structures &amp; Complexity:</strong>
                        <p className="text-on-surface-variant mt-0.5">{activeSubmissionDetail.logicExplanation?.dataStructures || '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Source Code */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-on-surface">Source Code ({activeSubmissionDetail.language})</span>
                    <pre className="bg-[#0d121f] text-slate-100 font-mono text-xs p-4 rounded-xl max-h-72 overflow-y-auto leading-5">
                      {activeSubmissionDetail.sourceCode}
                    </pre>
                  </div>
                </div>
              ) : (
                // Submissions table
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Language</th>
                      <th>Status</th>
                      <th>AI Declaration</th>
                      <th>Annotations</th>
                      <th>Date</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissionsList.map((sub) => (
                      <tr key={sub.id}>
                        <td>
                          <span className="font-semibold block text-on-surface">{sub.studentName}</span>
                          <span className="text-[11px] text-on-surface-variant font-mono">{sub.studentEmail}</span>
                        </td>
                        <td className="font-mono text-xs">{sub.language}</td>
                        <td>
                          <span className={`status-pill ${sub.isFinal ? 'status-open' : 'status-draft'}`}>
                            {sub.isFinal ? 'Final' : 'Draft'}
                          </span>
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sub.aiDeclaration?.aiUsed ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface'
                          }`}>
                            {sub.aiDeclaration?.aiUsed ? 'AI-Assisted' : 'Independent'}
                          </span>
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sub.annotationStatus === 'complete'
                              ? 'bg-green-100 text-green-800'
                              : sub.annotationStatus === 'not_required'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-error-container text-on-error-container'
                          }`}>
                            {sub.annotationStatus}
                          </span>
                        </td>
                        <td className="font-mono text-xs">
                          {new Date(sub.submittedAt || sub.createdAt).toLocaleDateString()}
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="table-action table-action-primary"
                            onClick={() => setActiveSubmissionDetail(sub)}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}

      {dialogOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialogOpen(false); }}><section className="assignment-dialog" role="dialog" aria-modal="true" aria-labelledby="assignment-dialog-title">
        <header className="flex items-start justify-between gap-4 border-b border-outline-variant/40 p-5"><div><h2 id="assignment-dialog-title" className="text-xl font-bold text-primary">{editing ? 'Edit assignment' : 'Create assignment'}</h2><p className="mt-1 text-xs text-on-surface-variant">Publish only when the specification and deadline are ready.</p></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={() => setDialogOpen(false)}><span className="material-symbols-outlined">close</span></button></header>
        <form className="space-y-4 p-5" onSubmit={submit}>
          {error && <div className="error-banner" role="alert">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2"><FormField label="Course code"><input className="form-input" required maxLength={32} value={form.courseCode} onChange={(e) => setField('courseCode', e.target.value)} /></FormField><FormField label="Assignment code"><input className="form-input" required maxLength={32} placeholder="LAB-01" value={form.assignmentCode} onChange={(e) => setField('assignmentCode', e.target.value)} /></FormField></div>
          <FormField label="Title"><input className="form-input" required minLength={3} maxLength={160} value={form.title} onChange={(e) => setField('title', e.target.value)} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2"><FormField label="Topic"><input className="form-input" required maxLength={80} value={form.topic} onChange={(e) => setField('topic', e.target.value)} placeholder="Hash Map / Linked List" /></FormField><FormField label="Maximum points"><input className="form-input" type="number" min="1" max="1000" required value={form.maxScore} onChange={(e) => setField('maxScore', e.target.value)} /></FormField></div>
          <FormField label="Short summary"><input className="form-input" required minLength={10} maxLength={240} value={form.summary} onChange={(e) => setField('summary', e.target.value)} /></FormField>
          <FormField label="Problem statement"><textarea className="form-input min-h-32 resize-y" required minLength={20} maxLength={30000} value={form.problemStatement} onChange={(e) => setField('problemStatement', e.target.value)} /></FormField>
          <FormField label="Constraints and requirements"><textarea className="form-input min-h-24 resize-y" maxLength={12000} value={form.constraintsMarkdown} onChange={(e) => setField('constraintsMarkdown', e.target.value)} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2"><FormField label="Due date and time"><input className="form-input" type="datetime-local" required value={form.dueAt} onChange={(e) => setField('dueAt', e.target.value)} /></FormField><FormField label="Supported languages"><div className="flex flex-wrap gap-4 rounded-lg border border-outline-variant bg-white p-3">{['C++20', 'Java 21'].map((language) => <label key={language} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.languageOptions.includes(language)} onChange={() => toggleLanguage(language)} />{language}</label>)}</div></FormField></div>
          <FormField label="Sample cases (JSON array)" hint="Optional"><textarea className="form-input min-h-24 resize-y font-mono text-xs" value={form.sampleCasesText} onChange={(e) => setField('sampleCasesText', e.target.value)} placeholder="Enter a JSON array of input and expectedOutput objects" /></FormField>
          <div className="flex flex-col-reverse justify-end gap-2 border-t border-outline-variant/40 pt-4 sm:flex-row"><button className="secondary-button" type="button" onClick={() => setDialogOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save as draft'}</button></div>
        </form>
      </section></div>}
    </div>
  );
}

function Metric({ label, value, icon, foot, accent }) {
  return <article className="metric-card"><div className="flex items-start justify-between"><div><p className="metric-label">{label}</p><p className={`metric-value ${accent ? 'text-secondary' : ''}`}>{value}</p></div><span className={`metric-icon material-symbols-outlined ${accent ? 'bg-secondary text-white' : 'bg-primary text-white'}`}>{icon}</span></div><div className="metric-foot">{foot}</div></article>;
}
function FormField({ label, hint, children }) {
  return <label className="block space-y-1.5"><span className="flex items-center justify-between gap-2 text-xs font-semibold text-on-surface">{label}{hint && <span className="font-normal text-on-surface-variant">{hint}</span>}</span>{children}</label>;
}
