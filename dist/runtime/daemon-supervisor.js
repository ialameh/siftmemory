import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { daemonHealthClient } from './daemon-health.js';
import { configService } from './config.js';
export class DaemonSupervisor extends EventEmitter {
    runningProcess = null;
    currentPid = null;
    async startDaemon(daemonPath, timeoutMs = 5000) {
        try {
            const daemonUrl = configService.getDaemonUrl();
            const daemonEnv = { ...process.env, SIFTMEMORY_STARTED_BY: 'claude-plugin' };
            try {
                const parsed = new URL(daemonUrl);
                if (parsed.hostname) {
                    daemonEnv.SIFTMEMORY_HOST = parsed.hostname;
                }
                if (parsed.port) {
                    daemonEnv.SIFTMEMORY_PORT = parsed.port;
                }
            }
            catch {
                // Keep existing environment if daemonUrl is not parseable.
            }
            this.runningProcess = spawn(daemonPath, [], {
                detached: true,
                stdio: 'ignore',
                env: daemonEnv
            });
            this.currentPid = this.runningProcess.pid || null;
            this.runningProcess.unref();
            const healthy = await daemonHealthClient.waitUntilHealthy(daemonUrl, timeoutMs);
            if (!healthy.ok) {
                this.runningProcess = null;
                this.currentPid = null;
                return { started: false, error: 'Daemon started but health check failed' };
            }
            return { started: true, pid: this.currentPid || undefined };
        }
        catch (error) {
            this.runningProcess = null;
            this.currentPid = null;
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { started: false, error: message };
        }
    }
    async stopDaemon() {
        if (this.currentPid === null) {
            return true;
        }
        try {
            process.kill(this.currentPid, 'SIGTERM');
            this.runningProcess = null;
            this.currentPid = null;
            return true;
        }
        catch {
            return false;
        }
    }
    getCurrentPid() {
        return this.currentPid;
    }
    isRunning() {
        return this.runningProcess !== null && this.currentPid !== null;
    }
}
export const daemonSupervisor = new DaemonSupervisor();
//# sourceMappingURL=daemon-supervisor.js.map