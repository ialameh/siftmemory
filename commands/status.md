---
description: Show detailed SiftMemory runtime status
allowed-tools: Bash
---

# /siftmemory:status

Shows detailed SiftMemory runtime status:
- **Runtime State**: Current state in the readiness state machine
- **Daemon Health**: Whether the daemon is responsive
- **Last Healthy**: Timestamp of last successful health check
- **Auto-Start**: Current auto-start configuration

## Examples

```
/siftmemory:status
```

## See Also

- `/siftmemory:check` - Quick health check
- `/siftmemory:start` - Start daemon