import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useLocalWorkspace } from '../context/LocalWorkspaceContext';

export const ChannelsPage: React.FC = () => {
  const { apiProvider } = useLocalWorkspace();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('douyin');

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['local-channels', apiProvider.baseUrl],
    queryFn: () => apiProvider.listChannels(),
    enabled: Boolean(apiProvider.baseUrl),
    retry: 2,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await apiProvider.createChannel({
      name: name.trim(),
      url: url.trim(),
      platform,
    });
    setName('');
    setUrl('');
    await refetch();
  };

  const handleDelete = async (id: string) => {
    await apiProvider.deleteChannel(id);
    await refetch();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Channels</h2>
        <button className="btn" onClick={() => refetch()}>
          <RefreshCw size={14} /> Tải lại
        </button>
      </div>

      <div className="card">
        <h3>Thêm Kênh Nguồn (Local Channel)</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: '1 1 200px' }}
            placeholder="Tên kênh (ví dụ: Douyin Movie Official)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            style={{ flex: '2 1 260px' }}
            placeholder="URL kênh (https://www.douyin.com/user/...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <select
            className="input"
            style={{ flex: '0 0 140px' }}
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="douyin">Douyin</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
            <option value="bilibili">Bilibili</option>
            <option value="local">Local Folder</option>
          </select>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            <Plus size={14} /> Thêm kênh
          </button>
        </form>
      </div>

      <div className="card">
        {isLoading && <p className="muted">Đang tải channels...</p>}
        {error && <p style={{ color: 'var(--warn)' }}>{(error as Error).message}</p>}
        {!isLoading && !error && data.length === 0 && (
          <p className="muted">Chưa có channel nào. Hãy thêm kênh nguồn ở form trên.</p>
        )}
        {data.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên kênh</th>
                <th>Nền tảng</th>
                <th>URL</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.map((ch) => (
                <tr key={ch.id}>
                  <td className="mono">{ch.id.slice(0, 8)}</td>
                  <td style={{ fontWeight: 600 }}>{ch.name || '—'}</td>
                  <td>
                    <span className="badge">{ch.platform || 'douyin'}</span>
                  </td>
                  <td className="mono">{ch.url || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn" onClick={() => handleDelete(ch.id)} title="Xóa kênh">
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
