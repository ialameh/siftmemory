/**
 * Payload Sanitizer
 * Sanitizes tool event payloads to remove sensitive data before buffering.
 */
export declare function redactSecrets(text: string): string;
export declare function truncate(text: string, maxLength: number): string;
export declare function hashString(text: string): string;
export declare function classifyToolEvent(event: {
    tool_name?: string;
    tool_input?: Record<string, unknown>;
}): string;
export declare function sanitizeToolPayload(event: {
    tool_name?: string;
    tool_input?: Record<string, unknown>;
    tool_output?: unknown;
    session_id?: string;
    tool_use_id?: string;
    hook_event_name?: string;
}, eventType: string): Record<string, unknown>;
export declare function sanitizePayloadSize(payload: Record<string, unknown>): Record<string, unknown>;
//# sourceMappingURL=payload-sanitizer.d.ts.map