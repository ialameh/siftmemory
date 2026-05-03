import { writeFileSync, readFileSync, existsSync, renameSync, unlinkSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
const SIFT_MEMORY_DIR = resolve(homedir(), '.siftmemory');
const STATE_FILE = resolve(SIFT_MEMORY_DIR, 'claude-plugin-state.json');
const STATE_LOCK_FILE = resolve(SIFT_MEMORY_DIR, 'claude-plugin-state.lock');
const LOCK_TTL_MS = 5000;
// Ensure ~/.siftmemory directory exists
function ensureSiftMemoryDir() {
    if (!existsSync(SIFT_MEMORY_DIR)) {
        mkdirSync(SIFT_MEMORY_DIR, { recursive: true });
    }
}
export class PluginStateStore {
    lockAcquiredAt = null;
    async get() {
        ensureSiftMemoryDir();
        this.acquireLock();
        try {
            if (!existsSync(STATE_FILE)) {
                return null;
            }
            const content = readFileSync(STATE_FILE, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
        finally {
            this.releaseLock();
        }
    }
    async set(state) {
        this.acquireLock();
        try {
            const tempFile = `${STATE_FILE}.${Date.now()}.tmp`;
            writeFileSync(tempFile, JSON.stringify(state, null, 2));
            renameSync(tempFile, STATE_FILE);
        }
        finally {
            this.releaseLock();
        }
    }
    async clear() {
        this.acquireLock();
        try {
            if (existsSync(STATE_FILE)) {
                unlinkSync(STATE_FILE);
            }
        }
        finally {
            this.releaseLock();
        }
    }
    acquireLock() {
        ensureSiftMemoryDir();
        const deadline = Date.now() + LOCK_TTL_MS;
        while (existsSync(STATE_LOCK_FILE)) {
            if (Date.now() > deadline) {
                try {
                    unlinkSync(STATE_LOCK_FILE);
                }
                catch {
                    // Ignore
                }
                break;
            }
        }
        try {
            writeFileSync(STATE_LOCK_FILE, `${Date.now()}`);
            this.lockAcquiredAt = Date.now();
        }
        catch {
            // Lock file may fail in some environments - continue anyway
        }
    }
    releaseLock() {
        this.lockAcquiredAt = null;
        try {
            if (existsSync(STATE_LOCK_FILE)) {
                unlinkSync(STATE_LOCK_FILE);
            }
        }
        catch {
            // Ignore
        }
    }
}
export const pluginStateStore = new PluginStateStore();
//# sourceMappingURL=plugin-state.js.map