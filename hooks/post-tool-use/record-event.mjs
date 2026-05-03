#!/usr/bin/env node
/**
 * SiftMemory PostToolUse Hook - Record tool events to daemon
 */

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PID_DIR = join(homedir(), '.siftmemory', 'run');
const EVENT_BUF_FILE = join(PID_DIR, 'event-buffer.jsonl');

function main() {
  const eventJson = process.env.SIFTMEMORY_TOOL_EVENT || '{}';

  try {
    const event = JSON.parse(eventJson);
    // Write event to buffer file for daemon to pick up
    writeFileSync(EVENT_BUF_FILE, JSON.stringify(event) + '\n', { flag: 'a' });
  } catch (e) {
    // silently ignore parse errors
  }

  process.exit(0);
}

main();
