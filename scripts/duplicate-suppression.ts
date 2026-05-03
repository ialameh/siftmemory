/**
 * Duplicate Resume Pack Suppression
 * Prevents injecting the same resume pack twice in a session.
 * Uses stable task hash to track actual prompt content.
 */

import { createHash } from 'crypto';
import { pluginStateStore } from './runtime/plugin-state.js';

const DUPLICATE_WINDOW_MS = 60000; // 60 seconds - but we track by resume_pack_id, not time

export function hashTask(prompt: string): string {
  return createHash('sha256').update(prompt.toLowerCase().trim()).digest('hex').slice(0, 16);
}

export function isPromptTrivial(prompt: string): boolean {
  const normalized = prompt.toLowerCase().trim();

  // Skip trivial prompts
  const trivial = [
    'thanks', 'thank you', 'ok', 'yes', 'no',
    'continue', 'go on', 'please', 'sure',
  ];

  if (trivial.includes(normalized)) {
    return true;
  }

  // Skip very short prompts without coding signals
  if (normalized.length < 10) {
    return true;
  }

  return false;
}

export async function checkDuplicateResume(
  workspaceId: string,
  prompt: string,
  resumePackId: string
): Promise<{ shouldSkip: boolean; resumePackId?: string }> {
  const state = await pluginStateStore.get();
  if (!state) {
    return { shouldSkip: false };
  }

  const sessionId = process.env.SIFTMEMORY_SESSION_ID || 'unknown';
  const taskHash = hashTask(prompt);

  // Get injection records
  const records = state.session.resumeInjections || [];

  // NEVER inject the same resume_pack_id twice in this session
  const samePackInSession = records.find(r =>
    r.sessionId === sessionId &&
    r.resumePackId === resumePackId
  );

  if (samePackInSession) {
    return { shouldSkip: true, resumePackId };
  }

  return { shouldSkip: false };
}

export async function recordResumeInjection(
  workspaceId: string,
  resumePackId: string,
  taskHash: string
): Promise<void> {
  const state = await pluginStateStore.get();
  if (!state) {
    return;
  }

  const sessionId = process.env.SIFTMEMORY_SESSION_ID || 'unknown';
  const records = state.session.resumeInjections || [];

  records.push({
    workspaceId,
    sessionId,
    resumePackId,
    injectedAtMs: Date.now(),
    taskHash,
  });

  // Keep only recent records (last 100)
  state.session.resumeInjections = records.slice(-100);

  await pluginStateStore.set(state);
}

export function extractPromptFromHookInput(input: { prompt?: string }): string {
  return input?.prompt || '';
}
