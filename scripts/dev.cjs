'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const vite = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev:renderer'], {
  cwd: ROOT,
  stdio: 'inherit',
});

setTimeout(() => {
  const electronExe = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
  const cmd = process.platform === 'win32' ? electronExe : 'electron';
  const electron = spawn(cmd, ['.'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: 'http://localhost:5173',
    },
  });
  electron.on('exit', () => {
    vite.kill();
    process.exit(0);
  });
}, 2500);
