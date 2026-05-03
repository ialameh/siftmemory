import { ReadinessReason, RuntimeAction } from '../types.js';
export interface Notification {
    type: 'info' | 'warning' | 'error';
    message: string;
    action?: RuntimeAction;
    timestamp: number;
}
export declare class NotificationService {
    private notifications;
    private lastNotificationTime;
    private throttleMs;
    notifyCoreMissing(reason: ReadinessReason): Promise<void>;
    notifyDaemonDown(reason: ReadinessReason): Promise<void>;
    notifyDaemonStartFailed(reason: ReadinessReason, error: string): Promise<void>;
    notifyDaemonStartTimedOut(reason: ReadinessReason): Promise<void>;
    notifyReady(): Promise<void>;
    private getCoreMissingMessage;
    private getDaemonDownMessage;
    private shouldThrottle;
    private isBackgroundHook;
    private emit;
    getRecent(): Notification[];
    clear(): void;
}
export declare const notificationService: NotificationService;
//# sourceMappingURL=notification.d.ts.map