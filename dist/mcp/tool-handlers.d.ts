/**
 * SiftMemory MCP Tool Handlers
 * Each handler calls runtimeReadinessService.ensureReady("mcp_tool").
 * Health check uses GET /v1/health (not POST).
 * Daemon URL comes from configService.getDaemonUrl().
 * All responses properly parse the ApiResponse<T> envelope.
 */
import { getToolDefinitions, ToolDefinition } from './tool-definitions.js';
export { getToolDefinitions, ToolDefinition };
export interface ToolHandler {
    (args: Record<string, unknown>): Promise<{
        content: {
            type: string;
            text: string;
        }[];
        isError?: boolean;
    }>;
}
export declare class ToolHandlers {
    private handlers;
    constructor();
    private registerHandlers;
    private resolveWorkspaceId;
    handle(request: {
        params: {
            name: string;
            arguments?: Record<string, unknown>;
        };
    }): Promise<{
        content: {
            type: string;
            text: string;
        }[];
        isError?: boolean;
    }>;
    private handleBuildResumePack;
    private handleIngestEvent;
    private handleRecordOutcome;
    private handleExtractCheckpoint;
    private handleInspectMemory;
    private handleSuppressMemory;
    private handleSearch;
    private handleCheckpointCreate;
    private handleCheckpointGet;
    private handleCheckpointList;
    private handleContextInject;
    private handleStats;
    private handleHealth;
    private handleCollectiveStatus;
    private handleCollectiveImport;
    private handleCollectivePromote;
    private handleCollectiveValidate;
    private handleCollectiveConflicts;
}
export declare const toolHandlers: ToolHandlers;
//# sourceMappingURL=tool-handlers.d.ts.map