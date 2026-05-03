import { configService } from './config.js';
import { binaryResolver } from './binary-resolver.js';
import { daemonHealthClient } from './daemon-health.js';
import { daemonSupervisor } from './daemon-supervisor.js';
import { daemonStartLock } from './daemon-start-lock.js';
import { notificationService } from './notification.js';
import { pluginStateStore } from './plugin-state.js';
const UNHEALTHY_THRESHOLD_MS = 60000;
const RESTART_BACKOFF_MS = [1000, 3000, 10000]; // 1s, 3s, 10s
const MAX_RESTART_ATTEMPTS = 3;
export class RuntimeReadinessService {
    async ensureReady(reason) {
        const config = configService.config;
        if (config.disabled) {
            return { ready: false, state: 'disabled_by_user', reason };
        }
        const state = await pluginStateStore.get();
        const currentState = state?.runtime?.state || 'uninitialized';
        if (currentState === 'disabled_by_user') {
            return { ready: false, state: 'disabled_by_user', reason };
        }
        // Check if permanently down for session
        if (state?.runtime?.permanentlyDownForSession) {
            return { ready: false, state: 'permanently_down', reason };
        }
        switch (currentState) {
            case 'uninitialized':
            case 'unknown':
                return this.checkAndUpdateState(reason, currentState);
            case 'checking':
                return { ready: false, state: 'checking', reason };
            case 'core_missing':
                return { ready: false, state: 'core_missing', reason };
            case 'permanently_down':
                return { ready: false, state: 'permanently_down', reason };
            case 'starting_daemon':
            case 'restarting': {
                const ttlRemaining = daemonStartLock.getTTLRemaining();
                if (ttlRemaining > 0) {
                    return { ready: false, state: currentState, reason };
                }
                return this.checkAndUpdateState(reason, currentState);
            }
            case 'core_installed_daemon_down':
            case 'daemon_down':
                if (this.shouldAutoStart()) {
                    return this.tryStartAndVerify(reason);
                }
                await notificationService.notifyDaemonDown(reason);
                return {
                    ready: false,
                    state: currentState,
                    reason,
                    action: 'start_daemon',
                };
            case 'ready':
            case 'degraded': {
                const daemonUrl = configService.getDaemonUrl();
                const healthy = await daemonHealthClient.check(daemonUrl);
                if (healthy.ok) {
                    return { ready: true, state: currentState, reason };
                }
                const lastHealthy = state?.runtime?.lastHealthy;
                if (lastHealthy && Date.now() - lastHealthy < UNHEALTHY_THRESHOLD_MS) {
                    await this.updateState('degraded', state);
                    return { ready: true, state: 'degraded', reason };
                }
                await this.updateState('daemon_down', state);
                if (this.shouldAutoStart()) {
                    return this.tryStartAndVerify(reason);
                }
                await notificationService.notifyDaemonDown(reason);
                return { ready: false, state: 'daemon_down', reason, action: 'start_daemon' };
            }
            case 'unhealthy':
                return this.checkAndUpdateState(reason, currentState);
            default:
                return this.checkAndUpdateState(reason, currentState);
        }
    }
    async checkAndUpdateState(reason, currentState) {
        await this.updateState('checking');
        const binaryPath = await binaryResolver.findSiftMemoryBinary();
        if (!binaryPath) {
            await this.updateState('core_missing');
            await notificationService.notifyCoreMissing(reason);
            return { ready: false, state: 'core_missing', reason };
        }
        const daemonUrl = configService.getDaemonUrl();
        const healthy = await daemonHealthClient.check(daemonUrl);
        if (healthy.ok) {
            await this.updateState('ready');
            await notificationService.notifyReady();
            return { ready: true, state: 'ready', reason };
        }
        await this.updateState('core_installed_daemon_down');
        if (this.shouldAutoStart()) {
            return this.tryStartAndVerify(reason);
        }
        await notificationService.notifyDaemonDown(reason);
        return { ready: false, state: 'daemon_down', reason, action: 'start_daemon' };
    }
    async tryStartAndVerify(reason) {
        if (!daemonStartLock.acquire()) {
            await this.updateState('starting_daemon');
            return { ready: false, state: 'starting_daemon', reason };
        }
        const state = await pluginStateStore.get();
        const restartAttempts = state?.runtime?.restartAttemptsThisSession || 0;
        // Check if we've exceeded max restart attempts
        if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
            daemonStartLock.release();
            await this.updateState('permanently_down', state);
            await notificationService.notifyPermanentlyDown(reason);
            return { ready: false, state: 'permanently_down', reason };
        }
        // Apply backoff delay if this is a restart (not first attempt)
        if (restartAttempts > 0) {
            const backoffIndex = Math.min(restartAttempts - 1, RESTART_BACKOFF_MS.length - 1);
            const delayMs = RESTART_BACKOFF_MS[backoffIndex];
            await this.sleep(delayMs);
        }
        try {
            await this.updateState('restarting');
            const binaryPath = await binaryResolver.findSiftMemoryBinary();
            if (!binaryPath) {
                await this.updateState('core_missing');
                await notificationService.notifyCoreMissing(reason);
                return { ready: false, state: 'core_missing', reason };
            }
            const startupTimeout = configService.getStartupTimeout();
            const startResult = await daemonSupervisor.startDaemon(binaryPath, startupTimeout);
            if (!startResult.started) {
                await this.handleFailedStart(reason, startResult.error || 'Unknown error');
                return {
                    ready: false,
                    state: 'daemon_down',
                    reason,
                    action: 'start_daemon',
                    error: startResult.error,
                };
            }
            const daemonUrl = configService.getDaemonUrl();
            const healthy = await daemonHealthClient.waitUntilHealthy(daemonUrl, startupTimeout);
            if (!healthy.ok) {
                await this.handleFailedStart(reason, 'Health check timed out');
                return {
                    ready: false,
                    state: 'daemon_down',
                    reason,
                    action: 'restart_daemon',
                    error: 'Daemon started but health check timed out',
                };
            }
            await this.updateState('ready');
            await notificationService.notifyReady();
            return { ready: true, state: 'ready', reason, pid: startResult.pid };
        }
        finally {
            daemonStartLock.release();
        }
    }
    async handleFailedStart(reason, error) {
        const state = await pluginStateStore.get();
        const restartAttempts = (state?.runtime?.restartAttemptsThisSession || 0) + 1;
        if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
            await this.updateState('permanently_down', state);
            await notificationService.notifyPermanentlyDown(reason);
        }
        else {
            await this.updateState('daemon_down', state);
            await this.incrementRestartAttempts(restartAttempts);
            await notificationService.notifyDaemonStartFailed(reason, error);
        }
    }
    async incrementRestartAttempts(count) {
        const state = await pluginStateStore.get();
        if (state) {
            state.runtime.restartAttemptsThisSession = count;
            await pluginStateStore.set(state);
        }
    }
    shouldAutoStart() {
        return configService.config.autoStartDaemon;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async updateState(newState, existingState) {
        const state = existingState || {
            runtime: {
                state: newState,
                lastHealthAttempt: null,
                lastHealthy: null,
                consecutiveFailures: 0,
                restartAttemptsThisSession: 0,
                permanentlyDownForSession: false,
            },
            session: {
                hooksEnabled: false,
                startTime: null,
                workspaceId: process.cwd(),
                resumeInjections: [],
                cwdToWorkspace: {},
            },
            config: {
                disabled: false,
            },
            notifications: {
                coreMissingNotified: false,
                daemonDownNotifiedAt: null,
                midSessionFailureNotified: false,
                permanentlyDownNotified: false,
            },
        };
        state.runtime.state = newState;
        if (newState === 'ready') {
            state.runtime.lastHealthy = Date.now();
        }
        if (newState === 'permanently_down') {
            state.runtime.permanentlyDownForSession = true;
        }
        await pluginStateStore.set(state);
    }
}
export const runtimeReadinessService = new RuntimeReadinessService();
//# sourceMappingURL=readiness.js.map