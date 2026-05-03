export const TOOL_DEFINITIONS = [
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
];
export function getToolDefinitions() {
    return TOOL_DEFINITIONS;
}
export function getToolByName(name) {
    return TOOL_DEFINITIONS.find(t => t.name === name);
}
//# sourceMappingURL=tool-definitions.js.map