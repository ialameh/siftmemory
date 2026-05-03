import { RuntimeReadinessResult, ReadinessReason, SiftMemoryRuntimeState, ResumeInjectionRecord } from '../types.js';
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
  async ensureReady(reason: ReadinessReason): Promise<RuntimeReadinessResult> {
    const config = configService.config;
    if (config.disabled) {
      return { ready: false, state: 'disabled_by_user', reason };
    }

    const state = await pluginStateStore.get();
    const currentState = state?.runtime?.state || 'uninitialized';

    if (currentState === 'disabled_by_user') {
      return { ready: false, state: 'disabled_by_user', reason };
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
        const healthy = await daemonHealthClient.check('http://127.0.0.1:7777');
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

  private async checkAndUpdateState(reason: ReadinessReason, currentState: SiftMemoryRuntimeState): Promise<RuntimeReadinessResult> {
    await this.updateState('checking');

    const binaryPath = await binaryResolver.findSiftMemoryBinary();
    if (!binaryPath) {
      await this.updateState('core_missing');
      await notificationService.notifyCoreMissing(reason);
      return { ready: false, state: 'core_missing', reason };
    }

    const healthy = await daemonHealthClient.check('http://127.0.0.1:7777');
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

  private async tryStartAndVerify(reason: ReadinessReason): Promise<RuntimeReadinessResult> {
    if (!daemonStartLock.acquire()) {
      await this.updateState('starting_daemon');
      return { ready: false, state: 'starting_daemon', reason };
    }

    try {
      await this.updateState('starting_daemon');

      const binaryPath = await binaryResolver.findSiftMemoryBinary();
      if (!binaryPath) {
        await this.updateState('core_missing');
        await notificationService.notifyCoreMissing(reason);
        return { ready: false, state: 'core_missing', reason };
      }

      const startResult = await daemonSupervisor.startDaemon(binaryPath, 5000);

      if (!startResult.started) {
        await this.updateState('daemon_down');
        await notificationService.notifyDaemonStartFailed(reason, startResult.error || 'Unknown error');
        return {
          ready: false,
          state: 'daemon_down',
          reason,
          action: 'start_daemon',
          error: startResult.error,
        };
      }

      const healthy = await daemonHealthClient.waitUntilHealthy('http://127.0.0.1:7777', 5000);

      if (!healthy.ok) {
        await this.updateState('daemon_down');
        await notificationService.notifyDaemonStartTimedOut(reason);
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
    } finally {
      daemonStartLock.release();
    }
  }

  private shouldAutoStart(): boolean {
    return configService.config.autoStartDaemon;
  }

  private async updateState(newState: SiftMemoryRuntimeState, existingState?: { runtime: { state: SiftMemoryRuntimeState; lastHealthAttempt: number | null; lastHealthy: number | null; consecutiveFailures: number; restartAttemptsThisSession: number; permanentlyDownForSession: boolean }; session: { hooksEnabled: boolean; startTime: number | null; workspaceId: string; resumeInjections: ResumeInjectionRecord[]; cwdToWorkspace: Record<string, string> }; config: { disabled: boolean }; notifications: { coreMissingNotified: boolean; daemonDownNotifiedAt: number | null; midSessionFailureNotified: boolean; permanentlyDownNotified: boolean } } | null): Promise<void> {
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
        resumeInjections: [] as ResumeInjectionRecord[],
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
    await pluginStateStore.set(state);
  }
}

export const runtimeReadinessService = new RuntimeReadinessService();