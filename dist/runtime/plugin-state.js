import { writeFileSync, readFileSync, existsSync, renameSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
const STATE_FILE = resolve(tmpdir(), 'siftmemory-plugin-state.json');
const STATE_LOCK_FILE = resolve(tmpdir(), 'siftmemory-state.lock');
const LOCK_TTL_MS = 5000;
export class PluginStateStore {
    lockAcquiredAt = null;
    async get() {
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