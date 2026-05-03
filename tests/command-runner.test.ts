import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensureReady: vi.fn(),
  ensureWorkspace: vi.fn(),
  buildResumePack: vi.fn(),
  collectiveStatus: vi.fn(),
}));

vi.mock('../scripts/runtime/readiness.js', () => ({
  runtimeReadinessService: {
    ensureReady: mocks.ensureReady,
  },
}));

vi.mock('../scripts/runtime/config.js', () => ({
  configService: {
    getDaemonUrl: vi.fn(() => 'http://127.0.0.1:7777'),
    shouldAutoStart: vi.fn(() => true),
  },
}));

vi.mock('../scripts/runtime/plugin-state.js', () => ({
  pluginStateStore: {
    get: vi.fn(async () => null),
  },
}));

vi.mock('../scripts/runtime/binary-resolver.js', () => ({
  binaryResolver: {
    findSiftMemoryBinary: vi.fn(async () => '/tmp/siftmemory-daemon'),
  },
}));

vi.mock('../scripts/daemon-http.js', () => ({
  getDaemonHealth: vi.fn(async () => ({ ok: true, version: 'test' })),
  buildResumePack: mocks.buildResumePack,
  ensureWorkspace: mocks.ensureWorkspace,
  daemonClient: {
    collectiveStatus: mocks.collectiveStatus,
  },
  isApiSuccess: vi.fn((response: { ok: boolean }) => response.ok),
  getApiError: vi.fn(() => 'daemon error'),
}));

describe('Command Runner Workspace Resolution', () => {
  const originalWorkspaceId = process.env.SIFTMEMORY_WORKSPACE_ID;
  const originalSessionId = process.env.SIFTMEMORY_SESSION_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SIFTMEMORY_WORKSPACE_ID;
    process.env.SIFTMEMORY_SESSION_ID = 'session-test';
    mocks.ensureReady.mockResolvedValue({ ready: true });
    mocks.ensureWorkspace.mockResolvedValue({
      workspace_id: 'ws-from-init',
      workspace_key: 'key-from-init',
    });
    mocks.buildResumePack.mockResolvedValue({
      resume_pack_id: 'pack-test',
      rendered_markdown: 'resume markdown',
    });
    mocks.collectiveStatus.mockResolvedValue({
      ok: true,
      data: {
        repo_collective_path: '/tmp/.siftmemory/collective',
        manifest_exists: true,
        record_counts: {},
        pending_reviews: 0,
        unresolved_conflicts: 0,
      },
    });
  });

  afterEach(() => {
    if (originalWorkspaceId === undefined) {
      delete process.env.SIFTMEMORY_WORKSPACE_ID;
    } else {
      process.env.SIFTMEMORY_WORKSPACE_ID = originalWorkspaceId;
    }

    if (originalSessionId === undefined) {
      delete process.env.SIFTMEMORY_SESSION_ID;
    } else {
      process.env.SIFTMEMORY_SESSION_ID = originalSessionId;
    }
  });

  it('resume uses SIFTMEMORY_WORKSPACE_ID when present', async () => {
    process.env.SIFTMEMORY_WORKSPACE_ID = 'ws-from-env';
    const { runCommand } = await import('../scripts/command-runner.js');

    const result = await runCommand('resume', ['fix', 'event', 'ingestion', 'contract']);

    expect(result.success).toBe(true);
    expect(mocks.ensureWorkspace).not.toHaveBeenCalled();
    expect(mocks.buildResumePack).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-from-env',
        sessionId: 'session-test',
        task: 'fix event ingestion contract',
      })
    );
  });

  it('resume calls ensureWorkspace when env var is absent', async () => {
    const { runCommand } = await import('../scripts/command-runner.js');

    const result = await runCommand('resume', ['fix', 'event', 'ingestion', 'contract']);

    expect(result.success).toBe(true);
    expect(mocks.ensureWorkspace).toHaveBeenCalledWith(process.cwd());
    expect(mocks.buildResumePack).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-from-init',
        task: 'fix event ingestion contract',
      })
    );
  });

  it('team status resolves workspace similarly', async () => {
    const { runCommand } = await import('../scripts/command-runner.js');

    const result = await runCommand('team', ['status']);

    expect(result.success).toBe(true);
    expect(mocks.ensureWorkspace).toHaveBeenCalledWith(process.cwd());
    expect(mocks.collectiveStatus).toHaveBeenCalledWith('ws-from-init');
  });
});
