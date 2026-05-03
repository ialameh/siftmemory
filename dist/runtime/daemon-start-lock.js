import { writeFileSync, existsSync, unlinkSync, readFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
const LOCK_TTL_MS = 10000;
const SIFT_MEMORY_DIR = resolve(homedir(), '.siftmemory');
const LOCK_FILE = resolve(SIFT_MEMORY_DIR, 'claude-plugin-daemon-start.lock');
function ensureSiftMemoryDir() {
    if (!existsSync(SIFT_MEMORY_DIR)) {
        mkdirSync(SIFT_MEMORY_DIR, { recursive: true });
    }
}
export class DaemonStartLock {
    lockAcquiredAt = null;
    acquire() {
        ensureSiftMemoryDir();
        if (this.isLocked()) {
            if (this.isExpired()) {
                this.release();
            }
            else {
                return false;
            }
        }
        try {
            writeFileSync(LOCK_FILE, `${Date.now()}`);
            this.lockAcquiredAt = Date.now();
            return true;
        }
        catch {
            return false;
        }
    }
    release() {
        this.lockAcquiredAt = null;
        try {
            if (existsSync(LOCK_FILE)) {
                unlinkSync(LOCK_FILE);
            }
        }
        catch {
            // Ignore cleanup errors
        }
    }
    isLocked() {
        if (!existsSync(LOCK_FILE)) {
            return false;
        }
        return !this.isExpired();
    }
    isExpired() {
        if (!existsSync(LOCK_FILE)) {
            return false;
        }
        try {
            const content = readFileSync(LOCK_FILE, 'utf-8');
            const timestamp = parseInt(content.trim(), 10);
            return Date.now() - timestamp > LOCK_TTL_MS;
        }
        catch {
            return true;
        }
    }
    getTTLRemaining() {
        if (!existsSync(LOCK_FILE)) {
            return 0;
        }
        try {
            const content = readFileSync(LOCK_FILE, 'utf-8');
            const timestamp = parseInt(content.trim(), 10);
            const elapsed = Date.now() - timestamp;
            return Math.max(0, LOCK_TTL_MS - elapsed);
        }
        catch {
            return 0;
        }
    }
}
export const daemonStartLock = new DaemonStartLock();
//# sourceMappingURL=daemon-start-lock.js.map