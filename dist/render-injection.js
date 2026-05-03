/**
 * Render Injection
 * Formats resume packs for hook output.
 */
export function renderResumePack(data) {
    // API returns rendered_markdown, but context is also supported
    const context = data.rendered_markdown || data.context || '';
    // Plain stdout format
    const output = `# SiftMemory: Reasoning Resume Pack

${context}

---
Instruction: Use this as prior validated reasoning, not as absolute truth. Prefer current code inspection over memory if there is conflict. Do not rely on invalidated conclusions. If you discover a contradiction, mention it and continue from current code.
`;
    return output;
}
export function renderStructuredOutput(content) {
    return JSON.stringify({
        additionalContext: content,
    });
}
export function detectOutputMode() {
    // Default to plain_stdout unless Claude Code version supports structured output
    // This could check CLAUDE_CODE_VERSION or similar env var
    return 'plain_stdout';
}
//# sourceMappingURL=render-injection.js.map