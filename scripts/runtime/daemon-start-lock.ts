import { writeFileSync, existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

const LOCK_TTL_MS = 10000;
const LOCK_FILE = resolve(tmpdir(), 'siftmemory-daemon-start.lock');

export class DaemonStartLock {
  private lockAcquiredAt: number | null = null;

  acquire(): boolean {
    if (this.isLocked()) {
      if (this.isExpired()) {
        this.release();
      } else {
        return false;
      }
    }

    try {
      writeFileSync(LOCK_FILE, `${Date.now()}`);
      this.lockAcquiredAt = Date.now();
      return true;
    } catch {
      return false;
    }
  }

  release(): void {
    this.lockAcquiredAt = null;
    try {
      if (existsSync(LOCK_FILE)) {
        unlinkSync(LOCK_FILE);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  isLocked(): boolean {
    if (!existsSync(LOCK_FILE)) {
      return false;
    }
    return !this.isExpired();
  }

  private isExpired(): boolean {
    if (!existsSync(LOCK_FILE)) {
      return false;
    }

    try {
      const content = readFileSync(LOCK_FILE, 'utf-8');
      const timestamp = parseInt(content.trim(), 10);
      return Date.now() - timestamp > LOCK_TTL_MS;
    } catch {
      return true;
    }
  }

  getTTLRemaining(): number {
    if (!existsSync(LOCK_FILE)) {
      return 0;
    }

    try {
      const content = readFileSync(LOCK_FILE, 'utf-8');
      const timestamp = parseInt(content.trim(), 10);
      const elapsed = Date.now() - timestamp;
      return Math.max(0, LOCK_TTL_MS - elapsed);
    } catch {
      return 0;
    }
  }
}

import { readFileSync } from 'fs';

export const daemonStartLock = new DaemonStartLock();