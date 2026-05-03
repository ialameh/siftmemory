import { writeFileSync, readFileSync, existsSync, renameSync, unlinkSync, mkdirSync, openSync, closeSync } from 'fs';
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
    lockToken = null;
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
        const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
        while (Date.now() <= deadline) {
            try {
                const fd = openSync(STATE_LOCK_FILE, 'wx');
                try {
                    writeFileSync(fd, token);
                }
                finally {
                    closeSync(fd);
                }
                this.lockAcquiredAt = Date.now();
                this.lockToken = token;
                return;
            }
            catch {
                if (this.isLockExpired()) {
                    try {
                        unlinkSync(STATE_LOCK_FILE);
                    }
                    catch { }
                    continue;
                }
                this.sleepSync(25);
            }
        }
        if (this.isLockExpired()) {
            try {
                unlinkSync(STATE_LOCK_FILE);
            }
            catch { }
            try {
                const fd = openSync(STATE_LOCK_FILE, 'wx');
                try {
                    writeFileSync(fd, token);
                }
                finally {
                    closeSync(fd);
                }
                this.lockAcquiredAt = Date.now();
                this.lockToken = token;
                return;
            }
            catch {
                // Fall through to fail open.
            }
        }
        throw new Error(`Failed to acquire SiftMemory plugin state lock: ${STATE_LOCK_FILE}`);
    }
    releaseLock() {
        const token = this.lockToken;
        this.lockAcquiredAt = null;
        this.lockToken = null;
        try {
            if (existsSync(STATE_LOCK_FILE) && readFileSync(STATE_LOCK_FILE, 'utf-8') === token) {
                unlinkSync(STATE_LOCK_FILE);
            }
        }
        catch {
            // Ignore
        }
    }
    isLockExpired() {
        if (!existsSync(STATE_LOCK_FILE)) {
            return false;
        }
        try {
            const content = readFileSync(STATE_LOCK_FILE, 'utf-8');
            const timestamp = Number(content.split(':')[1] || '0');
            return Number.isFinite(timestamp) && Date.now() - timestamp > LOCK_TTL_MS;
        }
        catch {
            return true;
        }
    }
    sleepSync(ms) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    }
}
export const pluginStateStore = new PluginStateStore();
//# sourceMappingURL=plugin-state.js.map