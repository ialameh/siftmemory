import { HealthCheckResult } from '../types.js';
export declare class DaemonHealthClient {
    private cache;
    private cacheTtlMs;
    setCacheTtl(ttlMs: number): void;
    check(url: string, forceRefresh?: boolean): Promise<HealthCheckResult>;
    waitUntilHealthy(url: string, timeoutMs: number, pollIntervalMs?: number): Promise<HealthCheckResult>;
    invalidateCache(): void;
    private sleep;
}
export declare const daemonHealthClient: DaemonHealthClient;
//# sourceMappingURL=daemon-health.d.ts.map