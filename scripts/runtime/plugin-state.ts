import { writeFileSync, readFileSync, existsSync, renameSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { PluginState, SiftMemoryRuntimeState } from '../types.js';

const STATE_FILE = resolve(tmpdir(), 'siftmemory-plugin-state.json');
const STATE_LOCK_FILE = resolve(tmpdir(), 'siftmemory-state.lock');
const LOCK_TTL_MS = 5000;

export class PluginStateStore {
  private lockAcquiredAt: number | null = null;

  async get(): Promise<PluginState | null> {
    this.acquireLock();
    try {
      if (!existsSync(STATE_FILE)) {
        return null;
      }
      const content = readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(content) as PluginState;
    } catch {
      return null;
    } finally {
      this.releaseLock();
    }
  }

  async set(state: PluginState): Promise<void> {
    this.acquireLock();
    try {
      const tempFile = `${STATE_FILE}.${Date.now()}.tmp`;
      writeFileSync(tempFile, JSON.stringify(state, null, 2));
      renameSync(tempFile, STATE_FILE);
    } finally {
      this.releaseLock();
    }
  }

  async clear(): Promise<void> {
    this.acquireLock();
    try {
      if (existsSync(STATE_FILE)) {
        unlinkSync(STATE_FILE);
      }
    } finally {
      this.releaseLock();
    }
  }

  private acquireLock(): void {
    const deadline = Date.now() + LOCK_TTL_MS;
    while (existsSync(STATE_LOCK_FILE)) {
      if (Date.now() > deadline) {
        try {
          unlinkSync(STATE_LOCK_FILE);
        } catch {
          // Ignore
        }
        break;
      }
    }

    try {
      writeFileSync(STATE_LOCK_FILE, `${Date.now()}`);
      this.lockAcquiredAt = Date.now();
    } catch {
      // Lock file may fail in some environments - continue anyway
    }
  }

  private releaseLock(): void {
    this.lockAcquiredAt = null;
    try {
      if (existsSync(STATE_LOCK_FILE)) {
        unlinkSync(STATE_LOCK_FILE);
      }
    } catch {
      // Ignore
    }
  }
}

export const pluginStateStore = new PluginStateStore();