import { RuntimeReadinessResult, ReadinessReason } from '../types.js';
export declare class RuntimeReadinessService {
    ensureReady(reason: ReadinessReason): Promise<RuntimeReadinessResult>;
    private checkAndUpdateState;
    private tryStartAndVerify;
    private handleFailedStart;
    private incrementRestartAttempts;
    private shouldAutoStart;
    private sleep;
    private updateState;
}
export declare const runtimeReadinessService: RuntimeReadinessService;
//# sourceMappingURL=readiness.d.ts.map