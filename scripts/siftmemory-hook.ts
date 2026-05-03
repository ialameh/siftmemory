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

import { parseArgs } from 'util';
import { createHash } from 'crypto';
import { runtimeReadinessService } from './runtime/readiness.js';
import { configService } from './runtime/config.js';
import { daemonHealthClient } from './runtime/daemon-health.js';
import { pluginStateStore } from './runtime/plugin-state.js';
import { ensureWorkspace, recordOutcome as recordSessionOutcome, buildResumePack, daemonClient } from './daemon-http.js';
import { classifyToolEvent, sanitizeToolPayload } from './payload-sanitizer.js';
import { checkDuplicateResume, recordResumeInjection, hashTask, isPromptTrivial } from './duplicate-suppression.js';
import { renderResumePack } from './render-injection.js';
import { bufferEvent, flushEventBuffer } from './event-buffer.js';
import { ReadinessReason } from './types.js';

const HOOK_TIMEOUT_MS = 30000;

interface HookInput {
  hook_event_name?: string;
  session_id?: string;
  workspace_id?: string;
  prompt?: string;
  tool_use_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: unknown;
  error?: string;
  cwd?: string;
  [key: string]: unknown;
}

/**
 * Build an IngestEventRequest compatible object for the daemon.
 * This ensures the correct contract with workspace_id top-level,
 * and sanitizer-specific fields inside payload_json.
 */
export function buildIngestEventRequest(params: {
  sanitized: Record<string, unknown>;
  workspaceId: string;
  sessionId: string;
  hookName: string;
  eventType: string;
}): Record<string, unknown> {
  const {
    sanitized,
    workspaceId,
    sessionId,
    hookName,
    eventType,
  } = params;

  // Extract tool name from sanitized or default
  const tool = sanitized.tool_name as string | undefined
    || sanitized.tool as string | undefined
    || '';

  // Extract file_path if present
  const file_path = sanitized.file_path as string | undefined;

  // Build payload_json from sanitizer-specific fields only
  const payload_json: Record<string, unknown> = {};
  // Only true top-level IngestEventRequest fields should be excluded from payload_json.
  // Hash fields (old_string_hash, new_string_hash, command_hash, output_hash, pattern_hash),
  // content_hash, match_count, etc. all belong INSIDE payload_json.
  const topLevelExcludes = [
    'workspace_id', 'session_id', 'client_event_id', 'timestamp',
    'event_type', 'actor', 'tool', 'tool_name', 'file_path',
    'symbol_refs', 'privacy_level', 'tool_use_id',
  ];

  for (const [key, value] of Object.entries(sanitized)) {
    if (!topLevelExcludes.includes(key)) {
      payload_json[key] = value;
    }
  }

  // Generate stable client_event_id if not already present
  let client_event_id = sanitized.client_event_id as string | undefined;
  if (!client_event_id) {
    const idInput = [sessionId, hookName, (sanitized.tool_use_id as string) || '', eventType].join('|');
    client_event_id = createHash('sha256').update(idInput).digest('hex').slice(0, 16);
  }

  return {
    workspace_id: workspaceId,
    session_id: sessionId,
    actor: 'Tool',
    event_type: eventType,
    tool,
    file_path: file_path || null,
    symbol_refs: [],
    payload_json,
    privacy_level: 'Private',
    client_event_id: client_event_id,
  };
}

/**
 * Read and parse hook input from stdin.
 * Claude Code sends JSON via stdin for most hooks.
 * Falls back to env vars if stdin is empty or parsing fails.
 */
async function readHookInput(): Promise<HookInput> {
  return new Promise((resolve) => {
    let data = '';

    // Check if stdin has data
    if (process.stdin.isTTY) {
      // No stdin data available - use env vars as fallback
      resolve(readFromEnvVars());
      return;
    }

    process.stdin.setEncoding('utf8');

    let stdinResolved = false;
    const timeout = setTimeout(() => {
      if (!stdinResolved) {
        stdinResolved = true;
        resolve(readFromEnvVars());
      }
    }, 100);

    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      if (stdinResolved) return;
      stdinResolved = true;
      clearTimeout(timeout);

      if (data.trim()) {
        try {
          const parsed = JSON.parse(data.trim());
          stdinResolved = true;
          resolve(parsed);
        } catch {
          stdinResolved = true;
          resolve(readFromEnvVars());
        }
      } else {
        resolve(readFromEnvVars());
      }
    });

    process.stdin.on('error', () => {
      if (stdinResolved) return;
      stdinResolved = true;
      clearTimeout(timeout);
      resolve(readFromEnvVars());
    });
  });
}

function safeJsonParse(text: string, fallback: unknown = undefined): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function readFromEnvVars(): HookInput {
  const toolEvent = safeJsonParse(process.env.SIFTMEMORY_TOOL_EVENT || '{}', {});
  const userPromptEvent = safeJsonParse(process.env.SIFTMEMORY_USER_PROMPT_EVENT || '{}', {});

  return {
    hook_event_name: process.env.SIFTMEMORY_HOOK_EVENT_NAME || '',
    session_id: process.env.SIFTMEMORY_SESSION_ID || 'unknown',
    workspace_id: process.env.SIFTMEMORY_WORKSPACE_ID,
    prompt: typeof userPromptEvent === 'object' && userPromptEvent !== null
      ? (userPromptEvent as Record<string, unknown>).prompt as string
      : undefined,
    tool_use_id: typeof toolEvent === 'object' && toolEvent !== null
      ? (toolEvent as Record<string, unknown>).tool_use_id as string
      : undefined,
    tool_name: typeof toolEvent === 'object' && toolEvent !== null
      ? (toolEvent as Record<string, unknown>).tool_name as string
      : undefined,
    tool_input: typeof toolEvent === 'object' && toolEvent !== null
      ? (toolEvent as Record<string, unknown>).input as Record<string, unknown>
      : undefined,
    tool_output: typeof toolEvent === 'object' && toolEvent !== null
      ? (toolEvent as Record<string, unknown>).output
      : undefined,
    cwd: process.cwd(),
  };
}

async function runHook(hookName: string, args: Record<string, string>): Promise<void> {
  const reason = `${hookName}_hook` as ReadinessReason;
  const input = await readHookInput();
  const sessionId = input.session_id || process.env.SIFTMEMORY_SESSION_ID || 'unknown';

  // SessionStart: spawn daemon and check readiness
  if (hookName === 'session-start') {
    const readiness = await runtimeReadinessService.ensureReady('session_start');
    if (readiness.ready) {
      await daemonHealthClient.check(configService.getDaemonUrl(), true);
    }
    process.exit(0);
  }

  // UserPromptSubmit: inject resume pack
  if (hookName === 'user-prompt-submit') {
    const readiness = await runtimeReadinessService.ensureReady('user_prompt_submit');
    if (!readiness.ready) {
      process.exit(0);
    }

    const workspace = await ensureWorkspace(process.cwd());
    if (!workspace) {
      process.exit(0);
    }

    const prompt = input.prompt || '';

    // Skip trivial prompts
    if (isPromptTrivial(prompt)) {
      process.exit(0);
    }

    const taskHash = hashTask(prompt);
    try {
      const result = await buildResumePack({
        workspaceId: workspace.workspace_id,
        sessionId: sessionId,
        task: prompt,
        mode: 'standard',
        tokenBudget: 4096,
        includePrivate: false,
        includeCollective: true,
        collectivePolicy: 'validated_only',
      });

      if (result.resume_pack_id) {
        // Check duplicate - now requires resumePackId to check against
        const dupCheck = await checkDuplicateResume(workspace.workspace_id, prompt, result.resume_pack_id);
        if (dupCheck.shouldSkip) {
          process.exit(0);
        }

        const rendered = renderResumePack({
          resume_pack_id: result.resume_pack_id,
          context: result.rendered_markdown,
        });
        process.stdout.write(rendered);
        await recordResumeInjection(workspace.workspace_id, result.resume_pack_id, taskHash);
      }
    } catch {
      // Fail open - don't block Claude
    }
    process.exit(0);
  }

  // PostToolUse: capture sanitized event
  if (hookName === 'post-tool-use') {
    const readiness = await runtimeReadinessService.ensureReady('post_tool_use');
    if (!readiness.ready) {
      process.exit(0);
    }

    const workspace = await ensureWorkspace(process.cwd());
    if (!workspace) {
      process.exit(0);
    }

    try {
      const eventType = classifyToolEvent({ tool_name: input.tool_name, tool_input: input.tool_input });
      const sanitized = sanitizeToolPayload(
        { tool_name: input.tool_name, tool_input: input.tool_input, tool_output: input.tool_output, hook_event_name: hookName },
        eventType
      );

      const ingestRequest = buildIngestEventRequest({
        sanitized,
        workspaceId: workspace.workspace_id,
        sessionId: sessionId,
        hookName: hookName,
        eventType: eventType,
      });

      await bufferEvent(ingestRequest);
    } catch {
      // Fail silently
    }
    process.exit(0);
  }

  // PostToolFailure: capture failure event
  if (hookName === 'post-tool-failure') {
    const readiness = await runtimeReadinessService.ensureReady('post_tool_failure');
    if (!readiness.ready) {
      process.exit(0);
    }

    const workspace = await ensureWorkspace(process.cwd());
    if (!workspace) {
      process.exit(0);
    }

    try {
      // Map tool_failure to ManualNote per contract
      const eventType = 'ManualNote';
      const sanitized = sanitizeToolPayload(
        { tool_name: input.tool_name, tool_input: input.tool_input, hook_event_name: hookName },
        eventType
      );

      // For failures, add error info to a copy
      const sanitizedWithError = {
        ...sanitized,
        error: input.error,
      };

      const ingestRequest = buildIngestEventRequest({
        sanitized: sanitizedWithError,
        workspaceId: workspace.workspace_id,
        sessionId: sessionId,
        hookName: hookName,
        eventType: eventType,
      });

      await bufferEvent(ingestRequest);
    } catch {
      // Fail silently
    }
    process.exit(0);
  }

  // PostToolBatch: flush buffered events
  if (hookName === 'post-tool-batch') {
    const readiness = await runtimeReadinessService.ensureReady('post_tool_batch');
    if (!readiness.ready) {
      process.exit(0);
    }
    await flushEventBuffer();
    process.exit(0);
  }

  // PreCompact: inject resume pack before compaction
  if (hookName === 'pre-compact') {
    const readiness = await runtimeReadinessService.ensureReady('pre_compact');
    if (!readiness.ready) {
      process.exit(0);
    }

    const workspace = await ensureWorkspace(process.cwd());
    if (!workspace) {
      process.exit(0);
    }

    try {
      // Try checkpoint extraction first
      await daemonClient.extractCheckpoint({
        workspace_id: workspace.workspace_id,
        session_id: sessionId,
      }).catch(() => {});

      // Then build resume pack using canonical client
      const response = await daemonClient.buildResume({
        workspace_id: workspace.workspace_id,
        session_id: sessionId,
        task: 'Pre-compaction reasoning preservation',
        mode: 'minimal',
        token_budget: 2000,
        include_collective: true,
        include_private: false,
        collective_policy: 'validated_only',
      });

      if (response.ok && response.data) {
        const rendered = renderResumePack({
          resume_pack_id: response.data.resume_pack_id,
          context: response.data.rendered_markdown,
        });
        process.stdout.write(rendered);
      }
    } catch {
      // Fail open
    }
    process.exit(0);
  }

  // Stop: record session outcome
  if (hookName === 'stop') {
    const readiness = await runtimeReadinessService.ensureReady('stop');
    if (!readiness.ready) {
      process.exit(0);
    }

    const workspace = await ensureWorkspace(process.cwd());
    if (!workspace) {
      process.exit(0);
    }

    await flushEventBuffer();
    await recordSessionOutcome(workspace.workspace_id, 'neutral', '');
    process.exit(0);
  }

  // StopFailure: record failed outcome
  if (hookName === 'stop-failure') {
    const readiness = await runtimeReadinessService.ensureReady('stop_failure');
    if (!readiness.ready) {
      process.exit(0);
    }

    const workspace = await ensureWorkspace(process.cwd());
    if (!workspace) {
      process.exit(0);
    }

    await flushEventBuffer();
    await recordSessionOutcome(workspace.workspace_id, 'failed', '');
    process.exit(0);
  }

  // CwdChanged: update workspace mapping
  if (hookName === 'cwd-changed') {
    const readiness = await runtimeReadinessService.ensureReady('cwd_changed');
    if (!readiness.ready) {
      process.exit(0);
    }

    const newCwd = input.cwd || args.cwd || process.cwd();
    const workspace = await ensureWorkspace(newCwd);
    if (!workspace) {
      process.exit(0);
    }

    const state = await pluginStateStore.get();
    if (state) {
      state.session.workspaceId = workspace.workspace_id;
      await pluginStateStore.set(state);
    }
    process.exit(0);
  }

  // SessionEnd: record outcome and flush events
  if (hookName === 'session-end') {
    const readiness = await runtimeReadinessService.ensureReady('session_end');
    if (!readiness.ready) {
      process.exit(0);
    }

    const workspace = await ensureWorkspace(process.cwd());
    if (workspace) {
      await flushEventBuffer();
      await recordSessionOutcome(workspace.workspace_id, 'neutral', '');
    }
    process.exit(0);
  }

  // SubagentStop: record subagent outcome
  if (hookName === 'subagent-stop') {
    const readiness = await runtimeReadinessService.ensureReady('subagent_stop');
    if (!readiness.ready) {
      process.exit(0);
    }

    const workspace = await ensureWorkspace(process.cwd());
    if (!workspace) {
      process.exit(0);
    }

    await recordSessionOutcome(workspace.workspace_id, 'neutral', 'subagent_stop');
    process.exit(0);
  }

  // Other hooks - fail open
  process.exit(0);
}

// Main entry point
const { positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {},
  allowPositionals: true,
});

const hookName = positionals[0] || 'unknown';
const timeout = setTimeout(() => {
  console.error(`Hook ${hookName} timed out`);
  process.exit(0);
}, HOOK_TIMEOUT_MS);

runHook(hookName, {})
  .finally(() => clearTimeout(timeout))
  .catch((err) => {
    console.error(`Hook ${hookName} error:`, err.message);
    process.exit(0);
  });
