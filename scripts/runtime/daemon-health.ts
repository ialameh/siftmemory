import axios, { AxiosError } from 'axios';
import { HealthCheckResult } from '../types.js';

export class DaemonHealthClient {
  private cache: { result: HealthCheckResult; timestamp: number } | null = null;
  private cacheTtlMs: number = 30000;

  setCacheTtl(ttlMs: number): void {
    this.cacheTtlMs = ttlMs;
  }

  async check(url: string, forceRefresh = false): Promise<HealthCheckResult> {
    if (!forceRefresh && this.cache) {
      const age = Date.now() - this.cache.timestamp;
      if (age < this.cacheTtlMs) {
        return this.cache.result;
      }
    }

    try {
      const response = await axios.get(`${url}/v1/health`, {
        timeout: 2000,
        validateStatus: () => true,
      });

      const ok = response.status === 200 && response.data?.ok === true;
      const result: HealthCheckResult = {
        ok,
        version: ok ? (response.data?.data?.version || 'unknown') : undefined,
        error: ok ? undefined : 'Health check failed',
      };

      this.cache = { result, timestamp: Date.now() };
      return result;
    } catch (error) {
      const axiosError = error as AxiosError;
      const result: HealthCheckResult = {
        ok: false,
        error: axiosError.message || 'Connection failed',
      };
      this.cache = { result, timestamp: Date.now() };
      return result;
    }
  }

  async waitUntilHealthy(url: string, timeoutMs: number, pollIntervalMs = 250): Promise<HealthCheckResult> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const result = await this.check(url, true);
      if (result.ok) {
        return result;
      }
      await this.sleep(pollIntervalMs);
    }

    return { ok: false, error: 'Timed out waiting for daemon' };
  }

  invalidateCache(): void {
    this.cache = null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const daemonHealthClient = new DaemonHealthClient();