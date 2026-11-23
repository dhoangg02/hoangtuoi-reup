import React, { useEffect, useState } from 'react';
import { FolderOpen, Save } from 'lucide-react';
import { useLocalWorkspace } from '../context/LocalWorkspaceContext';

export const SettingsPage: React.FC = () => {
  const { workspace, updateWorkspace, apiProvider } = useLocalWorkspace();
  const [displayName, setDisplayName] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('vi');
  const [outputDir, setOutputDir] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (workspace) {
      setDisplayName(workspace.displayName);
      setDefaultLanguage(workspace.settings?.defaultLanguage || 'vi');
      setOutputDir(workspace.settings?.outputDir || '');
    }
  }, [workspace]);

  const handleChooseOutputFolder = async () => {
    if (window.api?.dialog?.openFolder) {
      const folder = await window.api.dialog.openFolder();
      if (folder) setOutputDir(folder);
    }
  };

  const handleOpenOutputFolder = async () => {
    if (outputDir && window.api?.shell?.openPath) {
      await window.api.shell.openPath(outputDir);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextName = displayName.trim() || 'Local Workspace Owner';
    await updateWorkspace({
      displayName: nextName,
      settings: {
        theme: workspace?.settings?.theme ?? 'dark',
        autoConnectSidecar: workspace?.settings?.autoConnectSidecar ?? true,
        defaultLanguage,
        outputDir: outputDir.trim() || workspace?.settings?.outputDir,
      },
    });
    if (apiProvider.baseUrl) {
      await apiProvider
        .updateSettings({
          display_name: nextName,
          default_language: defaultLanguage,
          output_dir: outputDir.trim(),
        })
        .catch(() => {});
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Local Workspace Settings</h2>
      <div className="card" style={{ maxWidth: 640 }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Tên hiển thị (Local Owner)</div>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>

          <label>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Ngôn ngữ đích mặc định</div>
            <select
              className="input"
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value)}
            >
              <option value="vi">Tiếng Việt (vi)</option>
              <option value="en">English (en)</option>
              <option value="zh">中文 (zh)</option>
              <option value="ja">日本語 (ja)</option>
            </select>
          </label>

          <label>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Thư mục xuất video (Output Directory)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
              />
              {window.api?.dialog?.openFolder && (
                <button type="button" className="btn" onClick={handleChooseOutputFolder}>
                  <FolderOpen size={14} /> Chọn
                </button>
              )}
              {outputDir && window.api?.shell?.openPath && (
                <button type="button" className="btn" onClick={handleOpenOutputFolder}>
                  Mở
                </button>
              )}
            </div>
          </label>

          <div>
            <div style={{ marginBottom: 4, fontWeight: 600 }}>Thư mục dữ liệu cục bộ (Storage Path)</div>
            <div className="mono muted">{workspace?.storagePath ?? '—'}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" className="btn btn-primary">
              <Save size={14} /> Lưu cấu hình cục bộ
            </button>
            {saved && <span style={{ color: 'var(--ok)', fontSize: 13 }}>Đã lưu cấu hình!</span>}
          </div>
        </form>
      </div>
    </div>
  );
};
