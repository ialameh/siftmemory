export type SiftMemoryRuntimeState = "uninitialized" | "unknown" | "checking" | "core_missing" | "core_installed_daemon_down" | "daemon_down" | "starting_daemon" | "restarting" | "ready" | "degraded" | "unhealthy" | "permanently_down" | "disabled_by_user";
export type RuntimeAction = "none" | "install_core" | "start_daemon" | "restart_daemon" | "check_again" | "disable_integration";
export type ReadinessReason = "session_start" | "user_prompt_submit" | "post_tool_use" | "post_tool_failure" | "post_tool_batch" | "pre_compact" | "post_compact" | "stop" | "stop_failure" | "cwd_changed" | "session_end" | "subagent_stop" | "command_check" | "command_status" | "command_start" | "command_resume" | "mcp_tool" | "explicit_check";
export interface RuntimeReadinessResult {
    ready: boolean;
    state: SiftMemoryRuntimeState;
    reason: ReadinessReason;
    action?: RuntimeAction;
    error?: string;
    pid?: number;
}
export interface PluginState {
    runtime: {
        state: SiftMemoryRuntimeState;
        lastHealthAttempt: number | null;
        lastHealthy: number | null;
        consecutiveFailures: number;
    };
    session: {
        hooksEnabled: boolean;
        startTime: number | null;
        workspaceId: string;
    };
    config: {
        disabled: boolean;
    };
}
export interface BinaryResolution {
    daemonPath: string | null;
    cliPath: string | null;
    searchPath: string[];
}
export interface HealthCheckResult {
    ok: boolean;
    version?: string;
    error?: string;
    latencyMs?: number;
}
export interface DaemonStartResult {
    started: boolean;
    pid?: number;
    error?: string;
}
export interface SiftMemoryPluginConfig {
    daemonUrl: string;
    autoStartDaemon: boolean;
    startupTimeoutMs: number;
    activeHeartbeatIntervalMs: number;
    idleHeartbeatIntervalMs: number;
    maxHeartbeatFailures: number;
    maxRestartAttempts: number;
    healthCacheTtlMs: number;
    notifyCoreMissing: boolean;
    notifyDaemonDown: boolean;
    disableWhenCoreMissing: boolean;
    daemonPath: string | null;
    cliPath: string | null;
    releaseUrl: string;
    injectOnSessionStart: boolean;
    injectOnUserPrompt: boolean;
    captureToolEvents: boolean;
    captureFailures: boolean;
    extractBeforeCompact: boolean;
    recordOutcomesOnStop: boolean;
    strictHookFailures: boolean;
    disabled: boolean;
}
export type HookOutputMode = "plain_stdout" | "structured_json";
export interface Event {
    type: 'tool_use' | 'claim' | 'decision' | 'invalidation';
    tool?: string;
    input?: unknown;
    output?: unknown;
    timestamp: number;
    claim?: string;
    evidence?: string[];
    uncertainty?: string;
    invalidation_rule?: string;
}
export interface EventPayload {
    workspaceId?: string;
    sessionId?: string;
    actor: "User" | "Assistant" | "Tool" | "System";
    eventType: string;
    tool?: string;
    filePath?: string;
    symbolRefs?: string[];
    payload: Record<string, unknown>;
    privacyLevel?: "Private" | "Redacted" | "Shareable" | "Collective";
}
export interface ResumePackRequest {
    workspaceId: string;
    sessionId?: string;
    task: string;
    mode: "Minimal" | "Standard" | "Deep" | "Audit";
    openFiles?: string[];
    changedFiles?: string[];
    recentFiles?: string[];
    tokenBudget?: number;
}
export interface ResumePackResponse {
    resumePackId: string;
    renderedMarkdown: string;
    consumedCheckpointIds: string[];
    warnings?: string[];
}
export declare const DEFAULT_CONFIG: SiftMemoryPluginConfig;
//# sourceMappingURL=types.d.ts.map