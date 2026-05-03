/**
 * SiftMemory MCP Tool Handlers
 * Each handler calls runtimeReadinessService.ensureReady("mcp_tool").
 * Health check uses GET /v1/health (not POST).
 * Daemon URL comes from configService.getDaemonUrl().
 */
import { runtimeReadinessService } from '../runtime/readiness.js';
import { configService } from '../runtime/config.js';
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
    async daemonFetch(path, options) {
        const daemonUrl = configService.getDaemonUrl();
        // Special case for health - uses GET, not POST
        if (path === '/v1/health' && (!options || options.method === 'GET' || !options.method)) {
            try {
                const response = await fetch(`${daemonUrl}${path}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (response.ok) {
                    const data = await response.json();
                    return { ok: data.ok !== false, data };
                }
                return { ok: false, error: `HTTP ${response.status}` };
            }
            catch (err) {
                return { ok: false, error: String(err) };
            }
        }
        try {
            const method = options?.useGet ? 'GET' : (options?.method || 'POST');
            const response = await fetch(`${daemonUrl}${path}`, {
                ...options,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(options?.headers || {}),
                },
            });
            if (response.ok) {
                const data = await response.json();
                return { ok: true, data };
            }
            return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }
        catch (err) {
            return { ok: false, error: String(err) };
        }
    }
    async handleBuildResumePack(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { scope = 'recent', limit = 5, cwd } = args;
        const result = await this.daemonFetch('/v1/resume/build', {
            method: 'POST',
            body: JSON.stringify({ workspace_id: cwd || process.cwd(), scope, limit }),
        });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleIngestEvent(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { event_type, tool_name, input, output, cwd } = args;
        const result = await this.daemonFetch('/v1/events', {
            method: 'POST',
            body: JSON.stringify({ event_type, tool_name, input, output, workspace_id: cwd || process.cwd() }),
        });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleRecordOutcome(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { outcome, summary, checkpoint_ids, cwd } = args;
        const result = await this.daemonFetch('/v1/outcomes', {
            method: 'POST',
            body: JSON.stringify({ outcome, summary, checkpoint_ids, workspace_id: cwd || process.cwd() }),
        });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleExtractCheckpoint(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { claim, evidence, uncertainty, invalidation_rule, tags, cwd } = args;
        const result = await this.daemonFetch('/v1/checkpoints/extract', {
            method: 'POST',
            body: JSON.stringify({ claim, evidence: evidence || [], uncertainty, invalidation_rule, tags: tags || [], workspace_id: cwd || process.cwd() }),
        });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleInspectMemory(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { scope = 'workspace', include_invalid = false, format = 'summary', cwd } = args;
        const result = await this.daemonFetch('/v1/retrieval/candidates', {
            method: 'POST',
            body: JSON.stringify({ workspace_id: cwd || process.cwd(), scope, include_invalid, format }),
        });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleSuppressMemory(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { checkpoint_ids, reason, cwd } = args;
        const result = await this.daemonFetch('/v1/checkpoints/suppress', {
            method: 'POST',
            body: JSON.stringify({ checkpoint_ids, reason, workspace_id: cwd || process.cwd() }),
        });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleSearch(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { query, limit = 5 } = args;
        const result = await this.daemonFetch('/v1/retrieval/candidates', {
            method: 'POST',
            body: JSON.stringify({ query, limit }),
        });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleCheckpointCreate(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { claim, evidence = [], uncertainty, invalidation_rule, tags = [] } = args;
        const result = await this.daemonFetch('/v1/checkpoints/extract', {
            method: 'POST',
            body: JSON.stringify({
                claim,
                evidence,
                uncertainty,
                invalidation_rule,
                tags,
                workspace_id: process.cwd(),
            }),
        });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: `Created: ${JSON.stringify(result.data)}` }] };
    }
    async handleCheckpointGet(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { id } = args;
        const result = await this.daemonFetch(`/v1/checkpoints/${id}`, { useGet: true });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Not found: ${id}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleCheckpointList(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { since, until, status, limit = 20 } = args;
        const params = new URLSearchParams();
        if (since)
            params.set('since', since);
        if (until)
            params.set('until', until);
        if (status)
            params.set('status', status);
        params.set('limit', String(limit));
        params.set('workspace_id', process.cwd());
        const result = await this.daemonFetch(`/v1/checkpoints?${params}`, { useGet: true });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleContextInject(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { scope = 'recent', limit = 5 } = args;
        const result = await this.daemonFetch('/v1/resume/build', {
            method: 'POST',
            body: JSON.stringify({
                workspace_id: process.cwd(),
                scope,
                limit,
            }),
        });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        const data = result.data;
        return { content: [{ type: 'text', text: data?.context || 'No context available' }] };
    }
    async handleStats(_args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const result = await this.daemonFetch('/v1/stats', { useGet: true });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleHealth(_args) {
        // Health check uses GET /v1/health - doesn't need full readiness
        // But we still check MCP tool readiness for consistency
        await runtimeReadinessService.ensureReady('mcp_tool');
        const result = await this.daemonFetch('/v1/health');
        if (!result.ok) {
            return {
                content: [{ type: 'text', text: 'Daemon is unhealthy' }],
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
        const { cwd } = args;
        const result = await this.daemonFetch('/v1/collective/status', { useGet: true });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleCollectiveImport(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { cwd, validate_after_import = true } = args;
        const result = await this.daemonFetch('/v1/collective/import', {
            method: 'POST',
            body: JSON.stringify({
                workspace_id: cwd || process.cwd(),
                validate_after_import,
            }),
        });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleCollectivePromote(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { checkpoint_id, cwd } = args;
        const result = await this.daemonFetch('/v1/collective/promote', {
            method: 'POST',
            body: JSON.stringify({
                workspace_id: cwd || process.cwd(),
                checkpoint_id,
                promotion_mode: 'manual',
                target: 'repo_collective',
            }),
        });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleCollectiveValidate(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { checkpoint_ids, validate_against_current_code = true, cwd } = args;
        const result = await this.daemonFetch('/v1/collective/validate', {
            method: 'POST',
            body: JSON.stringify({
                workspace_id: cwd || process.cwd(),
                checkpoint_ids: checkpoint_ids || [],
                validate_against_current_code,
            }),
        });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
    async handleCollectiveConflicts(args) {
        const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
        if (!readiness.ready) {
            return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
        }
        const { cwd } = args;
        const result = await this.daemonFetch('/v1/collective/conflicts', { useGet: true });
        if (!result.ok) {
            return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
    }
}
export const toolHandlers = new ToolHandlers();
//# sourceMappingURL=tool-handlers.js.map