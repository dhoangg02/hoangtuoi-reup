import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useLocalWorkspace } from '../context/LocalWorkspaceContext';

export const SeriesPage: React.FC = () => {
  const { apiProvider } = useLocalWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['local-series', apiProvider.baseUrl],
    queryFn: () => apiProvider.listSeries(),
    enabled: Boolean(apiProvider.baseUrl),
    retry: 2,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await apiProvider.createSeries({
      name: name.trim(),
      description: description.trim(),
    });
    setName('');
    setDescription('');
    await refetch();
  };

  const handleDelete = async (id: string) => {
    await apiProvider.deleteSeries(id);
    await refetch();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Series</h2>
        <button className="btn" onClick={() => refetch()}>
          <RefreshCw size={14} /> Tải lại
        </button>
      </div>

      <div className="card">
        <h3>Tạo Series mới</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: '1 1 220px' }}
            placeholder="Tên Series (ví dụ: Review Phim Cổ Trang)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            style={{ flex: '2 1 280px' }}
            placeholder="Mô tả ngắn..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            <Plus size={14} /> Tạo Series
          </button>
        </form>
      </div>

      <div className="card">
        {isLoading && <p className="muted">Đang tải series...</p>}
        {error && <p style={{ color: 'var(--warn)' }}>{(error as Error).message}</p>}
        {!isLoading && !error && data.length === 0 && (
          <p className="muted">Chưa có series nào. Hãy tạo series mới ở trên.</p>
        )}
        {data.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên Series</th>
                <th>Mô tả</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id}>
                  <td className="mono">{item.id.slice(0, 8)}</td>
                  <td style={{ fontWeight: 600 }}>{item.name || '—'}</td>
                  <td>{item.description || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn" onClick={() => handleDelete(item.id)} title="Xóa series">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
