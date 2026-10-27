import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function AssignmentViewerPage() {
  const { id } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api(`/api/student/assignments/${id}`).then((result) => {
      if (active) setAssignment(result.assignment);
    }).catch((fetchError) => {
      if (active) setError(fetchError.status === 404 ? 'This assignment is not available to your account.' : fetchError.message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="screen-loader">Loading assignment…</div>;
  if (error || !assignment) return <section className="panel mx-auto max-w-3xl p-8 text-center"><span className="material-symbols-outlined text-3xl text-error">error</span><h1 className="mt-3 text-xl font-bold">Assignment unavailable</h1><p className="mt-2 text-sm text-on-surface-variant">{error || 'The assignment could not be loaded.'}</p><Link className="primary-button mt-5" to="/student/dashboard">Back to dashboard</Link></section>;

  const due = new Date(assignment.dueAt);
  const overdue = due.getTime() < Date.now();

  return (
    <div className="page-wrap">
      <nav className="mb-4 flex items-center gap-2 text-xs text-on-surface-variant" aria-label="Breadcrumb"><Link className="hover:text-secondary" to="/student/dashboard">Assignments</Link><span className="material-symbols-outlined text-sm">chevron_right</span><span className="max-w-[60vw] truncate font-medium text-on-surface">{assignment.title}</span></nav>
      <header className="panel mb-6 p-5 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl"><div className="flex flex-wrap items-center gap-2"><span className="tag tag-code">{assignment.courseCode} · {assignment.assignmentCode}</span><span className="tag tag-topic">{assignment.topic}</span><span className="tag tag-topic">Maximum {assignment.maxScore} points</span></div>
            <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-primary sm:text-3xl">{assignment.title}</h1><p className="mt-2 text-sm leading-6 text-on-surface-variant">{assignment.summary}</p></div>
          <div className="min-w-64 rounded-xl bg-surface-container-low p-4"><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Assignment status</span><span className={`status-pill ${overdue ? 'status-late' : 'status-open'}`}>{overdue ? 'Past due' : 'Open'}</span></div><p className="mt-3 font-mono text-base font-semibold text-primary">{due.toLocaleDateString(undefined, { dateStyle: 'medium' })}</p><p className="mt-1 text-xs text-on-surface-variant">Due at {due.toLocaleTimeString(undefined, { timeStyle: 'short' })} local time</p></div>
        </div>
        <div className="metadata-grid mt-5">
          <Meta icon="account_tree" label="Topic" value={assignment.topic} />
          <Meta icon="event" label="Deadline" value={due.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} />
          <Meta icon="grade" label="Maximum score" value={`${assignment.maxScore} points`} />
          <Meta icon="code" label="Supported languages" value={assignment.languageOptions.join(', ')} mono />
        </div>
      </header>

      <div className="viewer-grid">
        <div className="space-y-5">
          <section className="panel p-5 sm:p-6"><SectionHeading number="1" title="Problem specification" /><div className="prose-safe mt-4">{assignment.problemStatement}</div></section>
          {assignment.constraintsMarkdown && <section className="panel p-5 sm:p-6"><SectionHeading number="2" title="Constraints &amp; requirements" /><div className="prose-safe mt-4">{assignment.constraintsMarkdown}</div></section>}
          <section className="panel overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-outline-variant/40 p-5"><div><SectionHeading number="3" title="Sample cases" /><p className="mt-1 text-xs text-on-surface-variant">Reference examples provided by the course staff.</p></div><span className="font-mono text-[10px] text-on-surface-variant">{assignment.sampleCases.length} CASES</span></div>
            {assignment.sampleCases.length === 0 ? <div className="p-6 text-sm text-on-surface-variant">No sample cases have been added for this assignment.</div> : <div className="divide-y divide-outline-variant/40">{assignment.sampleCases.map((sample, index) => <article className="grid gap-4 p-5 md:grid-cols-2" key={`${index}-${sample.input.slice(0, 16)}`}><div><p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">Input · {index + 1}</p><pre className="code-sample">{sample.input || '—'}</pre></div><div><p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">Expected output</p><pre className="code-sample">{sample.expectedOutput || '—'}</pre>{sample.explanation && <p className="mt-2 text-xs text-on-surface-variant">{sample.explanation}</p>}</div></article>)}</div>}
          </section>
        </div>
        <aside className="flex flex-col gap-5">
          <section className="panel p-5"><SectionHeading number="" title="Assignment details" /><dl className="mt-4 space-y-4">{[["Course", assignment.courseCode], ["Assignment code", assignment.assignmentCode], ["Maximum score", `${assignment.maxScore} points`], ["Due", due.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })]].map(([label, value]) => <div key={label} className="border-b border-outline-variant/40 pb-3 last:border-0"><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="mt-1 text-sm font-semibold text-on-surface">{value}</dd></div>)}</dl></section>
          <section className="rounded-xl bg-surface-container-low p-5"><div className="flex items-center gap-2 text-primary"><span className="material-symbols-outlined text-secondary">info</span><h2 className="text-sm font-semibold">Evaluation approach</h2></div><p className="mt-2 text-xs leading-5 text-on-surface-variant">LabTrack evaluates correctness and demonstrated understanding. Similarity results, when available, are review flags—not verdicts.</p></section>
        </aside>
      </div>
      <aside className="sticky bottom-3 z-20 mt-8 rounded-xl border border-outline-variant/40 bg-white/95 p-4 shadow-elevated backdrop-blur"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="material-symbols-outlined text-primary">terminal</span><div><p className="text-sm font-semibold text-primary">Code workspace</p><p className="mt-0.5 text-xs text-on-surface-variant">The sandboxed editor is introduced in the next implementation stage. No code is run on this page.</p></div></div><button type="button" className="secondary-button opacity-60" disabled aria-disabled="true">Available in a later iteration<span className="material-symbols-outlined text-sm">lock</span></button></div></aside>
    </div>
  );
}

function Meta({ icon, label, value, mono = false }) {
  return <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest text-primary"><span className="material-symbols-outlined">{icon}</span></span><div className="min-w-0"><p className="text-[11px] text-on-surface-variant">{label}</p><p className={`truncate text-xs font-semibold text-on-surface ${mono ? 'font-mono' : ''}`}>{value}</p></div></div>;
}
function SectionHeading({ number, title }) {
  return <div className="flex items-center gap-3"><span className="h-6 w-1.5 rounded-full bg-secondary" />{number && <span className="font-mono text-xs text-secondary">{number}.</span>}<h2 className="text-lg font-bold text-primary">{title}</h2></div>;
}
