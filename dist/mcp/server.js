import { EventEmitter } from 'events';
import { toolHandlers } from './tool-handlers.js';
import { getToolDefinitions } from './tool-definitions.js';
const DEFAULT_TOOL_DEFINITIONS = getToolDefinitions();
export class SiftMemoryMCPServer extends EventEmitter {
    constructor() {
        super();
    }
    async handleRequest(request) {
        if (request.method === 'tools/list') {
            return {
                tools: DEFAULT_TOOL_DEFINITIONS,
            };
        }
        if (request.method === 'tools/call') {
            const result = await toolHandlers.handle({
                params: {
                    name: request.params.name,
                    arguments: request.params.arguments || {},
                },
            });
            return result;
        }
        throw new Error(`Unknown method: ${request.method}`);
    }
    async start() {
        console.error('[SiftMemory] MCP server created');
    }
    async stop() {
        this.removeAllListeners();
    }
}
export const mcpServer = new SiftMemoryMCPServer();
//# sourceMappingURL=server.js.map