import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { DaemonStartResult } from '../types.js';
import { daemonHealthClient } from './daemon-health.js';

export class DaemonSupervisor extends EventEmitter {
  private runningProcess: ChildProcess | null = null;
  private currentPid: number | null = null;

  async startDaemon(
    daemonPath: string,
    timeoutMs: number = 5000
  ): Promise<DaemonStartResult> {
    try {
      this.runningProcess = spawn(daemonPath, [], {
        detached: true,
        stdio: 'ignore',
      });

      this.currentPid = this.runningProcess.pid || null;
      this.runningProcess.unref();

      const healthy = await daemonHealthClient.waitUntilHealthy(
        'http://127.0.0.1:7777',
        timeoutMs
      );

      if (!healthy.ok) {
        this.runningProcess = null;
        this.currentPid = null;
        return { started: false, error: 'Daemon started but health check failed' };
      }

      return { started: true, pid: this.currentPid || undefined };
    } catch (error) {
      this.runningProcess = null;
      this.currentPid = null;
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { started: false, error: message };
    }
  }

  async stopDaemon(): Promise<boolean> {
    if (this.currentPid === null) {
      return true;
    }

    try {
      process.kill(this.currentPid, 'SIGTERM');
      this.runningProcess = null;
      this.currentPid = null;
      return true;
    } catch {
      return false;
    }
  }

  getCurrentPid(): number | null {
    return this.currentPid;
  }

  isRunning(): boolean {
    return this.runningProcess !== null && this.currentPid !== null;
  }
}

export const daemonSupervisor = new DaemonSupervisor();