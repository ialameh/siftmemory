import { writeFileSync, readFileSync, existsSync, renameSync, unlinkSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { PluginState, SiftMemoryRuntimeState } from '../types.js';

const SIFT_MEMORY_DIR = resolve(homedir(), '.siftmemory');
const STATE_FILE = resolve(SIFT_MEMORY_DIR, 'claude-plugin-state.json');
const STATE_LOCK_FILE = resolve(SIFT_MEMORY_DIR, 'claude-plugin-state.lock');
const LOCK_TTL_MS = 5000;

// Ensure ~/.siftmemory directory exists
function ensureSiftMemoryDir(): void {
  if (!existsSync(SIFT_MEMORY_DIR)) {
    mkdirSync(SIFT_MEMORY_DIR, { recursive: true });
  }
}

export class PluginStateStore {
  private lockAcquiredAt: number | null = null;

  async get(): Promise<PluginState | null> {
    ensureSiftMemoryDir();
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
    ensureSiftMemoryDir();
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