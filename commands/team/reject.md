# /siftmemory:team reject

Reject a checkpoint from team use.

## Usage

```
/siftmemory:team reject <checkpoint_id>
```

## Description

Rejects a checkpoint, marking it as not suitable for team use. Consider using `/siftmemory:team tombstone` instead to permanently exclude it.

## Examples

```
/siftmemory:team reject cp_123
```

## Output

```
Checkpoint cp_123 rejected.
Use /siftmemory:team tombstone to permanently exclude.
```

## See Also

- `/siftmemory:team review` - View pending reviews
- `/siftmemory:team approve` - Approve a checkpoint
- `/siftmemory:team tombstone` - Permanently exclude a checkpoint