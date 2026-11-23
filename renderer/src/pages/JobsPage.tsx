import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, Play, Plus, RefreshCw, Square, Trash2 } from 'lucide-react';
import { useLocalWorkspace } from '../context/LocalWorkspaceContext';

export const JobsPage: React.FC = () => {
  const { apiProvider } = useLocalWorkspace();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: jobs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['local-jobs', apiProvider.baseUrl],
    queryFn: () => apiProvider.listJobs(),
    enabled: Boolean(apiProvider.baseUrl),
    retry: 2,
    refetchInterval: (query) => {
      const list = query.state.data ?? [];
      return list.some((j) => j.status === 'running' || j.status === 'queued') ? 800 : false;
    },
  });

  useEffect(() => {
    if (!apiProvider.baseUrl) return;
    const wsUrl = `${apiProvider.baseUrl.replace(/^http/, 'ws')}/api/v1/ws`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = () => {
        queryClient.invalidateQueries({ queryKey: ['local-jobs', apiProvider.baseUrl] });
      };
    } catch {
      // ignore ws errors
    }
    return () => {
      if (ws) ws.close();
    };
  }, [apiProvider.baseUrl, queryClient]);

  const handleBrowseVideo = async () => {
    if (window.api?.dialog?.openVideoFile) {
      const selected = await window.api.dialog.openVideoFile();
      if (selected) {
        setUrl(selected);
        if (!title.trim()) {
          const base = selected.split(/[\\/]/).pop() || selected;
          setTitle(base);
        }
      }
    }
  };

  const handleCreateJob = async (autoStart: boolean) => {
    const cleanTitle = title.trim() || url.trim() || 'Untitled Reup Job';
    setSubmitting(true);
    try {
      const created = await apiProvider.createJob({
        title: cleanTitle,
        url: url.trim(),
        options: { target_lang: 'vi' },
      });
      if (autoStart && created?.id) {
        await apiProvider.startJob(created.id);
      }
      setTitle('');
      setUrl('');
      await refetch();
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async (id: string) => {
    await apiProvider.startJob(id);
    await refetch();
  };

  const handleCancel = async (id: string) => {
    await apiProvider.cancelJob(id);
    await refetch();
  };

  const handleDelete = async (id: string) => {
    await apiProvider.deleteJob(id);
    await refetch();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Jobs (Local Reup Pipeline)</h2>
        <button className="btn" onClick={() => refetch()}>
          <RefreshCw size={14} /> Tải lại
        </button>
      </div>

      <div className="card">
        <h3>Tạo Job mới</h3>
        <div className="grid-2" style={{ marginBottom: 12 }}>
          <label>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Tiêu đề Job</div>
            <input
              className="input"
              placeholder="Ví dụ: Tập 1 - Review Phim..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Link Video hoặc Đường dẫn File cục bộ</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                placeholder="https://... hoặc C:\Videos\input.mp4"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              {window.api?.dialog?.openVideoFile && (
                <button type="button" className="btn" onClick={handleBrowseVideo} title="Chọn file video">
                  <FolderOpen size={14} /> Chọn file
                </button>
              )}
            </div>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={submitting || (!title.trim() && !url.trim())}
            onClick={() => handleCreateJob(true)}
          >
            <Play size={14} /> Tạo & Chạy ngay
          </button>
          <button
            type="button"
            className="btn"
            disabled={submitting || (!title.trim() && !url.trim())}
            onClick={() => handleCreateJob(false)}
          >
            <Plus size={14} /> Chỉ thêm vào hàng đợi
          </button>
        </div>
      </div>

      <div className="card">
        {isLoading && <p className="muted">Đang tải danh sách jobs từ local sidecar...</p>}
        {error && (
          <p style={{ color: 'var(--warn)' }}>
            Không thể kết nối `/api/v1/jobs`: {(error as Error).message}
          </p>
        )}
        {!isLoading && !error && jobs.length === 0 && (
          <p className="muted">Chưa có job nào trong thư mục dữ liệu cục bộ. Hãy tạo job mới ở trên.</p>
        )}
        {jobs.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tiêu đề / Nguồn</th>
                <th>Trạng thái</th>
                <th>Stage</th>
                <th>Tiến độ</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const isRunning = job.status === 'running' || job.status === 'queued';
                const pct = typeof job.progress === 'number' ? job.progress : 0;
                return (
                  <tr key={job.id}>
                    <td className="mono">{job.id.slice(0, 8)}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{job.title || '—'}</div>
                      {job.url && (
                        <div className="mono muted" style={{ fontSize: 11 }}>
                          {job.url}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          job.status === 'completed'
                            ? ''
                            : job.status === 'failed' || job.status === 'cancelled'
                            ? 'badge-cloud'
                            : ''
                        }`}
                      >
                        {job.status || 'pending'}
                      </span>
                    </td>
                    <td className="mono">{job.stage || '—'}</td>
                    <td style={{ minWidth: 120 }}>
                      <div
                        style={{
                          height: 6,
                          background: 'var(--bg)',
                          borderRadius: 4,
                          overflow: 'hidden',
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, pct))}%`,
                            height: '100%',
                            background: 'var(--accent)',
                            transition: 'width 0.25s ease',
                          }}
                        />
                      </div>
                      <span className="mono muted" style={{ fontSize: 11 }}>
                        {pct}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {!isRunning ? (
                          <button
                            className="btn"
                            onClick={() => handleStart(job.id)}
                            title="Chạy / Thử lại"
                          >
                            <Play size={13} /> Chạy
                          </button>
                        ) : (
                          <button
                            className="btn"
                            onClick={() => handleCancel(job.id)}
                            title="Hủy job"
                          >
                            <Square size={13} /> Hủy
                          </button>
                        )}
                        <button
                          className="btn"
                          onClick={() => handleDelete(job.id)}
                          title="Xóa job"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
