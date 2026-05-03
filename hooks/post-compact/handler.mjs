#!/usr/bin/env node
/**
 * SiftMemory PostCompact Hook - Handle post-compaction events
 */

import { existsSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PID_DIR = join(homedir(), '.siftmemory', 'run');

function main() {
  const eventJson = process.env.SIFTMEMORY_COMPACT_EVENT || '{}';
  const sockFile = join(PID_DIR, 'daemon.sock');

  if (!existsSync(sockFile)) {
    process.exit(0);
  }

  try {
    const event = JSON.parse(eventJson);
    appendFileSync(join(PID_DIR, 'post-compact.ndjson'),
      JSON.stringify({
        ...event,
        event_type: 'post_compact',
        timestamp: new Date().toISOString()
      }) + '\n');
  } catch (e) {
    // silently ignore parse errors
  }

  process.exit(0);
}

main();