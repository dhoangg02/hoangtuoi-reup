import React from 'react';
import { FolderOpen, RefreshCw } from 'lucide-react';
import { useLocalWorkspace } from '../context/LocalWorkspaceContext';

export const WorkspacePage: React.FC = () => {
  const { workspace, runtimeInfo, runtimeMode, refreshRuntimeInfo } = useLocalWorkspace();

  const openDataFolder = async () => {
    if (workspace?.storagePath && window.api?.shell?.openPath) {
      await window.api.shell.openPath(workspace.storagePath);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Local Workspace</h2>
      <p className="muted">
        Chế độ single-user, local-first. Khởi động trực tiếp vào workspace mà không yêu cầu đăng nhập
        hay cloud identity.
      </p>

      <div className="grid-2">
        <div className="card">
          <h3>Workspace Identity (Local)</h3>
          <p>
            <strong>Mode:</strong> <span className="badge">{runtimeMode}</span>
          </p>
          <p>
            <strong>ID:</strong> <span className="mono">{workspace?.id ?? '—'}</span>
          </p>
          <p>
            <strong>Display Name:</strong> {workspace?.displayName ?? '—'}
          </p>
          <p>
            <strong>Storage Path:</strong>{' '}
            <span className="mono">{workspace?.storagePath ?? '—'}</span>
          </p>
          <p>
            <strong>Created At:</strong>{' '}
            <span className="mono">{workspace?.createdAt ?? '—'}</span>
          </p>
          <button className="btn" onClick={openDataFolder}>
            <FolderOpen size={14} /> Mở thư mục dữ liệu cục bộ
          </button>
        </div>

        <div className="card">
          <h3>Local FastAPI Sidecar</h3>
          <p>
            <strong>Status:</strong>{' '}
            <span
              className={`status-dot ${runtimeInfo?.sidecarRunning ? 'status-ok' : 'status-err'}`}
            />
            {runtimeInfo?.sidecarRunning ? 'Running' : 'Not running'}
          </p>
          <p>
            <strong>Sidecar URL:</strong>{' '}
            <span className="mono">{runtimeInfo?.sidecarUrl || '—'}</span>
          </p>
          <p>
            <strong>Platform:</strong> <span className="mono">{runtimeInfo?.platform ?? '—'}</span>
          </p>
          <button className="btn" onClick={refreshRuntimeInfo}>
            <RefreshCw size={14} /> Làm mới trạng thái
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Chức năng bị vô hiệu hóa trong Local Standalone Edition</h3>
        <p className="muted" style={{ marginBottom: 8 }}>
          Các chức năng sau được đánh dấu <span className="badge badge-cloud">CLOUD_ONLY</span> và
          không được gọi hoặc giả lập trong bản Local:
        </p>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Đăng nhập / Đăng ký / OTP / Cloud Session (`/api/auth/*`)</li>
          <li>Tài khoản Cloud, Số dư Credit & Thanh toán SePay (`/api/account/*`, `/api/billing/*`)</li>
          <li>Kết nối & đăng bài Facebook Pages (`/api/v1/facebook/*`)</li>
          <li>Telemetry (PostHog), Live Chat (Tawk.to) và Cloud Auto-Updater</li>
        </ul>
      </div>
    </div>
  );
};
