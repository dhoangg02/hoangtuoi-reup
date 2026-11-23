'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const RUNTIME_MODE = process.env.HOANGTUOI_RUNTIME_MODE || 'LOCAL_STANDALONE';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(process.env.HOANGTUOI_DATA_DIR || path.join(PROJECT_ROOT, 'data'));
const WORKSPACE_FILE = path.join(DATA_DIR, 'local-workspace.json');
const BACKEND_SRC_DIR = path.join(PROJECT_ROOT, 'backend');

app.setName('HoangTuoi Reup');

function resolveBackendLaunch() {
  if (app.isPackaged) {
    const exeName =
      process.platform === 'win32' ? 'hoangtuoi-reup-backend.exe' : 'hoangtuoi-reup-backend';
    const packagedExe = path.join(process.resourcesPath, 'backend', exeName);
    return {
      mode: 'packaged',
      cmd: packagedExe,
      baseArgs: [],
      cwd: DATA_DIR,
      binaryPath: packagedExe,
    };
  }
  const builtExe = path.join(
    PROJECT_ROOT,
    'dist',
    'backend',
    process.platform === 'win32' ? 'hoangtuoi-reup-backend.exe' : 'hoangtuoi-reup-backend'
  );
  if (process.env.HOANGTUOI_USE_BUILT_BACKEND === '1' && fs.existsSync(builtExe)) {
    return {
      mode: 'built-local',
      cmd: builtExe,
      baseArgs: [],
      cwd: DATA_DIR,
      binaryPath: builtExe,
    };
  }
  const pyCmd = process.env.HOANGTUOI_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  return {
    mode: 'source',
    cmd: pyCmd,
    baseArgs: ['-m', 'app.main'],
    cwd: BACKEND_SRC_DIR,
    binaryPath: path.join(BACKEND_SRC_DIR, 'app', 'main.py'),
  };
}

let mainWindow = null;
let sidecarProcess = null;
let sidecarPort = 0;
let sidecarUrl = '';

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadOrCreateLocalWorkspace() {
  ensureDir(DATA_DIR);
  ensureDir(path.join(DATA_DIR, 'output'));
  ensureDir(path.join(DATA_DIR, 'logs'));
  ensureDir(path.join(DATA_DIR, 'temp'));

  if (fs.existsSync(WORKSPACE_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(WORKSPACE_FILE, 'utf-8'));
      let changed = false;
      if (existing.storagePath !== DATA_DIR) {
        existing.storagePath = DATA_DIR;
        changed = true;
      }
      if (!existing.settings) {
        existing.settings = {};
        changed = true;
      }
      if (!existing.settings.outputDir || !fs.existsSync(existing.settings.outputDir)) {
        existing.settings.outputDir = path.join(DATA_DIR, 'output');
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(existing, null, 2), 'utf-8');
      }
      return existing;
    } catch {
      // Fall through to recreate default workspace if corrupted
    }
  }

  const workspace = {
    id: `local-${crypto.randomUUID()}`,
    displayName: 'Local Workspace Owner',
    settings: {
      theme: 'dark',
      defaultLanguage: 'vi',
      autoConnectSidecar: true,
      outputDir: path.join(DATA_DIR, 'output'),
    },
    storagePath: DATA_DIR,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(workspace, null, 2), 'utf-8');
  return workspace;
}

function updateLocalWorkspace(patch) {
  const current = loadOrCreateLocalWorkspace();
  const next = {
    ...current,
    ...patch,
    settings: {
      ...current.settings,
      ...(patch && patch.settings ? patch.settings : {}),
    },
  };
  fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 18765;
      server.close(() => resolve(port));
    });
  });
}

function stopSidecar() {
  if (sidecarProcess && !sidecarProcess.killed) {
    try {
      sidecarProcess.kill();
    } catch {
      // ignore
    }
  }
  sidecarProcess = null;
}

async function startSidecar() {
  stopSidecar();
  sidecarPort = await findFreePort();
  sidecarUrl = `http://127.0.0.1:${sidecarPort}`;

  const launch = resolveBackendLaunch();
  if (launch.mode !== 'source' && !fs.existsSync(launch.cmd)) {
    console.warn('[LocalEdition] Backend binary not found:', launch.cmd);
    return sidecarUrl;
  }

  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(sidecarPort),
    HOANGTUOI_DATA_DIR: DATA_DIR,
    HOANGTUOI_RUNTIME_MODE: RUNTIME_MODE,
    PYTHONPATH: BACKEND_SRC_DIR,
  };

  try {
    sidecarProcess = spawn(
      launch.cmd,
      [
        ...launch.baseArgs,
        '--data-dir',
        DATA_DIR,
        '--job-storage-dir',
        path.join(DATA_DIR, 'jobs'),
        '--cache-dir',
        path.join(DATA_DIR, 'job-cache'),
        '--host',
        '127.0.0.1',
        '--port',
        String(sidecarPort),
      ],
      {
        cwd: launch.cwd,
        env,
        stdio: 'ignore',
        windowsHide: true,
      }
    );
    sidecarProcess.on('exit', () => {
      sidecarProcess = null;
    });
    await waitForHealth(sidecarUrl, 4500);
  } catch (err) {
    console.error('[LocalEdition] Failed to spawn open-source backend:', err);
    sidecarProcess = null;
  }

  return sidecarUrl;
}

function registerIpcHandlers() {
  ipcMain.handle('workspace:get', () => loadOrCreateLocalWorkspace());
  ipcMain.handle('workspace:update', (_event, patch) => updateLocalWorkspace(patch));

  ipcMain.handle('paths:data', () => DATA_DIR);
  ipcMain.handle('paths:output', () => path.join(DATA_DIR, 'output'));
  ipcMain.handle('paths:logs', () => path.join(DATA_DIR, 'logs'));

  ipcMain.handle('shell:showInFolder', (_event, targetPath) => {
    if (targetPath) shell.showItemInFolder(targetPath);
  });
  ipcMain.handle('shell:openPath', (_event, targetPath) => {
    if (targetPath) return shell.openPath(targetPath);
    return '';
  });

  ipcMain.handle('dialog:openVideoFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi'] }],
    });
    return result.canceled ? null : result.filePaths[0] || null;
  });

  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0] || null;
  });

  ipcMain.handle('app:get-runtime-info', () => ({
    runtimeMode: RUNTIME_MODE,
    appVersion: app.getVersion(),
    platform: process.platform,
    sidecarUrl,
    sidecarRunning: Boolean(sidecarProcess && !sidecarProcess.killed),
    sidecarBinaryPath: resolveBackendLaunch().binaryPath,
    dataDir: DATA_DIR,
  }));

  ipcMain.handle('app:restart-sidecar', async () => {
    const url = await startSidecar();
    return { sidecarUrl: url, sidecarRunning: Boolean(sidecarProcess) };
  });

  ipcMain.handle('app:quit', () => {
    app.quit();
  });
}

async function createMainWindow() {
  const url = await startSidecar();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'HoangTuoi Reup',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await mainWindow.loadURL(
      `${devUrl}?api=${encodeURIComponent(url)}&mode=${encodeURIComponent(RUNTIME_MODE)}`
    );
  } else {
    const indexHtml = path.join(PROJECT_ROOT, 'dist', 'renderer', 'index.html');
    await mainWindow.loadFile(indexHtml, {
      query: {
        api: url,
        mode: RUNTIME_MODE,
      },
    });
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(true);
    mainWindow.show();
    mainWindow.focus();
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(false);
      }
    }, 800);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.HOANGTUOI_SMOKE_TEST === '1') {
    runSmokeTest(mainWindow, url).catch((err) => {
      fs.writeFileSync(path.join(DATA_DIR, 'smoke-test-error.txt'), String(err.stack || err), 'utf-8');
      stopSidecar();
      app.exit(1);
    });
  }
}

async function waitForHealth(baseUrl, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'timeout';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/health`);
      if (res.ok) {
        return { ok: true, status: res.status, body: await res.json().catch(() => ({})) };
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err.message;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { ok: false, error: lastError };
}

async function runSmokeTest(win, baseUrl) {
  const blockedCloudRequests = [];
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    if (/^https?:\/\//i.test(details.url) && !details.url.startsWith('http://127.0.0.1') && !details.url.startsWith('http://localhost')) {
      blockedCloudRequests.push(details.url);
    }
    callback({});
  });

  await new Promise((r) => setTimeout(r, 1200));

  const initialState = await win.webContents.executeJavaScript(`({
    hash: window.location.hash,
    title: document.title,
    h2: document.querySelector('h2')?.textContent || '',
    hasLoginText: /sign in|đăng nhập|login/i.test(document.querySelector('h2')?.textContent || ''),
    runtimeMode: window.api?.runtimeMode || ''
  })`);

  const health = await waitForHealth(baseUrl, 12000);

  const routes = ['/', '/jobs', '/channels', '/series', '/watermarks', '/settings', '/health'];
  const routeResults = [];
  for (const r of routes) {
    await win.webContents.executeJavaScript(`window.location.hash = ${JSON.stringify('#' + r)}`);
    await new Promise((res) => setTimeout(res, 350));
    const snap = await win.webContents.executeJavaScript(`({
      route: ${JSON.stringify(r)},
      hash: window.location.hash,
      h2: document.querySelector('h2')?.textContent || '',
      bodyPreview: (document.querySelector('.main-content')?.textContent || '').slice(0, 140)
    })`);
    routeResults.push(snap);
  }

  const report = {
    windowCreated: true,
    sidecarUrl: baseUrl,
    sidecarRunning: Boolean(sidecarProcess && !sidecarProcess.killed),
    initialState,
    cloudAuthRequests: blockedCloudRequests,
    health,
    routeResults,
  };
  fs.writeFileSync(
    path.join(DATA_DIR, 'smoke-test-result.json'),
    JSON.stringify(report, null, 2),
    'utf-8'
  );
  console.log('=== SMOKE_TEST_RESULT ===');
  console.log(JSON.stringify(report, null, 2));
  stopSidecar();
  app.exit(0);
}

app.whenReady().then(async () => {
  loadOrCreateLocalWorkspace();
  registerIpcHandlers();
  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  stopSidecar();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
