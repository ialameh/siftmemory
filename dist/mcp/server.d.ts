/**
 * SiftMemory MCP Server
 * MCP server implementation with proper readiness checks.
 *
 * IMPORTANT: This server starts even when core is missing.
 * Tools check readiness individually via runtimeReadinessService.
 */
import { EventEmitter } from 'events';
import { toolHandlers, ToolHandlers } from './tool-handlers.js';
import { getToolDefinitions, ToolDefinition } from './tool-definitions.js';
export { toolHandlers, ToolHandlers };
export { getToolDefinitions, ToolDefinition };
export declare class SiftMemoryMCPServer extends EventEmitter {
    private isRunning;
    constructor();
    handleRequest(request: {
        method: string;
        params?: {
            name?: string;
            arguments?: Record<string, unknown>;
        };
    }): Promise<{
        content: {
            type: string;
            text: string;
        }[];
        isError?: boolean;
    } | {
        tools: ToolDefinition[];
    }>;
    start(): Promise<void>;
    stop(): Promise<void>;
    isServerRunning(): boolean;
}
export declare const mcpServer: SiftMemoryMCPServer;
//# sourceMappingURL=server.d.ts.map