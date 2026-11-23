# LOCAL_DEPENDENCY_MAP — Authentication Subsystem & Local Standalone Refactor

Tài liệu này phân tích toàn bộ kiến trúc dự án, kiểm kê artifact trong `Gốc/Dudu Reup-Setup-0.18.6-x64.exe` so với cây mã nguồn hiện tại, và lập bản đồ tách biệt hoàn toàn hệ thống Authentication khỏi luồng chạy của **Local Standalone Edition (`RuntimeMode = LOCAL_STANDALONE`)**.

---

## 1. Phân tích Artifact trong `Gốc/` & Trạng thái Source Code

### 1.1. Kiểm kê Binary Artifact (`Gốc/Dudu Reup-Setup-0.18.6-x64.exe`)

| Thành phần trong bộ cài `.exe` | Định dạng hiện có | Source gốc chưa biên dịch trong `.exe` | Hướng xử lý hợp lệ (Không patch binary) |
|---|---|---|---|
| `resources/app.asar` → `out/preload/index.js` | CommonJS rõ ràng (3.4 KB) | Có đầy đủ cấu trúc IPC bridge | Tái cấu trúc sạch tại `electron/preload.cjs` với `runtimeMode`. |
| `resources/app.asar` → `out/main/index.js` | Rollup bundle (629 KB, 30 IPC handlers) | Thiếu file `.ts` lẻ của `src/main/*` trong gói cài đặt | Tái cấu trúc sạch tại `electron/main.cjs`, tách cấu hình `HOANGTUOI_RUNTIME_MODE` và `resolveDataDir()`. |
| `resources/app.asar` → `out/renderer/assets/index-*.js` | Vite/React minified bundle (1.75 MB, không có `.map`) | Thiếu source `.tsx` gốc của `src/renderer/*` trong bộ cài `.exe` | Xây dựng cây source TypeScript/React chuẩn tại `renderer/src/*` sử dụng `LocalWorkspaceContext` thay cho `AuthContext`. |
| `resources/backend/dudu-reup-backend/dudu-reup-backend.exe` | PyInstaller `onedir` bundle (Python 3.11 `.pyc` trong PYZ) | Thiếu source `.py` gốc của sidecar trong bộ cài `.exe` | Xây dựng FastAPI + SQLite + Faster-Whisper + Edge-TTS + FFmpeg + yt-dlp sidecar mã nguồn mở tại `backend/app/*`. |

> **Lưu ý tuân thủ:** Không thực hiện decompile/patch binary `dudu-reup-backend.exe`, không giả mạo `cloud_session_token` hay `desktop_token`. Toàn bộ thay đổi kiến trúc được thực hiện trực tiếp trên cây source code (`shared/`, `backend-adapter/`, `electron/`, `renderer/`, `backend/`).

---

## 2. Bản đồ Dependency của Authentication Subsystem (8 Nhóm Thành Phần)

Dưới đây là toàn bộ 8 nhóm thành phần liên quan đến xác thực, tài khoản và phiên đăng nhập đã được xác định và tách khỏi luồng chạy `LOCAL_STANDALONE`:

### 2.1. Login UI
- **Thành phần Cloud (`RuntimeMode = CLOUD`):** Các màn hình `/login`, `/register`, `/forgot-password`, `/verify-otp` yêu cầu nhập email/password hoặc mã OTP trước khi vào ứng dụng.
- **Cách tách trong `LOCAL_STANDALONE`:**
  - `renderer/src/App.tsx` không mount bất kỳ route `/login` hay `/register` nào khi `runtimeMode === 'LOCAL_STANDALONE'`.
  - Route gốc `/` khởi động trực tiếp vào giao diện làm việc chính (**Studio Dịch & Lồng Tiếng Video**).

### 2.2. Account / Profile & Billing
- **Thành phần Cloud:**
  - `GET /api/account/me` (thông tin user cloud)
  - `GET /api/tokens/balance` (số dư credit/token)
  - `GET /api/billing/packs`, `POST /api/billing/orders` (thanh toán SePay QR)
- **Cách tách trong `LOCAL_STANDALONE`:**
  - Thay thế hoàn toàn dependency `User` / `AccountProfile` bằng `LocalWorkspace` (`id`, `displayName: "Local Workspace Owner"`, `settings`, `storagePath`) lưu tại `data/local-workspace.json`.
  - Trong `LocalApiProvider` (`backend-adapter/apiProvider.ts`), các hàm `getCloudAccount()` và `getBillingBalance()` ném `CloudOnlyFeatureError` rõ ràng nếu bị gọi nhầm, tuyệt đối không trả về dữ liệu/số dư giả.

### 2.3. Session Management
- **Thành phần Cloud:**
  - `GET /api/auth/get-session`
  - `POST /api/auth/sign-out`
  - `POST /api/v1/settings/cloud-session/logout`
- **Cách tách trong `LOCAL_STANDALONE`:**
  - `LocalWorkspaceProvider` (`renderer/src/context/LocalWorkspaceContext.tsx`) đọc trực tiếp cấu hình workspace cục bộ qua IPC `workspace:get` và `app:get-runtime-info`, không khởi tạo hay kiểm tra bất kỳ cloud session nào.

### 2.4. Authentication Client
- **Thành phần Cloud:** HTTP client gọi tới `https://api.dudutools.store` và `https://api-dev.dudutools.store` kèm header `Authorization: Bearer <token>`.
- **Cách tách trong `LOCAL_STANDALONE`:**
  - `createApiProvider(runtimeMode, baseUrl)` trong `backend-adapter/apiProvider.ts` chọn `LocalApiProvider` khi `runtimeMode === RuntimeMode.LOCAL_STANDALONE` và giữ nguyên `CloudApiProvider` cho `RuntimeMode.CLOUD`.
  - Content Security Policy (CSP) trong `renderer/index.html` chỉ cho phép kết nối tới `http://127.0.0.1:*` và `ws://127.0.0.1:*` cho local sidecar API.

### 2.5. Authentication API Endpoints
- **Thành phần Cloud:**
  - `POST /api/auth/sign-in/email`
  - `POST /api/auth/sign-up/email`
  - `POST /api/auth/email-otp/request-password-reset`
  - `POST /api/auth/email-otp/reset-password`
  - `POST /api/auth/email-otp/send-verification-otp`
  - `POST /api/auth/email-otp/verify-email`
  - `POST /api/account/desktop-token`
- **Cách tách trong `LOCAL_STANDALONE`:** Không được gọi ở bất kỳ bước nào trong `LocalApiProvider` hay `electron/main.cjs`.

### 2.6. Token / Session Persistence
- **Thành phần Cloud:** Lưu `cloud_session_token`, `desktop_token` vào `/api/v1/settings/secrets` và sinh `app:get-device-hash` để định danh máy với cloud server.
- **Cách tách trong `LOCAL_STANDALONE`:**
  - Không tạo fake token, không ghi `cloud_session_token` giả vào database hay `local-workspace.json`.
  - Dữ liệu người dùng chỉ gồm `data/local-workspace.json` và SQLite `data/hoangtuoi-reup.db`.

### 2.7. Route Guards / Middleware phụ thuộc trạng thái đăng nhập
- **Thành phần Cloud:**
  - Frontend `AuthGuard` / `ProtectedRoute` chặn truy cập khi `!session` và redirect về `/login`.
  - Backend middleware kiểm tra `desktop_token` / quota trước khi cho phép `POST /api/v1/jobs/{id}/start`.
- **Cách tách trong `LOCAL_STANDALONE`:**
  - Frontend `AppRoutes` trong `renderer/src/App.tsx` chỉ đợi `useLocalWorkspace().isLoading` (đọc file `local-workspace.json` cục bộ) rồi render thẳng các route `/`, `/jobs`, `/channels`, `/series`, `/watermarks`, `/settings`, `/workspace`, `/health`.
  - Backend FastAPI (`backend/app/api/routes.py`) bind trực tiếp trên `127.0.0.1` cho phép local workspace owner thực thi đầy đủ các route `/api/v1/jobs*`, `/api/v1/voices*`, `/api/v1/resources*`, `/api/v1/channels*`, `/api/v1/series*`, `/api/v1/watermarks*`, `/api/v1/settings*` mà không qua middleware kiểm tra cloud token.

### 2.8. Startup Checks
- **Thành phần Cloud:** Kiểm tra `get-session`, kiểm tra cập nhật từ `https://updates.dudutools.store`, tải binary từ `https://resources.dudutools.store`, khởi tạo PostHog telemetry và Tawk.to widget.
- **Cách tách trong `LOCAL_STANDALONE`:**
  - Loại bỏ hoàn toàn PostHog, Tawk.to và cloud auto-updater.
  - Thay bằng **Local Resource & Model Bootstrap (`/api/v1/startup/status` & `/api/v1/resources`)**: kiểm tra trạng thái cục bộ của `FFmpeg`, `FFprobe`, `yt-dlp`, `Faster-Whisper ASR models` (`tiny`, `base`, `small`) và `Edge-TTS Neural Voices`, đồng thời cho phép người dùng tải/cài đặt các tài nguyên mã nguồn mở này ngay trong giao diện ứng dụng.

---

## 3. Luồng Khởi Động Mới (`LOCAL_STANDALONE`)

```
Launch Application (Electron Main)
  ├── Load/Create data/local-workspace.json (Local Workspace Owner)
  ├── Spawn Local FastAPI Sidecar on http://127.0.0.1:<port>
  └── Load Renderer with ?api=http://127.0.0.1:<port>&mode=LOCAL_STANDALONE
        ├── LocalWorkspaceProvider bootstraps workspace & runtimeInfo
        ├── Check Local Resources (/api/v1/startup/status: FFmpeg, yt-dlp, Whisper, Neural TTS)
        └── Render Directly into Local Studio Workspace (No Login / No Auth Redirect)
```
