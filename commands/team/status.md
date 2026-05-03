# /siftmemory:team status

Show team collective memory status for the current repository.

## Usage

```
/siftmemory:team status
```

## Description

Displays:
- Whether repo has `.siftmemory/collective/` folder
- Number of imported checkpoints and claims
- Pending reviews and unresolved conflicts
- Last import timestamp

## Examples

```
/siftmemory:team status
```

## Output

```
Team memory status:
- Repo collective folder: present
- Imported checkpoints: 12
- Validated team claims: 30
- Pending reviews: 4
- Unresolved conflicts: 2
- Last import: 5 minutes ago
```

## See Also

- `/siftmemory:team import` - Import team memory from repository
- `/siftmemory:team promote` - Promote local checkpoint to team memory