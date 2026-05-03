import { runtimeReadinessService } from './runtime/readiness.js';
import { daemonSupervisor } from './runtime/daemon-supervisor.js';
import { binaryResolver } from './runtime/binary-resolver.js';
import { pluginStateStore } from './runtime/plugin-state.js';
export async function registerSlashCommands() {
    // Slash commands are registered via commands/*.md files
}
export async function initializePlugin() {
    const state = await pluginStateStore.get();
    if (!state) {
        await pluginStateStore.set({
            runtime: {
                state: 'uninitialized',
                lastHealthAttempt: null,
                lastHealthy: null,
                consecutiveFailures: 0,
            },
            session: {
                hooksEnabled: false,
                startTime: null,
                workspaceId: process.cwd(),
            },
            config: {
                disabled: false,
            },
        });
    }
    const checkResult = await runtimeReadinessService.ensureReady('session_start');
    if (checkResult.ready) {
        console.error('[SiftMemory] Initialized and ready');
    }
    else if (checkResult.state === 'core_missing') {
        console.error('[SiftMemory] Core missing - see /siftmemory:check for installation instructions');
    }
}
export async function shutdownPlugin() {
    await daemonSupervisor.stopDaemon();
}
export { runtimeReadinessService, daemonSupervisor, binaryResolver, pluginStateStore };
//# sourceMappingURL=plugin.js.map