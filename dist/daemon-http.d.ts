/**
 * SiftMemory Daemon HTTP Client
 * Properly handles ApiResponse<T> envelope and implements retry with backoff.
 */
import { ApiResponse, isApiSuccess, getApiError, HealthData, InitWorkspaceResponse, EventResponse, BatchEventResponse, ExtractCheckpointResponse, BuildResumeResponse, RecordOutcomeResponse } from './api-types.js';
export interface DaemonClient {
    health(): Promise<ApiResponse<HealthData>>;
    initWorkspace(repoRoot: string, userEmail?: string): Promise<ApiResponse<InitWorkspaceResponse>>;
    ingestEvent(event: Record<string, unknown>): Promise<ApiResponse<EventResponse>>;
    ingestEventBatch(workspaceId: string, events: Record<string, unknown>[]): Promise<ApiResponse<BatchEventResponse>>;
    extractCheckpoint(params: Record<string, unknown>): Promise<ApiResponse<ExtractCheckpointResponse>>;
    buildResume(params: Record<string, unknown>): Promise<ApiResponse<BuildResumeResponse>>;
    recordOutcome(params: Record<string, unknown>): Promise<ApiResponse<RecordOutcomeResponse>>;
    collectiveStatus(workspaceId: string): Promise<ApiResponse<unknown>>;
    collectiveConflicts(workspaceId: string): Promise<ApiResponse<unknown>>;
    collectivePromote(workspaceId: string, checkpointId: string): Promise<ApiResponse<unknown>>;
    collectiveValidate(workspaceId: string, checkpointId?: string): Promise<ApiResponse<unknown>>;
    collectiveImport(workspaceId: string): Promise<ApiResponse<unknown>>;
}
declare class DaemonClientImpl implements DaemonClient {
    private fetch;
    health(): Promise<ApiResponse<HealthData>>;
    initWorkspace(repoRoot: string, userEmail?: string, createRepoConfig?: boolean): Promise<ApiResponse<InitWorkspaceResponse>>;
    ingestEvent(event: Record<string, unknown>): Promise<ApiResponse<EventResponse>>;
    ingestEventBatch(workspaceId: string, events: Record<string, unknown>[]): Promise<ApiResponse<BatchEventResponse>>;
    extractCheckpoint(params: Record<string, unknown>): Promise<ApiResponse<ExtractCheckpointResponse>>;
    buildResume(params: Record<string, unknown>): Promise<ApiResponse<BuildResumeResponse>>;
    recordOutcome(params: Record<string, unknown>): Promise<ApiResponse<RecordOutcomeResponse>>;
    collectiveStatus(workspaceId: string): Promise<ApiResponse<unknown>>;
    collectiveConflicts(workspaceId: string): Promise<ApiResponse<unknown>>;
    collectivePromote(workspaceId: string, checkpointId: string): Promise<ApiResponse<unknown>>;
    collectiveValidate(workspaceId: string, checkpointId?: string): Promise<ApiResponse<unknown>>;
    collectiveImport(workspaceId: string): Promise<ApiResponse<unknown>>;
}
export declare function apiFetch<T>(baseUrl: string, path: string, options?: RequestInit & {
    timeoutMs?: number;
}): Promise<ApiResponse<T>>;
export declare const daemonClient: DaemonClientImpl;
export { isApiSuccess, getApiError };
export interface WorkspaceInfo {
    workspace_id: string;
    workspace_key: string;
}
export declare function ensureWorkspace(cwd: string): Promise<WorkspaceInfo | null>;
export declare function recordOutcome(workspaceId: string, outcome: 'success' | 'partial' | 'failed' | 'neutral', summary: string, consumedCheckpointIds?: string[]): Promise<void>;
export declare function getDaemonHealth(): Promise<{
    ok: boolean;
    version?: string;
    error?: string;
}>;
export declare function buildResumePack(params: {
    workspaceId: string;
    sessionId: string;
    task: string;
    mode?: 'standard' | 'focused' | 'broad';
    tokenBudget?: number;
    includePrivate?: boolean;
    includeCollective?: boolean;
    collectivePolicy?: string;
}): Promise<{
    resume_pack_id?: string;
    rendered_markdown?: string;
    warnings?: string[];
}>;
//# sourceMappingURL=daemon-http.d.ts.map