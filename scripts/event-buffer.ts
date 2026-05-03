/**
 * Event Buffer
 * Buffers sanitized events to disk before daemon ingestion.
 * PostToolBatch and terminal hooks flush the buffer to /v1/events/batch.
 */

import {
  existsSync,
  appendFileSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  renameSync,
} from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

const BUFFER_DIR = resolve(homedir(), '.siftmemory');
const BUFFER_FILE = resolve(BUFFER_DIR, 'claude-plugin-buffer.ndjson');
const MAX_BUFFER_SIZE = 5 * 1024 * 1024; // 5 MB

export type BufferEventResult =
  | { status: 'buffered'; file: string }
  | { status: 'failed'; file: string; error: string };

export type FlushEventBufferResult =
  | { status: 'intentionally_skipped'; reason: 'empty_buffer' }
  | { status: 'sent_to_daemon'; workspaceCount: number; eventCount: number }
  | { status: 'failed'; workspaceCount: number; eventCount: number; error: string };

function ensureBufferDir(): void {
  if (!existsSync(BUFFER_DIR)) {
    mkdirSync(BUFFER_DIR, { recursive: true });
  }
}

export async function bufferEvent(event: Record<string, unknown>): Promise<BufferEventResult> {
  ensureBufferDir();
  try {
    const line = JSON.stringify(event) + '\n';
    appendFileSync(BUFFER_FILE, line, { flag: 'a' });

    // Rotate if too large
    const stats = { size: 0 };
    try {
      const content = readFileSync(BUFFER_FILE, 'utf-8');
      stats.size = content.length;
    } catch {}

    if (stats.size > MAX_BUFFER_SIZE) {
      rotateBuffer();
    }

    return { status: 'buffered', file: BUFFER_FILE };
  } catch (error) {
    return {
      status: 'failed',
      file: BUFFER_FILE,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function isBatchResponseSuccess(response: Response, body: unknown): boolean {
  if (!response.ok) return false;
  if (typeof body === 'object' && body !== null && 'ok' in body) {
    return (body as { ok?: unknown }).ok === true;
  }
  return true;
}

export async function flushEventBuffer(): Promise<FlushEventBufferResult> {
  ensureBufferDir();
  if (!existsSync(BUFFER_FILE)) {
    return { status: 'intentionally_skipped', reason: 'empty_buffer' };
  }

  const { configService } = await import('./runtime/config.js');

  const content = readFileSync(BUFFER_FILE, 'utf-8');
  const lines = content.split('\n').filter(Boolean);

  if (lines.length === 0) {
    return { status: 'intentionally_skipped', reason: 'empty_buffer' };
  }

  // Group events by workspace_id
  const eventsByWorkspace = new Map<string, unknown[]>();
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (!event.workspace_id) {
        console.error('Event missing workspace_id, discarding:', JSON.stringify(event).slice(0, 100));
        continue;
      }
      const wsId = event.workspace_id as string;
      if (!eventsByWorkspace.has(wsId)) {
        eventsByWorkspace.set(wsId, []);
      }
      eventsByWorkspace.get(wsId)!.push(event);
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  const daemonUrl = configService.getDaemonUrl();
  let eventCount = 0;
  for (const events of eventsByWorkspace.values()) {
    eventCount += events.length;
  }

  if (eventCount === 0) {
    return { status: 'intentionally_skipped', reason: 'empty_buffer' };
  }

  // Flush each workspace's events as a batch
  let allBatchesSucceeded = true;
  let lastError = '';
  for (const [workspaceId, events] of eventsByWorkspace) {
    try {
      const response = await fetch(`${daemonUrl}/v1/events/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, events }),
      });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {}

      if (!isBatchResponseSuccess(response, body)) {
        allBatchesSucceeded = false;
        lastError = `daemon returned ${response.status}`;
      }
    } catch (error) {
      allBatchesSucceeded = false;
      lastError = error instanceof Error ? error.message : String(error);
      // Keep buffer for next flush - don't delete
    }
  }

  if (!allBatchesSucceeded) {
    return {
      status: 'failed',
      workspaceCount: eventsByWorkspace.size,
      eventCount,
      error: lastError || 'event batch flush failed',
    };
  }

  try {
    unlinkSync(BUFFER_FILE);
  } catch {}

  return {
    status: 'sent_to_daemon',
    workspaceCount: eventsByWorkspace.size,
    eventCount,
  };
}

function rotateBuffer(): void {
  try {
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
    const content = readFileSync(BUFFER_FILE, 'utf-8');
    return content.split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}
