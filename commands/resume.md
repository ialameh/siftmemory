---
description: Request a Reasoning Resume Pack
allowed-tools: Bash
command: |
  node "${CLAUDE_PLUGIN_ROOT}/dist/command-runner.js" resume "$ARGUMENTS"
---

# /siftmemory:resume

Request a Reasoning Resume Pack for the current task context.

## Usage

```
/siftmemory:resume
```

## Description

Retrieves validated reasoning checkpoints relevant to the current workspace and session context. The resume pack contains claims, evidence, and validity status to help Claude reason from previously validated understanding rather than starting from scratch.

## Examples

```
/siftmemory:resume
```

## See Also

- `/siftmemory:checkpoint` - Create a checkpoint
- `/siftmemory:status` - Check daemon health