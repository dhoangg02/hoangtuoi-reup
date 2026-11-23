import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Film,
  FolderOpen,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useLocalWorkspace } from '../context/LocalWorkspaceContext';
import type { JobSummary, SubtitleSegment } from '@adapter/apiProvider';

const STAGE_LABELS: Record<string, string> = {
  init: 'Khởi tạo',
  queued: 'Trong hàng đợi',
  download_video: '1/6 Tải & Chuẩn bị Video',
  extract_audio: '2/6 Tách âm thanh (FFmpeg)',
  transcribe_asr: '3/6 Nhận diện lời thoại AI (Whisper)',
  translate_subtitles: '4/6 Dịch phụ đề sang Tiếng Việt',
  tts_dubbing: '5/6 Lồng tiếng AI (Edge-TTS)',
  render_video: '6/6 Ghép giọng & Đóng phụ đề MP4',
  completed: 'Hoàn tất Dịch & Lồng tiếng',
  failed: 'Lỗi xử lý',
  cancelled: 'Đã hủy',
};

export const JobsPage: React.FC = () => {
  const { apiProvider } = useLocalWorkspace();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [voiceId, setVoiceId] = useState('vi-VN-HoaiMyNeural');
  const [voiceRate, setVoiceRate] = useState('+10%');
  const [bgVolume, setBgVolume] = useState('0.15');
  const [whisperModel, setWhisperModel] = useState('base');
  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [editedSegments, setEditedSegments] = useState<SubtitleSegment[]>([]);
  const [studioVoiceId, setStudioVoiceId] = useState('vi-VN-HoaiMyNeural');
  const [studioVoiceRate, setStudioVoiceRate] = useState('+10%');
  const [studioBgVolume, setStudioBgVolume] = useState('0.15');
  const [studioBurnSubtitles, setStudioBurnSubtitles] = useState(true);
  const [videoVersion, setVideoVersion] = useState(1);

  const { data: jobs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['local-jobs', apiProvider.baseUrl],
    queryFn: () => apiProvider.listJobs(),
    enabled: Boolean(apiProvider.baseUrl),
    retry: 6,
    retryDelay: 400,
    refetchInterval: (query) => {
      const list = query.state.data ?? [];
      return list.some((j) => j.status === 'running' || j.status === 'queued') ? 1000 : false;
    },
  });

  useEffect(() => {
    if (!apiProvider.baseUrl) return;
    const wsUrl = `${apiProvider.baseUrl.replace(/^http/, 'ws')}/api/v1/ws`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (ev) => {
        queryClient.invalidateQueries({ queryKey: ['local-jobs', apiProvider.baseUrl] });
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'job.completed') {
            setVideoVersion((v) => v + 1);
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }
    return () => {
      if (ws) ws.close();
    };
  }, [apiProvider.baseUrl, queryClient]);

  const selectedJob: JobSummary | undefined =
    jobs.find((j) => j.id === selectedJobId) || jobs.find((j) => j.status === 'completed') || jobs[0];

  useEffect(() => {
    if (!selectedJob) return;
    const segs = selectedJob.studio?.segments ?? [];
    setEditedSegments(segs.map((s) => ({ ...s })));
    setStudioVoiceId(String(selectedJob.studio?.voice_id || selectedJob.options?.voice_id || 'vi-VN-HoaiMyNeural'));
    setStudioVoiceRate(String(selectedJob.studio?.voice_rate || selectedJob.options?.voice_rate || '+10%'));
    setStudioBgVolume(String(selectedJob.studio?.bg_volume ?? selectedJob.options?.bg_volume ?? '0.15'));
    setStudioBurnSubtitles(Boolean(selectedJob.studio?.burn_subtitles ?? selectedJob.options?.burn_subtitles ?? true));
  }, [selectedJob?.id, selectedJob?.updated_at]);

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

  const buildOptions = () => ({
    source_lang: sourceLang,
    target_lang: 'vi',
    voice_id: voiceId,
    voice_rate: voiceRate,
    bg_volume: parseFloat(bgVolume),
    whisper_model: whisperModel,
    burn_subtitles: burnSubtitles,
  });

  const handleCreateJob = async (autoStart: boolean) => {
    const cleanTitle = title.trim() || url.trim() || 'Video Dịch & Lồng Tiếng';
    setSubmitting(true);
    try {
      const created = await apiProvider.createJob({
        title: cleanTitle,
        url: url.trim(),
        options: buildOptions(),
      });
      if (created?.id) {
        setSelectedJobId(created.id);
        if (autoStart) {
          await apiProvider.startJob(created.id);
        }
      }
      setTitle('');
      setUrl('');
      await refetch();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDemoJob = async () => {
    setSubmitting(true);
    try {
      const created = await apiProvider.createDemoJob(buildOptions());
      if (created?.id) {
        setSelectedJobId(created.id);
      }
      await refetch();
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async (id: string) => {
    setSelectedJobId(id);
    await apiProvider.startJob(id);
    await refetch();
  };

  const handleCancel = async (id: string) => {
    await apiProvider.cancelJob(id);
    await refetch();
  };

  const handleDelete = async (id: string) => {
    await apiProvider.deleteJob(id);
    if (selectedJobId === id) setSelectedJobId(null);
    await refetch();
  };

  const handleRedub = async () => {
    if (!selectedJob) return;
    await apiProvider.redubJob(selectedJob.id, {
      segments: editedSegments,
      voice_id: studioVoiceId,
      voice_rate: studioVoiceRate,
      bg_volume: parseFloat(studioBgVolume),
      burn_subtitles: studioBurnSubtitles,
    });
    await refetch();
  };

  const handleOpenOutputInFolder = async (job: JobSummary) => {
    const outPath = job.output_path || job.studio?.output_path;
    if (outPath && window.api?.shell?.showInFolder) {
      await window.api.shell.showInFolder(outPath);
    } else if (window.api?.paths?.output && window.api?.shell?.openPath) {
      const outDir = await window.api.paths.output();
      await window.api.shell.openPath(outDir);
    }
  };

  const updateSegmentText = (idx: number, field: 'origin_text' | 'vi_text', value: string) => {
    setEditedSegments((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Dịch & Lồng Tiếng Video AI (Local Pipeline)</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Tải video Douyin / TikTok / YouTube hoặc chọn file từ máy → Bóc băng AI Whisper → Dịch Tiếng Việt → Lồng tiếng AI Hoài My / Nam Minh → Xuất MP4.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            disabled={submitting}
            onClick={handleCreateDemoJob}
            title="Tự tạo 1 video tiếng Trung mẫu và chạy toàn bộ quy trình Dịch & Lồng tiếng Tiếng Việt"
          >
            <Sparkles size={14} /> Chạy Thử Video Mẫu (Demo Trung → Việt)
          </button>
          <button className="btn" onClick={() => refetch()}>
            <RefreshCw size={14} /> Tải lại
          </button>
        </div>
      </div>

      {/* Form Tạo Job Dịch & Lồng Tiếng */}
      <div className="card">
        <h3>1. Tạo Job Dịch & Lồng Tiếng Mới</h3>
        <div className="grid-2" style={{ marginBottom: 12 }}>
          <label>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Link Video (Douyin / TikTok / YouTube) hoặc File trên máy</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                placeholder="Dán link Douyin/TikTok/YouTube hoặc bấm Chọn file MP4..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              {window.api?.dialog?.openVideoFile && (
                <button type="button" className="btn" onClick={handleBrowseVideo}>
                  <FolderOpen size={14} /> Chọn file
                </button>
              )}
            </div>
          </label>
          <label>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Tiêu đề Video (Tùy chọn)</div>
            <input
              className="input"
              placeholder="Ví dụ: Tập 1 - Review Phim..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <label>
            <div style={{ marginBottom: 5, fontSize: 12, fontWeight: 600 }}>Ngôn ngữ video gốc</div>
            <select className="input" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
              <option value="auto">Tự động nhận diện (Auto)</option>
              <option value="zh">Tiếng Trung (Douyin / Bilibili)</option>
              <option value="en">Tiếng Anh (English)</option>
              <option value="ja">Tiếng Nhật (Japanese)</option>
              <option value="ko">Tiếng Hàn (Korean)</option>
            </select>
          </label>

          <label>
            <div style={{ marginBottom: 5, fontSize: 12, fontWeight: 600 }}>Giọng đọc Lồng tiếng AI</div>
            <select className="input" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
              <option value="vi-VN-HoaiMyNeural">Nữ - Hoài My (Review / TikTok)</option>
              <option value="vi-VN-NamMinhNeural">Nam - Nam Minh (Thuyết minh)</option>
            </select>
          </label>

          <label>
            <div style={{ marginBottom: 5, fontSize: 12, fontWeight: 600 }}>Tốc độ giọng đọc</div>
            <select className="input" value={voiceRate} onChange={(e) => setVoiceRate(e.target.value)}>
              <option value="+0%">Bình thường (+0%)</option>
              <option value="+10%">Nhanh vừa (+10% - Khuyên dùng)</option>
              <option value="+15%">Nhanh (+15% - Review phim)</option>
              <option value="+20%">Rất nhanh (+20%)</option>
            </select>
          </label>

          <label>
            <div style={{ marginBottom: 5, fontSize: 12, fontWeight: 600 }}>Âm lượng tiếng/nhạc gốc</div>
            <select className="input" value={bgVolume} onChange={(e) => setBgVolume(e.target.value)}>
              <option value="0.0">0% (Tắt hẳn tiếng gốc)</option>
              <option value="0.15">15% (Giữ nhạc nền nhỏ)</option>
              <option value="0.30">30% (Giữ tiếng gốc vừa)</option>
              <option value="0.50">50%</option>
            </select>
          </label>

          <label>
            <div style={{ marginBottom: 5, fontSize: 12, fontWeight: 600 }}>Model AI Whisper (Bóc băng)</div>
            <select className="input" value={whisperModel} onChange={(e) => setWhisperModel(e.target.value)}>
              <option value="tiny">Tiny (Siêu nhanh)</option>
              <option value="base">Base (Cân bằng - Khuyên dùng)</option>
              <option value="small">Small (Chính xác cao)</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={burnSubtitles}
              onChange={(e) => setBurnSubtitles(e.target.checked)}
            />
            <span>Đóng phụ đề Tiếng Việt trực tiếp lên video (Hardsub)</span>
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitting || (!title.trim() && !url.trim())}
              onClick={() => handleCreateJob(true)}
            >
              <Play size={14} /> Bắt đầu Dịch & Lồng Tiếng Ngay
            </button>
          </div>
        </div>
      </div>

      {/* Danh sách Jobs */}
      <div className="card">
        <h3>2. Danh sách Jobs & Tiến độ Xử lý</h3>
        {isLoading && <p className="muted">Đang kết nối tới Local FastAPI Sidecar...</p>}
        {error && (
          <p style={{ color: 'var(--warn)' }}>
            Đang chờ sidecar khởi động: {(error as Error).message}
          </p>
        )}
        {!isLoading && !error && jobs.length === 0 && (
          <p className="muted">
            Chưa có job nào. Hãy chọn file video ở trên hoặc bấm nút <strong>"Chạy Thử Video Mẫu (Demo Trung → Việt)"</strong> ở góc phải trên để trải nghiệm ngay!
          </p>
        )}
        {jobs.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Video / Nguồn</th>
                <th>Bước xử lý hiện tại</th>
                <th>Tiến độ</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const isRunning = job.status === 'running' || job.status === 'queued';
                const pct = typeof job.progress === 'number' ? job.progress : 0;
                const isSelected = selectedJob?.id === job.id;
                return (
                  <tr
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(59, 130, 246, 0.1)' : undefined,
                    }}
                  >
                    <td className="mono">{job.id.slice(0, 8)}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{job.title || '—'}</div>
                      <div className="mono muted" style={{ fontSize: 11 }}>
                        {job.url || '—'}
                      </div>
                      {job.error_message && (
                        <div style={{ color: 'var(--err)', fontSize: 12, marginTop: 4 }}>
                          {job.error_message}
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
                        {STAGE_LABELS[job.stage || ''] || job.stage || job.status}
                      </span>
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <div
                        style={{
                          height: 7,
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
                            background: job.status === 'completed' ? 'var(--ok)' : 'var(--accent)',
                            transition: 'width 0.25s ease',
                          }}
                        />
                      </div>
                      <span className="mono muted" style={{ fontSize: 11 }}>
                        {pct}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn"
                          onClick={() => setSelectedJobId(job.id)}
                          title="Mở Studio Xem Video & Phụ đề"
                        >
                          <Film size={13} /> Studio
                        </button>
                        {job.status === 'completed' && (
                          <button
                            className="btn"
                            onClick={() => handleOpenOutputInFolder(job)}
                            title="Mở file MP4 đã lồng tiếng trong thư mục"
                          >
                            <FolderOpen size={13} /> Mở File
                          </button>
                        )}
                        {!isRunning ? (
                          <button
                            className="btn"
                            onClick={() => handleStart(job.id)}
                            title="Chạy / Chạy lại từ đầu"
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

      {/* Studio Xem Trước Video & Chỉnh Sửa Phụ Đề / Lồng Tiếng Lại */}
      {selectedJob && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0 }}>
                3. Studio Kết Quả & Chỉnh Sửa Phụ Đề — {selectedJob.title} ({selectedJob.id})
              </h3>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Ngôn ngữ phát hiện: <strong>{selectedJob.studio?.detected_language || 'auto'}</strong> → Tiếng Việt (<strong>vi</strong>) | Giọng đọc: <strong>{studioVoiceId}</strong>
              </div>
            </div>

            {selectedJob.status === 'completed' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={() => handleOpenOutputInFolder(selectedJob)}>
                  <FolderOpen size={14} /> Mở File MP4 Trong Thư Mục
                </button>
                <a
                  className="btn"
                  href={`${apiProvider.baseUrl}/api/v1/jobs/${encodeURIComponent(selectedJob.id)}/srt`}
                  download={`${selectedJob.id}_vi.srt`}
                  style={{ textDecoration: 'none' }}
                >
                  <Download size={14} /> Tải Phụ Đề (.SRT)
                </a>
              </div>
            )}
          </div>

          {/* Trình phát Video Kết Quả & Video Gốc */}
          {selectedJob.status === 'completed' && (
            <div className="grid-2" style={{ marginBottom: 18 }}>
              <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--ok)' }}>
                  Video Đã Dịch & Lồng Tiếng Việt (Output MP4)
                </div>
                <video
                  key={`${selectedJob.id}-dub-${videoVersion}`}
                  controls
                  style={{ width: '100%', maxHeight: 320, borderRadius: 6, background: '#000' }}
                  src={`${apiProvider.baseUrl}/api/v1/jobs/${encodeURIComponent(selectedJob.id)}/video?v=${videoVersion}`}
                />
                <div className="mono muted" style={{ fontSize: 11, marginTop: 6 }}>
                  File: {selectedJob.output_path || selectedJob.studio?.output_path || '—'}
                </div>
              </div>

              <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  Video Gốc (Source Video)
                </div>
                <video
                  key={`${selectedJob.id}-src-${videoVersion}`}
                  controls
                  style={{ width: '100%', maxHeight: 320, borderRadius: 6, background: '#000' }}
                  src={`${apiProvider.baseUrl}/api/v1/jobs/${encodeURIComponent(selectedJob.id)}/source-video?v=${videoVersion}`}
                />
              </div>
            </div>
          )}

          {/* Bảng Chỉnh sửa Phụ đề & Lồng tiếng lại */}
          {editedSegments.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                <h4 style={{ margin: 0 }}>
                  Phụ đề song ngữ & Lời thoại lồng tiếng ({editedSegments.length} câu) — Có thể sửa trực tiếp lời Việt bên dưới:
                </h4>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className="input"
                    style={{ width: 210 }}
                    value={studioVoiceId}
                    onChange={(e) => setStudioVoiceId(e.target.value)}
                  >
                    <option value="vi-VN-HoaiMyNeural">Giọng Nữ - Hoài My</option>
                    <option value="vi-VN-NamMinhNeural">Giọng Nam - Nam Minh</option>
                  </select>
                  <select
                    className="input"
                    style={{ width: 130 }}
                    value={studioVoiceRate}
                    onChange={(e) => setStudioVoiceRate(e.target.value)}
                  >
                    <option value="+0%">Tốc độ +0%</option>
                    <option value="+10%">Tốc độ +10%</option>
                    <option value="+15%">Tốc độ +15%</option>
                    <option value="+20%">Tốc độ +20%</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleRedub}
                    disabled={selectedJob.status === 'running' || selectedJob.status === 'queued'}
                  >
                    <Volume2 size={14} /> Lồng Tiếng & Xuất Lại Video
                  </button>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th style={{ width: 130 }}>Thời gian</th>
                    <th>Lời thoại gốc (Whisper ASR)</th>
                    <th>Lời dịch & Lồng tiếng Tiếng Việt (Sửa trực tiếp)</th>
                  </tr>
                </thead>
                <tbody>
                  {editedSegments.map((seg, idx) => (
                    <tr key={seg.index ?? idx}>
                      <td className="mono">{idx + 1}</td>
                      <td className="mono">
                        {seg.start.toFixed(1)}s → {seg.end.toFixed(1)}s
                      </td>
                      <td>
                        <input
                          className="input"
                          value={seg.origin_text}
                          onChange={(e) => updateSegmentText(idx, 'origin_text', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          value={seg.vi_text}
                          onChange={(e) => updateSegmentText(idx, 'vi_text', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
