import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

const LOCK_FILE = resolve(tmpdir(), 'siftmemory-state.lock');
const LOCK_TTL_MS = 5000;

export class StateLock {
  private lockedAt: number | null = null;

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
      this.lockedAt = Date.now();
      return true;
    } catch {
      return false;
    }
  }

  release(): void {
    this.lockedAt = null;
    try {
      if (existsSync(LOCK_FILE)) {
        unlinkSync(LOCK_FILE);
      }
    } catch {
      // Ignore
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

  withLock<T>(fn: () => T): T {
    if (!this.acquire()) {
      throw new Error('Failed to acquire state lock');
    }
    try {
      return fn();
    } finally {
      this.release();
    }
  }
}

export const stateLock = new StateLock();