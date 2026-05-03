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
import { ensureWorkspace } from './daemon-client.js';
import { classifyToolEvent, sanitizeToolPayload } from './payload-sanitizer.js';
import { checkDuplicateResume, recordResumeInjection, hashTask, isPromptTrivial } from './duplicate-suppression.js';
import { renderResumePack } from './render-injection.js';
import { bufferEvent, flushEventBuffer } from './event-buffer.js';
import { recordOutcome } from './daemon-client.js';
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
 * Generate a stable client_event_id from session_id + hook_event_name + tool_use_id + event_type
 * This replaces Date.now() based IDs with deterministic ones.
 */
export function generateClientEventId(params: {
  sessionId: string;
  hookEventName: string;
  toolUseId?: string;
  eventType: string;
}): string {
  const input = [
    params.sessionId,
    params.hookEventName,
    params.toolUseId || '',
    params.eventType,
  ].join('|');

  return createHash('sha256').update(input).digest('hex').slice(0, 16);
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

function readFromEnvVars(): HookInput {
  return {
    hook_event_name: process.env.SIFTMEMORY_HOOK_EVENT_NAME || '',
    session_id: process.env.SIFTMEMORY_SESSION_ID || 'unknown',
    workspace_id: process.env.SIFTMEMORY_WORKSPACE_ID,
    prompt: process.env.SIFTMEMORY_USER_PROMPT_EVENT ? JSON.parse(process.env.SIFTMEMORY_USER_PROMPT_EVENT).prompt : undefined,
    tool_use_id: process.env.SIFTMEMORY_TOOL_EVENT ? JSON.parse(process.env.SIFTMEMORY_TOOL_EVENT).tool_use_id : undefined,
    tool_name: process.env.SIFTMEMORY_TOOL_EVENT ? JSON.parse(process.env.SIFTMEMORY_TOOL_EVENT).tool_name : undefined,
    tool_input: process.env.SIFTMEMORY_TOOL_EVENT ? JSON.parse(process.env.SIFTMEMORY_TOOL_EVENT).input : undefined,
    tool_output: process.env.SIFTMEMORY_TOOL_EVENT ? JSON.parse(process.env.SIFTMEMORY_TOOL_EVENT).output : undefined,
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

    // Build resume pack
    const daemonUrl = configService.getDaemonUrl();
    const taskHash = hashTask(prompt);
    try {
      const response = await fetch(`${daemonUrl}/v1/resume/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.workspace_id,
          session_id: sessionId,
          task: prompt,
          mode: 'standard',
          token_budget: 4000,
          include_collective: true,
          include_private: false,
          collective_policy: 'validated_only',
        }),
      });

      if (response.ok) {
        const data = await response.json() as { resume_pack_id?: string; context?: string; checkpoints?: unknown[]; claims?: unknown[] };
        const clientEventId = generateClientEventId({
          sessionId,
          hookEventName: hookName,
          eventType: 'resume_inject',
        });

        // Check duplicate - now requires resumePackId to check against
        const dupCheck = await checkDuplicateResume(workspace.workspace_id, prompt, data.resume_pack_id || 'unknown');
        if (dupCheck.shouldSkip) {
          process.exit(0);
        }

        const rendered = renderResumePack(data);
        process.stdout.write(rendered);
        await recordResumeInjection(workspace.workspace_id, data.resume_pack_id || 'unknown', taskHash);
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

      sanitized.workspace_id = workspace.workspace_id;
      (sanitized as Record<string, unknown>).session_id = sessionId;
      (sanitized as Record<string, unknown>).tool_use_id = input.tool_use_id;

      await bufferEvent(sanitized);
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
      const eventType = 'tool_failure';
      const sanitized = sanitizeToolPayload(
        { tool_name: input.tool_name, tool_input: input.tool_input, hook_event_name: hookName },
        eventType
      );

      sanitized.workspace_id = workspace.workspace_id;
      (sanitized as Record<string, unknown>).session_id = sessionId;
      (sanitized as Record<string, unknown>).tool_use_id = input.tool_use_id;
      (sanitized as Record<string, unknown>).error = input.error;

      await bufferEvent(sanitized);
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

    const daemonUrl = configService.getDaemonUrl();
    try {
      // Try checkpoint extraction first
      await fetch(`${daemonUrl}/v1/checkpoints/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.workspace_id,
          session_id: sessionId,
        }),
      }).catch(() => {});

      // Then build resume pack
      const response = await fetch(`${daemonUrl}/v1/resume/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.workspace_id,
          session_id: sessionId,
          mode: 'compact',
          token_budget: 2000,
          include_collective: true,
          include_private: false,
          collective_policy: 'validated_only',
        }),
      });

      if (response.ok) {
        const data = await response.json() as { resume_pack_id?: string; context?: string; checkpoints?: unknown[]; claims?: unknown[] };
        const rendered = renderResumePack(data);
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
    await recordOutcome(workspace.workspace_id, 'neutral', '');
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
    await recordOutcome(workspace.workspace_id, 'failed', '');
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
      await recordOutcome(workspace.workspace_id, 'neutral', '');
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

    await recordOutcome(workspace.workspace_id, 'neutral', 'subagent_stop');
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
