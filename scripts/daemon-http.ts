/**
 * SiftMemory Daemon HTTP Client
 * Properly handles ApiResponse<T> envelope and implements retry with backoff.
 */

import { configService } from './runtime/config.js';
import {
  ApiResponse,
  isApiSuccess,
  getApiError,
  HealthData,
  InitWorkspaceResponse,
  EventResponse,
  BatchEventResponse,
  ExtractCheckpointResponse,
  BuildResumeResponse,
  RecordOutcomeResponse,
} from './api-types.js';

const DEFAULT_TIMEOUT_MS = 10000;
const RETRY_BACKOFF_MS = [1000, 3000, 10000];
const MAX_RETRIES = 3;

export interface DaemonClient {
  health(): Promise<ApiResponse<HealthData>>;
  initWorkspace(repoRoot: string, userEmail?: string): Promise<ApiResponse<InitWorkspaceResponse>>;
  ingestEvent(event: Record<string, unknown>): Promise<ApiResponse<EventResponse>>;
  ingestEventBatch(workspaceId: string, events: Record<string, unknown>[]): Promise<ApiResponse<BatchEventResponse>>;
  extractCheckpoint(params: Record<string, unknown>): Promise<ApiResponse<ExtractCheckpointResponse>>;
  buildResume(params: Record<string, unknown>): Promise<ApiResponse<BuildResumeResponse>>;
  recordOutcome(params: Record<string, unknown>): Promise<ApiResponse<RecordOutcomeResponse>>;
}

class DaemonClientImpl implements DaemonClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = configService.getDaemonUrl();
  }

  private async fetch<T>(
    path: string,
    options?: RequestInit & { timeoutMs?: number; retries?: number }
  ): Promise<ApiResponse<T>> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retries = options?.retries ?? 0;
    const fetchHeaders = options?.headers;
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const { timeoutMs: _, retries: __, headers: ___, ...rest } = options || {};
      const response = await fetch(url, {
        ...rest,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(fetchHeaders || {}),
        },
      });

      clearTimeout(timeout);

      // Parse the ApiResponse envelope
      const envelope = await response.json() as ApiResponse<T>;

      // If the API returned an error (even with 200 status), propagate it
      if (!envelope.ok || envelope.error) {
        return envelope;
      }

      return envelope;
    } catch (error) {
      clearTimeout(timeout);

      // Network error - retry if we have retries left
      if (retries > 0) {
        const backoffIndex = Math.min(MAX_RETRIES - retries, RETRY_BACKOFF_MS.length - 1);
        const delay = RETRY_BACKOFF_MS[backoffIndex];
        await sleep(delay);
        return this.fetch<T>(path, { ...options, retries: retries - 1 });
      }

      return {
        ok: false,
        data: null,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
        },
      };
    }
  }

  async health(): Promise<ApiResponse<HealthData>> {
    return this.fetch<HealthData>('/v1/health', { method: 'GET' });
  }

  async initWorkspace(
    repoRoot: string,
    userEmail?: string,
    createRepoConfig = true
  ): Promise<ApiResponse<InitWorkspaceResponse>> {
    return this.fetch<InitWorkspaceResponse>('/v1/workspaces/init', {
      method: 'POST',
      body: JSON.stringify({
        repo_root: repoRoot,
        user_email: userEmail,
        create_repo_config: createRepoConfig,
      }),
    });
  }

  async ingestEvent(event: Record<string, unknown>): Promise<ApiResponse<EventResponse>> {
    return this.fetch<EventResponse>('/v1/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async ingestEventBatch(
    workspaceId: string,
    events: Record<string, unknown>[]
  ): Promise<ApiResponse<BatchEventResponse>> {
    return this.fetch<BatchEventResponse>('/v1/events/batch', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: workspaceId, events }),
    });
  }

  async extractCheckpoint(
    params: Record<string, unknown>
  ): Promise<ApiResponse<ExtractCheckpointResponse>> {
    return this.fetch<ExtractCheckpointResponse>('/v1/checkpoints/extract', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async buildResume(params: Record<string, unknown>): Promise<ApiResponse<BuildResumeResponse>> {
    return this.fetch<BuildResumeResponse>('/v1/resume/build', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async recordOutcome(params: Record<string, unknown>): Promise<ApiResponse<RecordOutcomeResponse>> {
    return this.fetch<RecordOutcomeResponse>('/v1/outcomes', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Standalone fetch wrapper for external consumers (MCP tool handlers)
export async function apiFetch<T>(
  baseUrl: string,
  path: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<ApiResponse<T>> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchHeaders = options?.headers;
  const url = `${baseUrl}${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { timeoutMs: _, headers: __, ...rest } = options || {};
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(fetchHeaders || {}),
      },
    });

    clearTimeout(timeout);

    const envelope = await response.json() as ApiResponse<T>;
    return envelope;
  } catch (error) {
    clearTimeout(timeout);
    return {
      ok: false,
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    };
  }
}

export const daemonClient = new DaemonClientImpl();

// Re-export envelope utilities for external consumers
export { isApiSuccess, getApiError };

// Workspace helpers with caching
export interface WorkspaceInfo {
  workspace_id: string;
  workspace_key: string;
}

const workspaceCache = new Map<string, WorkspaceInfo>();

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

export async function ensureWorkspace(cwd: string): Promise<WorkspaceInfo | null> {
  if (workspaceCache.has(cwd)) {
    return workspaceCache.get(cwd)!;
  }

  const repoRoot = await gitRepoRoot(cwd);
  const userEmail = await gitUserEmail(repoRoot);

  const response = await daemonClient.initWorkspace(repoRoot, userEmail);

  if (isApiSuccess(response) && response.data) {
    const workspace: WorkspaceInfo = {
      workspace_id: response.data.workspace_id,
      workspace_key: response.data.workspace_key,
    };
    workspaceCache.set(cwd, workspace);
    return workspace;
  }

  return null;
}

export async function recordOutcome(
  workspaceId: string,
  outcome: 'success' | 'partial' | 'failed' | 'neutral',
  summary: string,
  consumedCheckpointIds: string[] = []
): Promise<void> {
  await daemonClient.recordOutcome({
    workspace_id: workspaceId,
    session_id: process.env.SIFTMEMORY_SESSION_ID || 'unknown',
    consumed_checkpoint_ids: consumedCheckpointIds,
    files_changed: [],
    tests_run: [],
    user_accepted_patch: outcome === 'success' ? true : null,
    user_rejected_patch: outcome === 'failed' ? true : null,
    user_corrections: null,
    new_claims: null,
    invalidated_claim_ids: [],
  });
}

export async function getDaemonHealth(): Promise<{ ok: boolean; version?: string; error?: string }> {
  const response = await daemonClient.health();

  if (isApiSuccess(response) && response.data) {
    return { ok: true, version: response.data.version };
  }

  return { ok: false, error: response.error ? getApiError(response) : 'Health check failed' };
}

export async function buildResumePack(params: {
  workspaceId: string;
  sessionId: string;
  task: string;
  mode?: 'standard' | 'focused' | 'broad';
  tokenBudget?: number;
  includePrivate?: boolean;
  includeCollective?: boolean;
  collectivePolicy?: string;
}): Promise<{ resume_pack_id?: string; rendered_markdown?: string; warnings?: string[] }> {
  const response = await daemonClient.buildResume({
    workspace_id: params.workspaceId,
    session_id: params.sessionId,
    task: params.task,
    mode: params.mode || 'standard',
    token_budget: params.tokenBudget || 4096,
    include_private: params.includePrivate ?? false,
    include_collective: params.includeCollective ?? true,
    collective_policy: params.collectivePolicy,
  });

  if (isApiSuccess(response) && response.data) {
    return {
      resume_pack_id: response.data.resume_pack_id,
      rendered_markdown: response.data.rendered_markdown,
      warnings: response.data.warnings,
    };
  }

  throw new Error(response.error ? getApiError(response) : 'Resume build failed');
}
