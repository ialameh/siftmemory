#!/usr/bin/env node
/**
 * SiftMemory SessionStart Hook - Daemon spawn + readiness check
 */

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIFTmemory_PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || __dirname;

const SOCKET_TIMEOUT_MS = 3000;
const SOCKET_POLL_MS = 100;
const PID_DIR = join(homedir(), '.siftmemory', 'run');

function logEvent(level, message, attributes = {}) {
  try {
    mkdirSync(PID_DIR, { recursive: true });
    const logFile = join(PID_DIR, 'session-start.ndjson');
    appendFileSync(logFile, JSON.stringify({ timestamp: new Date().toISOString(), level, name: 'session-start', message, attributes }) + '\n');
  } catch { /* never fatal */ }
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function findDaemonBinary() {
  const searchPaths = [
    join(SIFTmemory_PLUGIN_ROOT, 'bin', 'siftmemory-daemon'),
    join(homedir(), '.cargo', 'bin', 'siftmemory-daemon'),
    join(homedir(), '.local', 'bin', 'siftmemory-daemon'),
    '/usr/local/bin/siftmemory-daemon',
  ];

  for (const p of searchPaths) {
    if (existsSync(p)) return p;
  }

  // PATH lookup
  try {
    const out = execFileSync('which', ['siftmemory-daemon'], { stdio: ['ignore', 'pipe', 'ignore'] });
    const path = out.toString('utf8').trim();
    if (path && existsSync(path)) return path;
  } catch { /* continue */ }

  return null;
}

function waitForSocket(sockFile) {
  const deadline = Date.now() + SOCKET_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (existsSync(sockFile)) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, SOCKET_POLL_MS);
  }
  return existsSync(sockFile);
}

function main() {
  const pidFile = join(PID_DIR, 'daemon.pid');
  const sockFile = join(PID_DIR, 'daemon.sock');

  // Check if daemon already running
  if (existsSync(pidFile) && existsSync(sockFile)) {
    const pid = parseInt(readFileSync(pidFile, 'utf8').trim(), 10);
    if (Number.isFinite(pid) && isAlive(pid)) {
      logEvent('info', 'daemon already running', { pid });
      process.exit(0);
    }
  }

  const daemonPath = findDaemonBinary();
  if (!daemonPath) {
    process.stdout.write('[SiftMemory] Core not found. Install with: cargo install --git https://github.com/ialameh/sift-memory siftmemory-daemon\n');
    process.exit(0);
  }

  mkdirSync(PID_DIR, { recursive: true });

  const child = spawn(process.execPath, [daemonPath], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });
  child.unref();

  const assignedPid = child.pid;
  if (Number.isFinite(assignedPid)) {
    try {
      appendFileSync(pidFile, String(assignedPid));
    } catch { /* ignore */ }
  }

  logEvent('info', 'daemon spawn dispatched', { daemonPath, pid: assignedPid });

  if (!waitForSocket(sockFile)) {
    logEvent('warn', 'daemon socket not found after timeout', { sockFile });
  }

  process.exit(0);
}

main();
