# HoangTuoi Reup

Open-source local-first desktop application for media reup workflows.

Built with Electron, React/TypeScript, and a clean-room Python FastAPI + SQLite backend (`RuntimeMode = LOCAL_STANDALONE`). Zero cloud authentication, zero telemetry, zero proprietary binary dependencies.

---

## Screenshots

> _Screenshots placeholder — add captures of Local Workspace, Jobs, Channels, Series, Watermarks, Settings, and Sidecar Health here._

---

## Supported Features (Local-Capable)

- **Direct Local Workspace startup** (`Launch → LocalWorkspace Bootstrap → Application UI`, no login/register/account screens)
- **Local FastAPI + SQLite backend** (`data/hoangtuoi-reup.db`) with async job queue & WebSocket progress (`/api/v1/ws`)
- **Jobs management** (create, list, inspect, start/retry, cancel, delete, studio timeline)
- **Channels, Series, Watermarks** local CRUD
- **Local Workspace Settings** (`data/local-workspace.json` + `/api/v1/settings`)
- **Sidecar Health diagnostics** (`/api/v1/health`, automatic `ffmpeg`/`ffprobe` detection)

## Unsupported / `CLOUD_ONLY` Features

The following cloud-dependent features are explicitly marked `CLOUD_ONLY` and disabled in `LOCAL_STANDALONE` mode (never spoofed):

- Cloud authentication, registration, email OTP, and cloud sessions
- Cloud account profiles, token/credit balances, and billing orders
- External social OAuth & auto-publishing
- Third-party telemetry, live chat widgets, and cloud auto-updaters

---

## System Requirements

- **OS:** Windows 10/11 (x64)
- **For building from source:**
  - Node.js 20+ (with `npm`)
  - Python 3.11+ (with `pip`)
  - Optional: `ffmpeg` and `ffprobe` on system `PATH` for media probing/processing

---

## Download

Pre-built Windows **NSIS Installer** (`HoangTuoi-Reup-Setup-*.exe`) and **Portable EXE** (`HoangTuoi-Reup-*-Portable.exe`) releases are published on [GitHub Releases](../../releases).

---

## Development & Local Resource Setup

Khi tải mã nguồn về máy mới, chạy trực tiếp **`Install-Resources.cmd`** (hoặc bấm nút **"Đồng bộ Tài nguyên & Giọng AI"** ngay trên thanh công cụ trong ứng dụng) để tự động cài đặt toàn bộ tài nguyên cần thiết (`Node modules`, `Faster-Whisper AI ASR`, `Edge-TTS >= 7.3.1` với 6 giọng đọc Neural Tiếng Việt, `yt-dlp`, và `FFmpeg`):

```powershell
git clone https://github.com/dhoangg02/hoangtuoi-reup.git
cd hoangtuoi-reup
.\Install-Resources.cmd
```

Hoặc cài thủ công từ terminal:

```powershell
npm ci
python -m pip install --upgrade -r backend/requirements.txt
npm run dev
```

Sau khi cài xong, nhấp đúp trực tiếp vào **`Start-HoangTuoi-Reup.cmd`** để mở nhanh ứng dụng (`Launch application → Local Workspace`, không cần đăng nhập). Chi tiết kiến trúc tách biệt Authentication xem tại [LOCAL_DEPENDENCY_MAP.md](./LOCAL_DEPENDENCY_MAP.md).

## Build from Source

```powershell
# Run backend & frontend checks
npm run test:backend
npm run typecheck
npm run build

# Package Windows NSIS Installer + Portable EXE (builds hoangtuoi-reup-backend.exe from Python source)
python -m pip install pyinstaller
npm run dist:win
```

---

## Architecture

- `electron/`: Electron Main & Preload processes (`main.cjs`, `preload.cjs`). Spawns `hoangtuoi-reup-backend` on `127.0.0.1` (`python -m app.main` in dev, `resources/backend/hoangtuoi-reup-backend.exe` in packaged builds).
- `renderer/`: React 18 + TypeScript + Vite + React Router 7 + TanStack Query UI using `LocalWorkspaceContext`.
- `shared/`: `RuntimeMode` (`LOCAL_STANDALONE` / `CLOUD`), `LocalWorkspace` types, `CloudOnlyFeatureError`.
- `backend-adapter/`: `ApiProvider` abstraction (`LocalApiProvider` / `CloudApiProvider`).
- `backend/`: Open-source Python 3.11 + FastAPI + Uvicorn + SQLite backend, PyInstaller spec (`hoangtuoi-reup-backend.spec`), and `pytest` suite.

## Local Data & Storage Location

All workspace data is stored locally under `data/`:

- `data/local-workspace.json` — Local workspace profile and UI preferences
- `data/hoangtuoi-reup.db` — SQLite database (`jobs`, `job_history`, `channels`, `series`, `watermarks`, `settings`, `media`)
- `data/jobs/`, `data/job-cache/`, `data/output/`, `data/logs/` — Local working directories

## Privacy

- Runs strictly on `127.0.0.1` with a strict local-only Content Security Policy in the renderer.
- Zero cloud authentication requests, zero telemetry, zero external tracking scripts.

## Troubleshooting

- **Sidecar shows offline:** Open the **Sidecar Health** tab and click **Khởi động lại Sidecar**, or verify Python 3.11 is on `PATH` when running in dev mode.
- **`ffmpeg_missing` in `/api/v1/health`:** Install FFmpeg (e.g. `winget install Gyan.FFmpeg`) and restart the app.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).

## License

MIT License — applies only to the original code authored in this repository. See [LICENSE](./LICENSE) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for third-party dependency licenses.
