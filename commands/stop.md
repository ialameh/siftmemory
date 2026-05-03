---
description: Stop the SiftMemory daemon
allowed-tools: Bash
command: |
  node "${CLAUDE_PLUGIN_ROOT}/dist/command-runner.js" stop "$ARGUMENTS"
---

# /siftmemory:stop

Stops the running SiftMemory daemon. The daemon will auto-restart on next Claude Code session if auto-start is enabled.

## Examples

```
/siftmemory:stop
```

## See Also

- `/siftmemory:start` - Start the daemon
- `/siftmemory:status` - Check status