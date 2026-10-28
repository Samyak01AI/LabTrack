import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';

const STARTER_TEMPLATES = {
  'C++20': `#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>

using namespace std;

// Solution implementation
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Read input from standard input and write to standard output
    string line;
    while (getline(cin, line)) {
        cout << line << "\\n";
    }

    return 0;
}
`,
  'Java 21': `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line;
        while ((line = reader.readLine()) != null) {
            System.out.println(line);
        }
    }
}
`,
};

const AVAILABLE_AI_TOOLS = [
  'LabTrack In-Platform AI Assistant',
  'GitHub Copilot',
  'ChatGPT-4o',
  'Claude 3.5 Sonnet',
  'Gemini 1.5 Pro',
  'Phind',
  'Cursor',
  'Local LLM (Ollama/Llama-3)',
];

function formatSessionTime(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function CodeWorkspacePage() {
  const { id } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active step: 1 (Code), 2 (Declaration), 3 (Explanation), 4 (Review)
  const [currentStep, setCurrentStep] = useState(1);

  // Per-language code buffers to fix TC_07 (switching languages never destroys code)
  const [selectedLanguage, setSelectedLanguage] = useState('C++20');
  const [codeBuffers, setCodeBuffers] = useState({
    'C++20': STARTER_TEMPLATES['C++20'],
    'Java 21': STARTER_TEMPLATES['Java 21'],
  });

  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('tests'); // 'tests' | 'console'
  const [fontSize, setFontSize] = useState('13px');
  const [cursorPos, setCursorPos] = useState({ ln: 1, col: 1 });

  // Test execution state
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [overallStatus, setOverallStatus] = useState(null);
  const [compilerOutput, setCompilerOutput] = useState('');

  // Step 2: AI Declaration state
  const [aiDeclaration, setAiDeclaration] = useState({
    aiUsed: false,
    tools: [],
    narrative: '',
    otherTool: '',
    impactPercentage: '1-25%',
  });

  // Code Annotations (for Step 2)
  const [annotations, setAnnotations] = useState([]);
  const [newAnnotation, setNewAnnotation] = useState({
    startLine: 1,
    endLine: 5,
    justification: '',
    tool: 'ChatGPT-4o',
  });

  // Step 3: Logic & Conceptual Defense state
  const [logicExplanation, setLogicExplanation] = useState({
    approach: '',
    dataStructures: '',
    tradeoffAnalysis: '',
    timeComplexity: 'O(N)',
    spaceComplexity: 'O(1)',
  });

  // Final submission completed state
  const [finalSubmission, setFinalSubmission] = useState(null);

  const [autosavedTime, setAutosavedTime] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(70);
  const [bannerNotice, setBannerNotice] = useState('');

  // Iteration 8: Pedagogical AI Assistant state
  const [aiStatus, setAiStatus] = useState({
    enabled: false,
    remainingQueries: 5,
    hourlyLimit: 5,
    usedInLastHour: 0,
    reason: '',
  });
  const [aiMode, setAiMode] = useState('hint'); // 'hint' | 'debug' | 'complexity'
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState([]);

  const textareaRef = useRef(null);
  const currentCode = codeBuffers[selectedLanguage] || '';

  // Session timer
  useEffect(() => {
    const timer = setInterval(() => setSessionSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch assignment & latest draft
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const res = await api(`/api/student/assignments/${id}`);
        if (!active) return;
        setAssignment(res.assignment);

        const defaultLang = res.assignment.languageOptions?.includes('C++20')
          ? 'C++20'
          : res.assignment.languageOptions?.[0] || 'C++20';
        setSelectedLanguage(defaultLang);

        // Check backend for draft first
        try {
          const draftRes = await api(`/api/student/assignments/${id}/submissions/latest`);
          if (active && draftRes?.submission) {
            const sub = draftRes.submission;
            const lang = sub.language || defaultLang;
            setSelectedLanguage(lang);
            setCodeBuffers((prev) => ({
              ...prev,
              [lang]: sub.sourceCode || prev[lang],
            }));
            if (sub.aiDeclaration) setAiDeclaration(sub.aiDeclaration);
            if (sub.logicExplanation) setLogicExplanation(sub.logicExplanation);
            if (sub.annotations) setAnnotations(sub.annotations);
            if (sub.isFinal) setFinalSubmission(sub);
            setAutosavedTime(new Date(sub.updatedAt || sub.createdAt).toLocaleTimeString());
          }
        } catch (_ignore) {
          // Check localStorage fallback
          const localDraft = localStorage.getItem(`labtrack_draft_${id}`);
          if (localDraft) {
            try {
              const parsed = JSON.parse(localDraft);
              if (parsed.codeBuffers) setCodeBuffers(parsed.codeBuffers);
              if (parsed.selectedLanguage) setSelectedLanguage(parsed.selectedLanguage);
              if (parsed.aiDeclaration) setAiDeclaration(parsed.aiDeclaration);
              if (parsed.logicExplanation) setLogicExplanation(parsed.logicExplanation);
              if (parsed.annotations) setAnnotations(parsed.annotations);
            } catch {
              setCodeBuffers((prev) => ({ ...prev, [defaultLang]: localDraft }));
            }
          }
        }

        // Initialize sample case results placeholder
        if (res.assignment.sampleCases) {
          setTestResults(res.assignment.sampleCases.map((sc, idx) => ({
            testIndex: idx,
            input: sc.input || '',
            expectedOutput: sc.expectedOutput || '',
            actualOutput: '—',
            status: 'pending',
            timeMs: 0,
            memoryKb: 0,
          })));
        }
        // Fetch AI Assistance Status & Prior Logs (Iteration 8)
        try {
          const [statusRes, logsRes] = await Promise.all([
            api(`/api/student/assignments/${id}/ai-status`),
            api(`/api/student/assignments/${id}/ai-logs`),
          ]);
          if (active) {
            setAiStatus(statusRes);
            if (logsRes?.logs) setAiHistory(logsRes.logs);
          }
        } catch (_ignoreAi) {
          // AI assistance endpoint may be unconfigured or disabled
        }
      } catch (err) {
        if (active) setError(err.status === 404 ? 'This assignment is not available to your account.' : err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, [id]);

  function persistLocal(overrides = {}) {
    const dataToSave = {
      codeBuffers,
      selectedLanguage,
      aiDeclaration,
      logicExplanation,
      annotations,
      ...overrides,
    };
    localStorage.setItem(`labtrack_draft_${id}`, JSON.stringify(dataToSave));
    setAutosavedTime(new Date().toLocaleTimeString());
  }

  function handleCodeChange(newCode) {
    const updated = { ...codeBuffers, [selectedLanguage]: newCode };
    setCodeBuffers(updated);
    persistLocal({ codeBuffers: updated });
  }

  function handleKeyDown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const val = e.target.value;
      const updated = val.substring(0, start) + '    ' + val.substring(end);
      handleCodeChange(updated);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      });
    }
  }

  function handleCursorUpdate(e) {
    const text = e.target.value.substring(0, e.target.selectionStart);
    const lines = text.split('\n');
    setCursorPos({
      ln: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
  }

  // Language change handles TC_07 safely by preserving separate buffers
  function handleLanguageChange(newLang) {
    setSelectedLanguage(newLang);
    persistLocal({ selectedLanguage: newLang });
    setBannerNotice(`Switched editor to ${newLang}. Code buffer preserved.`);
    setTimeout(() => setBannerNotice(''), 3000);
  }

  function handleResetTemplate() {
    if (window.confirm(`Reset ${selectedLanguage} code to starter template? Any unsaved edits in this buffer will be replaced.`)) {
      handleCodeChange(STARTER_TEMPLATES[selectedLanguage] || '');
      setBannerNotice(`Reset ${selectedLanguage} to starter template.`);
      setTimeout(() => setBannerNotice(''), 3000);
    }
  }

  // Step 2 Tool selection toggles
  function toggleAiTool(tool) {
    setAiDeclaration((prev) => {
      const exists = prev.tools.includes(tool);
      const updated = exists ? prev.tools.filter((t) => t !== tool) : [...prev.tools, tool];
      const next = { ...prev, tools: updated };
      persistLocal({ aiDeclaration: next });
      return next;
    });
  }

  // Code Annotations management
  function handleAddAnnotation() {
    if (!newAnnotation.justification.trim()) {
      alert('Please provide a justification for the AI-assisted code range.');
      return;
    }
    const maxLines = currentCode.split('\n').length;
    const start = Math.max(1, Math.min(newAnnotation.startLine, maxLines));
    const end = Math.max(start, Math.min(newAnnotation.endLine, maxLines));

    const ann = {
      id: `ann-${Date.now()}`,
      startLine: start,
      endLine: end,
      justification: newAnnotation.justification.trim(),
      tool: newAnnotation.tool || 'AI Assistant',
    };
    const updated = [...annotations, ann];
    setAnnotations(updated);
    setNewAnnotation({
      startLine: Math.min(end + 1, maxLines),
      endLine: Math.min(end + 5, maxLines),
      justification: '',
      tool: newAnnotation.tool,
    });
    persistLocal({ annotations: updated });
    setBannerNotice(`Annotation added for Lines ${start}–${end}.`);
    setTimeout(() => setBannerNotice(''), 3000);
  }

  function handleRemoveAnnotation(annId) {
    const updated = annotations.filter((a) => a.id !== annId);
    setAnnotations(updated);
    persistLocal({ annotations: updated });
  }

  // Save draft to backend & local
  async function handleSaveDraft() {
    setIsSaving(true);
    setBannerNotice('');
    try {
      await api(`/api/student/assignments/${id}/submit`, {
        method: 'POST',
        body: {
          language: selectedLanguage,
          sourceCode: currentCode,
          isDraft: true,
          aiDeclaration,
          logicExplanation,
          annotations,
        },
      });
      persistLocal();
      setBannerNotice('Draft, declaration & annotations saved to institutional sandbox.');
    } catch (err) {
      setBannerNotice(`Save draft failed: ${err.message}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setBannerNotice(''), 4000);
    }
  }

  // Run code against test cases (Step 1)
  async function handleRunCode() {
    if (!currentCode.trim()) {
      alert('Source code cannot be blank.');
      return;
    }
    setIsRunning(true);
    setOverallStatus('running');
    setActiveTab('tests');

    try {
      const res = await api(`/api/student/assignments/${id}/run`, {
        method: 'POST',
        body: {
          language: selectedLanguage,
          sourceCode: currentCode,
        },
      });

      setOverallStatus(res.status || 'accepted');
      if (res.results && res.results.length > 0) {
        setTestResults(res.results);
      }
      if (res.compilerOutput) {
        setCompilerOutput(res.compilerOutput);
      } else {
        setCompilerOutput(`$ ${selectedLanguage === 'C++20' ? 'g++ -std=c++20 -O2' : 'javac -version'} solution\nCompilation finished with 0 errors.\nExecution completed in ${res.executionTimeMs ?? 1} ms.`);
      }
      persistLocal();
      setBannerNotice('Test run completed.');
    } catch (err) {
      setOverallStatus('internal_error');
      setCompilerOutput(`Execution failed: ${err.message}`);
      setBannerNotice(`Execution error: ${err.message}`);
    } finally {
      setIsRunning(false);
      setTimeout(() => setBannerNotice(''), 4000);
    }
  }

  // Iteration 8: Request Socratic AI Assistant guidance
  async function handleAskAssistant() {
    if (!aiPrompt.trim()) return;
    if (aiPrompt.trim().length < 3) {
      alert('Please ask a question with at least 3 characters.');
      return;
    }
    setAiLoading(true);
    try {
      const res = await api(`/api/student/assignments/${id}/ai-assist`, {
        method: 'POST',
        body: {
          mode: aiMode,
          prompt: aiPrompt.trim(),
          sourceCode: currentCode,
          language: selectedLanguage,
        },
      });

      const newEntry = {
        id: res.attribution?.id || String(Date.now()),
        mode: aiMode,
        prompt: aiPrompt.trim(),
        response: res.response,
        createdAt: new Date().toISOString(),
      };

      setAiHistory((prev) => [...prev, newEntry]);
      setAiPrompt('');
      if (res.remainingQueries != null) {
        setAiStatus((prev) => ({ ...prev, remainingQueries: res.remainingQueries }));
      }

      // Automatically attribute in Step 2 AI Declaration
      setAiDeclaration((prev) => {
        const tools = prev.tools.includes('LabTrack In-Platform AI Assistant')
          ? prev.tools
          : ['LabTrack In-Platform AI Assistant', ...prev.tools];
        const narrativeAddition = `[${aiMode.toUpperCase()}]: ${newEntry.prompt.slice(0, 60)}...`;
        const updatedNarrative = prev.narrative
          ? `${prev.narrative}\n• ${narrativeAddition}`
          : `• ${narrativeAddition}`;
        const updated = {
          ...prev,
          aiUsed: true,
          tools,
          narrative: updatedNarrative,
        };
        persistLocal({ aiDeclaration: updated });
        return updated;
      });

      setBannerNotice('Inquiry logged and automatically attributed to Step 2 AI declaration.');
      setTimeout(() => setBannerNotice(''), 4500);
    } catch (err) {
      alert(`AI Assistant notice: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  }

  // Step 4 Final Submission
  async function handleFinalSubmit() {
    // Client-side pre-flight checks mirroring server validation
    if (!currentCode.trim()) {
      alert('Source code cannot be empty.');
      setCurrentStep(1);
      return;
    }
    if (aiDeclaration.aiUsed) {
      if (aiDeclaration.tools.length === 0 && !aiDeclaration.otherTool?.trim()) {
        alert('Step 2: Please select at least one AI tool utilized.');
        setCurrentStep(2);
        return;
      }
      if (annotations.length === 0) {
        alert('Step 2: AI assistance was declared, but zero code annotations were provided. You must mark and justify AI-assisted lines.');
        setCurrentStep(2);
        return;
      }
    }

    const totalExplLen =
      (logicExplanation.approach?.trim().length || 0) +
      (logicExplanation.dataStructures?.trim().length || 0) +
      (logicExplanation.tradeoffAnalysis?.trim().length || 0);

    if (totalExplLen < 60) {
      alert('Step 3: Conceptual logic explanation is too brief. Minimum 60 characters required across logic, approach, and data structures.');
      setCurrentStep(3);
      return;
    }

    setIsSubmitting(true);
    setBannerNotice('');

    try {
      const res = await api(`/api/student/assignments/${id}/submit`, {
        method: 'POST',
        body: {
          language: selectedLanguage,
          sourceCode: currentCode,
          isDraft: false,
          aiDeclaration,
          logicExplanation,
          annotations,
        },
      });

      setFinalSubmission(res.submission);
      setOverallStatus(res.submission.status);
      if (res.submission.results) setTestResults(res.submission.results);
      setBannerNotice('Submission finalized and recorded. Snapshot is immutable.');
      setCurrentStep(4);
    } catch (err) {
      alert(`Submission failed: ${err.message}`);
      setBannerNotice(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) return <div className="screen-loader">Loading DSA workbench…</div>;
  if (error || !assignment) {
    return (
      <section className="panel mx-auto max-w-3xl p-8 text-center">
        <span className="material-symbols-outlined text-3xl text-error">error</span>
        <h1 className="mt-3 text-xl font-bold">Workspace unavailable</h1>
        <p className="mt-2 text-sm text-on-surface-variant">{error || 'Could not load workspace.'}</p>
        <Link className="primary-button mt-5" to="/student/dashboard">Back to dashboard</Link>
      </section>
    );
  }

  const lines = currentCode.split('\n');
  const passingCount = testResults.filter((r) => r.status === 'accepted' || r.status === 'PASS').length;
  const totalCount = testResults.length;

  // Validation calculations for Steps 2 & 3
  const isStep1Complete = currentCode.trim().length > 10;
  const isStep2Complete = !aiDeclaration.aiUsed || (aiDeclaration.tools.length > 0 || Boolean(aiDeclaration.otherTool?.trim())) && annotations.length > 0;
  const logicApproachLen = logicExplanation.approach?.trim().length || 0;
  const logicTradeoffLen = logicExplanation.tradeoffAnalysis?.trim().length || 0;
  const logicDsLen = logicExplanation.dataStructures?.trim().length || 0;
  const totalLogicLen = logicApproachLen + logicTradeoffLen + logicDsLen;
  const isStep3Complete = totalLogicLen >= 60;
  const isReadyForFinalSubmit = isStep1Complete && isStep2Complete && isStep3Complete;

  // Set of annotated line numbers for code viewer highlighting
  const annotatedLineSet = new Set();
  annotations.forEach((ann) => {
    for (let l = ann.startLine; l <= ann.endLine; l++) {
      annotatedLineSet.add(l);
    }
  });

  return (
    <div className="flex flex-col w-full pb-24">
      {bannerNotice && (
        <div className="fixed top-20 right-8 z-50 rounded-lg bg-primary text-on-primary px-4 py-2.5 shadow-elevated text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary-fixed text-base">info</span>
          <span>{bannerNotice}</span>
        </div>
      )}

      {/* TOP CONTEXT BAR: Breadcrumbs, Session Metadata & Stepper */}
      <section className="w-full bg-surface-container-lowest shadow-sm rounded-xl mb-4 p-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <nav className="flex items-center gap-2 text-on-surface-variant text-xs font-medium" aria-label="Breadcrumb">
              <Link className="hover:text-secondary" to="/student/dashboard">Assignments</Link>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <Link className="hover:text-secondary max-w-[40vw] truncate" to={`/student/assignments/${assignment.id}`}>{assignment.title}</Link>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="text-secondary font-bold uppercase tracking-wider">
                {currentStep === 1 ? 'Step 1: Code' : currentStep === 2 ? 'Step 2: AI Declaration' : currentStep === 3 ? 'Step 3: Logic Defense' : 'Step 4: Review & Submit'}
              </span>
            </nav>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <h1 className="text-xl font-bold text-on-surface">{assignment.title}</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold">{selectedLanguage}</span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-mono text-xs">Max Marks: {assignment.maxScore}</span>
              {finalSubmission && (
                <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  <span>Submitted Snapshot</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-on-surface-variant text-xs self-start xl:self-auto">
            <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-lg">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
              </span>
              <span className="font-mono text-on-surface font-medium">{autosavedTime ? `Autosaved ${autosavedTime}` : 'Autosaved'}</span>
              <span className="text-outline text-[11px]">•</span>
              <span className="font-mono text-on-surface-variant">git:sub-{assignment.assignmentCode?.toLowerCase()}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-primary text-on-primary px-3 py-1.5 rounded-lg shadow-sm">
              <span className="material-symbols-outlined text-sm text-secondary-fixed">timer</span>
              <span className="font-mono tracking-wide font-medium">Lab Session: {formatSessionTime(sessionSeconds)}</span>
            </div>
          </div>
        </div>

        {/* 4-Step Academic Workflow Stepper */}
        <div className="mt-4 pt-3 bg-surface-container-low/60 rounded-xl px-4 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Step 1 */}
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all ${
                currentStep === 1
                  ? 'bg-surface-container-lowest ring-2 ring-secondary shadow-sm'
                  : isStep1Complete
                  ? 'bg-surface-container-low opacity-90 hover:opacity-100'
                  : 'bg-surface-container-low opacity-60'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                currentStep === 1 || isStep1Complete ? 'bg-secondary text-white' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {isStep1Complete && currentStep !== 1 ? <span className="material-symbols-outlined text-sm">check</span> : '1'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className={`text-[10px] uppercase font-bold tracking-wider ${currentStep === 1 ? 'text-secondary' : 'text-on-surface-variant'}`}>
                  {currentStep === 1 ? 'Step 1 • Active' : 'Step 1'}
                </span>
                <span className="text-sm font-semibold text-on-surface truncate">Code Implementation</span>
              </div>
              <span className="ml-auto material-symbols-outlined text-secondary text-base">terminal</span>
            </button>

            {/* Step 2 */}
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all ${
                currentStep === 2
                  ? 'bg-surface-container-lowest ring-2 ring-secondary shadow-sm'
                  : isStep2Complete
                  ? 'bg-surface-container-low opacity-90 hover:opacity-100'
                  : 'bg-surface-container-low opacity-60'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                currentStep === 2 || isStep2Complete ? 'bg-secondary text-white' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {isStep2Complete && currentStep !== 2 ? <span className="material-symbols-outlined text-sm">check</span> : '2'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className={`text-[10px] uppercase font-bold tracking-wider ${currentStep === 2 ? 'text-secondary' : 'text-on-surface-variant'}`}>
                  {currentStep === 2 ? 'Step 2 • Active' : 'Step 2'}
                </span>
                <span className="text-sm font-semibold text-on-surface truncate">AI-Use Declaration</span>
              </div>
              <span className="ml-auto material-symbols-outlined text-secondary text-base">psychology</span>
            </button>

            {/* Step 3 */}
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all ${
                currentStep === 3
                  ? 'bg-surface-container-lowest ring-2 ring-secondary shadow-sm'
                  : isStep3Complete
                  ? 'bg-surface-container-low opacity-90 hover:opacity-100'
                  : 'bg-surface-container-low opacity-60'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                currentStep === 3 || isStep3Complete ? 'bg-secondary text-white' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {isStep3Complete && currentStep !== 3 ? <span className="material-symbols-outlined text-sm">check</span> : '3'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className={`text-[10px] uppercase font-bold tracking-wider ${currentStep === 3 ? 'text-secondary' : 'text-on-surface-variant'}`}>
                  {currentStep === 3 ? 'Step 3 • Active' : 'Step 3'}
                </span>
                <span className="text-sm font-semibold text-on-surface truncate">Logic Explanation</span>
              </div>
              <span className="ml-auto material-symbols-outlined text-secondary text-base">menu_book</span>
            </button>

            {/* Step 4 */}
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all ${
                currentStep === 4
                  ? 'bg-surface-container-lowest ring-2 ring-secondary shadow-sm'
                  : isReadyForFinalSubmit
                  ? 'bg-surface-container-low opacity-90 hover:opacity-100'
                  : 'bg-surface-container-low opacity-60'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                currentStep === 4 ? 'bg-secondary text-white' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {finalSubmission ? <span className="material-symbols-outlined text-sm">check</span> : '4'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className={`text-[10px] uppercase font-bold tracking-wider ${currentStep === 4 ? 'text-secondary' : 'text-on-surface-variant'}`}>
                  {currentStep === 4 ? 'Step 4 • Active' : 'Step 4'}
                </span>
                <span className="text-sm font-semibold text-on-surface truncate">Review &amp; Submit</span>
              </div>
              <span className="ml-auto material-symbols-outlined text-secondary text-base">verified</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* STEP 1: CODE IMPLEMENTATION                                               */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="grid grid-cols-12 gap-4 mb-8 items-start">
          {/* LEFT PANEL: Problem Brief & Academic Specs */}
          {!isDrawerCollapsed && (
            <aside className="col-span-12 lg:col-span-4 xl:col-span-3 flex flex-col gap-4 transition-all duration-200">
              <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 bg-surface-container-low flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-xl">assignment</span>
                    <span className="font-bold text-primary text-base">Problem Brief</span>
                  </div>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
                    onClick={() => setIsDrawerCollapsed(true)}
                    title="Collapse Specifications"
                  >
                    <span className="material-symbols-outlined text-lg">first_page</span>
                  </button>
                </div>

                <div className="p-4 flex flex-col gap-4">
                  <div>
                    <div className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1">Core Objective</div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {assignment.summary || assignment.problemStatement?.slice(0, 200)}
                    </p>
                  </div>

                  <div className="bg-surface-container-low rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-primary uppercase">Course Info</span>
                      <span className="material-symbols-outlined text-outline text-base">school</span>
                    </div>
                    <ul className="flex flex-col gap-1 font-mono text-xs text-on-surface">
                      <li className="bg-surface-container-lowest px-2 py-1 rounded shadow-sm text-primary">{assignment.courseCode} · {assignment.assignmentCode}</li>
                      <li className="bg-surface-container-lowest px-2 py-1 rounded shadow-sm text-primary">{assignment.topic}</li>
                      <li className="bg-surface-container-lowest px-2 py-1 rounded shadow-sm text-primary">Max Score: {assignment.maxScore}</li>
                    </ul>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-on-surface uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-secondary text-base">tune</span>
                      <span>System Constraints</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 text-xs">
                      <div className="flex justify-between items-center py-1.5 px-2.5 rounded bg-surface-container-low">
                        <span className="text-on-surface-variant">Time Limit</span>
                        <span className="font-mono font-semibold text-primary">1.50 seconds</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 px-2.5 rounded bg-surface-container-low">
                        <span className="text-on-surface-variant">Memory Limit</span>
                        <span className="font-mono font-semibold text-primary">256 MB</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 px-2.5 rounded bg-surface-container-low">
                        <span className="text-on-surface-variant">Languages</span>
                        <span className="font-mono font-semibold text-secondary">{assignment.languageOptions?.join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-surface-container text-on-surface flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-secondary">
                      <span className="material-symbols-outlined text-base">lightbulb</span>
                      <span className="text-[11px] font-bold uppercase">Department Invariant Note</span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-tight">
                      All student code executes strictly within isolated sandbox environments. Ensure standard I/O conventions are followed without interactive prompts.
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold block mb-2">Project Manifest</span>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between p-2 rounded bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-secondary text-base">description</span>
                          <span className="font-mono text-xs font-medium text-primary">
                            {selectedLanguage === 'C++20' ? 'solution.cpp' : 'Main.java'}
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-container-high text-primary font-bold">MAIN</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-on-surface-variant text-base">science</span>
                          <span className="font-mono text-xs font-medium text-on-surface-variant">sample_cases.json</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-container text-on-surface-variant">TESTS</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          )}

          {/* RIGHT / CENTRAL WORKBENCH: Code Editor & Execution Harness */}
          <div className={`flex flex-col gap-4 ${isDrawerCollapsed ? 'col-span-12' : 'col-span-12 lg:col-span-8 xl:col-span-9'}`}>
            {isDrawerCollapsed && (
              <button
                type="button"
                className="self-start flex items-center gap-1.5 text-xs font-semibold text-secondary bg-surface-container px-3 py-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
                onClick={() => setIsDrawerCollapsed(false)}
              >
                <span className="material-symbols-outlined text-base">last_page</span>
                <span>Show Problem Brief</span>
              </button>
            )}

            {/* Monaco-Style Code Editor */}
            <div className="bg-[#1b2336] text-white rounded-xl shadow-md overflow-hidden flex flex-col">
              <div className="bg-[#30384d] px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-[#1b2336] px-3 py-1.5 rounded-lg border border-white/10">
                    <span className="material-symbols-outlined text-[#7cd4df] text-base">terminal</span>
                    <select
                      className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
                      value={selectedLanguage}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                    >
                      {(assignment.languageOptions || ['C++20', 'Java 21']).map((lang) => (
                        <option key={lang} className="bg-[#1b2336] text-white" value={lang}>
                          {lang === 'C++20' ? 'C++ (GCC 13.2 / C++20)' : 'Java (OpenJDK 21)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-[#1b2336]/60 font-mono text-xs text-blue-200">
                    <span>{selectedLanguage === 'C++20' ? 'solution.cpp' : 'Main.java'}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#96eef9]" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden md:flex items-center gap-1 text-slate-300 pr-2">
                    <button
                      type="button"
                      className="px-2 py-1 rounded hover:bg-[#1b2336] text-slate-300 font-mono text-xs transition-colors"
                      onClick={() => setFontSize((prev) => (prev === '13px' ? '15px' : prev === '15px' ? '12px' : '13px'))}
                      title="Toggle Font Size"
                    >
                      {fontSize}
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-[#1b2336] text-slate-300 transition-colors"
                      onClick={handleResetTemplate}
                      title="Reset to template"
                    >
                      <span className="material-symbols-outlined text-base">restart_alt</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1b2336] hover:bg-white/10 text-white text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
                    onClick={handleSaveDraft}
                    disabled={isSaving}
                  >
                    <span className="material-symbols-outlined text-sm">save</span>
                    <span>{isSaving ? 'Saving…' : 'Draft'}</span>
                  </button>

                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1f3864] text-white hover:bg-[#2e4673] transition-colors text-xs font-semibold shadow-sm disabled:opacity-50"
                    onClick={handleRunCode}
                    disabled={isRunning}
                  >
                    <span className="material-symbols-outlined text-sm text-[#7cd4df]">play_arrow</span>
                    <span>{isRunning ? 'Running…' : 'Run Code'}</span>
                  </button>

                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-secondary text-white hover:bg-secondary/90 transition-colors text-xs font-bold shadow-sm"
                    onClick={() => setCurrentStep(2)}
                  >
                    <span>Proceed to Step 2</span>
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </button>
                </div>
              </div>

              {/* Editor Canvas */}
              <div className="grid grid-cols-12 bg-[#0d121f] text-slate-100 font-mono text-xs min-h-[460px] p-2 select-text overflow-x-auto">
                <div className="col-span-1 select-none text-right pr-3 text-slate-500 font-mono text-xs flex flex-col pt-2 leading-6">
                  {lines.map((_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>

                <div className="col-span-11 pl-2 pt-2 relative">
                  <textarea
                    ref={textareaRef}
                    className="w-full h-full min-h-[440px] bg-transparent text-slate-100 font-mono resize-none focus:outline-none leading-6 border-0 p-0"
                    style={{ fontSize }}
                    value={currentCode}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleCursorUpdate}
                    onClick={handleCursorUpdate}
                    spellCheck="false"
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                  />
                </div>
              </div>

              {/* Status Footer */}
              <div className="bg-[#1b2336] px-4 py-1.5 flex items-center justify-between text-slate-400 font-mono text-xs border-t border-white/5">
                <div className="flex items-center gap-4">
                  <span>Spaces: 4</span>
                  <span>UTF-8</span>
                  <span>LF</span>
                  <span className="text-[#7cd4df]">Sandbox Runner: {isRunning ? 'Active' : 'Ready'}</span>
                </div>
                <div>Ln {cursorPos.ln}, Col {cursorPos.col}</div>
              </div>
            </div>

            {/* Test Harness & Results Panel */}
            <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="bg-surface-container-low px-4 pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`flex items-center gap-2 px-3 py-2 rounded-t-lg text-xs font-bold transition-colors ${
                      activeTab === 'tests'
                        ? 'bg-surface-container-lowest text-primary shadow-sm'
                        : 'text-on-surface-variant hover:bg-surface-container'
                    }`}
                    onClick={() => setActiveTab('tests')}
                  >
                    <span className="material-symbols-outlined text-base text-secondary">checklist</span>
                    <span>Automated Test Cases</span>
                    {overallStatus && overallStatus !== 'idle' && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        passingCount === totalCount && totalCount > 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-error-container text-on-error-container'
                      }`}>
                        {passingCount}/{totalCount} Passing
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`flex items-center gap-2 px-3 py-2 rounded-t-lg text-xs font-medium transition-colors ${
                      activeTab === 'console'
                        ? 'bg-[#1b2336] text-white shadow-sm'
                        : 'text-on-surface-variant hover:bg-surface-container'
                    }`}
                    onClick={() => setActiveTab('console')}
                  >
                    <span className="material-symbols-outlined text-base">terminal</span>
                    <span>Console &amp; Compiler</span>
                    {compilerOutput && <span className="w-2 h-2 rounded-full bg-secondary" />}
                  </button>

                  <button
                    type="button"
                    className={`flex items-center gap-2 px-3 py-2 rounded-t-lg text-xs font-medium transition-colors ${
                      activeTab === 'assistant'
                        ? 'bg-surface-container-lowest text-primary shadow-sm'
                        : 'text-on-surface-variant hover:bg-surface-container'
                    }`}
                    onClick={() => setActiveTab('assistant')}
                  >
                    <span className="material-symbols-outlined text-base text-secondary">psychology</span>
                    <span>AI Socratic Assistant</span>
                    {aiStatus.enabled ? (
                      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold">
                        {aiStatus.remainingQueries}/{aiStatus.hourlyLimit} Left
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[10px]">
                        Policy Disabled
                      </span>
                    )}
                  </button>
                </div>

                <div className="hidden sm:flex items-center gap-3 text-on-surface-variant text-xs pb-1">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-secondary">memory</span>
                    <span>Memory: 256MB</span>
                  </span>
                  <span className="text-outline">•</span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-secondary">schedule</span>
                    <span>Timeout: 1.50s</span>
                  </span>
                </div>
              </div>

              {activeTab === 'tests' && (
                <div className="p-4 flex flex-col gap-2">
                  {testResults.length === 0 ? (
                    <div className="p-6 text-center text-xs text-on-surface-variant">
                      No sample test cases available for this assignment. Click "Run Code" to verify against runner.
                    </div>
                  ) : (
                    testResults.map((tc, idx) => {
                      const isPass = tc.status === 'accepted' || tc.status === 'PASS';
                      const isFail = tc.status === 'wrong_answer' || tc.status === 'FAIL';
                      const isTle = tc.status === 'time_limit_exceeded';

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            isPass
                              ? 'bg-green-50/60 border-green-200'
                              : isFail || isTle
                              ? 'bg-error-container/30 border-error-container'
                              : 'bg-surface-container-low border-transparent'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                              isPass
                                ? 'bg-green-100 text-green-700'
                                : isFail || isTle
                                ? 'bg-error text-white'
                                : 'bg-surface-container-high text-on-surface-variant'
                            }`}>
                              <span className="material-symbols-outlined text-sm">
                                {isPass ? 'check' : isFail ? 'close' : isTle ? 'timer_off' : 'hourglass_empty'}
                              </span>
                            </div>

                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-on-surface">Case {idx + 1}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                  isPass
                                    ? 'bg-green-100 text-green-700'
                                    : isTle
                                    ? 'bg-error text-white'
                                    : isFail
                                    ? 'bg-error text-white'
                                    : 'bg-surface-container text-on-surface-variant'
                                }`}>
                                  {isPass ? 'PASS' : isTle ? 'TIME LIMIT EXCEEDED' : isFail ? 'FAIL' : 'PENDING'}
                                </span>
                              </div>
                              <div className="font-mono text-xs text-on-surface-variant pt-1 truncate">
                                <span className="text-primary font-medium">Input: </span>
                                {tc.input ? tc.input.replace(/\n/g, ' ') : '—'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 font-mono text-xs text-on-surface-variant self-end md:self-auto shrink-0">
                            <div className="text-right">
                              <div className="text-on-surface font-semibold truncate max-w-[200px]">
                                Output: {tc.actualOutput || '—'}
                              </div>
                              <div className="text-[11px] text-outline truncate max-w-[200px]">
                                Expected: {tc.expectedOutput || '—'}
                              </div>
                            </div>
                            <div className="bg-surface-container-lowest px-2 py-1 rounded shadow-sm flex flex-col items-end">
                              <span className="text-secondary font-bold">{tc.timeMs ? `${tc.timeMs} ms` : '—'}</span>
                              <span className="text-[10px] text-outline">{tc.memoryKb ? `${(tc.memoryKb / 1024).toFixed(1)} MB` : '—'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'console' && (
                <div className="p-4 flex flex-col gap-2 bg-[#1b2336] text-slate-100">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2 font-mono text-xs text-[#7cd4df]">
                      <span className="material-symbols-outlined text-sm">terminal</span>
                      <span>Diagnostic Sandbox Output ({selectedLanguage === 'C++20' ? 'g++ 13.2' : 'OpenJDK 21'})</span>
                    </div>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-white text-xs font-mono"
                      onClick={() => setCompilerOutput('')}
                    >
                      Clear Output
                    </button>
                  </div>
                  <pre className="bg-[#0b121e] p-4 rounded-lg font-mono text-xs leading-relaxed overflow-x-auto text-slate-300 min-h-[140px] whitespace-pre-wrap">
                    {compilerOutput || 'No compiler warnings or execution logs yet. Run code to view output.'}
                  </pre>
                </div>
              )}

              {/* Iteration 8: Pedagogical AI Socratic Assistant Tab */}
              {activeTab === 'assistant' && (
                <div className="p-4 flex flex-col gap-4 bg-surface-container-lowest">
                  {!aiStatus.enabled ? (
                    <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col items-center text-center max-w-xl mx-auto my-4">
                      <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-secondary mb-3">
                        <span className="material-symbols-outlined text-2xl">policy</span>
                      </div>
                      <h3 className="text-base font-bold text-primary">In-Platform AI Assistance Disabled</h3>
                      <p className="text-xs text-on-surface-variant leading-relaxed mt-1.5">
                        In accordance with academic policies for this course, generative AI assistance is disabled by default for this assignment. Students are expected to formulate algorithmic invariants independently.
                      </p>
                      <div className="mt-4 px-3 py-1.5 rounded-lg bg-surface-container text-xs text-on-surface-variant font-mono">
                        Course Policy Setting: ENABLE_AI_ASSISTANCE = false
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {/* Top Assistant Control Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/30">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">Mode:</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setAiMode('hint')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                aiMode === 'hint'
                                  ? 'bg-secondary text-white shadow-sm'
                                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[15px]">lightbulb</span>
                              <span>Conceptual Hint</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setAiMode('debug')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                aiMode === 'debug'
                                  ? 'bg-secondary text-white shadow-sm'
                                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[15px]">bug_report</span>
                              <span>Debugging Guide</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setAiMode('complexity')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                aiMode === 'complexity'
                                  ? 'bg-secondary text-white shadow-sm'
                                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[15px]">speed</span>
                              <span>Complexity Analysis</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-mono text-on-surface-variant">
                          <span className="w-2 h-2 rounded-full bg-secondary"></span>
                          <span>Queries: <strong>{aiStatus.remainingQueries}</strong> of {aiStatus.hourlyLimit} / hr</span>
                        </div>
                      </div>

                      {/* Conversation History / Log Viewport */}
                      <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
                        {aiHistory.length === 0 ? (
                          <div className="p-8 text-center rounded-xl bg-surface-container-low border border-dashed border-outline-variant/40 flex flex-col items-center">
                            <span className="material-symbols-outlined text-secondary text-3xl mb-1">psychology</span>
                            <p className="text-xs font-bold text-primary">Socratic Guidance Active</p>
                            <p className="text-xs text-on-surface-variant max-w-md mt-1">
                              Ask for algorithmic invariant hints, debugging edge-case pointers, or complexity recurrence relations. The Socratic TA guides your thinking and never outputs complete code.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2 justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setAiMode('hint');
                                  setAiPrompt('What invariant should I maintain across my main traversal loop?');
                                }}
                                className="px-2.5 py-1 rounded-full bg-surface-container text-secondary text-xs hover:bg-surface-container-high font-medium"
                              >
                                "Invariant hint"
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAiMode('debug');
                                  setAiPrompt('How should I check boundary edge cases on empty or single-element inputs?');
                                }}
                                className="px-2.5 py-1 rounded-full bg-surface-container text-secondary text-xs hover:bg-surface-container-high font-medium"
                              >
                                "Edge cases check"
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAiMode('complexity');
                                  setAiPrompt('Can you analyze the time and space complexity of my approach?');
                                }}
                                className="px-2.5 py-1 rounded-full bg-surface-container text-secondary text-xs hover:bg-surface-container-high font-medium"
                              >
                                "Complexity analysis"
                              </button>
                            </div>
                          </div>
                        ) : (
                          aiHistory.map((item, idx) => (
                            <div key={item.id || idx} className="flex flex-col gap-2 p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs">
                              <div className="flex items-center justify-between pb-1.5 border-b border-outline-variant/20">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-secondary text-white">
                                    {item.mode || 'hint'}
                                  </span>
                                  <span className="font-semibold text-primary">Question: "{item.prompt}"</span>
                                </div>
                                <span className="font-mono text-[10px] text-on-surface-variant">
                                  {new Date(item.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="text-on-surface whitespace-pre-wrap leading-relaxed pt-1">
                                {item.response}
                              </div>
                              <div className="pt-1.5 border-t border-outline-variant/20 flex items-center justify-between text-[10px] text-on-surface-variant font-mono">
                                <span className="flex items-center gap-1 text-secondary">
                                  <span className="material-symbols-outlined text-[13px]">verified</span>
                                  <span>Attributed in Step 2 AI Declaration</span>
                                </span>
                                <span>Audit ID: {item.id?.slice(0, 8)}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Prompt Input & Send Console */}
                      <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/30">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey && !aiLoading && aiPrompt.trim()) {
                                e.preventDefault();
                                handleAskAssistant();
                              }
                            }}
                            placeholder={
                              aiMode === 'hint'
                                ? 'Ask a Socratic question (e.g., What invariant governs two pointers here?)...'
                                : aiMode === 'debug'
                                ? 'Ask about a bug or test failure (e.g., Why might my fast pointer segfault?)...'
                                : 'Ask about asymptotic bounds (e.g., Is my space complexity strictly O(1)?)...'
                            }
                            className="flex-1 h-10 px-3.5 rounded-lg bg-surface-container text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-secondary outline-none"
                            disabled={aiLoading || aiStatus.remainingQueries <= 0}
                          />
                          <button
                            type="button"
                            onClick={handleAskAssistant}
                            disabled={aiLoading || !aiPrompt.trim() || aiStatus.remainingQueries <= 0}
                            className="h-10 px-4 rounded-lg bg-secondary text-white text-xs font-bold hover:bg-secondary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
                          >
                            {aiLoading ? (
                              <>
                                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                <span>Thinking…</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-base">send</span>
                                <span>Ask TA</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                          <span>Departmental Rule: All assistant inquiries are logged and attributed in Step 2.</span>
                          <span className="font-mono">{aiStatus.remainingQueries} queries left</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: AI-USE DECLARATION & CODE ANNOTATIONS                             */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="flex flex-col gap-6">
          {/* Constructive AI Disclosure Protocol Banner */}
          <section className="bg-primary text-on-primary p-5 rounded-xl shadow-md relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4 max-w-4xl">
                <div className="w-10 h-10 rounded-lg bg-secondary text-white flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-2xl">policy</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-white">Constructive AI Disclosure Protocol</span>
                    <span className="px-2 py-0.5 rounded-full bg-secondary/30 text-secondary-fixed font-mono text-[10px] uppercase">Departmental Transparency</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed mt-1">
                    Declaring AI use is required for departmental transparency; course faculty evaluate your conceptual comprehension of the final implementation. LabTrack operates on a <strong className="text-white font-semibold">constructive disclosure model</strong> — honest declarations inform targeted viva questions with <strong className="text-secondary-fixed font-semibold">zero punitive grading penalty</strong>.
                  </p>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-container text-white text-xs font-medium">
                <span className="material-symbols-outlined text-secondary text-base">verified_user</span>
                <span>Academic Rigor Verified</span>
              </div>
            </div>
          </section>

          {/* Declaration Card */}
          <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-surface-container flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <h2 className="text-base font-bold text-primary">Step 2: AI-Assistance Declaration</h2>
                  <p className="text-xs text-on-surface-variant">Disclose generative tools, workflows, and annotate AI-assisted code regions</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface text-xs font-semibold">Required Step</span>
            </div>

            <div className="p-6 flex flex-col gap-6">
              {/* Radio Selection: Attribution Mode */}
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-bold text-primary mb-1">Authoring Attribution Mode <span className="text-error">*</span></legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option A: Independent */}
                  <label
                    className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                      !aiDeclaration.aiUsed
                        ? 'bg-surface-container-high ring-2 ring-secondary shadow-sm'
                        : 'bg-surface-container-low hover:bg-surface-container'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ai_attribution_mode"
                      className="mt-1 h-4 w-4 text-secondary focus:ring-secondary"
                      checked={!aiDeclaration.aiUsed}
                      onChange={() => {
                        const updated = { ...aiDeclaration, aiUsed: false };
                        setAiDeclaration(updated);
                        persistLocal({ aiDeclaration: updated });
                      }}
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-on-surface">I did not use AI assistance</span>
                        {!aiDeclaration.aiUsed && (
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-white text-[10px] font-bold">Active</span>
                        )}
                      </div>
                      <span className="text-xs text-on-surface-variant mt-0.5">
                        Authored entirely independently using course lecture notes, textbooks, and standard language references only.
                      </span>
                    </div>
                  </label>

                  {/* Option B: AI-Assisted */}
                  <label
                    className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                      aiDeclaration.aiUsed
                        ? 'bg-surface-container-high ring-2 ring-secondary shadow-sm'
                        : 'bg-surface-container-low hover:bg-surface-container'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ai_attribution_mode"
                      className="mt-1 h-4 w-4 text-secondary focus:ring-secondary"
                      checked={aiDeclaration.aiUsed}
                      onChange={() => {
                        const updated = { ...aiDeclaration, aiUsed: true };
                        setAiDeclaration(updated);
                        persistLocal({ aiDeclaration: updated });
                      }}
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-primary">I used AI assistance</span>
                        {aiDeclaration.aiUsed && (
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-white text-[10px] font-bold">Active</span>
                        )}
                      </div>
                      <span className="text-xs text-on-surface mt-0.5">
                        Co-piloted, consulted generative models for syntax, ideation, boilerplate generation, or edge-case diagnostics.
                      </span>
                    </div>
                  </label>
                </div>
              </fieldset>

              {/* Conditional AI Assistance Details */}
              {aiDeclaration.aiUsed && (
                <div className="flex flex-col gap-6 pt-2 border-t border-outline-variant/30">
                  {/* In-Platform AI Inquiries Log Card (Iteration 8) */}
                  {aiHistory.length > 0 && (
                    <div className="p-4 rounded-xl bg-secondary-container/30 border border-secondary/20 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary font-bold text-xs">
                          <span className="material-symbols-outlined text-secondary text-base">verified</span>
                          <span>In-Platform AI Assistant Inquiries ({aiHistory.length} Recorded)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-white font-mono text-[10px] font-bold">
                          Auto-Attributed
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Your inquiries with the Socratic AI Assistant have been automatically logged to verify adherence to constructive disclosure policies.
                      </p>
                      <div className="mt-1 flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                        {aiHistory.map((h, i) => (
                          <div key={h.id || i} className="p-2 rounded bg-white text-xs border border-outline-variant/20 flex items-center justify-between">
                            <span className="truncate max-w-[70%] font-mono text-[11px] text-primary">
                              <strong>[{h.mode?.toUpperCase()}]</strong> {h.prompt}
                            </span>
                            <span className="text-[10px] text-on-surface-variant font-mono">
                              {new Date(h.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tool Selection */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-on-surface flex items-center gap-1">
                      <span>Which generative tools or models were utilized?</span>
                      <span className="text-error">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_AI_TOOLS.map((tool) => {
                        const isSelected = aiDeclaration.tools.includes(tool);
                        return (
                          <button
                            key={tool}
                            type="button"
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                              isSelected
                                ? 'bg-secondary text-white shadow-sm'
                                : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                            }`}
                            onClick={() => toggleAiTool(tool)}
                          >
                            {isSelected && <span className="material-symbols-outlined text-sm">check</span>}
                            <span>{tool}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Narrative Textarea */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-on-surface" htmlFor="ai_narrative">
                        How did you use AI during your problem solving?
                      </label>
                      <span className="font-mono text-xs text-on-surface-variant">
                        {aiDeclaration.narrative?.length || 0} chars
                      </span>
                    </div>
                    <textarea
                      id="ai_narrative"
                      rows={3}
                      className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-secondary border border-outline-variant/40 resize-y"
                      placeholder="e.g. Used Copilot for boilerplate struct Node setup; consulted ChatGPT for edge-case eviction logic and null sentinels."
                      value={aiDeclaration.narrative || ''}
                      onChange={(e) => {
                        const updated = { ...aiDeclaration, narrative: e.target.value };
                        setAiDeclaration(updated);
                        persistLocal({ aiDeclaration: updated });
                      }}
                    />
                  </div>

                  {/* Code Annotations Split View */}
                  <div className="flex flex-col gap-3 pt-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                          <span className="material-symbols-outlined text-secondary text-lg">code_blocks</span>
                          <span>Annotate AI-Assisted Code Ranges</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            annotations.length > 0 ? 'bg-green-100 text-green-800' : 'bg-error-container text-on-error-container'
                          }`}>
                            {annotations.length > 0 ? `${annotations.length} Annotated` : 'Annotations Required'}
                          </span>
                        </h3>
                        <p className="text-xs text-on-surface-variant">
                          Mark specific line ranges in your code that were generated or guided by AI and explain each.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                      {/* Left: Code Viewer with line highlighting */}
                      <div className="xl:col-span-6 bg-[#0d121f] rounded-xl overflow-hidden shadow-sm flex flex-col border border-white/10">
                        <div className="px-4 py-2 bg-[#1b2336] text-slate-300 flex items-center justify-between font-mono text-xs">
                          <span>{selectedLanguage === 'C++20' ? 'solution.cpp' : 'Main.java'}</span>
                          <span className="text-[#7cd4df]">{lines.length} lines</span>
                        </div>
                        <div className="p-3 font-mono text-xs text-slate-100 max-h-96 overflow-y-auto leading-6 select-none">
                          {lines.map((lineText, idx) => {
                            const lineNo = idx + 1;
                            const isAnnotated = annotatedLineSet.has(lineNo);
                            return (
                              <div
                                key={lineNo}
                                className={`flex px-1.5 rounded transition-colors ${
                                  isAnnotated
                                    ? 'bg-secondary/25 border-l-2 border-secondary text-secondary-fixed'
                                    : 'hover:bg-white/5 text-slate-300'
                                }`}
                              >
                                <span className={`w-8 text-right pr-3 shrink-0 font-mono text-[11px] ${
                                  isAnnotated ? 'text-secondary font-bold' : 'text-slate-500'
                                }`}>
                                  {lineNo}
                                </span>
                                <span className="whitespace-pre overflow-x-auto">{lineText || ' '}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Right: Active Annotations & Add Form */}
                      <div className="xl:col-span-6 flex flex-col gap-3">
                        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                          {annotations.length === 0 ? (
                            <div className="p-4 rounded-xl bg-surface-container-low text-xs text-on-surface-variant text-center border border-dashed border-outline-variant">
                              No code ranges annotated yet. Use the form below to mark AI-assisted lines.
                            </div>
                          ) : (
                            annotations.map((ann) => (
                              <div key={ann.id} className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-primary text-white font-mono text-xs font-semibold">
                                      Lines {ann.startLine}–{ann.endLine}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-semibold">
                                      {ann.tool || 'AI Tool'}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    className="p-1 rounded text-error hover:bg-error-container"
                                    onClick={() => handleRemoveAnnotation(ann.id)}
                                    title="Delete annotation"
                                  >
                                    <span className="material-symbols-outlined text-base">delete</span>
                                  </button>
                                </div>
                                <p className="text-xs text-on-surface italic">"{ann.justification}"</p>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Add Annotation Sub-Form */}
                        <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/40 flex flex-col gap-2">
                          <span className="text-xs font-bold text-primary">Annotate New Code Range</span>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-on-surface-variant font-medium block">Start Line</label>
                              <input
                                type="number"
                                min={1}
                                max={lines.length}
                                className="w-full px-2 py-1 rounded bg-surface-container-lowest text-xs font-mono border border-outline-variant/40"
                                value={newAnnotation.startLine}
                                onChange={(e) => setNewAnnotation({ ...newAnnotation, startLine: Number(e.target.value) })}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-on-surface-variant font-medium block">End Line</label>
                              <input
                                type="number"
                                min={newAnnotation.startLine}
                                max={lines.length}
                                className="w-full px-2 py-1 rounded bg-surface-container-lowest text-xs font-mono border border-outline-variant/40"
                                value={newAnnotation.endLine}
                                onChange={(e) => setNewAnnotation({ ...newAnnotation, endLine: Number(e.target.value) })}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-on-surface-variant font-medium block">Tool</label>
                              <select
                                className="w-full px-2 py-1 rounded bg-surface-container-lowest text-xs font-mono border border-outline-variant/40"
                                value={newAnnotation.tool}
                                onChange={(e) => setNewAnnotation({ ...newAnnotation, tool: e.target.value })}
                              >
                                {AVAILABLE_AI_TOOLS.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                                <option value="Other">Other</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-on-surface-variant font-medium block">Justification in your own words</label>
                            <input
                              type="text"
                              className="w-full px-2 py-1.5 rounded bg-surface-container-lowest text-xs border border-outline-variant/40"
                              placeholder="e.g. AI suggested pointer unlinking logic; I verified null guards."
                              value={newAnnotation.justification}
                              onChange={(e) => setNewAnnotation({ ...newAnnotation, justification: e.target.value })}
                            />
                          </div>
                          <button
                            type="button"
                            className="self-end px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-secondary/90 transition-colors flex items-center gap-1"
                            onClick={handleAddAnnotation}
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                            <span>Add Annotation</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: CONCEPTUAL LOGIC & ALGORITHMIC DEFENSE                            */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="flex flex-col gap-6">
          <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-surface-container flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <h2 className="text-base font-bold text-primary">Step 3: Conceptual Logic &amp; Algorithmic Defense</h2>
                  <p className="text-xs text-on-surface-variant">
                    Demonstrate your personal mastery of the data structures and edge case invariants. You will defend these during oral viva voce.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold">
                <span className="material-symbols-outlined text-sm">record_voice_over</span>
                <span>Oral Viva Assessment Link</span>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-6">
              {/* Field 1: Algorithmic Logic */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-on-surface flex items-center gap-1" htmlFor="algo_approach">
                    <span>1. Algorithmic Logic &amp; Invariants</span>
                    <span className="text-error">*</span>
                  </label>
                  <span className={`font-mono text-xs ${logicApproachLen >= 20 ? 'text-secondary font-semibold' : 'text-on-surface-variant'}`}>
                    {logicApproachLen} chars {logicApproachLen >= 20 ? '✓' : '(min 20)'}
                  </span>
                </div>
                <textarea
                  id="algo_approach"
                  rows={4}
                  className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-secondary border border-outline-variant/40 resize-y"
                  placeholder="Describe your algorithm step-by-step and how invariant states are preserved (e.g. cache eviction order, sentinel node maintenance)."
                  value={logicExplanation.approach || ''}
                  onChange={(e) => {
                    const updated = { ...logicExplanation, approach: e.target.value };
                    setLogicExplanation(updated);
                    persistLocal({ logicExplanation: updated });
                  }}
                />
                <span className="text-[11px] text-on-surface-variant">Explain the core algorithm and how correctness is guaranteed.</span>
              </div>

              {/* Field 2: Trade-off Analysis */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-on-surface flex items-center gap-1" htmlFor="algo_tradeoffs">
                    <span>2. Approach &amp; Trade-off Analysis</span>
                    <span className="text-error">*</span>
                  </label>
                  <span className={`font-mono text-xs ${logicTradeoffLen >= 20 ? 'text-secondary font-semibold' : 'text-on-surface-variant'}`}>
                    {logicTradeoffLen} chars {logicTradeoffLen >= 20 ? '✓' : '(min 20)'}
                  </span>
                </div>
                <textarea
                  id="algo_tradeoffs"
                  rows={3}
                  className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-secondary border border-outline-variant/40 resize-y"
                  placeholder="Explain why you chose this design pattern over alternatives and address time vs space trade-offs."
                  value={logicExplanation.tradeoffAnalysis || ''}
                  onChange={(e) => {
                    const updated = { ...logicExplanation, tradeoffAnalysis: e.target.value };
                    setLogicExplanation(updated);
                    persistLocal({ logicExplanation: updated });
                  }}
                />
                <span className="text-[11px] text-on-surface-variant">Justify algorithmic trade-offs compared to naive alternatives.</span>
              </div>

              {/* Field 3: Data Structures & Complexity */}
              <div className={`flex flex-col gap-2 p-4 rounded-xl border transition-all ${
                logicDsLen < 20 ? 'bg-error-container/20 border-error-container' : 'bg-surface-container-low border-transparent'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-on-surface flex items-center gap-1.5" htmlFor="algo_ds">
                    <span>3. Data Structures &amp; Complexity Analysis</span>
                    <span className="text-error">*</span>
                    {logicDsLen < 20 && (
                      <span className="px-2 py-0.5 rounded bg-error text-white text-[10px] font-bold">Needs Detail</span>
                    )}
                  </label>
                  <span className={`font-mono text-xs font-bold ${logicDsLen >= 20 ? 'text-secondary' : 'text-error'}`}>
                    {logicDsLen} chars (min 20)
                  </span>
                </div>
                <textarea
                  id="algo_ds"
                  rows={3}
                  className={`w-full p-3 rounded-xl bg-surface-container-lowest text-on-surface text-xs focus:outline-none focus:ring-2 ${
                    logicDsLen < 20 ? 'ring-2 ring-error' : 'focus:ring-secondary'
                  } border border-outline-variant/40 resize-y`}
                  placeholder="Outline data structures used (e.g. hash map, doubly linked list), pointer lifecycles, and Big-O runtime/space bounds."
                  value={logicExplanation.dataStructures || ''}
                  onChange={(e) => {
                    const updated = { ...logicExplanation, dataStructures: e.target.value };
                    setLogicExplanation(updated);
                    persistLocal({ logicExplanation: updated });
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1">
                  <div className="flex items-center gap-3 font-mono">
                    <span>Time: <strong className="text-primary">{logicExplanation.timeComplexity || 'O(1)'}</strong></span>
                    <span>Space: <strong className="text-primary">{logicExplanation.spaceComplexity || 'O(N)'}</strong></span>
                  </div>
                  {totalLogicLen < 60 ? (
                    <span className="text-error font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">error</span>
                      <span>Total logic depth: {totalLogicLen}/60 chars minimum required</span>
                    </span>
                  ) : (
                    <span className="text-secondary font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      <span>Total logic depth: {totalLogicLen} chars (Satisfied)</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: REVIEW & FINAL SUBMISSION                                         */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <div className="flex flex-col gap-6">
          {finalSubmission ? (
            <section className="bg-surface-container-lowest p-8 rounded-xl shadow-card text-center border-2 border-secondary/30">
              <span className="material-symbols-outlined text-5xl text-secondary">verified</span>
              <h2 className="mt-3 text-2xl font-bold text-primary">Assignment Submitted Successfully</h2>
              <p className="mt-2 text-sm text-on-surface-variant max-w-xl mx-auto">
                Your immutable submission snapshot has been safely recorded in the institutional repository at{' '}
                <strong className="text-on-surface font-mono">{new Date(finalSubmission.submittedAt || finalSubmission.createdAt).toLocaleString()}</strong>.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link to="/student/dashboard" className="primary-button">
                  <span>Return to Dashboard</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setCurrentStep(1)}
                >
                  Inspect Submitted Code
                </button>
              </div>
            </section>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Readiness Checklist Banner */}
              <section className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/40">
                <h2 className="text-base font-bold text-primary mb-3">Pre-Submission Readiness Audit</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className={`p-3 rounded-lg flex items-center gap-3 ${
                    isStep1Complete ? 'bg-green-50 text-green-900 border border-green-200' : 'bg-error-container/30 text-on-error-container'
                  }`}>
                    <span className="material-symbols-outlined text-xl">{isStep1Complete ? 'check_circle' : 'error'}</span>
                    <div>
                      <p className="text-xs font-bold">1. Code Implementation</p>
                      <p className="text-[11px] opacity-80">{lines.length} lines of {selectedLanguage}</p>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg flex items-center gap-3 ${
                    isStep2Complete ? 'bg-green-50 text-green-900 border border-green-200' : 'bg-error-container/30 text-on-error-container'
                  }`}>
                    <span className="material-symbols-outlined text-xl">{isStep2Complete ? 'check_circle' : 'error'}</span>
                    <div>
                      <p className="text-xs font-bold">2. AI-Use Declaration</p>
                      <p className="text-[11px] opacity-80">
                        {!aiDeclaration.aiUsed ? 'Independent authoring' : `${annotations.length} ranges annotated`}
                      </p>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg flex items-center gap-3 ${
                    isStep3Complete ? 'bg-green-50 text-green-900 border border-green-200' : 'bg-error-container/30 text-on-error-container'
                  }`}>
                    <span className="material-symbols-outlined text-xl">{isStep3Complete ? 'check_circle' : 'error'}</span>
                    <div>
                      <p className="text-xs font-bold">3. Conceptual Logic</p>
                      <p className="text-[11px] opacity-80">{totalLogicLen}/60 chars minimum</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Review Summary Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Code Snapshot Summary */}
                <section className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/30 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-secondary text-base">code</span>
                      <span>Code Snapshot</span>
                    </span>
                    <button
                      type="button"
                      className="text-xs text-secondary hover:underline"
                      onClick={() => setCurrentStep(1)}
                    >
                      Edit Code
                    </button>
                  </div>
                  <pre className="bg-[#0d121f] text-slate-100 font-mono text-xs p-3 rounded-lg max-h-64 overflow-y-auto leading-5">
                    {currentCode}
                  </pre>
                </section>

                {/* Declaration & Logic Defense Summary */}
                <div className="flex flex-col gap-4">
                  <section className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/30 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-primary flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-secondary text-base">psychology</span>
                        <span>AI Declaration</span>
                      </span>
                      <button
                        type="button"
                        className="text-xs text-secondary hover:underline"
                        onClick={() => setCurrentStep(2)}
                      >
                        Edit
                      </button>
                    </div>
                    <p className="text-xs text-on-surface">
                      <strong>Attribution Mode:</strong> {aiDeclaration.aiUsed ? 'AI-Assisted' : 'Independent Authoring'}
                    </p>
                    {aiDeclaration.aiUsed && (
                      <div className="text-xs text-on-surface-variant flex flex-col gap-1">
                        <p><strong>Tools:</strong> {aiDeclaration.tools.join(', ') || aiDeclaration.otherTool || '—'}</p>
                        <p><strong>Annotations:</strong> {annotations.length} code segments marked</p>
                        {aiDeclaration.narrative && <p className="italic">"{aiDeclaration.narrative}"</p>}
                      </div>
                    )}
                  </section>

                  <section className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/30 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-primary flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-secondary text-base">menu_book</span>
                        <span>Logic Defense</span>
                      </span>
                      <button
                        type="button"
                        className="text-xs text-secondary hover:underline"
                        onClick={() => setCurrentStep(3)}
                      >
                        Edit
                      </button>
                    </div>
                    <div className="text-xs text-on-surface-variant flex flex-col gap-2">
                      <div>
                        <strong className="text-on-surface">Approach:</strong>
                        <p className="mt-0.5">{logicExplanation.approach || '—'}</p>
                      </div>
                      <div>
                        <strong className="text-on-surface">Data Structures &amp; Complexity:</strong>
                        <p className="mt-0.5">{logicExplanation.dataStructures || '—'}</p>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* BOTTOM STICKY ACTION & NAVIGATION BAR                                     */}
      {/* ========================================================================= */}
      <aside className="fixed bottom-0 left-0 right-0 z-30 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/30 px-6 py-3.5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Previous step or navigation */}
        <div className="flex items-center gap-3">
          {currentStep > 1 && (
            <button
              type="button"
              className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary text-xs font-semibold transition-colors flex items-center gap-1"
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>Back</span>
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2 text-on-surface-variant text-xs">
            <span className="material-symbols-outlined text-secondary text-base">cloud_sync</span>
            <span>Synced to institutional git sandbox:</span>
            <span className="font-mono bg-surface-container px-2 py-0.5 rounded text-primary font-bold">
              sub/{assignment.assignmentCode?.toLowerCase()}
            </span>
          </div>
        </div>

        {/* Right: Step navigation, Save draft, and Final submit */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            onClick={handleSaveDraft}
            disabled={isSaving}
          >
            <span className="material-symbols-outlined text-base">save</span>
            <span>{isSaving ? 'Saving…' : 'Save Draft'}</span>
          </button>

          {currentStep < 4 ? (
            <button
              type="button"
              className="px-5 py-2 rounded-lg bg-secondary text-white hover:bg-on-secondary-container transition-all text-xs font-bold flex items-center gap-2 shadow-md"
              onClick={() => setCurrentStep((prev) => Math.min(4, prev + 1))}
            >
              <span>{currentStep === 1 ? 'Next: AI-Use Declaration' : currentStep === 2 ? 'Next: Logic Defense' : 'Next: Review & Submit'}</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          ) : (
            !finalSubmission && (
              <button
                type="button"
                className="px-5 py-2 rounded-lg bg-secondary text-white hover:bg-on-secondary-container transition-all text-xs font-bold flex items-center gap-2 shadow-md disabled:opacity-50"
                onClick={handleFinalSubmit}
                disabled={!isReadyForFinalSubmit || isSubmitting}
              >
                <span>{isSubmitting ? 'Finalizing Submission…' : 'Confirm & Finalize Submission'}</span>
                <span className="material-symbols-outlined text-base">check_circle</span>
              </button>
            )
          )}
        </div>
      </aside>
    </div>
  );
}
