import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useLocalWorkspace } from '../context/LocalWorkspaceContext';

export const WatermarksPage: React.FC = () => {
  const { apiProvider } = useLocalWorkspace();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [position, setPosition] = useState('bottom-right');

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['local-watermarks', apiProvider.baseUrl],
    queryFn: () => apiProvider.listWatermarks(),
    enabled: Boolean(apiProvider.baseUrl),
    retry: 2,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await apiProvider.createWatermark({
      name: name.trim(),
      config: {
        text: text.trim() || name.trim(),
        position,
        opacity: 0.85,
      },
    });
    setName('');
    setText('');
    await refetch();
  };

  const handleDelete = async (id: string) => {
    await apiProvider.deleteWatermark(id);
    await refetch();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Watermarks</h2>
        <button className="btn" onClick={() => refetch()}>
          <RefreshCw size={14} /> Tải lại
        </button>
      </div>

      <div className="card">
        <h3>Tạo Watermark Profile</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: '1 1 200px' }}
            placeholder="Tên cấu hình (ví dụ: Logo Kênh Chính)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            style={{ flex: '1 1 220px' }}
            placeholder="Nội dung chữ đóng dấu (@HoangTuoiReup)"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <select
            className="input"
            style={{ flex: '0 0 160px' }}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          >
            <option value="bottom-right">Góc dưới phải</option>
            <option value="bottom-left">Góc dưới trái</option>
            <option value="top-right">Góc trên phải</option>
            <option value="top-left">Góc trên trái</option>
          </select>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            <Plus size={14} /> Tạo Watermark
          </button>
        </form>
      </div>

      <div className="card">
        {isLoading && <p className="muted">Đang tải watermarks...</p>}
        {error && <p style={{ color: 'var(--warn)' }}>{(error as Error).message}</p>}
        {!isLoading && !error && data.length === 0 && (
          <p className="muted">Chưa có watermark profile nào. Hãy tạo cấu hình mới ở trên.</p>
        )}
        {data.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên Profile</th>
                <th>Nội dung / Vị trí</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.map((wm) => {
                const cfg = (wm.config ?? {}) as Record<string, unknown>;
                return (
                  <tr key={wm.id}>
                    <td className="mono">{wm.id.slice(0, 8)}</td>
                    <td style={{ fontWeight: 600 }}>{wm.name || '—'}</td>
                    <td className="mono">
                      {String(cfg.text || '—')} ({String(cfg.position || 'bottom-right')})
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn"
                        onClick={() => handleDelete(wm.id)}
                        title="Xóa watermark"
                      >
                        <Trash2 size={13} />
                      </button>
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
