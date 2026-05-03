---
description: Check SiftMemory daemon status and plugin state
allowed-tools: Bash
---

# /siftmemory:check

Checks the SiftMemory daemon status and plugin state:

- **Core Status**: Whether the SiftMemory binary is installed
- **Daemon Status**: Whether the daemon is running and healthy
- **Plugin State**: Current state in the readiness state machine

## Examples

```
/siftmemory:check
```

## Installation

If core is missing, install with:

```
cargo install --git https://github.com/ialameh/sift-memory siftmemory-daemon
```

## See Also

- `/siftmemory:start` - Start the daemon
- `/siftmemory:status` - View detailed status