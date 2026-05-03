#!/usr/bin/env node
/**
 * SiftMemory PreCompact Hook - Inject resume pack before compaction
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PID_DIR = join(homedir(), '.siftmemory', 'run');
const RESUME_FILE = join(PID_DIR, 'resume-pack.json');

function main() {
  const sockFile = join(PID_DIR, 'daemon.sock');

  if (!existsSync(sockFile)) {
    process.exit(0);
  }

  // Daemon-side injection happens via the socket connection
  // This hook signals the daemon to prepare the resume pack
  process.exit(0);
}

main();
