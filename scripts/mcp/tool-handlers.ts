/**
 * SiftMemory MCP Tool Handlers
 * Each handler calls runtimeReadinessService.ensureReady("mcp_tool").
 * Health check uses GET /v1/health (not POST).
 * Daemon URL comes from configService.getDaemonUrl().
 */

import { runtimeReadinessService } from '../runtime/readiness.js';
import { configService } from '../runtime/config.js';
import { getToolDefinitions, ToolDefinition } from './tool-definitions.js';

export { getToolDefinitions, ToolDefinition };

export interface ToolHandler {
  (args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;
}

export class ToolHandlers {
  private handlers = new Map<string, ToolHandler>();

  constructor() {
    this.registerHandlers();
  }

  private registerHandlers(): void {
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

  async handle(request: { params: { name: string; arguments?: Record<string, unknown> } }): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const handler = this.handlers.get(request.params.name);

    if (!handler) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }

    try {
      return await handler(request.params.arguments || {});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  }

  private async daemonFetch(
    path: string,
    options?: RequestInit & { useGet?: boolean }
  ): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    const daemonUrl = configService.getDaemonUrl();

    // Special case for health - uses GET, not POST
    if (path === '/v1/health' && (!options || options.method === 'GET' || !options.method)) {
      try {
        const response = await fetch(`${daemonUrl}${path}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const data = await response.json() as { ok?: boolean; data?: unknown };
          return { ok: data.ok !== false, data };
        }
        return { ok: false, error: `HTTP ${response.status}` };
      } catch (err) {
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
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  private async handleBuildResumePack(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { scope = 'recent', limit = 5, cwd } = args as { scope?: string; limit?: number; cwd?: string };
    const result = await this.daemonFetch('/v1/resume/build', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: cwd || process.cwd(), scope, limit }),
    });

    if (!result.ok) {
      return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleIngestEvent(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { event_type, tool_name, input, output, cwd } = args as { event_type: string; tool_name?: string; input?: unknown; output?: unknown; cwd?: string };
    const result = await this.daemonFetch('/v1/events', {
      method: 'POST',
      body: JSON.stringify({ event_type, tool_name, input, output, workspace_id: cwd || process.cwd() }),
    });

    if (!result.ok) {
      return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleRecordOutcome(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { outcome, summary, checkpoint_ids, cwd } = args as { outcome: string; summary?: string; checkpoint_ids?: string[]; cwd?: string };
    const result = await this.daemonFetch('/v1/outcomes', {
      method: 'POST',
      body: JSON.stringify({ outcome, summary, checkpoint_ids, workspace_id: cwd || process.cwd() }),
    });

    if (!result.ok) {
      return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleExtractCheckpoint(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { claim, evidence, uncertainty, invalidation_rule, tags, cwd } = args as { claim?: string; evidence?: string[]; uncertainty?: string; invalidation_rule?: string; tags?: string[]; cwd?: string };
    const result = await this.daemonFetch('/v1/checkpoints/extract', {
      method: 'POST',
      body: JSON.stringify({ claim, evidence: evidence || [], uncertainty, invalidation_rule, tags: tags || [], workspace_id: cwd || process.cwd() }),
    });

    if (!result.ok) {
      return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleInspectMemory(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { scope = 'workspace', include_invalid = false, format = 'summary', cwd } = args as { scope?: string; include_invalid?: boolean; format?: string; cwd?: string };
    const result = await this.daemonFetch('/v1/retrieval/candidates', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: cwd || process.cwd(), scope, include_invalid, format }),
    });

    if (!result.ok) {
      return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleSuppressMemory(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { checkpoint_ids, reason, cwd } = args as { checkpoint_ids: string[]; reason?: string; cwd?: string };
    const result = await this.daemonFetch('/v1/checkpoints/suppress', {
      method: 'POST',
      body: JSON.stringify({ checkpoint_ids, reason, workspace_id: cwd || process.cwd() }),
    });

    if (!result.ok) {
      return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleSearch(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { query, limit = 5 } = args as { query: string; limit?: number };
    const result = await this.daemonFetch('/v1/retrieval/candidates', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    });

    if (!result.ok) {
      return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleCheckpointCreate(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { claim, evidence = [], uncertainty, invalidation_rule, tags = [] } = args as { claim: string; evidence?: string[]; uncertainty?: string; invalidation_rule?: string; tags?: string[] };
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

  private async handleCheckpointGet(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { id } = args as { id: string };
    const result = await this.daemonFetch(`/v1/checkpoints/${id}`, { useGet: true });

    if (!result.ok) {
      return { content: [{ type: 'text', text: `Not found: ${id}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleCheckpointList(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { since, until, status, limit = 20 } = args as { since?: string; until?: string; status?: string; limit?: number };
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (until) params.set('until', until);
    if (status) params.set('status', status);
    params.set('limit', String(limit));
    params.set('workspace_id', process.cwd());

    const result = await this.daemonFetch(`/v1/checkpoints?${params}`, { useGet: true });

    if (!result.ok) {
      return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleContextInject(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { scope = 'recent', limit = 5 } = args as { scope?: string; limit?: number };
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

    const data = result.data as { context?: string } | undefined;
    return { content: [{ type: 'text', text: data?.context || 'No context available' }] };
  }

  private async handleStats(_args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
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

  private async handleHealth(_args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
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

  private async handleCollectiveStatus(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { cwd } = args as { cwd?: string };
    const result = await this.daemonFetch('/v1/collective/status', { useGet: true });

    if (!result.ok) {
      return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleCollectiveImport(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { cwd, validate_after_import = true } = args as { cwd?: string; validate_after_import?: boolean };
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

  private async handleCollectivePromote(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { checkpoint_id, cwd } = args as { checkpoint_id: string; cwd?: string };
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

  private async handleCollectiveValidate(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { checkpoint_ids, validate_against_current_code = true, cwd } = args as { checkpoint_ids?: string[]; validate_against_current_code?: boolean; cwd?: string };
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

  private async handleCollectiveConflicts(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { cwd } = args as { cwd?: string };
    const result = await this.daemonFetch('/v1/collective/conflicts', { useGet: true });

    if (!result.ok) {
      return { content: [{ type: 'text', text: `Failed: ${result.error}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }
}

export const toolHandlers = new ToolHandlers();
