/**
 * SiftMemory MCP Tool Handlers
 * Each handler calls runtimeReadinessService.ensureReady("mcp_tool").
 * Health check uses GET /v1/health (not POST).
 * Daemon URL comes from configService.getDaemonUrl().
 * All responses properly parse the ApiResponse<T> envelope.
 */

import { runtimeReadinessService } from '../runtime/readiness.js';
import { configService } from '../runtime/config.js';
import { daemonClient, apiFetch, isApiSuccess, getApiError } from '../daemon-http.js';
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

  private async handleBuildResumePack(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { workspace_id, session_id, task, mode, token_budget, include_private, include_collective, collective_policy } = args as {
      workspace_id?: string;
      session_id?: string;
      task?: string;
      mode?: string;
      token_budget?: number;
      include_private?: boolean;
      include_collective?: boolean;
      collective_policy?: string;
    };

    const result = await daemonClient.buildResume({
      workspace_id: workspace_id || process.cwd(),
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

  private async handleIngestEvent(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const result = await daemonClient.ingestEvent(args as Record<string, unknown>);

    if (!isApiSuccess(result)) {
      return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleRecordOutcome(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
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

  private async handleExtractCheckpoint(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
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

  private async handleInspectMemory(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    // POST /v1/retrieval/candidates with workspace_id and scope params
    const { workspace_id, scope, include_invalid, format } = args as {
      workspace_id?: string;
      scope?: string;
      include_invalid?: boolean;
      format?: string;
    };

    const result = await apiFetch<{ candidates: unknown[] }>(configService.getDaemonUrl(), '/v1/retrieval/candidates', {
      method: 'POST',
      body: JSON.stringify({
        workspace_id: workspace_id || process.cwd(),
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

  private async handleSuppressMemory(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { checkpoint_ids, reason } = args as { checkpoint_ids: string[]; reason?: string };
    const result = await apiFetch(configService.getDaemonUrl(), '/v1/checkpoints/suppress', {
      method: 'POST',
      body: JSON.stringify({ checkpoint_ids, reason }),
    });

    if (!isApiSuccess(result)) {
      return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleSearch(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { query, limit } = args as { query: string; limit?: number };
    const result = await apiFetch<{ candidates: unknown[] }>(configService.getDaemonUrl(), '/v1/retrieval/candidates', {
      method: 'POST',
      body: JSON.stringify({ query, limit: limit || 5 }),
    });

    if (!isApiSuccess(result)) {
      return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleCheckpointCreate(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { workspace_id, session_id, claim, evidence, uncertainty, invalidation_rule, tags, origin } = args as {
      workspace_id?: string;
      session_id?: string;
      claim?: string;
      evidence?: string[];
      uncertainty?: string;
      invalidation_rule?: string;
      tags?: string[];
      origin?: string;
    };

    const result = await daemonClient.extractCheckpoint({
      workspace_id: workspace_id || process.cwd(),
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

  private async handleCheckpointGet(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { id } = args as { id: string };
    const result = await apiFetch(configService.getDaemonUrl(), `/v1/checkpoints/${id}`, { method: 'GET' });

    if (!isApiSuccess(result)) {
      return { content: [{ type: 'text', text: `Not found: ${id}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleCheckpointList(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { workspace_id, since, until, status, limit } = args as {
      workspace_id?: string;
      since?: string;
      until?: string;
      status?: string;
      limit?: number;
    };

    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (until) params.set('until', until);
    if (status) params.set('status', status);
    params.set('limit', String(limit || 20));

    const result = await apiFetch(configService.getDaemonUrl(), `/v1/checkpoints?${params}`, { method: 'GET' });

    if (!isApiSuccess(result)) {
      return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleContextInject(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const { workspace_id, session_id, task, mode, token_budget } = args as {
      workspace_id?: string;
      session_id?: string;
      task?: string;
      mode?: string;
      token_budget?: number;
    };

    const result = await daemonClient.buildResume({
      workspace_id: workspace_id || process.cwd(),
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

    const data = result.data as { rendered_markdown?: string };
    return { content: [{ type: 'text', text: data?.rendered_markdown || 'No context available' }] };
  }

  private async handleStats(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const result = await apiFetch(configService.getDaemonUrl(), '/v1/stats', { method: 'GET' });

    if (!isApiSuccess(result)) {
      return { content: [{ type: 'text', text: `Failed: ${getApiError(result)}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
  }

  private async handleHealth(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
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

  private async handleCollectiveStatus(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    // Collective endpoints return FEATURE_NOT_IMPLEMENTED per spec
    const result = await apiFetch(configService.getDaemonUrl(), '/v1/collective/status', { method: 'GET' });

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

  private async handleCollectiveImport(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
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

  private async handleCollectivePromote(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
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

  private async handleCollectiveValidate(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
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

  private async handleCollectiveConflicts(args: Record<string, unknown>): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
    const readiness = await runtimeReadinessService.ensureReady('mcp_tool');
    if (!readiness.ready) {
      return { content: [{ type: 'text', text: `Daemon not ready: ${readiness.state}` }], isError: true };
    }

    const result = await apiFetch(configService.getDaemonUrl(), '/v1/collective/conflicts', { method: 'GET' });

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
