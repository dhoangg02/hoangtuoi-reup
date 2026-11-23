import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, RotateCw } from 'lucide-react';
import { useLocalWorkspace } from '../context/LocalWorkspaceContext';

export const HealthPage: React.FC = () => {
  const { apiProvider, runtimeInfo, refreshRuntimeInfo } = useLocalWorkspace();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['local-health', apiProvider.baseUrl],
    queryFn: () => apiProvider.getHealth(),
    enabled: Boolean(apiProvider.baseUrl),
    retry: 6,
    retryDelay: 400,
  });

  const handleRestart = async () => {
    if (window.api?.app?.restartSidecar) {
      await window.api.app.restartSidecar();
      await refreshRuntimeInfo();
      setTimeout(() => refetch(), 1500);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Sidecar Health</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => refetch()}>
            <RefreshCw size={14} /> Kiểm tra `/api/v1/health`
          </button>
          <button className="btn" onClick={handleRestart}>
            <RotateCw size={14} /> Khởi động lại Sidecar
          </button>
        </div>
      </div>

      <div className="card">
        <p>
          <strong>Endpoint:</strong>{' '}
          <span className="mono">
            {apiProvider.baseUrl ? `${apiProvider.baseUrl}/api/v1/health` : '—'}
          </span>
        </p>
        <p>
          <strong>Binary:</strong>{' '}
          <span className="mono">{runtimeInfo?.sidecarBinaryPath ?? '—'}</span>
        </p>
        {isLoading && <p className="muted">Đang kiểm tra kết nối tới FastAPI sidecar...</p>}
        {error && (
          <p style={{ color: 'var(--warn)' }}>
            Sidecar chưa phản hồi: {(error as Error).message}
          </p>
        )}
        {data && (
          <pre
            className="mono"
            style={{
              background: 'var(--bg)',
              padding: 12,
              borderRadius: 8,
              overflowX: 'auto',
              border: '1px solid var(--border)',
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};
