/**
 * SiftMemory Daemon Client
 * Single client used by hooks, commands, and MCP tools.
 */
export interface WorkspaceInfo {
    workspace_id: string;
    workspace_key: string;
}
export declare function initWorkspace(cwd: string): Promise<WorkspaceInfo | null>;
export declare function ensureWorkspace(cwd: string): Promise<WorkspaceInfo | null>;
export declare function recordOutcome(workspaceId: string, outcome: 'success' | 'partial' | 'failed' | 'neutral', summary: string, checkpointIds?: string[]): Promise<void>;
export declare function getDaemonHealth(): Promise<{
    ok: boolean;
    version?: string;
    error?: string;
}>;
export declare function buildResumePack(params: {
    workspaceId: string;
    sessionId: string;
    task: string;
    mode?: string;
    tokenBudget?: number;
    includePrivate?: boolean;
    includeCollective?: boolean;
    collectivePolicy?: string;
}): Promise<{
    resume_pack_id?: string;
    context?: string;
}>;
//# sourceMappingURL=daemon-client.d.ts.map