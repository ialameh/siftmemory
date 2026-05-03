# /siftmemory:team

Team collective memory management for cross-repository reasoning.

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `status` | Show team collective memory status |
| `import` | Import team memory from repository |
| `promote` | Promote local checkpoint to team memory |
| `review` | Review pending team checkpoints |
| `approve` | Approve a checkpoint for team use |
| `reject` | Reject a checkpoint |
| `conflicts` | Show unresolved conflicts |
| `tombstone` | Mark a checkpoint as invalidated |
| `explain` | Explain team memory decisions |
| `pull` | Pull latest team memory |

## Usage

```
/siftmemory:team <subcommand> [args]
```

## Examples

```
/siftmemory:team status
/siftmemory:team import
/siftmemory:team promote <checkpoint-id>
/siftmemory:team review
```

## Team Memory Location

Team memory is stored in `.siftmemory/collective/` within each repository.
These files are git-tracked and shared across team members.

## Privacy

Team memory only includes checkpoints marked as `shareable` or `collective`.
Private reasoning is never included in team memory.

## See Also

- `/siftmemory:team status` - Team memory status
- `/siftmemory:team import` - Import team memory
