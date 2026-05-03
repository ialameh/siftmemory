#!/usr/bin/env node
/**
 * SiftMemory Stop Hook - Record session outcome
 */

import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PID_DIR = join(homedir(), '.siftmemory', 'run');
const OUTCOME_FILE = join(PID_DIR, 'session-outcome.json');

function main() {
  const outcome = {
    stoppedAt: new Date().toISOString(),
    cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  };

  try {
    writeFileSync(OUTCOME_FILE, JSON.stringify(outcome, null, 2));
  } catch { /* ignore */ }

  process.exit(0);
}

main();
