# /siftmemory:team import

Import team collective memory from repository into local database.

## Usage

```
/siftmemory:team import
```

## Description

Reads `repo/.siftmemory/collective/*.ndjson` files and imports valid records into local workspace database. Validates imported claims against current codebase.

## Examples

```
/siftmemory:team import
```

## Output

```
Imported:
- Checkpoints: 12
- Claims: 38
- Evidence refs: 41

Validated:
- Active: 30
- Stale: 4
- Invalid: 2
- Disputed: 2

Warnings: []
```

## See Also

- `/siftmemory:team status` - View current team memory state
- `/siftmemory:team promote` - Share local checkpoint with team