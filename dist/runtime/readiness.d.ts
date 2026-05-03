import { RuntimeReadinessResult, ReadinessReason } from '../types.js';
export declare class RuntimeReadinessService {
    ensureReady(reason: ReadinessReason): Promise<RuntimeReadinessResult>;
    private checkAndUpdateState;
    private tryStartAndVerify;
    private shouldAutoStart;
    private updateState;
}
export declare const runtimeReadinessService: RuntimeReadinessService;
//# sourceMappingURL=readiness.d.ts.map