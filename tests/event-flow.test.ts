import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bufferEvent: vi.fn(),
}));

vi.mock('../scripts/event-buffer.js', () => ({
  bufferEvent: mocks.bufferEvent,
  flushEventBuffer: vi.fn(),
}));

describe('PostToolUse event flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bufferEvent.mockResolvedValue({
      status: 'buffered',
      file: '/tmp/claude-plugin-buffer.ndjson',
    });
  });

  it('creates a valid IngestEventRequest and buffers it locally', async () => {
    const { capturePostToolUseEvent } = await import('../scripts/siftmemory-hook.js');

    const result = await capturePostToolUseEvent({
      input: {
        session_id: 'session-1',
        tool_use_id: 'tool-1',
        tool_name: 'Edit',
        tool_input: {
          file_path: 'src/a.ts',
          old_string: 'token=secret',
          new_string: 'token=redacted',
        },
        tool_output: { ok: true },
      },
      workspaceId: 'workspace-1',
      sessionId: 'session-1',
    });

    expect(result.status).toBe('buffered');
    expect(mocks.bufferEvent).toHaveBeenCalledTimes(1);

    const request = mocks.bufferEvent.mock.calls[0][0] as Record<string, any>;
    expect(request).toMatchObject({
      workspace_id: 'workspace-1',
      session_id: 'session-1',
      actor: 'Tool',
      event_type: 'FileEdit',
      tool: '',
      file_path: 'src/a.ts',
      symbol_refs: [],
      privacy_level: 'Private',
    });
    expect(request.client_event_id).toBeTruthy();
    expect(request.payload_json).toHaveProperty('old_string_hash');
    expect(request.payload_json).toHaveProperty('new_string_hash');
  });

  it('does not store raw edit strings in top-level fields or payload_json', async () => {
    const { capturePostToolUseEvent } = await import('../scripts/siftmemory-hook.js');

    await capturePostToolUseEvent({
      input: {
        session_id: 'session-1',
        tool_use_id: 'tool-1',
        tool_name: 'Edit',
        tool_input: {
          file_path: 'src/a.ts',
          old_string: 'token=secret',
          new_string: 'token=redacted',
        },
      },
      workspaceId: 'workspace-1',
      sessionId: 'session-1',
    });

    const request = mocks.bufferEvent.mock.calls[0][0] as Record<string, any>;
    expect(JSON.stringify(request)).not.toContain('token=secret');
    expect(JSON.stringify(request)).not.toContain('token=redacted');
    expect(request).not.toHaveProperty('old_string');
    expect(request).not.toHaveProperty('new_string');
    expect(request.payload_json).not.toHaveProperty('old_string');
    expect(request.payload_json).not.toHaveProperty('new_string');
  });

  it('buildIngestEventRequest keeps command_hash and output_hash inside payload_json', async () => {
    const { buildIngestEventRequest } = await import('../scripts/siftmemory-hook.js');
    const { sanitizeToolPayload } = await import('../scripts/payload-sanitizer.js');

    const sanitized = sanitizeToolPayload(
      {
        tool_name: 'Bash',
        tool_input: { command: 'npm test', exit_code: 0 },
        tool_output: { stdout: 'tests passed' },
        session_id: 'session-1',
        tool_use_id: 'tool-1',
        hook_event_name: 'post-tool-use',
      },
      'TestRun'
    );

    const request = buildIngestEventRequest({
      sanitized,
      workspaceId: 'workspace-1',
      sessionId: 'session-1',
      hookName: 'post-tool-use',
      eventType: 'TestRun',
    });

    expect(request).not.toHaveProperty('command_hash');
    expect(request).not.toHaveProperty('output_hash');
    expect(request.payload_json).toHaveProperty('command_hash');
    expect(request.payload_json).toHaveProperty('output_hash');
  });

  it('buildIngestEventRequest keeps pattern_hash inside payload_json', async () => {
    const { buildIngestEventRequest } = await import('../scripts/siftmemory-hook.js');
    const { sanitizeToolPayload } = await import('../scripts/payload-sanitizer.js');

    const sanitized = sanitizeToolPayload(
      {
        tool_name: 'Grep',
        tool_input: { pattern: 'TODO.*fixme', matches: [{ file_path: 'src/main.ts' }] },
        session_id: 'session-1',
        tool_use_id: 'tool-1',
        hook_event_name: 'post-tool-use',
      },
      'ManualNote'
    );

    const request = buildIngestEventRequest({
      sanitized,
      workspaceId: 'workspace-1',
      sessionId: 'session-1',
      hookName: 'post-tool-use',
      eventType: 'ManualNote',
    });

    expect(request).not.toHaveProperty('pattern_hash');
    expect(request.payload_json).toHaveProperty('pattern_hash');
  });

  it('does not emit unsupported FileWrite or Search event types', async () => {
    const { classifyToolEvent } = await import('../scripts/payload-sanitizer.js');

    const cases = [
      classifyToolEvent({ tool_name: 'Write', tool_input: { file_path: 'src/a.ts' } }),
      classifyToolEvent({ tool_name: 'Edit', tool_input: { file_path: 'src/a.ts' } }),
      classifyToolEvent({ tool_name: 'Grep', tool_input: { pattern: 'TODO' } }),
      classifyToolEvent({ tool_name: 'Glob', tool_input: { pattern: '*.ts' } }),
    ];

    expect(cases).not.toContain('FileWrite');
    expect(cases).not.toContain('Search');
    expect(cases).toEqual(['FileCreate', 'FileEdit', 'ManualNote', 'ManualNote']);
  });
});
