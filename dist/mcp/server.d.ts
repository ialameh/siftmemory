import { EventEmitter } from 'events';
export declare class SiftMemoryMCPServer extends EventEmitter {
    constructor();
    handleRequest(request: {
        method: string;
        params?: Record<string, unknown>;
    }): Promise<unknown>;
    start(): Promise<void>;
    stop(): Promise<void>;
}
export declare const mcpServer: SiftMemoryMCPServer;
//# sourceMappingURL=server.d.ts.map