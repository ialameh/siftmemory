import { ReadinessReason, RuntimeAction } from '../types.js';

export interface Notification {
  type: 'info' | 'warning' | 'error';
  message: string;
  action?: RuntimeAction;
  timestamp: number;
}

export class NotificationService {
  private notifications: Notification[] = [];
  private lastNotificationTime: number = 0;
  private throttleMs: number = 5000;

  async notifyCoreMissing(reason: ReadinessReason): Promise<void> {
    const notification: Notification = {
      type: 'error',
      message: this.getCoreMissingMessage(reason),
      action: 'install_core',
      timestamp: Date.now(),
    };
    this.emit(notification);
  }

  async notifyDaemonDown(reason: ReadinessReason): Promise<void> {
    if (this.shouldThrottle()) {
      return;
    }

    const notification: Notification = {
      type: 'warning',
      message: this.getDaemonDownMessage(reason),
      action: 'start_daemon',
      timestamp: Date.now(),
    };
    this.emit(notification);
    this.lastNotificationTime = Date.now();
  }

  async notifyDaemonStartFailed(reason: ReadinessReason, error: string): Promise<void> {
    const notification: Notification = {
      type: 'error',
      message: `Failed to start SiftMemory daemon: ${error}`,
      action: 'start_daemon',
      timestamp: Date.now(),
    };
    this.emit(notification);
  }

  async notifyDaemonStartTimedOut(reason: ReadinessReason): Promise<void> {
    const notification: Notification = {
      type: 'error',
      message: 'SiftMemory daemon started but did not become healthy in time.',
      action: 'restart_daemon',
      timestamp: Date.now(),
    };
    this.emit(notification);
  }

  async notifyReady(): Promise<void> {
    // Silent - we don't notify on success
  }

  private getCoreMissingMessage(reason: ReadinessReason): string {
    return `SiftMemory core is not installed.

SiftMemory cannot work without its core binaries.

To install, run:
  cargo install --git https://github.com/ialameh/sift-memory siftmemory-daemon

Then restart Claude Code or run:
  /siftmemory:check`;
  }

  private getDaemonDownMessage(reason: ReadinessReason): string {
    const hookHint = this.isBackgroundHook(reason) ? ' (will retry)' : '';
    return `SiftMemory daemon is not running.${hookHint}

To start it, run:
  /siftmemory:start

Or restart Claude Code to auto-start.`;
  }

  private shouldThrottle(): boolean {
    return Date.now() - this.lastNotificationTime < this.throttleMs;
  }

  private isBackgroundHook(reason: ReadinessReason): boolean {
    return ['post_tool_use', 'post_tool_failure', 'post_tool_batch', 'cwd_changed'].includes(reason);
  }

  private emit(notification: Notification): void {
    this.notifications.push(notification);
    console.error(`[SiftMemory] ${notification.type.toUpperCase()}: ${notification.message}`);
  }

  getRecent(): Notification[] {
    return this.notifications.slice(-10);
  }

  clear(): void {
    this.notifications = [];
  }
}

export const notificationService = new NotificationService();