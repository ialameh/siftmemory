/**
 * SiftMemory MCP Server
 * MCP server implementation with proper readiness checks.
 *
 * IMPORTANT: This server starts even when core is missing.
 * Tools check readiness individually via runtimeReadinessService.
 */

import { EventEmitter } from 'events';
import { toolHandlers, ToolHandlers } from './tool-handlers.js';
import { getToolDefinitions, ToolDefinition } from './tool-definitions.js';
import { runtimeReadinessService } from '../runtime/readiness.js';
import { configService } from '../runtime/config.js';

export { toolHandlers, ToolHandlers };
export { getToolDefinitions, ToolDefinition };

export class SiftMemoryMCPServer extends EventEmitter {
  private isRunning: boolean = false;

  constructor() {
    super();
  }

  async handleRequest(request: { method: string; params?: { name?: string; arguments?: Record<string, unknown> } }): Promise<{ content: { type: string; text: string }[]; isError?: boolean } | { tools: ToolDefinition[] }> {
    // MCP tools/list - return tool definitions even when daemon is down
    if (request.method === 'tools/list') {
      return {
        tools: getToolDefinitions(),
      };
    }

    // MCP tools/call - all tools go through readiness check
    if (request.method === 'tools/call') {
      const toolName = request.params?.name;
      const args = request.params?.arguments || {};

      if (!toolName) {
        return {
          content: [{ type: 'text', text: 'Missing tool name' }],
          isError: true,
        };
      }

      // All tools require mcp_tool readiness check
      const readiness = await runtimeReadinessService.ensureReady('mcp_tool');

      // For tools that need daemon, check if ready
      const daemonTools = [
        'siftmemory_build_resume_pack',
        'siftmemory_ingest_event',
        'siftmemory_record_outcome',
        'siftmemory_extract_checkpoint',
        'siftmemory_inspect_memory',
        'siftmemory_suppress_memory',
        'siftmemory_search',
        'siftmemory_checkpoint_create',
        'siftmemory_checkpoint_get',
        'siftmemory_checkpoint_list',
        'siftmemory_context_inject',
        'siftmemory_stats',
        'siftmemory_collective_status',
        'siftmemory_collective_import',
        'siftmemory_collective_promote',
        'siftmemory_collective_validate',
        'siftmemory_collective_conflicts',
      ];

      if (daemonTools.includes(toolName) && !readiness.ready) {
        // Daemon tools return error if not ready, but server keeps running
        return {
          content: [{
            type: 'text',
            text: `SiftMemory daemon is not ready (state: ${readiness.state}). Message: ${readiness.reason}`,
          }],
          isError: true,
        };
      }

      // Handle the tool
      return await toolHandlers.handle({
        params: {
          name: toolName,
          arguments: args,
        },
      });
    }

    throw new Error(`Unknown method: ${request.method}`);
  }

  async start(): Promise<void> {
    // MCP server starts even when core is missing
    // Tools will report not-ready individually
    this.isRunning = true;
    console.error('[SiftMemory] MCP server started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.removeAllListeners();
    console.error('[SiftMemory] MCP server stopped');
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }
}

export const mcpServer = new SiftMemoryMCPServer();
