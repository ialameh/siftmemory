#!/usr/bin/env node
/**
 * SiftMemory Hook Dispatcher
 * Unified entry point for all Claude Code lifecycle hooks.
 *
 * Usage:
 *   node dist/siftmemory-hook.js <hook-name>
 *
 * Hooks:
 *   session-start, user-prompt-submit, post-tool-use, post-tool-failure,
 *   post-tool-batch, pre-compact, post-compact, stop, stop-failure,
 *   session-end, cwd-changed, subagent-stop
 *
 * Input: Claude hook JSON is read from stdin. Env vars used as fallback.
 */
/**
 * Build an IngestEventRequest compatible object for the daemon.
 * This ensures the correct contract with workspace_id top-level,
 * and sanitizer-specific fields inside payload_json.
 */
export declare function buildIngestEventRequest(params: {
    sanitized: Record<string, unknown>;
    workspaceId: string;
    sessionId: string;
    hookName: string;
    eventType: string;
}): Record<string, unknown>;
//# sourceMappingURL=siftmemory-hook.d.ts.map