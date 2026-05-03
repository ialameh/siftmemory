import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../scripts/runtime/config.js', () => ({
  configService: {
    getDaemonUrl: vi.fn(() => 'http://daemon.test'),
  },
}));

describe('Event buffer flushing', () => {
  const originalHome = process.env.HOME;
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'siftmemory-buffer-test-'));
    process.env.HOME = tempHome;
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: true, data: { ingested_count: 1 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    rmSync(tempHome, { recursive: true, force: true });
  });

  it('bufferEvent returns buffered and creates the buffer file', async () => {
    const { bufferEvent, getBufferedEventCount } = await import('../scripts/event-buffer.js');
    const event = {
      workspace_id: 'workspace-1',
      session_id: 'session-1',
      event_type: 'ManualNote',
      payload_json: {},
    };

    const result = await bufferEvent(event);
    const bufferFile = join(tempHome, '.siftmemory', 'claude-plugin-buffer.ndjson');

    expect(result).toMatchObject({ status: 'buffered', file: bufferFile });
    expect(existsSync(bufferFile)).toBe(true);
    expect(readFileSync(bufferFile, 'utf-8')).toContain('"workspace_id":"workspace-1"');
    expect(await getBufferedEventCount()).toBe(1);
  });

  it('flushEventBuffer intentionally skips when there is no buffer', async () => {
    const { flushEventBuffer } = await import('../scripts/event-buffer.js');

    await expect(flushEventBuffer()).resolves.toEqual({
      status: 'intentionally_skipped',
      reason: 'empty_buffer',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('flushEventBuffer sends { workspace_id, events } to the daemon', async () => {
    const { bufferEvent, flushEventBuffer } = await import('../scripts/event-buffer.js');
    const event = {
      workspace_id: 'workspace-1',
      session_id: 'session-1',
      actor: 'Tool',
      event_type: 'FileEdit',
      tool: 'Edit',
      file_path: 'src/a.ts',
      symbol_refs: [],
      payload_json: {
        old_string_hash: 'sha256:old',
        new_string_hash: 'sha256:new',
      },
      privacy_level: 'Private',
      client_event_id: 'event-1',
    };

    await bufferEvent(event);
    const result = await flushEventBuffer();

    expect(result).toMatchObject({
      status: 'sent_to_daemon',
      workspaceCount: 1,
      eventCount: 1,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'http://daemon.test/v1/events/batch',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: 'workspace-1', events: [event] }),
      })
    );
  });

  it('keeps buffered events when daemon ingestion fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: false, error: { code: 'TEST', message: 'failed' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )));
    const { bufferEvent, flushEventBuffer } = await import('../scripts/event-buffer.js');
    const event = {
      workspace_id: 'workspace-1',
      session_id: 'session-1',
      event_type: 'ManualNote',
      payload_json: {},
    };

    await bufferEvent(event);
    const result = await flushEventBuffer();
    const bufferFile = join(tempHome, '.siftmemory', 'claude-plugin-buffer.ndjson');

    expect(result.status).toBe('failed');
    expect(existsSync(bufferFile)).toBe(true);
    expect(readFileSync(bufferFile, 'utf-8')).toContain('"workspace_id":"workspace-1"');
  });
});
