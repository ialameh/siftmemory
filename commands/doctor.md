# /siftmemory:doctor

Run diagnostics on SiftMemory installation and configuration.

## Usage

```
/siftmemory:doctor
```

## Description

Checks the health of your SiftMemory installation including:

- Whether siftmemory-daemon binary is installed
- Whether the daemon is running and responsive
- Plugin configuration status
- Workspace initialization state
- Recent error logs

Run this when SiftMemory features seem broken or to verify your setup.

## Examples

```
/siftmemory:doctor
```

## See Also

- `/siftmemory:check` - Quick status check
- `/siftmemory:start` - Start the daemon
- `/siftmemory:status` - View detailed status