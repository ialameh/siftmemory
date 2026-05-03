# /siftmemory:team conflicts

View unresolved team claim conflicts.

## Usage

```
/siftmemory:team conflicts
```

## Description

Shows claim pairs that contradict each other and need resolution.

## Examples

```
/siftmemory:team conflicts
```

## Output

```
Unresolved conflicts: 2

1. claim_team_1 vs claim_team_9
   Type: contradiction
   Summary: Two claims disagree about whether SessionStore persists refreshToken.

2. claim_team_3 vs claim_team_7
   Type: supersession
   Summary: claim_team_7 supersedes claim_team_3 after refactor.
```

## See Also

- `/siftmemory:team status` - View team memory state
- `/siftmemory:team review` - View pending reviews
- `/siftmemory:team tombstone` - Exclude conflicting claims