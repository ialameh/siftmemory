# /siftmemory:team approve

Approve a checkpoint for team use.

## Usage

```
/siftmemory:team approve <checkpoint_id>
```

## Description

Marks a checkpoint as approved after review, elevating its trust level to `qa_reviewed`.

## Examples

```
/siftmemory:team approve cp_123
```

## Output

```
Checkpoint cp_123 approved.
Trust level: qa_reviewed

This checkpoint can now be injected as trusted team memory.
```

## See Also

- `/siftmemory:team review` - View pending reviews
- `/siftmemory:team reject` - Reject a checkpoint
- `/siftmemory:team status` - View team memory state