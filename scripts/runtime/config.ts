import { SiftMemoryPluginConfig, DEFAULT_CONFIG } from '../types.js';

export class ConfigService {
  config: SiftMemoryPluginConfig;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  get(): SiftMemoryPluginConfig {
    return { ...this.config };
  }

  update(partial: Partial<SiftMemoryPluginConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  getOrThrow<K extends keyof SiftMemoryPluginConfig>(key: K): SiftMemoryPluginConfig[K] {
    const value = this.config[key];
    if (value === undefined) {
      throw new Error(`Config key ${key} is not set`);
    }
    return value;
  }

  isEnabled(): boolean {
    return !this.config.disabled;
  }

  getDaemonUrl(): string {
    return this.config.daemonUrl;
  }

  shouldAutoStart(): boolean {
    return this.config.autoStartDaemon;
  }

  shouldCaptureToolEvents(): boolean {
    return this.config.captureToolEvents;
  }

  shouldInjectOnSessionStart(): boolean {
    return this.config.injectOnSessionStart;
  }

  shouldInjectOnUserPrompt(): boolean {
    return this.config.injectOnUserPrompt;
  }

  getMaxRestartAttempts(): number {
    return this.config.maxRestartAttempts;
  }

  getHealthCacheTtl(): number {
    return this.config.healthCacheTtlMs;
  }

  getStartupTimeout(): number {
    return this.config.startupTimeoutMs;
  }
}

export const configService = new ConfigService();