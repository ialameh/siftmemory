# /siftmemory:team pull

Pull team collective memory from repository and merge into local database.

## Usage

```
/siftmemory:team pull
```

## Description

Runs `git pull` to update repository, then imports any updated collective memory files from `repo/.siftmemory/collective/`.

## Examples

```
/siftmemory:team pull
```

## Output

```
Pulled latest changes.
Collective memory updated:
- 3 new checkpoints
- 7 new claims

Validated:
- 10 active
- 0 stale/invalid
```

## See Also

- `/siftmemory:team import` - Import without pulling
- `/siftmemory:team status` - View team memory state