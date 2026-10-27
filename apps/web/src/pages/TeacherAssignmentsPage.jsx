import { useCallback, useEffect, useMemo, useState } from 'react';
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
            {visible.map((item) => <tr key={item.id}><td><span className="table-title">{item.assignmentCode}: {item.title}</span><span className="table-subtitle">{item.courseCode} · {item.summary}</span></td><td><span className="tag tag-topic">{item.topic}</span></td><td className="font-mono text-xs">{new Date(item.dueAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td><td><span className={`status-pill ${item.status === 'published' ? 'status-open' : item.status === 'archived' ? 'status-archived' : 'status-draft'}`}><span className="material-symbols-outlined text-sm">{item.status === 'published' ? 'check_circle' : item.status === 'archived' ? 'archive' : 'edit_note'}</span>{item.status}</span></td><td className="text-center font-mono text-sm">{item.maxScore}</td><td><div className="flex justify-end gap-2"><button className="table-action" type="button" onClick={() => openEdit(item)}>Edit</button>{item.status === 'draft' && <button className="table-action table-action-primary" type="button" onClick={() => changeStatus(item, 'published')}>Publish</button>}{item.status === 'published' && <button className="table-action" type="button" onClick={() => changeStatus(item, 'draft')}>Unpublish</button>}{item.status !== 'archived' && <button className="table-action" type="button" onClick={() => changeStatus(item, 'archived')}>Archive</button>}{item.status === 'archived' && <button className="table-action" type="button" onClick={() => changeStatus(item, 'draft')}>Restore draft</button>}</div></td></tr>)}
          </tbody></table></div>
        )}
        {!loading && assignments.length > 0 && <div className="flex flex-wrap justify-between gap-2 border-t border-outline-variant/40 px-5 py-3 text-xs text-on-surface-variant"><span>Showing <strong>{visible.length}</strong> of <strong>{assignments.length}</strong> assignments</span><span className="font-mono">{archived} archived</span></div>}
      </section>

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
