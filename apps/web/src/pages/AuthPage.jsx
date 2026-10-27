import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider.jsx';

export default function AuthPage({ mode = 'login' }) {
  const isRegister = mode === 'register';
  const { login, register, logout, connectionError } = useAuth();
  const navigate = useNavigate();
  const [roleChoice, setRoleChoice] = useState('student');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault(); setError('');
    if (isRegister && password !== confirmPassword) return setError('Passwords do not match.');
    if (isRegister && password.length < 12) return setError('Use at least 12 characters for your password.');
    setBusy(true);
    try {
      if (isRegister) {
        await register({ displayName, email, password });
        const user = await login(email, password);
        navigate(user.role === 'teacher' ? '/teacher/assignments' : '/student/dashboard', { replace: true });
      } else {
        const user = await login(email, password);
        if (user.role !== roleChoice) {
          await logout();
          throw new Error(`This account is registered as ${user.role}. Choose the matching sign-in role.`);
        }
        navigate(user.role === 'teacher' ? '/teacher/assignments' : '/student/dashboard', { replace: true });
      }
    } catch (submitError) {
      setError(submitError.payload?.message || submitError.message || 'Unable to complete sign-in.');
    } finally { setBusy(false); }
  }

  return (
    <main className="auth-page min-h-screen bg-surface px-3 py-4 sm:px-6 sm:py-8">
      <div className="auth-card mx-auto grid max-w-7xl overflow-hidden rounded-2xl bg-white shadow-xl lg:grid-cols-12">
        <section className="auth-identity relative flex flex-col justify-between overflow-hidden bg-primary-container p-7 text-white sm:p-10 lg:col-span-5 xl:p-14">
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-secondary opacity-20 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3"><span className="brand-mark brand-mark-large material-symbols-outlined">terminal</span><div><div className="flex items-center gap-2"><span className="text-2xl font-bold tracking-tight">LabTrack</span><span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">V4.2 Workbench</span></div><p className="mt-1 text-xs text-blue-100">Department of Computer Science &amp; Engineering</p></div></div>
          <div className="relative z-10 my-10"><span className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-secondary-fixed">DSA Continuous Evaluation</span><h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">Evaluate what students <span className="text-secondary-fixed">understand</span>, not just what they submit.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-blue-50">An evidence-centered workbench for assignments, secure code evaluation, and demonstrated understanding.</p><div className="mt-8 grid gap-3"><Feature icon="assignment" title="Clear assignment specifications" body="Course teams publish structured DSA assignments with explicit constraints and deadlines." /><Feature icon="psychology" title="Responsible AI assistance" body="AI use is declared and reviewed transparently; similarity is never an AI-authorship verdict." /><Feature icon="school" title="Understanding matters" body="Correctness and a student's explanation both contribute to fair evaluation." /></div></div>
          <p className="relative z-10 text-xs text-blue-100">Evidence first. Human review. No AI-authorship claims.</p>
        </section>
        <section className="flex items-center justify-center p-6 sm:p-10 lg:col-span-7 xl:p-14"><div className="w-full max-w-md">
          <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wider text-secondary">Academic authentication</span><span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-on-surface-variant"><span className="h-2 w-2 rounded-full bg-secondary" />Secure session</span></div>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-on-surface">{isRegister ? 'Create your student account' : 'Sign in to LabTrack'}</h2><p className="mt-2 text-sm text-on-surface-variant">{isRegister ? 'Use your academic details to join the assignment workbench.' : 'Access your course assignments and evaluation workspace.'}</p>
          {!isRegister && <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-surface-container p-1" role="group" aria-label="Account role">{['student', 'teacher'].map((role) => <button key={role} type="button" onClick={() => setRoleChoice(role)} className={`role-tab ${roleChoice === role ? 'role-tab-active' : ''}`}><span className="material-symbols-outlined text-base">{role === 'student' ? 'school' : 'badge'}</span>{role === 'student' ? 'Student' : 'Teacher'}</button>)}</div>}
          {(error || connectionError) && <div className="mt-5 rounded-lg bg-error-container p-3.5 text-sm text-on-error-container" role="alert">{error || connectionError}</div>}
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {isRegister && <Field label="Full name" id="displayName"><input id="displayName" className="form-input" type="text" autoComplete="name" required maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" /></Field>}
            <Field label="Institutional email" id="email"><input id="email" className="form-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="student@university.edu" /></Field>
            <Field label="Password" id="password" hint={isRegister ? 'At least 12 characters' : undefined}><div className="relative"><input id="password" className="form-input pr-12" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={isRegister ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? 'Create a secure password' : 'Enter password'} /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}><span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span></button></div></Field>
            {isRegister && <Field label="Confirm password" id="confirmPassword"><input id="confirmPassword" className="form-input" type="password" autoComplete="new-password" required maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter your password" /></Field>}
            {!isRegister && <div className="flex items-center justify-between text-xs text-on-surface-variant"><span>Sessions use an HTTP-only cookie.</span><span className="font-mono">{roleChoice.toUpperCase()}</span></div>}
            <button type="submit" className="primary-button w-full justify-center" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create student account' : 'Sign in'}<span className="material-symbols-outlined text-lg">arrow_forward</span></button>
          </form>
          <p className="mt-6 text-center text-sm text-on-surface-variant">{isRegister ? 'Already registered?' : 'New to LabTrack?'} <Link className="font-semibold text-secondary hover:underline" to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create a student account'}</Link></p>
          {!isRegister && roleChoice === 'teacher' && <p className="mt-3 text-center text-xs text-on-surface-variant">Teacher access is provisioned by your course administrator.</p>}
        </div></section>
      </div>
    </main>
  );
}
function Feature({ icon, title, body }) { return <div className="flex items-start gap-3 rounded-xl bg-primary/40 p-4"><span className="material-symbols-outlined mt-0.5 text-secondary-fixed" aria-hidden="true">{icon}</span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-blue-100">{body}</p></div></div>; }
function Field({ label, id, hint, children }) { return <div className="space-y-1.5"><div className="flex items-center justify-between gap-2"><label htmlFor={id} className="text-sm font-semibold text-on-surface">{label} <span className="text-error" aria-hidden="true">*</span></label>{hint && <span className="text-xs text-on-surface-variant">{hint}</span>}</div>{children}</div>; }
