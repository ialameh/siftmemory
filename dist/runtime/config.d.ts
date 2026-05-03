import { SiftMemoryPluginConfig } from '../types.js';
export declare class ConfigService {
    config: SiftMemoryPluginConfig;
    constructor();
    get(): SiftMemoryPluginConfig;
    update(partial: Partial<SiftMemoryPluginConfig>): void;
    getOrThrow<K extends keyof SiftMemoryPluginConfig>(key: K): SiftMemoryPluginConfig[K];
    isEnabled(): boolean;
    getDaemonUrl(): string;
    shouldAutoStart(): boolean;
    shouldCaptureToolEvents(): boolean;
    shouldInjectOnSessionStart(): boolean;
    shouldInjectOnUserPrompt(): boolean;
    getMaxRestartAttempts(): number;
    getHealthCacheTtl(): number;
    getStartupTimeout(): number;
}
export declare const configService: ConfigService;
//# sourceMappingURL=config.d.ts.map