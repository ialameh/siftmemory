#!/usr/bin/env node
/**
 * SiftMemory CwdChanged Hook - Update workspace on directory change
 */

import { existsSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PID_DIR = join(homedir(), '.siftmemory', 'run');

function main() {
  const eventJson = process.env.SIFTMEMORY_CWD_EVENT || '{}';
  const sockFile = join(PID_DIR, 'daemon.sock');

  if (!existsSync(sockFile)) {
    process.exit(0);
  }

  try {
    const event = JSON.parse(eventJson);
    appendFileSync(join(PID_DIR, 'cwd-changed.ndjson'),
      JSON.stringify({
        ...event,
        event_type: 'cwd_changed',
        timestamp: new Date().toISOString()
      }) + '\n');
  } catch (e) {
    // silently ignore parse errors
  }

  process.exit(0);
}

main();