/**
 * Duplicate Resume Pack Suppression
 * Prevents injecting the same resume pack twice in a session.
 */

import { pluginStateStore } from './runtime/plugin-state.js';

const DUPLICATE_WINDOW_MS = 60000; // 60 seconds

interface ResumeInjectionRecord {
  workspaceId: string;
  sessionId: string;
  resumePackId: string;
  injectedAtMs: number;
  taskHash: string;
}

export function shouldSuppressPrompt(prompt: string): boolean {
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

export function isPromptSpecific(prompt: string): boolean {
  const codingSignals = [
    'fix', 'implement', 'debug', 'refactor', 'test', 'deploy',
    'compile', 'error', 'class', 'function', 'method', 'api',
    'component', 'lwc', 'apex', 'typescript', 'rust', 'python',
    'salesforce', 'auth', 'database', 'migration', 'architecture',
    'add', 'remove', 'change', 'update', 'create', 'delete',
  ];

  const lower = prompt.toLowerCase();
  return codingSignals.some(signal => lower.includes(signal));
}

export function hashTask(prompt: string): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(prompt.toLowerCase().trim()).digest('hex').slice(0, 16);
}

export async function checkDuplicateResume(
  workspaceId: string,
  prompt: string
): Promise<{ shouldSkip: boolean; resumePackId?: string }> {
  const state = await pluginStateStore.get();
  if (!state) {
    return { shouldSkip: false };
  }

  const sessionId = process.env.SIFTMEMORY_SESSION_ID || 'unknown';
  const now = Date.now();
  const taskHash = hashTask(prompt);

  // Get injection records
  const records: ResumeInjectionRecord[] = state.session.resumeInjections || [];

  // Check for same resume pack injected in this session
  const recentSameSession = records.find(r =>
    r.sessionId === sessionId &&
    now - r.injectedAtMs < DUPLICATE_WINDOW_MS
  );

  if (recentSameSession) {
    return { shouldSkip: true, resumePackId: recentSameSession.resumePackId };
  }

  // If task is generic and we had a pack recently, skip
  if (!isPromptSpecific(prompt)) {
    const recentGeneric = records.find(r =>
      r.workspaceId === workspaceId &&
      r.sessionId === sessionId &&
      now - r.injectedAtMs < DUPLICATE_WINDOW_MS
    );

    if (recentGeneric) {
      return { shouldSkip: true };
    }
  }

  return { shouldSkip: false };
}

export async function recordResumeInjection(
  workspaceId: string,
  resumePackId: string
): Promise<void> {
  const state = await pluginStateStore.get();
  if (!state) {
    return;
  }

  const sessionId = process.env.SIFTMEMORY_SESSION_ID || 'unknown';
  const records: ResumeInjectionRecord[] = state.session.resumeInjections || [];

  records.push({
    workspaceId,
    sessionId,
    resumePackId,
    injectedAtMs: Date.now(),
    taskHash: hashTask(''),
  });

  // Keep only recent records (last 100)
  state.session.resumeInjections = records.slice(-100);

  await pluginStateStore.set(state);
}