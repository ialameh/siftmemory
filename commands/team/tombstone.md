# /siftmemory:team tombstone

Permanently exclude a checkpoint or claim from team memory.

## Usage

```
/siftmemory:team tombstone <checkpoint_id>
```

## Description

Tombstones a checkpoint or claim, permanently excluding it from team memory injection. Uses append-friendly NDJSON records - never deletes.

## Examples

```
/siftmemory:team tombstone cp_123
```

## Output

```
Checkpoint cp_123 tombstoned.
It will not be injected as trusted team memory.

To undo this, run:
  /siftmemory:team explain cp_123
```

## See Also

- `/siftmemory:team conflicts` - View unresolved conflicts
- `/siftmemory:team explain` - Explain a checkpoint's state
- `/siftmemory:team status` - View team memory state