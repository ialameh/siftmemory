/**
 * Event Buffer
 * Buffers events to disk during daemon outages.
 */

import { writeFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

const BUFFER_DIR = resolve(homedir(), '.siftmemory');
const BUFFER_FILE = resolve(BUFFER_DIR, 'claude-plugin-buffer.ndjson');
const MAX_BUFFER_SIZE = 5 * 1024 * 1024; // 5 MB

function ensureBufferDir(): void {
  if (!existsSync(BUFFER_DIR)) {
    mkdirSync(BUFFER_DIR, { recursive: true });
  }
}

export async function bufferEvent(event: Record<string, unknown>): Promise<void> {
  ensureBufferDir();
  try {
    const line = JSON.stringify(event) + '\n';
    appendFileSync(BUFFER_FILE, line, { flag: 'a' });

    // Rotate if too large
    const stats = { size: 0 };
    try {
      const content = require('fs').readFileSync(BUFFER_FILE, 'utf-8');
      stats.size = content.length;
    } catch {}

    if (stats.size > MAX_BUFFER_SIZE) {
      rotateBuffer();
    }
  } catch {
    // Non-fatal - buffer failures should not block hooks
  }
}

export async function flushEventBuffer(): Promise<void> {
  ensureBufferDir();
  if (!existsSync(BUFFER_FILE)) {
    return;
  }

  const { readFileSync, unlinkSync, writeFileSync } = await import('fs');
  const { configService } = await import('./runtime/config.js');

  const content = readFileSync(BUFFER_FILE, 'utf-8');
  const lines = content.split('\n').filter(Boolean);

  if (lines.length === 0) {
    return;
  }

  const daemonUrl = configService.getDaemonUrl();

  try {
    const response = await fetch(`${daemonUrl}/v1/events/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: lines.map(l => JSON.parse(l)) }),
    });

    if (response.ok) {
      unlinkSync(BUFFER_FILE);
    }
  } catch {
    // Keep buffer for next flush
  }
}

function rotateBuffer(): void {
  try {
    const { readFileSync, unlinkSync, writeFileSync, renameSync } = require('fs');
    const timestamp = Date.now();
    const rotated = `${BUFFER_FILE}.${timestamp}`;
    renameSync(BUFFER_FILE, rotated);
    writeFileSync(BUFFER_FILE, '');
  } catch {
    // Non-fatal
  }
}

export async function getBufferedEventCount(): Promise<number> {
  if (!existsSync(BUFFER_FILE)) {
    return 0;
  }
  try {
    const content = require('fs').readFileSync(BUFFER_FILE, 'utf-8');
    return content.split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}