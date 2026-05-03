#!/usr/bin/env node
/**
 * SiftMemory SessionEnd Hook - Final cleanup and outcome recording
 */

import { existsSync, appendFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PID_DIR = join(homedir(), '.siftmemory', 'run');
const EVENT_BUF_FILE = join(PID_DIR, 'event-buffer.jsonl');

function main() {
  const eventJson = process.env.SIFTMEMORY_SESSION_EVENT || '{}';
  const sockFile = join(PID_DIR, 'daemon.sock');

  if (!existsSync(sockFile)) {
    process.exit(0);
  }

  try {
    const event = JSON.parse(eventJson);
    appendFileSync(EVENT_BUF_FILE, JSON.stringify({
      ...event,
      event_type: 'session_end',
      timestamp: new Date().toISOString()
    }) + '\n');
  } catch (e) {
    // silently ignore parse errors
  }

  process.exit(0);
}

main();