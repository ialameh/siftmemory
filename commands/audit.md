# /siftmemory:audit

Audit SiftMemory memory and checkpoint validity.

## Usage

```
/siftmemory:audit [--scope <scope>] [--format <format>]
```

## Description

Reviews all checkpoints in the current workspace, checking their validity against current code state. Invalidated checkpoints are flagged for review.

## Options

- `--scope <scope>` - Scope: `session`, `workspace`, or `all` (default: workspace)
- `--format <format>` - Output format: `summary`, `detailed`, or `json` (default: summary)

## Examples

```
/siftmemory:audit
/siftmemory:audit --scope workspace --format detailed
```

## See Also

- `/siftmemory:resume` - Get resume pack
- `/siftmemory:checkpoint` - Create checkpoint