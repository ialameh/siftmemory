/**
 * Duplicate Resume Pack Suppression
 * Prevents injecting the same resume pack twice in a session.
 * Uses stable task hash to track actual prompt content.
 */
export declare function hashTask(prompt: string): string;
export declare function isPromptTrivial(prompt: string): boolean;
export declare function checkDuplicateResume(workspaceId: string, prompt: string, resumePackId: string): Promise<{
    shouldSkip: boolean;
    resumePackId?: string;
}>;
export declare function recordResumeInjection(workspaceId: string, resumePackId: string, taskHash: string): Promise<void>;
export declare function extractPromptFromHookInput(input: {
    prompt?: string;
}): string;
//# sourceMappingURL=duplicate-suppression.d.ts.map