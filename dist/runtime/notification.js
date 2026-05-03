export class NotificationService {
    notifications = [];
    lastNotificationTime = 0;
    throttleMs = 5000;
    async notifyCoreMissing(reason) {
        const notification = {
            type: 'error',
            message: this.getCoreMissingMessage(reason),
            action: 'install_core',
            timestamp: Date.now(),
        };
        this.emit(notification);
    }
    async notifyDaemonDown(reason) {
        if (this.shouldThrottle()) {
            return;
        }
        const notification = {
            type: 'warning',
            message: this.getDaemonDownMessage(reason),
            action: 'start_daemon',
            timestamp: Date.now(),
        };
        this.emit(notification);
        this.lastNotificationTime = Date.now();
    }
    async notifyDaemonStartFailed(reason, error) {
        const notification = {
            type: 'error',
            message: `Failed to start SiftMemory daemon: ${error}`,
            action: 'start_daemon',
            timestamp: Date.now(),
        };
        this.emit(notification);
    }
    async notifyDaemonStartTimedOut(reason) {
        const notification = {
            type: 'error',
            message: 'SiftMemory daemon started but did not become healthy in time.',
            action: 'restart_daemon',
            timestamp: Date.now(),
        };
        this.emit(notification);
    }
    async notifyReady() {
        // Silent - we don't notify on success
    }
    getCoreMissingMessage(reason) {
        return `SiftMemory core is not installed.

SiftMemory cannot work without its core binaries.

To install, run:
  cargo install --git https://github.com/ialameh/sift-memory siftmemory-daemon

Then restart Claude Code or run:
  /siftmemory:check`;
    }
    getDaemonDownMessage(reason) {
        const hookHint = this.isBackgroundHook(reason) ? ' (will retry)' : '';
        return `SiftMemory daemon is not running.${hookHint}

To start it, run:
  /siftmemory:start

Or restart Claude Code to auto-start.`;
    }
    shouldThrottle() {
        return Date.now() - this.lastNotificationTime < this.throttleMs;
    }
    isBackgroundHook(reason) {
        return ['post_tool_use', 'post_tool_failure', 'post_tool_batch', 'cwd_changed'].includes(reason);
    }
    emit(notification) {
        this.notifications.push(notification);
        console.error(`[SiftMemory] ${notification.type.toUpperCase()}: ${notification.message}`);
    }
    getRecent() {
        return this.notifications.slice(-10);
    }
    clear() {
        this.notifications = [];
    }
}
export const notificationService = new NotificationService();
//# sourceMappingURL=notification.js.map