/**
 * Render Injection
 * Formats resume packs for hook output.
 */
export type HookOutputMode = 'plain_stdout' | 'structured_json';
export declare function renderResumePack(data: {
    resume_pack_id?: string;
    context?: string;
    checkpoints?: unknown[];
    claims?: unknown[];
}): string;
export declare function renderStructuredOutput(content: string): string;
export declare function detectOutputMode(): HookOutputMode;
//# sourceMappingURL=render-injection.d.ts.map