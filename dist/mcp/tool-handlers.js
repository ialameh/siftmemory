/**
 * SiftMemory MCP Tool Handlers
 * Each handler calls runtimeReadinessService.ensureReady("mcp_tool").
 * Health check uses GET /v1/health (not POST).
 * Daemon URL comes from configService.getDaemonUrl().
 * All responses properly parse the ApiResponse<T> envelope.
 */
import { runtimeReadinessService } from '../runtime/readiness.js';
import { configService } from '../runtime/config.js';
import { daemonClient, apiFetch, isApiSuccess, getApiError, ensureWorkspace } from '../daemon-http.js';
import { getToolDefinitions } from './tool-definitions.js';
export { getToolDefinitions };
export class ToolHandlers {
    handlers = new Map();
    constructor() {
        this.registerHandlers();
    }
    registerHandlers() {
        this.handlers.set('siftmemory_build_resume_pack', this.handleBuildResumePack.bind(this));
        this.handlers.set('siftmemory_ingest_event', this.handleIngestEvent.bind(this));
        this.handlers.set('siftmemory_record_outcome', this.handleRecordOutcome.bind(this));
        this.handlers.set('siftmemory_extract_checkpoint', this.handleExtractCheckpoint.bind(this));
        this.handlers.set('siftmemory_inspect_memory', this.handleInspectMemory.bind(this));
        this.handlers.set('siftmemory_suppress_memory', this.handleSuppressMemory.bind(this));
        this.handlers.set('siftmemory_search', this.handleSearch.bind(this));
        this.handlers.set('siftmemory_checkpoint_create', this.handleCheckpointCreate.bind(this));
        this.handlers.set('siftmemory_checkpoint_get', this.handleCheckpointGet.bind(this));
        this.handlers.set('siftmemory_checkpoint_list', this.handleCheckpointList.bind(this));
        this.handlers.set('siftmemory_context_inject', this.handleContextInject.bind(this));
        this.handlers.set('siftmemory_stats', this.handleStats.bind(this));
        this.handlers.set('siftmemory_health', this.handleHealth.bind(this));
        this.handlers.set('siftmemory_collective_status', this.handleCollectiveStatus.bind(this));
        this.handlers.set('siftmemory_collective_import', this.handleCollectiveImport.bind(this));
        this.handlers.set('siftmemory_collective_promote', this.handleCollectivePromote.bind(this));
        this.handlers.set('siftmemory_collective_validate', this.handleCollectiveValidate.bind(this));
        this.handlers.set('siftmemory_collective_conflicts', this.handleCollectiveConflicts.bind(this));
    }
    async resolveWorkspaceId(workspaceId) {
        if (workspaceId?.trim()) {
            return workspaceId.trim();
        }
        const workspace = await ensureWorkspace(process.cwd());
        return workspace?.workspace_id ?? null;
    }
    async handle(request) {
        const handler = this.handlers.get(request.params.name);
        if (!handler) {
            return {
                content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
                isError: true,
            };
        }
        try {
            return await handler(request.params.arguments || {});
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [{ type: 'text', text: `Error: ${message}` }],
                isError: true,
            };
        }
    }
    async handleBuildResumePack(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { workspace_id, session_id, task, mode, token_budget, include_private, include_collective, collective_policy } = args;
        const resolvedWorkspaceId = await this.resolveWorkspaceId(workspace_id);
        if (!resolvedWorkspaceId) {
            return { content: [{ type: 'text', text: 'Failed: workspace could not be resolved' }], isError: true };
        }
        const result = await daemonClient.buildResume({
            workspace_id: resolvedWorkspaceId,
            session_id: session_id || process.env.SIFTMEMORY_SESSION_ID || 'unknown',
            task: task || 'resume',
            mode: mode || 'standard',
            token_budget: token_budget || 4096,
            include_private: include_private ?? false,
            include_collective: include_collective ?? true,
            collective_policy: collective_policy || 'validated_only',
        });
        if (!isApiSuccess(result)) {
            return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleIngestEvent(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const result = await daemonClient.ingestEvent(args);
        if (!isApiSuccess(result)) {
            return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleRecordOutcome(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const result = await daemonClient.recordOutcome(args);
        if (!isApiSuccess(result)) {
            return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleExtractCheckpoint(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const result = await daemonClient.extractCheckpoint(args);
        if (!isApiSuccess(result)) {
            return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleInspectMemory(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        // POST /v1/retrieval/candidates with workspace_id and scope params
        const { workspace_id, scope, include_invalid, format } = args;
        const resolvedWorkspaceId = await this.resolveWorkspaceId(workspace_id);
        if (!resolvedWorkspaceId) {
            return { content: [{ type: 'text', text: 'Failed: workspace could not be resolved' }], isError: true };
        }
        const result = await apiFetch(configService.getDaemonUrl(), '/v1/retrieval/candidates', {
            method: 'POST',
            body: JSON.stringify({
                workspace_id: resolvedWorkspaceId,
                scope: scope || 'workspace',
                include_invalid: include_invalid ?? false,
                format: format || 'summary',
            }),
        });
        if (!isApiSuccess(result)) {
            return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleSuppressMemory(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { checkpoint_ids, reason } = args;
        const result = await apiFetch(configService.getDaemonUrl(), '/v1/checkpoints/suppress', {
            method: 'POST',
            body: JSON.stringify({ checkpoint_ids, reason }),
        });
        if (!isApiSuccess(result)) {
            return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleSearch(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { query, limit, workspace_id } = args;
        const resolvedWorkspaceId = await this.resolveWorkspaceId(workspace_id);
        if (!resolvedWorkspaceId) {
            return { content: [{ type: 'text', text: 'Failed: workspace could not be resolved' }], isError: true };
        }
        const result = await apiFetch(configService.getDaemonUrl(), '/v1/retrieval/candidates', {
            method: 'POST',
            body: JSON.stringify({ workspace_id: resolvedWorkspaceId, scope: { query }, limit: limit || 5 }),
        });
        if (!isApiSuccess(result)) {
            return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleCheckpointCreate(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { workspace_id, session_id, claim, evidence, uncertainty, invalidation_rule, tags, origin } = args;
        const resolvedWorkspaceId = await this.resolveWorkspaceId(workspace_id);
        if (!resolvedWorkspaceId) {
            return { content: [{ type: 'text', text: 'Failed: workspace could not be resolved' }], isError: true };
        }
        const result = await daemonClient.extractCheckpoint({
            workspace_id: resolvedWorkspaceId,
            session_id: session_id || process.env.SIFTMEMORY_SESSION_ID || 'unknown',
            event_ids: [],
            claim,
            evidence: evidence || [],
            uncertainty,
            invalidation_rule,
            tags: tags || [],
            origin: origin || 'Manual',
        });
        if (!isApiSuccess(result)) {
            return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleCheckpointGet(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { id, workspace_id } = args;
        const resolvedWorkspaceId = await this.resolveWorkspaceId(workspace_id);
        if (!resolvedWorkspaceId) {
            return { content: [{ type: 'text', text: 'Failed: workspace could not be resolved' }], isError: true };
        }
        const result = await apiFetch(configService.getDaemonUrl(), `/v1/checkpoints/${encodeURIComponent(id)}?workspace_id=${encodeURIComponent(resolvedWorkspaceId)}`, { method: 'GET' });
        if (!isApiSuccess(result)) {
            return { content: [{ type: 'text', text: `Not found: ${id}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleCheckpointList(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { workspace_id, since, until, status, limit } = args;
        const resolvedWorkspaceId = await this.resolveWorkspaceId(workspace_id);
        if (!resolvedWorkspaceId) {
            return { content: [{ type: 'text', text: 'Failed: workspace could not be resolved' }], isError: true };
        }
        const params = new URLSearchParams();
        params.set('workspace_id', resolvedWorkspaceId);
        params.set('limit', String(limit || 20));
        if (since)
            params.set('since', since);
        if (until)
            params.set('until', until);
        if (status)
            params.set('status', status);
        const result = await apiFetch(configService.getDaemonUrl(), `/v1/checkpoints?${params}`, { method: 'GET' });
        if (!isApiSuccess(result)) {
            return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleContextInject(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { workspace_id, session_id, task, mode, token_budget } = args;
        const resolvedWorkspaceId = await this.resolveWorkspaceId(workspace_id);
        if (!resolvedWorkspaceId) {
            return { content: [{ type: 'text', text: 'Failed: workspace could not be resolved' }], isError: true };
        }
        const result = await daemonClient.buildResume({
            workspace_id: resolvedWorkspaceId,
            session_id: session_id || process.env.SIFTMEMORY_SESSION_ID || 'unknown',
            task: task || 'context inject',
            mode: mode || 'standard',
            token_budget: token_budget || 4096,
            include_private: false,
            include_collective: true,
            collective_policy: 'validated_only',
        });
        if (!isApiSuccess(result)) {
            return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
        }
        const data = result.data;
        return { content: [{ type: 'text', text: data?.rendered_markdown || 'No context available' }] };
    }
    async handleStats(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const health = await daemonClient.health();
        if (!isApiSuccess(health)) {
            return { content: [{ type: 'text', text: `Failed: ${getApiError(health)}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ health: health.data }, null, 2) }] };
    }
    async handleHealth(args) {
        // Health check uses GET /v1/health
        await runtimeReadinessService.ensureReady('mcp_tool');
        const result = await daemonClient.health();
        if (!isApiSuccess(result)) {
            return {
                content: [{ type: 'text', text: `Daemon unhealthy: ${getApiError(result)}` }],
                isError: true,
            };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleCollectiveStatus(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { workspace_id } = args;
        const resolvedWorkspaceId = await this.resolveWorkspaceId(workspace_id);
        if (!resolvedWorkspaceId) {
            return { content: [{ type: 'text', text: 'Failed: workspace could not be resolved' }], isError: true };
        }
        const result = await apiFetch(configService.getDaemonUrl(), `/v1/collective/status?workspace_id=${encodeURIComponent(resolvedWorkspaceId)}`, { method: 'GET' });
        return {
            content: [{
                    type: 'text',
                    text: result.error?.code === 'FEATURE_NOT_IMPLEMENTED'
                        ? 'Collective memory not yet implemented (Phase 6)'
                        : JSON.stringify(result.data, null, 2),
                }],
            isError: result.error?.code === 'FEATURE_NOT_IMPLEMENTED',
        };
    }
    async handleCollectiveImport(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const result = await apiFetch(configService.getDaemonUrl(), '/v1/collective/import', {
            method: 'POST',
            body: JSON.stringify(args),
        });
        return {
            content: [{
                    type: 'text',
                    text: result.error?.code === 'FEATURE_NOT_IMPLEMENTED'
                        ? 'Collective memory not yet implemented (Phase 6)'
                        : JSON.stringify(result.data, null, 2),
                }],
            isError: result.error?.code === 'FEATURE_NOT_IMPLEMENTED',
        };
    }
    async handleCollectivePromote(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const result = await apiFetch(configService.getDaemonUrl(), '/v1/collective/promote', {
            method: 'POST',
            body: JSON.stringify(args),
        });
        return {
            content: [{
                    type: 'text',
                    text: result.error?.code === 'FEATURE_NOT_IMPLEMENTED'
                        ? 'Collective memory not yet implemented (Phase 6)'
                        : JSON.stringify(result.data, null, 2),
                }],
            isError: result.error?.code === 'FEATURE_NOT_IMPLEMENTED',
        };
    }
    async handleCollectiveValidate(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const result = await apiFetch(configService.getDaemonUrl(), '/v1/collective/validate', {
            method: 'POST',
            body: JSON.stringify(args),
        });
        return {
            content: [{
                    type: 'text',
                    text: result.error?.code === 'FEATURE_NOT_IMPLEMENTED'
                        ? 'Collective memory not yet implemented (Phase 6)'
                        : JSON.stringify(result.data, null, 2),
                }],
            isError: result.error?.code === 'FEATURE_NOT_IMPLEMENTED',
        };
    }
    async handleCollectiveConflicts(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { workspace_id } = args;
        const resolvedWorkspaceId = await this.resolveWorkspaceId(workspace_id);
        if (!resolvedWorkspaceId) {
            return { content: [{ type: 'text', text: 'Failed: workspace could not be resolved' }], isError: true };
        }
        const result = await apiFetch(configService.getDaemonUrl(), `/v1/collective/conflicts?workspace_id=${encodeURIComponent(resolvedWorkspaceId)}`, { method: 'GET' });
        return {
            content: [{
                    type: 'text',
                    text: result.error?.code === 'FEATURE_NOT_IMPLEMENTED'
                        ? 'Collective memory not yet implemented (Phase 6)'
                        : JSON.stringify(result.data, null, 2),
                }],
            isError: result.error?.code === 'FEATURE_NOT_IMPLEMENTED',
        };
    }
}
export const toolHandlers = new ToolHandlers();
//# sourceMappingURL=tool-handlers.js.map