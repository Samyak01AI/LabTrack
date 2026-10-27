import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider.jsx';

const linksByRole = {
  student: [
    { to: '/student/dashboard', label: 'Dashboard', icon: 'grid_view' },
    { to: '/student/dashboard#assignment-list', label: 'Assignments', icon: 'code_blocks' },
  ],
  teacher: [{ to: '/teacher/assignments', label: 'Assignments', icon: 'assignment' }],
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = linksByRole[user.role] ?? [];
  const roleLabel = user.role === 'teacher' ? 'TEACHER' : 'STUDENT';
  const renderLink = (link, index, mobile = false) => {
    const hash = link.to.includes('#') ? link.to.split('#')[1] : '';
    const path = link.to.split('#')[0];
    const active = location.pathname === path && (hash ? location.hash === `#${hash}` : !location.hash);
    const mobileColor = mobile ? (active ? 'text-white' : 'text-primary hover:bg-surface-container') : '';
    return <NavLink key={`${link.label}-${index}`} to={link.to} onClick={() => mobile && setMenuOpen(false)} className={`nav-link ${mobileColor} ${active ? 'nav-link-active' : ''}`} aria-current={active ? 'page' : undefined}>
      <span className="material-symbols-outlined text-xl" aria-hidden="true">{link.icon}</span><span className={mobile ? '' : 'hidden lg:inline'}>{link.label}</span>
    </NavLink>;
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <aside className="sidebar-shell fixed inset-y-0 left-0 z-50 hidden w-[72px] flex-col justify-between bg-primary text-white shadow-card sm:flex lg:w-64">
        <div><div className="flex h-16 items-center justify-center gap-2 bg-primary px-4 lg:justify-start"><span className="brand-mark material-symbols-outlined">terminal</span><span className="hidden text-base font-bold tracking-tight lg:inline">LabTrack</span><span className="hidden rounded bg-primary-container px-1.5 py-0.5 font-mono text-[10px] text-secondary-fixed lg:inline">V4.2</span></div>
          <div className="px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[.16em] text-blue-200 lg:text-left">DSA Workbench</div><nav aria-label="Main navigation" className="flex flex-col gap-1 px-2">{links.map((link, index) => renderLink(link, index))}</nav></div>
        <div className="m-3 hidden rounded-xl bg-tertiary-container p-3 text-left lg:block"><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-secondary-fixed"><span className="h-2 w-2 rounded-full bg-secondary-fixed" />Account access</div><p className="mt-2 truncate font-mono text-[11px] text-white" title={user.email}>{user.email}</p><p className="mt-1 text-xs text-blue-100">{roleLabel} • protected session</p></div>
      </aside>
      <div className="min-w-0 sm:pl-[72px] lg:pl-64">
        <header className="topbar-shell fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant/50 bg-white/95 px-4 shadow-card backdrop-blur-xl sm:left-[72px] sm:px-6 lg:left-64">
          <div className="flex min-w-0 items-center gap-3"><button className="icon-button sm:hidden" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span className="material-symbols-outlined">menu</span></button><span className="material-symbols-outlined text-secondary" aria-hidden="true">school</span><span className="truncate text-sm font-medium text-on-surface-variant">Department of Computer Science &amp; Engineering</span><span className="hidden rounded-full bg-surface-container-high px-2.5 py-1 font-mono text-[10px] font-semibold text-primary md:inline-flex">DSA WORKBENCH</span></div>
          <div className="flex shrink-0 items-center gap-3"><div className="hidden text-right sm:block"><div className="max-w-44 truncate text-sm font-semibold text-on-surface">{user.displayName}</div><div className="font-mono text-[10px] text-on-surface-variant">{roleLabel}</div></div><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white" aria-hidden="true"><span className="material-symbols-outlined text-lg">person</span></span><button className="hidden rounded-lg px-2 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container sm:inline-flex" type="button" onClick={() => logout()}>Sign out</button></div>
        </header>
        {menuOpen && <nav className="mobile-menu fixed inset-x-0 top-16 z-40 flex flex-col gap-1 border-b border-outline-variant bg-white p-3 shadow-lg sm:hidden" aria-label="Mobile navigation">{links.map((link, index) => renderLink(link, index, true))}<button type="button" className="nav-link text-left text-primary" onClick={() => { setMenuOpen(false); logout(); }}>Sign out</button></nav>}
        <main className="min-h-screen px-4 pb-10 pt-20 sm:px-6 lg:px-8"><Outlet /></main>
      </div>
    </div>
  );
}
