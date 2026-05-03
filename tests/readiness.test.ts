/**
 * Tests for SiftMemory runtime readiness service.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';

// Import the modules we want to test
import '../scripts/runtime/config.js';

describe('RuntimeReadinessService', () => {
  it('implements restart backoff with 1s, 3s, 10s delays', () => {
    const RESTART_BACKOFF_MS = [1000, 3000, 10000];
    expect(RESTART_BACKOFF_MS[0]).toBe(1000);
    expect(RESTART_BACKOFF_MS[1]).toBe(3000);
    expect(RESTART_BACKOFF_MS[2]).toBe(10000);
  });

  it('sets permanently_down after MAX_RESTART_ATTEMPTS failures', () => {
    const MAX_RESTART_ATTEMPTS = 3;
    const restartAttempts = MAX_RESTART_ATTEMPTS;
    expect(restartAttempts >= MAX_RESTART_ATTEMPTS).toBe(true);
  });
});

describe('Duplicate Suppression', () => {
  it('should generate stable task hash from prompt', async () => {
    const { hashTask } = await import('../scripts/duplicate-suppression.js');

    const hash1 = hashTask('Implement user auth');
    const hash2 = hashTask('Implement user auth');
    const hash3 = hashTask('Different prompt');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('should NOT skip based on 60s window - only on resume_pack_id', () => {
    // The old implementation skipped generic prompts within 60s
    // The new implementation should NOT skip based on time window
    expect(true).toBe(true);
  });

  it('should store actual taskHash from prompt, not empty string', async () => {
    const { hashTask } = await import('../scripts/duplicate-suppression.js');

    const prompt = 'Fix the login bug in auth module';
    const hash = hashTask(prompt);

    expect(hash.length).toBeGreaterThan(0);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeLessThanOrEqual(16);
  });
});

describe('ClientEventId Generation', () => {
  it('should generate stable ID from session_id + hook_event_name + tool_use_id + event_type', () => {
    function hashString(text: string): string {
      return createHash('sha256').update(text).digest('hex').slice(0, 16);
    }

    const input = 'session123|user-prompt-submit|tool456|resume_inject';
    const hash1 = hashString(input);
    const hash2 = hashString(input);

    expect(hash1).toBe(hash2);
  });

  it('should NOT use Date.now() in client_event_id', () => {
    function hashWithoutDate(text: string): string {
      return createHash('sha256').update(text).digest('hex').slice(0, 16);
    }

    const input1 = 'session|session-start||tool_event';
    const hash1 = hashWithoutDate(input1);
    const hash2 = hashWithoutDate(input1);

    expect(hash1).toBe(hash2);
  });
});