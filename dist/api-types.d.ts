/**
 * API Response envelope types
 * Matches the SiftMemory core daemon ApiResponse<T> contract
 */
export interface ApiErrorBody {
    code: string;
    message: string;
    details?: unknown;
}
export interface ApiResponse<T> {
    ok: boolean;
    data?: T | null;
    error?: ApiErrorBody | null;
}
export declare function isApiSuccess<T>(response: ApiResponse<T>): response is ApiResponse<T> & {
    data: NonNullable<T>;
};
export declare function isApiError<T>(response: ApiResponse<T>): boolean;
export declare function getApiError(response: ApiResponse<unknown>): string;
export type HealthData = {
    status: string;
    version: string;
    storage_backend: string;
    workspace_count: number;
    active_jobs: number;
    uptime_ms: number;
};
export type InitWorkspaceResponse = {
    workspace_id: string;
    workspace_key: string;
    repo_root: string;
    config_path: string;
    database_path: string;
    created: boolean;
};
export type EventResponse = {
    event_id: string;
    payload_hash: string;
    queued_jobs: string[];
};
export type BatchEventResponse = {
    event_ids: string[];
    queued_jobs: string[];
    duplicates_skipped: number;
};
export type ExtractCheckpointResponse = {
    checkpoint_id: string;
    claim_ids: string[];
    uncertainty_ids: string[];
    evidence_ids: string[];
    status: string;
    warnings: string[];
};
export type BuildResumeResponse = {
    resume_pack_id: string;
    rendered_markdown: string;
    pack_json: unknown;
    consumed_checkpoint_ids: string[];
    warnings: string[];
};
export type RecordOutcomeResponse = {
    outcome_id: string;
    updated_checkpoint_ids: string[];
    invalidated_claim_ids: string[];
    confidence_updates: string[];
};
//# sourceMappingURL=api-types.d.ts.map