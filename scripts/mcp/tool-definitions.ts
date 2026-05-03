/**
 * SiftMemory MCP Tool Definitions
 * Type definitions for MCP tools.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'siftmemory_build_resume_pack',
    description: 'Build a Reasoning Resume Pack for the current workspace and task context',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['recent', 'session', 'workspace'],
          description: 'Context scope (default: recent)',
          default: 'recent',
        },
        limit: {
          type: 'number',
          description: 'Maximum checkpoints to include (default: 5)',
          default: 5,
        },
        cwd: {
          type: 'string',
          description: 'Working directory for workspace resolution',
        },
      },
    },
  },
  {
    name: 'siftmemory_ingest_event',
    description: 'Ingest a development event into SiftMemory',
    inputSchema: {
      type: 'object',
      properties: {
        event_type: {
          type: 'string',
          description: 'Type of event',
        },
        tool_name: {
          type: 'string',
          description: 'Name of tool used',
        },
        input: {
          type: 'object',
          description: 'Tool input data',
        },
        output: {
          type: 'object',
          description: 'Tool output data',
        },
        cwd: {
          type: 'string',
          description: 'Working directory',
        },
      },
    },
  },
  {
    name: 'siftmemory_record_outcome',
    description: 'Record the outcome of a Claude session',
    inputSchema: {
      type: 'object',
      properties: {
        outcome: {
          type: 'string',
          enum: ['success', 'partial', 'failed'],
          description: 'Session outcome',
        },
        summary: {
          type: 'string',
          description: 'Brief summary of what was accomplished',
        },
        checkpoint_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Checkpoints used in this session',
        },
        cwd: {
          type: 'string',
          description: 'Working directory',
        },
      },
      required: ['outcome'],
    },
  },
  {
    name: 'siftmemory_extract_checkpoint',
    description: 'Extract reasoning checkpoint from recent events',
    inputSchema: {
      type: 'object',
      properties: {
        claim: {
          type: 'string',
          description: 'The main claim or conclusion',
        },
        evidence: {
          type: 'array',
          items: { type: 'string' },
          description: 'Evidence supporting the claim',
        },
        uncertainty: {
          type: 'string',
          description: 'Known limitations or uncertainties',
        },
        invalidation_rule: {
          type: 'string',
          description: 'Condition that would invalidate this claim',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization',
        },
        cwd: {
          type: 'string',
          description: 'Working directory',
        },
      },
      required: ['claim'],
    },
  },
  {
    name: 'siftmemory_inspect_memory',
    description: 'Inspect SiftMemory memory state and checkpoint validity',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['session', 'workspace', 'all'],
          description: 'Scope to inspect (default: workspace)',
          default: 'workspace',
        },
        include_invalid: {
          type: 'boolean',
          description: 'Include invalidated checkpoints',
          default: false,
        },
        format: {
          type: 'string',
          enum: ['summary', 'detailed', 'json'],
          description: 'Output format',
          default: 'summary',
        },
        cwd: {
          type: 'string',
          description: 'Working directory',
        },
      },
    },
  },
  {
    name: 'siftmemory_suppress_memory',
    description: 'Suppress or exclude specific checkpoints from resume packs',
    inputSchema: {
      type: 'object',
      properties: {
        checkpoint_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Checkpoint IDs to suppress',
        },
        reason: {
          type: 'string',
          description: 'Reason for suppression',
        },
        cwd: {
          type: 'string',
          description: 'Working directory',
        },
      },
      required: ['checkpoint_ids'],
    },
  },
  {
    name: 'siftmemory_search',
    description: 'Search SiftMemory reasoning checkpoints and claims for relevant context',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (natural language supported)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 5)',
          default: 5,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'siftmemory_checkpoint_create',
    description: 'Create a new reasoning checkpoint with claim and evidence',
    inputSchema: {
      type: 'object',
      properties: {
        claim: {
          type: 'string',
          description: 'The main claim or conclusion',
        },
        evidence: {
          type: 'array',
          items: { type: 'string' },
          description: 'Evidence supporting the claim',
        },
        uncertainty: {
          type: 'string',
          description: 'Known limitations or uncertainties',
        },
        invalidation_rule: {
          type: 'string',
          description: 'Condition that would invalidate this claim',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization',
        },
      },
      required: ['claim'],
    },
  },
  {
    name: 'siftmemory_checkpoint_get',
    description: 'Retrieve a specific checkpoint by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Checkpoint ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'siftmemory_checkpoint_list',
    description: 'List reasoning checkpoints with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        since: {
          type: 'number',
          description: 'Unix timestamp - return checkpoints since',
        },
        until: {
          type: 'number',
          description: 'Unix timestamp - return checkpoints until',
        },
        status: {
          type: 'string',
          enum: ['valid', 'invalid', 'unvalidated'],
          description: 'Filter by validity status',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 20)',
          default: 20,
        },
      },
    },
  },
  {
    name: 'siftmemory_context_inject',
    description: 'Inject relevant reasoning context into current session',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['recent', 'session', 'workspace'],
          description: 'Context scope (default: recent)',
          default: 'recent',
        },
        limit: {
          type: 'number',
          description: 'Number of checkpoints to inject (default: 5)',
          default: 5,
        },
      },
    },
  },
  {
    name: 'siftmemory_stats',
    description: 'Get SiftMemory memory statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'siftmemory_health',
    description: 'Check SiftMemory daemon health status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'siftmemory_collective_status',
    description: 'Get team collective memory status for current repository',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: 'Working directory for repo resolution',
        },
      },
    },
  },
  {
    name: 'siftmemory_collective_import',
    description: 'Import team collective memory from repository into local database',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: 'Working directory for repo resolution',
        },
        validate_after_import: {
          type: 'boolean',
          description: 'Validate imported claims against current code',
          default: true,
        },
      },
    },
  },
  {
    name: 'siftmemory_collective_promote',
    description: 'Promote a local checkpoint to team collective memory',
    inputSchema: {
      type: 'object',
      properties: {
        checkpoint_id: {
          type: 'string',
          description: 'Checkpoint ID to promote',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for repo resolution',
        },
      },
      required: ['checkpoint_id'],
    },
  },
  {
    name: 'siftmemory_collective_validate',
    description: 'Validate team collective claims against current codebase',
    inputSchema: {
      type: 'object',
      properties: {
        checkpoint_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Checkpoint IDs to validate',
        },
        validate_against_current_code: {
          type: 'boolean',
          description: 'Validate claims against current code facts',
          default: true,
        },
        cwd: {
          type: 'string',
          description: 'Working directory for repo resolution',
        },
      },
    },
  },
  {
    name: 'siftmemory_collective_conflicts',
    description: 'Get unresolved team claim conflicts',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: 'Working directory for repo resolution',
        },
      },
    },
  },
];

export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

export function getToolByName(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find(t => t.name === name);
}
