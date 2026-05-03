import { runtimeReadinessService } from './runtime/readiness.js';
import { daemonSupervisor } from './runtime/daemon-supervisor.js';
import { binaryResolver } from './runtime/binary-resolver.js';
import { pluginStateStore } from './runtime/plugin-state.js';
export declare function registerSlashCommands(): Promise<void>;
export declare function initializePlugin(): Promise<void>;
export declare function shutdownPlugin(): Promise<void>;
export { runtimeReadinessService, daemonSupervisor, binaryResolver, pluginStateStore };
//# sourceMappingURL=plugin.d.ts.map