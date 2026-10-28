import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function StudentSubmissionHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'final', 'draft'
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/api/student/submissions/history');
      setHistory(res.history || []);
    } catch (err) {
      setError(err.message || 'Failed to load submission history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (filterType === 'final' && !item.isFinal) return false;
      if (filterType === 'draft' && item.isFinal) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const match =
          item.assignmentCode?.toLowerCase().includes(q) ||
          item.assignmentTitle?.toLowerCase().includes(q) ||
          item.language?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [history, filterType, query]);

  // Derived metrics
  const totalSubmissions = history.length;
  const finalSubmissions = history.filter((h) => h.isFinal).length;
  const evaluatedCount = history.filter((h) => h.grade?.status === 'finalised').length;
  const gradedItems = history.filter((h) => h.grade?.totalScore != null);
  const avgScore = gradedItems.length > 0
    ? Math.round(gradedItems.reduce((acc, h) => acc + h.grade.totalScore, 0) / gradedItems.length)
    : 0;

  return (
    <div className="min-h-screen bg-surface px-4 sm:px-6 lg:px-8 py-6 text-on-surface">
      {/* Top Academic Context Header & Action Toolbar */}
      <div className="pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-outline-variant/30">
        <div className="flex flex-col gap-1.5 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-surface-container-high text-secondary">
              Academic Ledger • CS-301 Fall '24
            </span>
            <span className="font-mono text-xs text-on-surface-variant flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              <span>Ledger ID: #TRK-STUDENT-SUBMISSIONS</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Submission History
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
            Immutable audit trail of algorithmic source code snapshots, automated test telemetry, declared AI-assist attributions, and faculty evaluation scorecards.
          </p>
        </div>

        {/* Quick Utilities */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <a
            href="/api/student/submissions/history/export"
            download="labtrack_submission_history.csv"
            className="h-9 px-3.5 rounded-lg bg-surface-container text-primary hover:bg-surface-container-high text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">download</span>
            <span>Export Audit CSV</span>
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3.5 rounded-lg bg-secondary text-white hover:bg-secondary/90 text-xs font-semibold transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            <span>Print Ledger</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Key Metrics Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        {/* Card 1: Total Submissions */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">Total Lifecycle Submissions</span>
            <span className="p-1.5 rounded-lg bg-surface-container text-primary">
              <span className="material-symbols-outlined text-[18px]">code</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-on-surface">{totalSubmissions}</span>
            <span className="text-xs text-on-surface-variant">({finalSubmissions} Final, {totalSubmissions - finalSubmissions} Drafts)</span>
          </div>
          <div className="mt-2 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-xs text-secondary font-semibold">
            <span>Verified Snapshots</span>
            <span className="text-on-surface-variant font-normal">Immutable</span>
          </div>
        </div>

        {/* Card 2: Evaluation Pipeline */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">Evaluation Pipeline</span>
            <span className="p-1.5 rounded-lg bg-surface-container-high text-secondary">
              <span className="material-symbols-outlined text-[18px]">grading</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-on-surface">{evaluatedCount}</span>
            <span className="text-xs text-on-surface-variant">Finalised / {finalSubmissions} Final</span>
          </div>
          <div className="mt-2 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-xs">
            <span className="text-secondary font-semibold">{evaluatedCount} Graded</span>
            <span className="text-on-surface-variant">{finalSubmissions - evaluatedCount} Pending Viva</span>
          </div>
        </div>

        {/* Card 3: Average Marks */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">Evaluated Performance</span>
            <span className="p-1.5 rounded-lg bg-surface-container text-primary">
              <span className="material-symbols-outlined text-[18px]">psychology</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-on-surface">{avgScore > 0 ? `${avgScore} Pts` : '—'}</span>
            <span className="text-xs text-secondary font-semibold">Average Grade</span>
          </div>
          <div className="mt-2 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
            <span>Combined Rubric</span>
            <span className="font-mono text-secondary font-bold">Autograder + Viva</span>
          </div>
        </div>

        {/* Card 4: AI Integrity Index */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">Academic Integrity</span>
            <span className="p-1.5 rounded-lg bg-surface-container-high text-secondary">
              <span className="material-symbols-outlined text-[18px]">policy</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-on-surface">100%</span>
            <span className="text-xs text-on-surface-variant">Attributed &amp; Vetted</span>
          </div>
          <div className="mt-2 pt-2 border-t border-outline-variant/20 flex items-center gap-1 text-xs text-secondary font-semibold">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            <span>Zero Unattributed Citations</span>
          </div>
        </div>
      </div>

      {/* Filter Console */}
      <div className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm border border-outline-variant/30 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {['all', 'final', 'draft'].map((t) => (
            <button
              key={t}
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filterType === t
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
              onClick={() => setFilterType(t)}
            >
              {t === 'all' ? 'All Attempts' : t === 'final' ? 'Final Submissions' : 'Autosaved Drafts'}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-2.5 top-2 text-on-surface-variant text-[16px]">search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code, lab, language…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-container-low text-xs text-on-surface border border-outline-variant/30 focus:outline-none focus:border-secondary"
          />
        </div>
      </div>

      {/* Submissions History Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-mono text-[11px] uppercase tracking-wider border-b border-outline-variant/20">
                <th className="py-3 px-4">Assignment</th>
                <th className="py-3 px-4">Attempt Type</th>
                <th className="py-3 px-4">Language</th>
                <th className="py-3 px-4">Test Cases</th>
                <th className="py-3 px-4">AI Disclosure</th>
                <th className="py-3 px-4">Evaluation / Mark</th>
                <th className="py-3 px-4">Submitted At</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-on-surface-variant">Loading submission history…</td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-on-surface-variant">No submission attempts recorded.</td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.submissionId} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-primary block">{item.assignmentCode}</span>
                      <span className="text-on-surface-variant text-[11px] truncate max-w-[200px] block">{item.assignmentTitle}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        item.isFinal ? 'bg-green-100 text-green-900' : 'bg-surface-container text-on-surface'
                      }`}>
                        {item.isFinal ? 'Final Submission' : 'Draft Snapshot'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-secondary font-semibold">
                      {item.language}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {item.totalTests > 0 ? (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          item.passedTests === item.totalTests ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
                        }`}>
                          {item.passedTests} / {item.totalTests} Passed
                        </span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.aiDeclared ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-secondary">
                          <span className="material-symbols-outlined text-[13px]">smart_toy</span>
                          <span>{item.aiTools?.join(', ') || 'Declared'}</span>
                        </span>
                      ) : (
                        <span className="text-on-surface-variant text-[11px]">Independent</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.grade ? (
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="font-bold text-primary">{item.grade.totalScore} Pts</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            item.grade.status === 'finalised' ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {item.grade.status === 'finalised' ? 'Final' : 'Provisional'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-on-surface-variant">
                      {new Date(item.submittedAt || item.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedSnapshot(item)}
                        className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-primary font-semibold transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot Inspection Modal */}
      {selectedSnapshot && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedSnapshot(null); }}>
          <section className="assignment-dialog max-w-3xl p-5 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/40 flex flex-col gap-4 max-h-[85vh] overflow-y-auto" role="dialog" aria-modal="true">
            <header className="flex items-start justify-between border-b border-outline-variant/30 pb-3">
              <div>
                <span className="font-mono text-[10px] text-secondary font-bold uppercase">{selectedSnapshot.assignmentCode} • {selectedSnapshot.language}</span>
                <h3 className="text-base font-bold text-primary">{selectedSnapshot.assignmentTitle}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Attempt snapshot: {new Date(selectedSnapshot.submittedAt || selectedSnapshot.createdAt).toLocaleString()}
                </p>
              </div>
              <button type="button" className="icon-button" onClick={() => setSelectedSnapshot(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            {/* Telemetry info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
              <div><span className="text-slate-400 block text-[10px]">Type</span><strong className="text-primary">{selectedSnapshot.isFinal ? 'Final Submission' : 'Draft'}</strong></div>
              <div><span className="text-slate-400 block text-[10px]">Tests</span><strong>{selectedSnapshot.passedTests}/{selectedSnapshot.totalTests} Passed</strong></div>
              <div><span className="text-slate-400 block text-[10px]">AI Attributed</span><strong>{selectedSnapshot.aiDeclared ? 'Yes' : 'No'}</strong></div>
              <div><span className="text-slate-400 block text-[10px]">Score</span><strong className="text-secondary">{selectedSnapshot.grade?.totalScore ?? 'Pending'} Pts</strong></div>
            </div>

            {/* Code preview */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Source Code Snapshot</span>
              <pre className="p-3 rounded-lg bg-[#0F172A] text-slate-200 font-mono text-xs overflow-x-auto max-h-72 leading-relaxed">
                {selectedSnapshot.sourceCode}
              </pre>
            </div>

            {/* Logic defense preview if available */}
            {selectedSnapshot.logicExplanation && (
              <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 text-xs flex flex-col gap-1">
                <span className="font-bold text-primary">Algorithmic Defense:</span>
                <p className="text-on-surface-variant leading-relaxed">
                  {selectedSnapshot.logicExplanation.approach || 'No approach notes.'}
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

