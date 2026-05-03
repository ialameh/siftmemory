export interface CallToolRequest {
    params: {
        name: string;
        arguments?: Record<string, unknown>;
    };
}
export interface CallToolResponse {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
}
export interface ToolHandler {
    (args: Record<string, unknown>): Promise<CallToolResponse>;
}
export declare class ToolHandlers {
    private handlers;
    constructor();
    private registerHandlers;
    handle(request: CallToolRequest): Promise<CallToolResponse>;
    private handleSearch;
    private handleCheckpointCreate;
    private handleCheckpointGet;
    private handleCheckpointList;
    private handleContextInject;
    private handleStats;
    private handleHealth;
}
export declare const toolHandlers: ToolHandlers;
//# sourceMappingURL=tool-handlers.d.ts.map