# /siftmemory:team explain

Explain a checkpoint's state, trust level, and history.

## Usage

```
/siftmemory:team explain <checkpoint_id>
```

## Description

Shows detailed information about a checkpoint including its current status, trust level, evidence references, and any invalidation rules.

## Examples

```
/siftmemory:team explain cp_123
```

## Output

```
Checkpoint: cp_123
Title: Auth refresh token ownership
Status: active
Trust Level: collective_validated

Scope:
- Files: src/auth/service.ts
- Symbols: AuthService

Claims: 2
- claim_team_1 (active)
- claim_team_2 (active)

Evidence: 1 reference
- evref_team_1: file_symbol, src/auth/service.ts::AuthService.refresh

Invalidation: None

Created: 2026-05-03
Promoted: 2026-05-03
```

## See Also

- `/siftmemory:team status` - View team memory state
- `/siftmemory:team tombstone` - Exclude a checkpoint
- `/siftmemory:team promote` - Share local checkpoint with team