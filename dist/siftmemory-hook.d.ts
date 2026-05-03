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
 * Generate a stable client_event_id from session_id + hook_event_name + tool_use_id + event_type
 * This replaces Date.now() based IDs with deterministic ones.
 */
export declare function generateClientEventId(params: {
    sessionId: string;
    hookEventName: string;
    toolUseId?: string;
    eventType: string;
}): string;
//# sourceMappingURL=siftmemory-hook.d.ts.map