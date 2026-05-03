import axios from 'axios';
export class DaemonHealthClient {
    cache = null;
    cacheTtlMs = 30000;
    setCacheTtl(ttlMs) {
        this.cacheTtlMs = ttlMs;
    }
    async check(url, forceRefresh = false) {
        if (!forceRefresh && this.cache) {
            const age = Date.now() - this.cache.timestamp;
            if (age < this.cacheTtlMs) {
                return this.cache.result;
            }
        }
        try {
            // Health endpoint per spec: GET /v1/health
            const response = await axios.get(`${url}/v1/health`, {
                timeout: 2000,
                validateStatus: () => true,
            });
            const ok = response.status === 200 && response.data?.ok === true;
            const result = {
                ok,
                version: ok ? (response.data?.data?.version || 'unknown') : undefined,
                error: ok ? undefined : 'Health check failed',
            };
            this.cache = { result, timestamp: Date.now() };
            return result;
        }
        catch (error) {
            const axiosError = error;
            const result = {
                ok: false,
                error: axiosError.message || 'Connection failed',
            };
            this.cache = { result, timestamp: Date.now() };
            return result;
        }
    }
    async waitUntilHealthy(url, timeoutMs, pollIntervalMs = 250) {
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
    invalidateCache() {
        this.cache = null;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
export const daemonHealthClient = new DaemonHealthClient();
//# sourceMappingURL=daemon-health.js.map