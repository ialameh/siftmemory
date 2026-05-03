import { PluginState } from '../types.js';
export declare class PluginStateStore {
    private lockAcquiredAt;
    get(): Promise<PluginState | null>;
    set(state: PluginState): Promise<void>;
    clear(): Promise<void>;
    private acquireLock;
    private releaseLock;
}
export declare const pluginStateStore: PluginStateStore;
//# sourceMappingURL=plugin-state.d.ts.map