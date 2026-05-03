/**
 * Render Injection
 * Formats resume packs for hook output.
 */

export type HookOutputMode = 'plain_stdout' | 'structured_json';

export function renderResumePack(data: {
  resume_pack_id?: string;
  context?: string;
  checkpoints?: unknown[];
  claims?: unknown[];
}): string {
  const context = data.context || '';

  // Plain stdout format
  const output = `# SiftMemory: Reasoning Resume Pack

${context}

---
Instruction: Use this as prior validated reasoning, not as absolute truth. Prefer current code inspection over memory if there is conflict. Do not rely on invalidated conclusions. If you discover a contradiction, mention it and continue from current code.
`;

  return output;
}

export function renderStructuredOutput(content: string): string {
  return JSON.stringify({
    additionalContext: content,
  });
}

export function detectOutputMode(): HookOutputMode {
  // Default to plain_stdout unless Claude Code version supports structured output
  // This could check CLAUDE_CODE_VERSION or similar env var
  return 'plain_stdout';
}