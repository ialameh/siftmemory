#!/usr/bin/env node
/**
 * SiftMemory UserPromptSubmit Hook - Inject resume pack on user prompt
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PID_DIR = join(homedir(), '.siftmemory', 'run');
const EVENT_BUF_FILE = join(PID_DIR, 'event-buffer.jsonl');

function logEvent(level, message, attributes = {}) {
  try {
    appendFileSync(join(PID_DIR, 'user-prompt-submit.ndjson'),
      JSON.stringify({ timestamp: new Date().toISOString(), level, name: 'user-prompt-submit', message, attributes }) + '\n');
  } catch { /* never fatal */ }
}

function main() {
  const eventJson = process.env.SIFTMEMORY_USER_PROMPT_EVENT || '{}';
  const sockFile = join(PID_DIR, 'daemon.sock');

  if (!existsSync(sockFile)) {
    process.exit(0);
  }

  try {
    const event = JSON.parse(eventJson);
    // Write event to buffer file for daemon to pick up
    appendFileSync(EVENT_BUF_FILE, JSON.stringify({
      ...event,
      event_type: 'user_prompt_submit',
      timestamp: new Date().toISOString()
    }) + '\n');
  } catch (e) {
    // silently ignore parse errors
  }

  process.exit(0);
}

main();