---
description: Start the SiftMemory daemon manually
allowed-tools: Bash
---

# /siftmemory:start

Manually starts the SiftMemory daemon. Use this when:
- The daemon is not running
- You need to restart after it was stopped
- You want to manually control daemon lifecycle

## Examples

```
/siftmemory:start
```

## Auto-Start

By default, the daemon auto-starts when Claude Code launches if `autoStartDaemon` is enabled.

## See Also

- `/siftmemory:stop` - Stop the daemon
- `/siftmemory:check` - Check status