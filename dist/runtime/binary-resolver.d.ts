import { BinaryResolution } from '../types.js';
export declare class BinaryResolver {
    private cachedResolution;
    findSiftMemoryBinary(): Promise<string | null>;
    resolve(explicitDaemonPath?: string | null, explicitCliPath?: string | null): Promise<BinaryResolution>;
    private findInPath;
    private findCliPath;
    private findCliPathFromBase;
    clearCache(): void;
}
export declare const binaryResolver: BinaryResolver;
//# sourceMappingURL=binary-resolver.d.ts.map