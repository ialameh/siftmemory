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
 */

import { parseArgs } from 'util';
import { runtimeReadinessService } from './runtime/readiness.js';
import { configService } from './runtime/config.js';
import { daemonHealthClient } from './runtime/daemon-health.js';
import { pluginStateStore } from './runtime/plugin-state.js';
import { ensureWorkspace } from './daemon-client.js';
import { classifyToolEvent, sanitizeToolPayload } from './payload-sanitizer.js';
import { shouldSuppressPrompt, checkDuplicateResume, recordResumeInjection } from './duplicate-suppression.js';
import { renderResumePack } from './render-injection.js';
import { bufferEvent, flushEventBuffer } from './event-buffer.js';
import { recordOutcome } from './daemon-client.js';
import { ReadinessReason } from './types.js';

const HOOK_TIMEOUT_MS = 30000;

async function runHook(hookName: string, args: Record<string, string>): Promise<void> {
  const reason = `${hookName}_hook` as ReadinessReason;

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

    // Read prompt from environment
    const promptEvent = process.env.SIFTMEMORY_USER_PROMPT_EVENT || '{}';
    let prompt = '';
    try {
      const event = JSON.parse(promptEvent);
      prompt = event.prompt || '';
    } catch {
      process.exit(0);
    }

    // Check if we should suppress
    if (shouldSuppressPrompt(prompt)) {
      process.exit(0);
    }

    // Check duplicate resume injection
    const dupCheck = await checkDuplicateResume(workspace.workspace_id, prompt);
    if (dupCheck.shouldSkip) {
      process.exit(0);
    }

    // Build resume pack
    const daemonUrl = configService.getDaemonUrl();
    try {
      const response = await fetch(`${daemonUrl}/v1/resume/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.workspace_id,
          session_id: process.env.SIFTMEMORY_SESSION_ID || 'unknown',
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
        const rendered = renderResumePack(data);
        // Output to stdout for Claude to pick up
        process.stdout.write(rendered);
        await recordResumeInjection(workspace.workspace_id, data.resume_pack_id || 'unknown');
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

    const toolEvent = process.env.SIFTMEMORY_TOOL_EVENT || '{}';
    try {
      const event = JSON.parse(toolEvent);
      const eventType = classifyToolEvent(event);
      const sanitized = sanitizeToolPayload(event, eventType);
      sanitized.workspace_id = workspace.workspace_id;
      sanitized.event_type = eventType;
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
          session_id: process.env.SIFTMEMORY_SESSION_ID || 'unknown',
        }),
      }).catch(() => {});

      // Then build resume pack
      const response = await fetch(`${daemonUrl}/v1/resume/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.workspace_id,
          session_id: process.env.SIFTMEMORY_SESSION_ID || 'unknown',
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

    const newCwd = args.cwd || process.cwd();
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