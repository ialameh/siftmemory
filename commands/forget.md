# /siftmemory:forget

Remove specific memories or clear SiftMemory data.

## Usage

```
/siftmemory:forget [--checkpoint <id>] [--workspace] [--all]
```

## Description

Removes reasoning checkpoints or workspace data from SiftMemory. Use with caution - this cannot be undone.

## Options

- `--checkpoint <id>` - Remove a specific checkpoint by ID
- `--workspace` - Clear all data for current workspace
- `--all` - Clear all SiftMemory data

## Examples

```
/siftmemory:forget --checkpoint cp_abc123
/siftmemory:forget --workspace
```

## See Also

- `/siftmemory:audit` - View memory state
- `/siftmemory:doctor` - Diagnostics