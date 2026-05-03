const DAEMON_URL = 'http://127.0.0.1:7777';
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
    async handleBuildResumePack(args) {
        const { scope = 'recent', limit = 5, cwd } = args;
        const response = await fetch(`${DAEMON_URL}/v1/resume/build`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspace_id: cwd || process.cwd(), scope, limit }),
        });
        if (!response.ok) {
            throw new Error(`Failed to build resume pack: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
    }
    async handleIngestEvent(args) {
        const { event_type, tool_name, input, output, cwd } = args;
        const response = await fetch(`${DAEMON_URL}/v1/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_type, tool_name, input, output, workspace_id: cwd || process.cwd() }),
        });
        if (!response.ok) {
            throw new Error(`Failed to ingest event: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
    }
    async handleRecordOutcome(args) {
        const { outcome, summary, checkpoint_ids, cwd } = args;
        const response = await fetch(`${DAEMON_URL}/v1/outcomes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outcome, summary, checkpoint_ids, workspace_id: cwd || process.cwd() }),
        });
        if (!response.ok) {
            throw new Error(`Failed to record outcome: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
    }
    async handleExtractCheckpoint(args) {
        const { claim, evidence, uncertainty, invalidation_rule, tags, cwd } = args;
        const response = await fetch(`${DAEMON_URL}/v1/checkpoints/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ claim, evidence: evidence || [], uncertainty, invalidation_rule, tags: tags || [], workspace_id: cwd || process.cwd() }),
        });
        if (!response.ok) {
            throw new Error(`Failed to extract checkpoint: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
    }
    async handleInspectMemory(args) {
        const { scope = 'workspace', include_invalid = false, format = 'summary', cwd } = args;
        const response = await fetch(`${DAEMON_URL}/v1/retrieval/candidates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspace_id: cwd || process.cwd(), scope, include_invalid, format }),
        });
        if (!response.ok) {
            throw new Error(`Failed to inspect memory: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
    }
    async handleSuppressMemory(args) {
        const { checkpoint_ids, reason, cwd } = args;
        const response = await fetch(`${DAEMON_URL}/v1/checkpoints/suppress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkpoint_ids, reason, workspace_id: cwd || process.cwd() }),
        });
        if (!response.ok) {
            throw new Error(`Failed to suppress memory: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
    }
    async handleSearch(args) {
        const { query, limit = 5 } = args;
        const response = await fetch(`${DAEMON_URL}/v1/retrieval/candidates`, {
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
        const response = await fetch(`${DAEMON_URL}/v1/checkpoints/extract`, {
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
                    text: `Created checkpoint: ${JSON.stringify(data)}`,
                },
            ],
        };
    }
    async handleCheckpointGet(args) {
        const { id } = args;
        const response = await fetch(`${DAEMON_URL}/v1/checkpoints/${id}`);
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
        const response = await fetch(`${DAEMON_URL}/v1/checkpoints?${params}`);
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
        const response = await fetch(`${DAEMON_URL}/v1/resume/build`, {
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
        const response = await fetch(`${DAEMON_URL}/v1/stats`);
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
        const response = await fetch(`${DAEMON_URL}/v1/health`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
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
    async handleCollectiveStatus(args) {
        const { cwd } = args;
        const response = await fetch(`${DAEMON_URL}/v1/collective/status`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
            throw new Error(`Failed to get collective status: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
    }
    async handleCollectiveImport(args) {
        const { cwd, validate_after_import = true } = args;
        const response = await fetch(`${DAEMON_URL}/v1/collective/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workspace_id: cwd || process.cwd(),
                validate_after_import,
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to import collective memory: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
    }
    async handleCollectivePromote(args) {
        const { checkpoint_id, cwd } = args;
        const response = await fetch(`${DAEMON_URL}/v1/collective/promote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workspace_id: cwd || process.cwd(),
                checkpoint_id,
                promotion_mode: 'manual',
                target: 'repo_collective',
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to promote checkpoint: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
    }
    async handleCollectiveValidate(args) {
        const { checkpoint_ids, validate_against_current_code = true, cwd } = args;
        const response = await fetch(`${DAEMON_URL}/v1/collective/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workspace_id: cwd || process.cwd(),
                checkpoint_ids: checkpoint_ids || [],
                validate_against_current_code,
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to validate collective memory: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
    }
    async handleCollectiveConflicts(args) {
        const { cwd } = args;
        const response = await fetch(`${DAEMON_URL}/v1/collective/conflicts`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
            throw new Error(`Failed to get collective conflicts: ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
    }
}
export const toolHandlers = new ToolHandlers();
//# sourceMappingURL=tool-handlers.js.map