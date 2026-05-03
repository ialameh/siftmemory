const DAEMON_URL = 'http://127.0.0.1:7777';
export class ToolHandlers {
    handlers = new Map();
    constructor() {
        this.registerHandlers();
    }
    registerHandlers() {
        this.handlers.set('siftmemory_search', this.handleSearch.bind(this));
        this.handlers.set('siftmemory_checkpoint_create', this.handleCheckpointCreate.bind(this));
        this.handlers.set('siftmemory_checkpoint_get', this.handleCheckpointGet.bind(this));
        this.handlers.set('siftmemory_checkpoint_list', this.handleCheckpointList.bind(this));
        this.handlers.set('siftmemory_context_inject', this.handleContextInject.bind(this));
        this.handlers.set('siftmemory_stats', this.handleStats.bind(this));
        this.handlers.set('siftmemory_health', this.handleHealth.bind(this));
    }
    async handle(request) {
        const handler = this.handlers.get(request.params.name);
        if (!handler) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Unknown tool: ${request.params.name}`,
                    },
                ],
                isError: true,
            };
        }
        try {
            return await handler(request.params.arguments || {});
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${message}`,
                    },
                ],
                isError: true,
            };
        }
    }
    async handleSearch(args) {
        const { query, limit = 5 } = args;
        const response = await fetch(`${DAEMON_URL}/api/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit }),
        });
        if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(data, null, 2),
                },
            ],
        };
    }
    async handleCheckpointCreate(args) {
        const { claim, evidence = [], uncertainty, invalidation_rule, tags = [] } = args;
        const response = await fetch(`${DAEMON_URL}/api/checkpoints`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                claim,
                evidence,
                uncertainty,
                invalidation_rule,
                tags,
                workspace_id: process.cwd(),
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to create checkpoint: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [
                {
                    type: 'text',
                    text: `Created checkpoint: ${data.id}`,
                },
            ],
        };
    }
    async handleCheckpointGet(args) {
        const { id } = args;
        const response = await fetch(`${DAEMON_URL}/api/checkpoints/${id}`);
        if (!response.ok) {
            throw new Error(`Checkpoint not found: ${id}`);
        }
        const data = await response.json();
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(data, null, 2),
                },
            ],
        };
    }
    async handleCheckpointList(args) {
        const { since, until, status, limit = 20 } = args;
        const params = new URLSearchParams();
        if (since)
            params.set('since', String(since));
        if (until)
            params.set('until', String(until));
        if (status)
            params.set('status', String(status));
        params.set('limit', String(limit));
        params.set('workspace_id', process.cwd());
        const response = await fetch(`${DAEMON_URL}/api/checkpoints?${params}`);
        if (!response.ok) {
            throw new Error(`Failed to list checkpoints: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(data, null, 2),
                },
            ],
        };
    }
    async handleContextInject(args) {
        const { scope = 'recent', limit = 5 } = args;
        const response = await fetch(`${DAEMON_URL}/api/resume-pack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workspace_id: process.cwd(),
                scope,
                limit,
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to get context: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [
                {
                    type: 'text',
                    text: data.context || 'No context available',
                },
            ],
        };
    }
    async handleStats(_args) {
        const response = await fetch(`${DAEMON_URL}/api/stats`);
        if (!response.ok) {
            throw new Error(`Failed to get stats: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(data, null, 2),
                },
            ],
        };
    }
    async handleHealth(_args) {
        const response = await fetch(`${DAEMON_URL}/health`);
        if (!response.ok) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'Daemon is unhealthy',
                    },
                ],
                isError: true,
            };
        }
        const data = await response.json();
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(data, null, 2),
                },
            ],
        };
    }
}
export const toolHandlers = new ToolHandlers();
//# sourceMappingURL=tool-handlers.js.map