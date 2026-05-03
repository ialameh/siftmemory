# SiftMemory for Claude Code

**SiftMemory** is a local-first reasoning memory layer for AI coding assistants. It captures development events, extracts reasoning checkpoints, validates them against current code state, and builds compact Reasoning Resume Packs that AI models can inject into coding sessions to resume from prior validated understanding.

## Features

- **Resumable Reasoning**: Never re-derive what you've already figured out
- **Claim-Level Invalidation**: Automatically invalidate reasoning when code changes
- **Local-First Privacy**: All data stays on your machine
- **Reasoning Resume Packs**: Compact context injection before compaction
- **12 Lifecycle Hooks**: Captures events at the right moments
- **8 Slash Commands**: Full control over memory operations
- **MCP Server**: High-level operations via Model Context Protocol

## Installation

```
/plugin add https://github.com/ialameh/siftmemory
```

The plugin includes pre-built `dist/` for immediate use. No `npm install` required.

## Prerequisites

Install the SiftMemory daemon:

```bash
cargo install --git https://github.com/ialameh/sift-memory siftmemory-daemon
```

Or use a pre-built binary from [GitHub Releases](https://github.com/ialameh/sift-memory/releases).

## Commands

| Command | Description |
|---------|-------------|
| `/siftmemory:check` | Quick status check - daemon health and plugin state |
| `/siftmemory:status` | Detailed status with workspace and session info |
| `/siftmemory:start` | Start the daemon manually |
| `/siftmemory:stop` | Stop the daemon |
| `/siftmemory:resume` | Force injection of reasoning resume pack |
| `/siftmemory:checkpoint` | Create a reasoning checkpoint manually |
| `/siftmemory:forget` | Remove specific checkpoints from memory |
| `/siftmemory:audit` | Review checkpoint validity and sources |
| `/siftmemory:doctor` | Run diagnostics on installation |

## Lifecycle Hooks

The plugin hooks into Claude Code lifecycle events:

| Hook | Purpose | Timeout |
|------|---------|---------|
| `SessionStart` | Spawn daemon, check readiness | 5s |
| `UserPromptSubmit` | Buffer prompt event, trigger injection | 3s |
| `PostToolUse` | Capture code read/write/edit events | 2s |
| `PostToolUseFailure` | Capture failed tool operations | 2s |
| `PostToolBatch` | Batch capture after tool batches | 5s |
| `PreCompact` | Inject resume pack before compaction | 10s |
| `PostCompact` | Post-compaction event capture | 5s |
| `Stop` | Record session outcome | 5s |
| `StopFailure` | Handle abnormal termination | 3s |
| `SessionEnd` | Final cleanup and state writeback | 5s |
| `CwdChanged` | Update workspace tracking | 3s |
| `SubagentStop` | Capture subagent reasoning | 3s |

## MCP Tools

The plugin provides an MCP server (`siftmemory-memory`) with these tools:

| Tool | Description |
|------|-------------|
| `siftmemory_build_resume_pack` | Build Reasoning Resume Pack for current context |
| `siftmemory_ingest_event` | Ingest a development event |
| `siftmemory_record_outcome` | Record session outcome (success/partial/failed) |
| `siftmemory_extract_checkpoint` | Extract reasoning checkpoint from events |
| `siftmemory_inspect_memory` | Inspect checkpoint validity state |
| `siftmemory_suppress_memory` | Exclude checkpoints from resume packs |
| `siftmemory_search` | Search checkpoints and claims |
| `siftmemory_checkpoint_*` | CRUD operations on checkpoints |
| `siftmemory_stats` | Get memory statistics |
| `siftmemory_health` | Check daemon health |

## Settings

Configure via Claude Code settings (`~/.claude/settings.json`):

```json
{
  "siftmemory.daemonUrl": "http://127.0.0.1:7777",
  "siftmemory.autoStartDaemon": true,
  "siftmemory.startupTimeoutMs": 5000,
  "siftmemory.activeHeartbeatIntervalMs": 30000,
  "siftmemory.idleHeartbeatIntervalMs": 120000,
  "siftmemory.maxHeartbeatFailures": 2,
  "siftmemory.maxRestartAttempts": 3,
  "siftmemory.injectOnSessionStart": true,
  "siftmemory.injectOnUserPrompt": true,
  "siftmemory.captureToolEvents": true,
  "siftmemory.captureFailures": true,
  "siftmemory.extractBeforeCompact": true,
  "siftmemory.recordOutcomesOnStop": true,
  "siftmemory.notifyCoreMissing": true,
  "siftmemory.notifyDaemonDown": true,
  "siftmemory.disableWhenCoreMissing": true,
  "siftmemory.daemonPath": null,
  "siftmemory.cliPath": null
}
```

## How It Works

```
1. SessionStart → Daemon spawn/readiness check
2. UserPromptSubmit → Resume pack injection for task context
3. PostToolUse → Code events captured to event buffer
4. PreCompact → Resume pack built from valid checkpoints
5. Stop → Session outcome recorded
```

### Event Flow

1. **Capture**: Tool uses are buffered to `~/.siftmemory/run/event-buffer.jsonl`
2. **Extract**: Checkpoints are extracted via daemon's checkpoint engine
3. **Validate**: Code changes trigger invalidation analysis
4. **Resume**: Valid checkpoints packaged into compact resume packs
5. **Inject**: Resume context injected before compaction

## Architecture

```
Claude Code
    ├── Lifecycle Hooks (12 hooks)
    ├── Slash Commands (8 commands)
    └── MCP Server (10+ tools)
            │
            ▼
    SiftMemory Daemon (http://127.0.0.1:7777)
            │
            ├── Event Ingestion
            ├── Checkpoint Extraction
            ├── Invalidation Engine
            ├── Retrieval & Scoring
            └── Resume Pack Builder
            │
            ▼
    SQLite Database (~/.siftmemory/workspaces/{workspace_key}/)
```

## Data Storage

- **Global config**: `~/.siftmemory/config.yaml`
- **Workspace configs**: `~/.siftmemory/workspaces/{workspace_key}/workspace.yaml`
- **Database**: `~/.siftmemory/workspaces/{workspace_key}/siftmemory.db`
- **Runtime state**: `~/.siftmemory/run/`

## Troubleshooting

### Daemon not running

```bash
/siftmemory:start
```

Or manually:

```bash
~/.cargo/bin/siftmemory-daemon
```

### Check status

```bash
/siftmemory:doctor
```

### View detailed logs

Check `~/.siftmemory/run/` for session logs and event buffers.

## License

Apache-2.0