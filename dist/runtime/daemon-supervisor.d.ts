import { EventEmitter } from 'events';
import { DaemonStartResult } from '../types.js';
export declare class DaemonSupervisor extends EventEmitter {
    private runningProcess;
    private currentPid;
    startDaemon(daemonPath: string, timeoutMs?: number): Promise<DaemonStartResult>;
    stopDaemon(): Promise<boolean>;
    getCurrentPid(): number | null;
    isRunning(): boolean;
}
export declare const daemonSupervisor: DaemonSupervisor;
//# sourceMappingURL=daemon-supervisor.d.ts.map