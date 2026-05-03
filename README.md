# SiftMemory for Claude Code

**SiftMemory** is a local-first reasoning memory layer for AI coding assistants. It captures development events, extracts reasoning checkpoints, validates them against current code state, and builds compact Reasoning Resume Packs that AI models can inject into coding sessions to resume from prior validated understanding.

## Features

- **Resumable Reasoning**: Never re-derive what you've already figured out
- **Claim-Level Invalidation**: Automatically invalidate reasoning when code changes
- **Local-First Privacy**: All data stays on your machine
- **Reasoning Resume Packs**: Compact context injection before compaction
- **MCP Server**: IDE-integrated via Model Context Protocol

## Installation

```
/plugin add https://github.com/ialameh/siftmemory
```

Or manually:

```bash
# Install the daemon binary
cargo install --git https://github.com/ialameh/sift-memory siftmemory-daemon
```

## Commands

| Command | Description |
|---------|-------------|
| `/siftmemory:check` | Check daemon status |
| `/siftmemory:start` | Start the daemon |
| `/siftmemory:stop` | Stop the daemon |
| `/siftmemory:status` | View detailed status |

## How It Works

1. **Event Capture**: Tool uses, decisions, and claims are captured during Claude Code sessions
2. **Checkpoint Extraction**: Key reasoning moments are extracted as checkpoints
3. **Validity Tracking**: Code changes trigger invalidation analysis
4. **Resume Pack Building**: Valid checkpoints are packaged for context injection

## Architecture

```
Claude Code
    ├── Hooks (SessionStart, PostToolUse, PreCompact, Stop)
    ├── Commands (/siftmemory:check, start, stop, etc.)
    └── MCP Server (IDE integration)
            │
            ▼
    SiftMemory Daemon (port 7777)
            │
            ▼
    SQLite Database (~/.siftmemory/)
```

## License

Apache-2.0
