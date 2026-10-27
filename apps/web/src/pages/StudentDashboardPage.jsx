import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider.jsx';
import { api } from '../lib/api.js';

const dateLabel = (value, options = { dateStyle: 'medium', timeStyle: 'short' }) => new Intl.DateTimeFormat(undefined, options).format(new Date(value));
const dayMs = 86_400_000;

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('All Modules');
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    let active = true;
    api('/api/student/assignments').then((result) => {
      if (active) setAssignments(result.assignments);
    }).catch((fetchError) => {
      if (active) setError(fetchError.message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const topics = useMemo(() => ['All Modules', ...new Set(assignments.map((item) => item.topic))], [assignments]);
  const now = Date.now();
  const dueSoon = assignments.filter((item) => new Date(item.dueAt).getTime() >= now && new Date(item.dueAt).getTime() <= now + 7 * dayMs);
  const pastDue = assignments.filter((item) => new Date(item.dueAt).getTime() < now);
  const upcoming = assignments.filter((item) => new Date(item.dueAt).getTime() >= now).slice(0, 4);
  const visible = assignments.filter((item) => {
    const textMatch = `${item.title} ${item.topic} ${item.summary}`.toLowerCase().includes(query.trim().toLowerCase());
    const topicMatch = topic === 'All Modules' || item.topic === topic;
    const due = new Date(item.dueAt).getTime();
    const filterMatch = filter === 'All' || (filter === 'Upcoming' && due >= now) || (filter === 'Past due' && due < now);
    return textMatch && topicMatch && filterMatch;
  });

  return (
    <div className="page-wrap">
      <section className="page-hero flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4"><span className="hero-icon material-symbols-outlined">terminal</span>
          <div><div className="flex flex-wrap items-center gap-2"><h1 className="page-title">Welcome back, {user.displayName.split(' ')[0]}</h1><span className="tag tag-code">STUDENT</span></div>
            <p className="mt-1 text-sm text-on-surface-variant">Your published DSA assignments and deadlines, kept up to date from the course database.</p></div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3.5 py-2 font-mono text-xs text-primary"><span className="h-2.5 w-2.5 rounded-full bg-secondary" />Assignment feed synchronized</div>
      </section>

      <section className="metric-grid" aria-label="Assignment summary">
        <Metric icon="assignment" label="Published assignments" value={assignments.length} foot="Available to your account" />
        <Metric icon="event_upcoming" label="Due within 7 days" value={dueSoon.length} foot="Calculated from saved deadlines" accent />
        <Metric icon="event_busy" label="Past due" value={pastDue.length} foot="No submission status is inferred" />
      </section>

      <div className="dashboard-grid">
        <section id="assignment-list" className="panel scroll-mt-20 overflow-hidden">
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-secondary">code_blocks</span><h2 className="section-title">My Assignments</h2></div>
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="assignment-search">Filter assignments</label>
              <input id="assignment-search" className="filter-input min-w-[200px] flex-1" type="search" placeholder="Filter by title or topic…" value={query} onChange={(event) => setQuery(event.target.value)} />
              <label className="sr-only" htmlFor="topic-filter">Filter by module</label>
              <select id="topic-filter" className="filter-input min-w-[150px]" value={topic} onChange={(event) => setTopic(event.target.value)}>{topics.map((value) => <option key={value}>{value}</option>)}</select>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto bg-surface-container-low px-5 py-2" role="tablist" aria-label="Assignment status filter">
            {['All', 'Upcoming', 'Past due'].map((value) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={`segment-tab ${filter === value ? 'segment-tab-active' : ''}`} onClick={() => setFilter(value)}>{value}<span className="segment-count">{value === 'All' ? assignments.length : value === 'Upcoming' ? assignments.length - pastDue.length : pastDue.length}</span></button>)}
          </div>
          {error && <div className="m-5 rounded-lg bg-error-container p-4 text-sm text-on-error-container" role="alert">{error}</div>}
          {loading ? <div className="p-8 text-center text-sm text-on-surface-variant">Loading assignments…</div> : visible.length === 0 ? <div className="empty-state m-5"><span className="material-symbols-outlined text-3xl text-secondary">inbox</span><h3 className="mt-2 font-semibold text-on-surface">{assignments.length === 0 ? 'No published assignments yet' : 'No matching assignments'}</h3><p className="mt-1 text-sm text-on-surface-variant">{assignments.length === 0 ? 'Your instructor’s published assignments will appear here.' : 'Try a different search, topic, or status filter.'}</p></div> : (
            <div className="overflow-x-auto"><table className="data-table min-w-[720px]"><thead><tr><th>Title &amp; specification</th><th>Topic</th><th>Deadline</th><th>Status</th><th className="text-center">Points</th><th className="text-right">Action</th></tr></thead><tbody>
              {visible.map((item) => { const overdue = new Date(item.dueAt).getTime() < Date.now(); return <tr key={item.id} className={overdue ? 'row-overdue' : ''}>
                <td><Link className="table-title" to={`/student/assignments/${item.id}`}>{item.assignmentCode}: {item.title}</Link><span className="table-subtitle">{item.summary}</span></td>
                <td><span className="tag tag-topic">{item.topic}</span></td>
                <td className="font-mono text-xs"><span>{dateLabel(item.dueAt, { dateStyle: 'medium' })}</span><span className="table-subtitle">{dateLabel(item.dueAt, { timeStyle: 'short' })}</span></td>
                <td><span className={`status-pill ${overdue ? 'status-late' : 'status-open'}`}><span className="material-symbols-outlined text-sm">{overdue ? 'schedule' : 'radio_button_unchecked'}</span>{overdue ? 'Past due' : 'Open'}</span></td>
                <td className="text-center font-mono text-sm">{item.maxScore}</td>
                <td className="text-right"><Link className="secondary-button" to={`/student/assignments/${item.id}`}>View assignment<span className="material-symbols-outlined text-sm">arrow_forward</span></Link></td>
              </tr>; })}
            </tbody></table></div>
          )}
          {!loading && assignments.length > 0 && <div className="flex justify-between border-t border-outline-variant/40 px-5 py-3 text-xs text-on-surface-variant"><span>Showing <strong>{visible.length}</strong> of <strong>{assignments.length}</strong> assignments</span><span className="font-mono">Source: Course database</span></div>}
        </section>

        <aside className="flex flex-col gap-5">
          <section className="panel p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><span className="material-symbols-outlined text-secondary">calendar_clock</span><h2 className="section-title text-base">Upcoming deadlines</h2></div><span className="font-mono text-[10px] text-on-surface-variant">LOCAL TIME</span></div>
            {upcoming.length === 0 ? <p className="rounded-lg bg-surface-container-low p-4 text-sm text-on-surface-variant">No upcoming deadlines.</p> : <div className="space-y-3">{upcoming.map((item) => <Link key={item.id} to={`/student/assignments/${item.id}`} className="deadline-card block"><div className="flex items-center justify-between gap-2"><span className="tag tag-topic">{item.topic}</span><span className="font-mono text-[10px] text-on-surface-variant">{dateLabel(item.dueAt, { dateStyle: 'short' })}</span></div><p className="mt-2 text-sm font-semibold text-on-surface">{item.title}</p><p className="mt-1 text-xs text-on-surface-variant">Due {dateLabel(item.dueAt, { dateStyle: 'medium', timeStyle: 'short' })}</p></Link>)}</div>}
          </section>
          <section className="panel bg-primary p-5 text-white"><div className="flex items-center gap-2 text-secondary-fixed"><span className="material-symbols-outlined">policy</span><h2 className="text-xs font-bold uppercase tracking-wider">Evaluation principles</h2></div><p className="mt-3 text-sm leading-6 text-blue-50">LabTrack considers both correctness and demonstrated understanding. Similarity flags are prompts for teacher review—not verdicts.</p></section>
        </aside>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, foot, accent = false }) {
  return <article className="metric-card"><div className="flex items-start justify-between"><div><p className="metric-label">{label}</p><p className={`metric-value ${accent ? 'text-secondary' : ''}`}>{value}</p></div><span className={`metric-icon ${accent ? 'bg-secondary text-white' : 'bg-primary text-white'} material-symbols-outlined`}>{icon}</span></div><div className="metric-foot">{foot}</div></article>;
}
