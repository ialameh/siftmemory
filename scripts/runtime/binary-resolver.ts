import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';
import { BinaryResolution } from '../types.js';

const execAsync = promisify(exec);

const COMMON_PATHS = [
  '/usr/local/bin',
  '/opt/siftmemory/bin',
];

const SEARCH_PATHS = [
  ...COMMON_PATHS,
  resolve(homedir(), '.cargo', 'bin'),
  resolve(homedir(), '.local', 'bin'),
];

export class BinaryResolver {
  private cachedResolution: BinaryResolution | null = null;

  async findSiftMemoryBinary(): Promise<string | null> {
    const result = await this.resolve();
    return result.daemonPath;
  }

  async resolve(explicitDaemonPath?: string | null, explicitCliPath?: string | null): Promise<BinaryResolution> {
    const searchPath: string[] = [];

    // 1. Explicit paths
    if (explicitDaemonPath && existsSync(explicitDaemonPath)) {
      const cliPath = explicitCliPath && existsSync(explicitCliPath) ? explicitCliPath : await this.findInPath('siftmemory-cli');
      this.cachedResolution = { daemonPath: explicitDaemonPath, cliPath, searchPath };
      return this.cachedResolution;
    }

    // 2. Environment variable
    const envPath = process.env.SIFTMEMORY_DAEMON_PATH;
    if (envPath && existsSync(envPath)) {
      searchPath.push(`env:SIFTMEMORY_DAEMON_PATH=${envPath}`);
      const cliPath = await this.findCliPath(explicitCliPath);
      this.cachedResolution = { daemonPath: envPath, cliPath, searchPath };
      return this.cachedResolution;
    }

    // 3. PATH lookup
    const daemonPath = await this.findInPath('siftmemory-daemon');
    if (daemonPath) {
      searchPath.push('PATH');
      const cliPath = await this.findCliPath(explicitCliPath);
      this.cachedResolution = { daemonPath, cliPath, searchPath };
      return this.cachedResolution;
    }

    // 4. Common locations
    for (const base of SEARCH_PATHS) {
      const candidate = resolve(base, 'siftmemory-daemon');
      if (existsSync(candidate)) {
        searchPath.push(base);
        const cliPath = await this.findCliPathFromBase(base, explicitCliPath);
        this.cachedResolution = { daemonPath: candidate, cliPath, searchPath };
        return this.cachedResolution;
      }
    }

    // 5. Bundled (future)
    const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || '';
    const platform = process.platform;
    const arch = process.arch;
    const bundled = resolve(pluginRoot, 'bin', platform, arch, 'siftmemory-daemon');
    if (existsSync(bundled)) {
      searchPath.push(`bundled:${bundled}`);
      const cliBundled = resolve(pluginRoot, 'bin', platform, arch, 'siftmemory-cli');
      const cliPath = existsSync(cliBundled) ? cliBundled : null;
      this.cachedResolution = { daemonPath: bundled, cliPath, searchPath };
      return this.cachedResolution;
    }

    return { daemonPath: null, cliPath: null, searchPath };
  }

  private async findInPath(binary: string): Promise<string | null> {
    try {
      const result = await execAsync(`which ${binary}`);
      const path = result.stdout.trim();
      return path && existsSync(path) ? path : null;
    } catch {
      return null;
    }
  }

  private async findCliPath(explicit?: string | null): Promise<string | null> {
    if (explicit && existsSync(explicit)) {
      return explicit;
    }
    return this.findInPath('siftmemory-cli');
  }

  private async findCliPathFromBase(base: string, explicit?: string | null): Promise<string | null> {
    if (explicit && existsSync(explicit)) {
      return explicit;
    }
    const candidate = resolve(base, 'siftmemory-cli');
    return existsSync(candidate) ? candidate : null;
  }

  clearCache(): void {
    this.cachedResolution = null;
  }
}

export const binaryResolver = new BinaryResolver();