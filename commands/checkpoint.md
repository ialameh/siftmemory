# /siftmemory:checkpoint

Create a reasoning checkpoint to capture current understanding.

## Usage

```
/siftmemory:checkpoint <claim> [--evidence <text>] [--uncertainty <text>] [--tags <tags>]
```

## Description

Creates a new reasoning checkpoint with a claim, supporting evidence, and optional uncertainty notes. Checkpoints are validated against current code state before inclusion in future resume packs.

## Arguments

- `claim` - The main conclusion or understanding to capture (required)
- `--evidence` - Supporting evidence or reasoning (optional)
- `--uncertainty` - Known limitations or things that could invalidate this claim (optional)
- `--tags` - Comma-separated tags for categorization (optional)

## Examples

```
/siftmemory:checkpoint "User authentication is implemented via JWT tokens"
/siftmemory:checkpoint "API rate limiting uses Redis" --evidence "Found in config/ratelimit.rs" --tags "backend,security"
```

## See Also

- `/siftmemory:resume` - Retrieve resume pack
- `/siftmemory:audit` - Review memory state