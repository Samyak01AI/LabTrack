import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function AssignmentViewerPage() {
  const { id } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api(`/api/student/assignments/${id}`).then((result) => {
      if (active) setAssignment(result.assignment);
    }).catch((fetchError) => {
      if (active) setError(fetchError.status === 404 ? 'This assignment is not available to your account.' : fetchError.message);
    }).finally(() => { if (active) setLoading(false); });

    // Attempt to load student scorecard if they have submitted
    api(`/api/student/assignments/${id}/scorecard`)
      .then((sc) => {
        if (active && sc) setScorecard(sc);
      })
      .catch(() => {
        // No submission or scorecard yet - silent ignore
      });

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
          {scorecard && (
            <section className="panel p-5 sm:p-6 border-l-4 border-secondary shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline-variant/30">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-2xl">grade</span>
                  <div>
                    <h2 className="text-base font-bold text-primary">Evaluation Scorecard</h2>
                    <p className="text-xs text-on-surface-variant font-mono">
                      Submission snapshot: {new Date(scorecard.submission?.submittedAt || '').toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                      scorecard.isProvisional
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-green-100 text-green-900 border border-green-300'
                    }`}
                  >
                    {scorecard.isProvisional ? 'PROVISIONAL MARK' : 'TEACHER FINALISED'}
                  </span>
                  <div className="px-3 py-1 rounded-xl bg-primary text-white font-mono font-bold text-sm">
                    {scorecard.grade?.totalScore ?? 0} / {scorecard.assignment?.maxScore || 100} Pts
                  </div>
                </div>
              </div>

              {scorecard.isProvisional && (
                <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">info</span>
                  <span>
                    This mark is provisional and pending oral examination/viva verification by your instructor.
                  </span>
                </div>
              )}

              {/* Rubric Category Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs font-mono">
                <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col">
                  <span className="text-[10px] text-on-surface-variant uppercase">1. Correctness</span>
                  <span className="text-base font-bold text-primary mt-1">
                    {scorecard.grade?.correctnessScore ?? scorecard.grade?.rubricScores?.correctness?.score ?? 0} / 40 Pts
                  </span>
                  <span className="text-[10px] text-secondary mt-0.5">Automated Tests</span>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col">
                  <span className="text-[10px] text-on-surface-variant uppercase">2. Approach &amp; Invariants</span>
                  <span className="text-base font-bold text-primary mt-1">
                    {scorecard.grade?.logicScore ?? scorecard.grade?.rubricScores?.logic?.score ?? 0} / 30 Pts
                  </span>
                  <span className="text-[10px] text-secondary mt-0.5">Logic Defense</span>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col">
                  <span className="text-[10px] text-on-surface-variant uppercase">3. Complexity</span>
                  <span className="text-base font-bold text-primary mt-1">
                    {scorecard.grade?.complexityScore ?? scorecard.grade?.rubricScores?.complexity?.score ?? 0} / 15 Pts
                  </span>
                  <span className="text-[10px] text-secondary mt-0.5">Data Structures</span>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col">
                  <span className="text-[10px] text-on-surface-variant uppercase">4. AI Transparency</span>
                  <span className="text-base font-bold text-primary mt-1">
                    {scorecard.grade?.transparencyScore ?? scorecard.grade?.rubricScores?.transparency?.score ?? 0} / 15 Pts
                  </span>
                  <span className="text-[10px] text-secondary mt-0.5">Viva &amp; Citations</span>
                </div>
              </div>

              {scorecard.grade?.feedback && (
                <div className="mt-4 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 text-xs">
                  <span className="font-bold text-primary block mb-1">Instructor Qualitative Feedback:</span>
                  <p className="text-on-surface leading-relaxed whitespace-pre-wrap">
                    {scorecard.grade.feedback}
                  </p>
                </div>
              )}
            </section>
          )}

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

      <aside className="sticky bottom-3 z-20 mt-8 rounded-xl border border-outline-variant/40 bg-white/95 p-4 shadow-elevated backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-secondary text-2xl">terminal</span>
            <div>
              <p className="text-sm font-semibold text-primary">Code Workspace &amp; Test Harness</p>
              <p className="mt-0.5 text-xs text-on-surface-variant">Write, test, and submit your C++20 / Java 21 solution against institutional test cases in the secure sandbox.</p>
            </div>
          </div>
          <Link to={`/student/assignments/${assignment.id}/workspace`} className="primary-button shrink-0">
            <span>Open Code Workspace</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Meta({ icon, label, value, mono = false }) {
  return <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest text-primary"><span className="material-symbols-outlined">{icon}</span></span><div className="min-w-0"><p className="text-[11px] text-on-surface-variant">{label}</p><p className={`truncate text-xs font-semibold text-on-surface ${mono ? 'font-mono' : ''}`}>{value}</p></div></div>;
}
function SectionHeading({ number, title }) {
  return <div className="flex items-center gap-3"><span className="h-6 w-1.5 rounded-full bg-secondary" />{number && <span className="font-mono text-xs text-secondary">{number}.</span>}<h2 className="text-lg font-bold text-primary">{title}</h2></div>;
}
