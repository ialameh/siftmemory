import { DEFAULT_CONFIG } from '../types.js';
export class ConfigService {
    config;
    constructor() {
        this.config = { ...DEFAULT_CONFIG };
    }
    get() {
        return { ...this.config };
    }
    update(partial) {
        this.config = { ...this.config, ...partial };
    }
    getOrThrow(key) {
        const value = this.config[key];
        if (value === undefined) {
            throw new Error(`Config key ${key} is not set`);
        }
        return value;
    }
    isEnabled() {
        return !this.config.disabled;
    }
    getDaemonUrl() {
        return this.config.daemonUrl;
    }
    shouldAutoStart() {
        return this.config.autoStartDaemon;
    }
    shouldCaptureToolEvents() {
        return this.config.captureToolEvents;
    }
    shouldInjectOnSessionStart() {
        return this.config.injectOnSessionStart;
    }
    shouldInjectOnUserPrompt() {
        return this.config.injectOnUserPrompt;
    }
    getMaxRestartAttempts() {
        return this.config.maxRestartAttempts;
    }
    getHealthCacheTtl() {
        return this.config.healthCacheTtlMs;
    }
    getStartupTimeout() {
        return this.config.startupTimeoutMs;
    }
}
export const configService = new ConfigService();
//# sourceMappingURL=config.js.map