import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  Film,
  FolderKanban,
  Home,
  Layers,
  Settings,
  Stamp,
} from 'lucide-react';
import { useLocalWorkspace } from '../context/LocalWorkspaceContext';

const navItems = [
  { to: '/', label: 'Dịch & Lồng Tiếng', icon: Film, end: true },
  { to: '/channels', label: 'Kênh Nguồn (Channels)', icon: FolderKanban },
  { to: '/series', label: 'Series Phim', icon: Layers },
  { to: '/watermarks', label: 'Đóng Dấu (Watermarks)', icon: Stamp },
  { to: '/settings', label: 'Cài Đặt (Settings)', icon: Settings },
  { to: '/workspace', label: 'Local Workspace', icon: Home },
  { to: '/health', label: 'Sidecar Health', icon: Activity },
];

export const Layout: React.FC = () => {
  const { runtimeMode, workspace, runtimeInfo } = useLocalWorkspace();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1 style={{ fontSize: 15, fontWeight: 600 }}>HoangTuoi Reup</h1>
          <span className="badge">{runtimeMode}</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
            {workspace?.displayName ?? 'Local Owner'}
          </div>
          <div className="mono" style={{ marginTop: 4 }}>
            <span
              className={`status-dot ${runtimeInfo?.sidecarRunning ? 'status-ok' : 'status-err'}`}
            />
            {runtimeInfo?.sidecarRunning ? 'Sidecar running' : 'Sidecar offline'}
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};
