import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalWorkspaceProvider, useLocalWorkspace } from './context/LocalWorkspaceContext';
import { Layout } from './components/Layout';
import { WorkspacePage } from './pages/WorkspacePage';
import { JobsPage } from './pages/JobsPage';
import { ChannelsPage } from './pages/ChannelsPage';
import { SeriesPage } from './pages/SeriesPage';
import { WatermarksPage } from './pages/WatermarksPage';
import { SettingsPage } from './pages/SettingsPage';
import { HealthPage } from './pages/HealthPage';

const queryClient = new QueryClient();

const AppRoutes: React.FC = () => {
  const { isLoading } = useLocalWorkspace();

  if (isLoading) {
    return (
      <div style={{ padding: 32, color: 'var(--muted)' }}>
        Đang khởi động HoangTuoi Reup (Local Standalone)...
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<JobsPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/series" element={<SeriesPage />} />
          <Route path="/watermarks" element={<WatermarksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/health" element={<HealthPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <LocalWorkspaceProvider>
      <AppRoutes />
    </LocalWorkspaceProvider>
  </QueryClientProvider>
);
