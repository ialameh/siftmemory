# /siftmemory:team promote

Promote a local checkpoint to team collective memory.

## Usage

```
/siftmemory:team promote <checkpoint_id>
```

## Description

Promotes a local checkpoint to team memory. The daemon applies privacy redaction, converts evidence to pointers, and writes redacted records to `repo/.siftmemory/collective/`.

## Examples

```
/siftmemory:team promote cp_123
```

## Output

```
Checkpoint promoted to team memory.

Files written:
- .siftmemory/collective/checkpoints.ndjson
- .siftmemory/collective/claims.ndjson
- .siftmemory/collective/evidence_refs.ndjson

Next step:
  Review and commit these files to Git.
```

## See Also

- `/siftmemory:team status` - View team memory state
- `/siftmemory:team import` - Import team memory from repository