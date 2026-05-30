import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  FileText,
  ScrollText,
  Settings,
  Target,
  Code2,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import CommandPalette from './CommandPalette';
import { api } from '../api/client';

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/jobs', icon: Search, label: 'Jobs' },
  { to: '/applications', icon: FileText, label: 'Applications' },
  { to: '/resume', icon: ScrollText, label: 'Resume' },
  { to: '/ats', icon: Target, label: 'ATS' },
  { to: '/latex', icon: Code2, label: 'LaTeX' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [initials, setInitials] = useState('?');

  useEffect(() => {
    api.profile.get().then((p) => {
      if (p.fullName) {
        const parts = p.fullName.trim().split(/\s+/);
        setInitials(
          parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : parts[0].slice(0, 2).toUpperCase()
        );
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '/') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === 'r' && location.pathname === '/jobs') {
        window.dispatchEvent(new CustomEvent('jobpilot:refresh'));
      }
      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('jobpilot:close-panel'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-7 bg-jp-bg/80 backdrop-blur-xl border-b border-jp-border-subtle">
        <div className="flex items-center gap-6">
          <NavLink to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-jp-accent flex items-center justify-center">
              <span className="text-jp-bg font-mono font-extrabold text-sm">JP</span>
            </div>
            <span className="font-bold text-[1.05rem] tracking-tight">JobPilot</span>
          </NavLink>

          <nav className="flex gap-0.5">
            {nav.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'text-jp-accent bg-jp-accent-glow'
                      : 'text-jp-text-secondary hover:text-jp-text hover:bg-jp-surface-2'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-jp-surface border border-jp-border rounded-lg text-sm text-jp-text-muted cursor-pointer hover:border-jp-text-muted transition-colors"
          >
            <span>Search...</span>
            <kbd className="font-mono text-xs px-1.5 py-0.5 bg-jp-surface-3 rounded text-jp-text-secondary">/</kbd>
          </button>
          <NotificationBell />
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-jp-accent to-jp-cyan flex items-center justify-center text-jp-bg text-xs font-bold">
            {initials}
          </div>
        </div>
      </header>

      <main className="flex-1 pt-14 overflow-auto">
        <Outlet />
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
