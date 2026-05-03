export declare class DaemonStartLock {
    private lockAcquiredAt;
    acquire(): boolean;
    release(): void;
    isLocked(): boolean;
    private isExpired;
    getTTLRemaining(): number;
}
export declare const daemonStartLock: DaemonStartLock;
//# sourceMappingURL=daemon-start-lock.d.ts.map