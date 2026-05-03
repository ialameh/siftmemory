export declare class StateLock {
    private lockedAt;
    acquire(): boolean;
    release(): void;
    isLocked(): boolean;
    private isExpired;
    withLock<T>(fn: () => T): T;
}
export declare const stateLock: StateLock;
//# sourceMappingURL=state-lock.d.ts.map