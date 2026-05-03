/**
 * SiftMemory Daemon Client
 * Single client used by hooks, commands, and MCP tools.
 */

import { configService } from './runtime/config.js';

export interface WorkspaceInfo {
  workspace_id: string;
  workspace_key: string;
}

export async function initWorkspace(cwd: string): Promise<WorkspaceInfo | null> {
  const daemonUrl = configService.getDaemonUrl();

  // First resolve git root
  const repoRoot = await gitRepoRoot(cwd);

  try {
    const response = await fetch(`${daemonUrl}/v1/workspaces/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo_root: repoRoot,
        create_repo_config: true,
        user_email: await gitUserEmail(repoRoot),
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { data?: WorkspaceInfo | null };
    return data.data ?? null;
  } catch {
    return null;
  }
}

// Cache workspace per cwd
const workspaceCache = new Map<string, WorkspaceInfo>();

export async function ensureWorkspace(cwd: string): Promise<WorkspaceInfo | null> {
  if (workspaceCache.has(cwd)) {
    return workspaceCache.get(cwd)!;
  }

  const workspace = await initWorkspace(cwd);
  if (workspace) {
    workspaceCache.set(cwd, workspace);
  }
  return workspace;
}

export async function recordOutcome(
  workspaceId: string,
  outcome: 'success' | 'partial' | 'failed' | 'neutral',
  summary: string,
  checkpointIds: string[] = []
): Promise<void> {
  const daemonUrl = configService.getDaemonUrl();

  try {
    await fetch(`${daemonUrl}/v1/outcomes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspaceId,
        session_id: process.env.SIFTMEMORY_SESSION_ID || 'unknown',
        outcome,
        summary,
        checkpoint_ids: checkpointIds,
      }),
    });
  } catch {
    // Non-fatal
  }
}

// Git helpers
async function gitRepoRoot(cwd: string): Promise<string> {
  const { execSync } = await import('child_process');
  try {
    const root = execSync('git rev-parse --show-toplevel', {
      cwd,
      encoding: 'utf-8',
    }).trim();
    return root || cwd;
  } catch {
    return cwd;
  }
}

async function gitUserEmail(cwd: string): Promise<string | undefined> {
  const { execSync } = await import('child_process');
  try {
    return execSync('git config user.email', {
      cwd,
      encoding: 'utf-8',
    }).trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function getDaemonHealth(): Promise<{ ok: boolean; version?: string; error?: string }> {
  const daemonUrl = configService.getDaemonUrl();
  try {
    const response = await fetch(`${daemonUrl}/v1/health`);
    if (response.ok) {
      const data = await response.json() as { ok: boolean; data?: { version?: string } };
      return { ok: data.ok === true, version: data.data?.version };
    }
    return { ok: false, error: 'Health check failed' };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

export async function buildResumePack(params: {
  workspaceId: string;
  sessionId: string;
  task: string;
  mode?: string;
  tokenBudget?: number;
  includePrivate?: boolean;
  includeCollective?: boolean;
  collectivePolicy?: string;
}): Promise<{ resume_pack_id?: string; context?: string }> {
  const daemonUrl = configService.getDaemonUrl();

  const response = await fetch(`${daemonUrl}/v1/resume/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_id: params.workspaceId,
      session_id: params.sessionId,
      task: params.task,
      mode: params.mode || 'standard',
      token_budget: params.tokenBudget || 4000,
      include_private: params.includePrivate ?? false,
      include_collective: params.includeCollective ?? true,
      collective_policy: params.collectivePolicy || 'validated_only',
    }),
  });

  if (!response.ok) {
    throw new Error(`Resume build failed: ${response.statusText}`);
  }

  return response.json() as Promise<{ resume_pack_id?: string; context?: string }>;
}