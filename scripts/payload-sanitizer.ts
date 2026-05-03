/**
 * Payload Sanitizer
 * Sanitizes tool event payloads to remove sensitive data before buffering.
 */

import { createHash } from 'crypto';

// Secret patterns to redact
const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]+/g,
  /AKIA[0-9A-Z]{16}/g,
  /xox[baprs]-[a-zA-Z0-9-]+/g,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/g,
  /password\s*=\s*[^\s]+/gi,
  /token\s*=\s*[^\s]+/gi,
  /api[_-]?key\s*=\s*[^\s]+/gi,
  /secret\s*=\s*[^\s]+/gi,
];

// Limits
const MAX_COMMAND_LENGTH = 2000;
const MAX_RESPONSE_LENGTH = 2000;
const MAX_PATH_COUNT = 50;
const MAX_PATH_LENGTH = 500;
const MAX_ERROR_LENGTH = 2000;
const MAX_BUFFERED_PAYLOAD = 8 * 1024;

export function redactSecrets(text: string): string {
  let redacted = text;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function hashString(text: string): string {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

export function classifyToolEvent(event: {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}): string {
  const toolName = event.tool_name || '';

  if (toolName === 'Read') return 'FileRead';
  if (toolName === 'Write' || toolName === 'NotebookEdit') return 'FileWrite';
  if (toolName === 'Edit') return 'FileEdit';

  // Bash classifier
  const cmd = String(event.tool_input?.command || '');
  if (cmd.match(/npm\s+test|pnpm\s+test|yarn\s+test|cargo\s+test|pytest|mvn\s+test|gradle\s+test|go\s+test/)) {
    return 'TestRun';
  }
  if (cmd.match(/eslint|clippy|cargo\s+clippy|ruff|flake8|pylint|mypy|tsc\s+--noEmit/)) {
    return 'LintRun';
  }
  if (cmd.match(/git\s+diff|git\s+status|git\s+show/)) {
    return 'GitDiff';
  }
  if (toolName === 'Bash') return 'CommandRun';

  if (toolName === 'Grep' || toolName === 'Glob') return 'Search';

  return 'Unknown';
}

export function sanitizeToolPayload(
  event: {
    tool_name?: string;
    tool_input?: Record<string, unknown>;
    tool_output?: unknown;
    session_id?: string;
    tool_use_id?: string;
  },
  eventType: string
): Record<string, unknown> {
  const toolName = event.tool_name || '';
  const input = event.tool_input || {};

  // Base sanitized event
  const sanitized: Record<string, unknown> = {
    session_id: event.session_id || process.env.SIFTMEMORY_SESSION_ID || 'unknown',
    client_event_id: hashString(
      `${event.session_id || 'unknown'}_${eventType}_${event.tool_use_id || 'unknown'}_${Date.now()}`
    ),
    timestamp: new Date().toISOString(),
  };

  // Read tool: only store file path, never content
  if (toolName === 'Read') {
    return {
      ...sanitized,
      event_type: 'FileRead',
      file_path: input.file_path,
      read: true,
    };
  }

  // Write tool: store hash and size, never content
  if (toolName === 'Write' || toolName === 'NotebookEdit') {
    const content = String(input.content || '');
    return {
      ...sanitized,
      event_type: 'FileWrite',
      file_path: input.file_path,
      content_hash: hashString(content),
      byte_length: Buffer.byteLength(content, 'utf-8'),
      write: true,
    };
  }

  // Edit tool: store hashes and lengths, never raw strings
  if (toolName === 'Edit') {
    const oldStr = String(input.old_string || '');
    const newStr = String(input.new_string || '');
    return {
      ...sanitized,
      event_type: 'FileEdit',
      file_path: input.file_path,
      old_string_hash: hashString(oldStr),
      new_string_hash: hashString(newStr),
      old_string_length: oldStr.length,
      new_string_length: newStr.length,
      size_delta: newStr.length - oldStr.length,
    };
  }

  // Bash tool: redact secrets, truncate output, store hash
  if (toolName === 'Bash') {
    let command = String(input.command || '');
    command = redactSecrets(command);
    command = truncate(command, MAX_COMMAND_LENGTH);

    let outputExcerpt = '';
    let outputRedacted = false;

    if (event.tool_output) {
      const output = JSON.stringify(event.tool_output);
      const hasSecret = SECRET_PATTERNS.some(p => p.test(output));
      if (hasSecret) {
        outputRedacted = true;
        outputExcerpt = '';
      } else {
        outputExcerpt = truncate(output, MAX_RESPONSE_LENGTH);
      }
    }

    return {
      ...sanitized,
      event_type: eventType,
      command,
      command_hash: hashString(String(input.command || '')),
      exit_code: input.exit_code,
      classification: eventType,
      output_excerpt: outputExcerpt,
      output_hash: event.tool_output ? hashString(JSON.stringify(event.tool_output)) : null,
      output_redacted: outputRedacted,
    };
  }

  // Grep/Glob: store pattern hash and matched paths only
  if (toolName === 'Grep' || toolName === 'Glob') {
    const pattern = String(input.pattern || '');
    const matches = Array.isArray(input.matches) ? input.matches : [];
    const matchedPaths = matches
      .slice(0, MAX_PATH_COUNT)
      .map((m: unknown) => (m as { file_path?: string })?.file_path)
      .filter(Boolean);

    return {
      ...sanitized,
      event_type: 'Search',
      pattern_hash: hashString(pattern),
      match_count: matches.length,
      matched_paths: matchedPaths,
    };
  }

  // Fallback: store safe metadata only
  return {
    ...sanitized,
    event_type: eventType,
    tool_name: toolName,
  };
}

export function sanitizePayloadSize(payload: Record<string, unknown>): Record<string, unknown> {
  const serialized = JSON.stringify(payload);
  if (serialized.length <= MAX_BUFFERED_PAYLOAD) {
    return payload;
  }

  // Truncate to max size
  return {
    ...payload,
    _truncated: true,
    _original_size: serialized.length,
  };
}