export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}
export declare const TOOL_DEFINITIONS: ToolDefinition[];
export declare function getToolDefinitions(): ToolDefinition[];
export declare function getToolByName(name: string): ToolDefinition | undefined;
//# sourceMappingURL=tool-definitions.d.ts.map