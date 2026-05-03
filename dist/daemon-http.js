/**
 * SiftMemory Daemon HTTP Client
 * Properly handles ApiResponse<T> envelope and implements retry with backoff.
 */
import { configService } from './runtime/config.js';
import { isApiSuccess, getApiError, } from './api-types.js';
const DEFAULT_TIMEOUT_MS = 10000;
const RETRY_BACKOFF_MS = [1000, 3000, 10000];
const MAX_RETRIES = 3;
class DaemonClientImpl {
    baseUrl;
    constructor() {
        this.baseUrl = configService.getDaemonUrl();
    }
    async fetch(path, options) {
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
            const envelope = await response.json();
            // If the API returned an error (even with 200 status), propagate it
            if (!envelope.ok || envelope.error) {
                return envelope;
            }
            return envelope;
        }
        catch (error) {
            clearTimeout(timeout);
            // Network error - retry if we have retries left
            if (retries > 0) {
                const backoffIndex = Math.min(MAX_RETRIES - retries, RETRY_BACKOFF_MS.length - 1);
                const delay = RETRY_BACKOFF_MS[backoffIndex];
                await sleep(delay);
                return this.fetch(path, { ...options, retries: retries - 1 });
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
    async health() {
        return this.fetch('/v1/health', { method: 'GET' });
    }
    async initWorkspace(repoRoot, userEmail, createRepoConfig = true) {
        return this.fetch('/v1/workspaces/init', {
            method: 'POST',
            body: JSON.stringify({
                repo_root: repoRoot,
                user_email: userEmail,
                create_repo_config: createRepoConfig,
            }),
        });
    }
    async ingestEvent(event) {
        return this.fetch('/v1/events', {
            method: 'POST',
            body: JSON.stringify(event),
        });
    }
    async ingestEventBatch(workspaceId, events) {
        return this.fetch('/v1/events/batch', {
            method: 'POST',
            body: JSON.stringify({ workspace_id: workspaceId, events }),
        });
    }
    async extractCheckpoint(params) {
        return this.fetch('/v1/checkpoints/extract', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    async buildResume(params) {
        return this.fetch('/v1/resume/build', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    async recordOutcome(params) {
        return this.fetch('/v1/outcomes', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    async collectiveStatus(workspaceId) {
        return this.fetch(`/v1/collective/status?workspace_id=${encodeURIComponent(workspaceId)}`, { method: 'GET' });
    }
    async collectiveConflicts(workspaceId) {
        return this.fetch(`/v1/collective/conflicts?workspace_id=${encodeURIComponent(workspaceId)}`, { method: 'GET' });
    }
    async collectivePromote(workspaceId, checkpointId) {
        return this.fetch('/v1/collective/promote', {
            method: 'POST',
            body: JSON.stringify({ workspace_id: workspaceId, checkpoint_id: checkpointId }),
        });
    }
    async collectiveValidate(workspaceId, checkpointId) {
        return this.fetch('/v1/collective/validate', {
            method: 'POST',
            body: JSON.stringify({ workspace_id: workspaceId, checkpoint_id: checkpointId }),
        });
    }
    async collectiveImport(workspaceId) {
        return this.fetch('/v1/collective/import', {
            method: 'POST',
            body: JSON.stringify({ workspace_id: workspaceId }),
        });
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Standalone fetch wrapper for external consumers (MCP tool handlers)
export async function apiFetch(baseUrl, path, options) {
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
        const envelope = await response.json();
        return envelope;
    }
    catch (error) {
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
const workspaceCache = new Map();
async function gitRepoRoot(cwd) {
    const { execSync } = await import('child_process');
    try {
        const root = execSync('git rev-parse --show-toplevel', {
            cwd,
            encoding: 'utf-8',
        }).trim();
        return root || cwd;
    }
    catch {
        return cwd;
    }
}
async function gitUserEmail(cwd) {
    const { execSync } = await import('child_process');
    try {
        return execSync('git config user.email', {
            cwd,
            encoding: 'utf-8',
        }).trim() || undefined;
    }
    catch {
        return undefined;
    }
}
export async function ensureWorkspace(cwd) {
    if (workspaceCache.has(cwd)) {
        return workspaceCache.get(cwd);
    }
    const repoRoot = await gitRepoRoot(cwd);
    const userEmail = await gitUserEmail(repoRoot);
    const response = await daemonClient.initWorkspace(repoRoot, userEmail);
    if (isApiSuccess(response) && response.data) {
        const workspace = {
            workspace_id: response.data.workspace_id,
            workspace_key: response.data.workspace_key,
        };
        workspaceCache.set(cwd, workspace);
        return workspace;
    }
    return null;
}
export async function recordOutcome(workspaceId, outcome, summary, consumedCheckpointIds = []) {
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
export async function getDaemonHealth() {
    const response = await daemonClient.health();
    if (isApiSuccess(response) && response.data) {
        return { ok: true, version: response.data.version };
    }
    return { ok: false, error: response.error ? getApiError(response) : 'Health check failed' };
}
export async function buildResumePack(params) {
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
//# sourceMappingURL=daemon-http.js.map