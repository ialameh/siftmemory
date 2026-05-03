# SiftMemory API Contract v1

**Base URL:** `http://127.0.0.1:7777`
**Content-Type:** `application/json`

All responses use the `ApiResponse<T>` envelope:

```json
{
  "ok": true,
  "data": { ... },
  "error": null
}
```

On error:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

---

## Endpoints

### `GET /v1/health`

Health check for daemon liveness.

**Response `ApiResponse<HealthData>`:**

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "version": "0.1.0",
    "storage_backend": "sqlite",
    "workspace_count": 0,
    "active_jobs": 0,
    "uptime_ms": 1234
  }
}
```

---

### `POST /v1/workspaces/init`

Initialize a workspace for a repository.

**Request `InitWorkspaceRequest`:**

```json
{
  "repo_root": "/path/to/repo",
  "user_email": "user@example.com",
  "create_repo_config": true
}
```

**Response `ApiResponse<InitWorkspaceResponse>`:**

```json
{
  "ok": true,
  "data": {
    "workspace_id": "workspace_key_hash",
    "workspace_key": "workspace_key_hash",
    "repo_root": "/path/to/repo",
    "config_path": "/path/to/repo/.siftmemory/workspace.yaml",
    "database_path": "~/.siftmemory/workspaces/<workspace_key>/siftmemory.db",
    "created": true
  }
}
```

**Side effects when `create_repo_config: true`:**
- Creates `{repo_root}/.siftmemory/` directory
- Creates `{repo_root}/.siftmemory/.gitignore` with proper patterns
- Creates `{repo_root}/.siftmemory/workspace.yaml`
- Creates collective directory `{repo_root}/.siftmemory/collective/` with:
  - `manifest.json`
  - `checkpoints.ndjson`
  - `claims.ndjson`
  - `evidence_refs.ndjson`
  - `uncertainties.ndjson`
  - `conflicts.ndjson`
  - `qa_reviews.ndjson`
  - `tombstones.ndjson`
  - `sync_state.json`
- Creates policy directory `{repo_root}/.siftmemory/policy/` with:
  - `collective-policy.yaml`
  - `promotion-policy.yaml`
  - `redaction-policy.yaml`
  - `review-policy.yaml`

**Notes:**
- `workspace_id` is derived from `SHA256(repo_root)[:12]` (12 bytes hex = 24 chars)
- The same `repo_root` always produces the same `workspace_id`
- Subsequent calls with same `repo_root` return `created: false`
- **Private SQLite DB stays at** `~/.siftmemory/workspaces/{workspace_key}/siftmemory.db` — NOT inside repo `.siftmemory`

---

### `POST /v1/events`

Ingest a single developer activity event.

**Request `IngestEventRequest`:**

```json
{
  "workspace_id": "workspace_key_hash",
  "session_id": "session-uuid",
  "actor": "user|assistant|tool|system",
  "event_type": "SessionStart|SessionEnd|UserPrompt|AssistantResponse|FileRead|FileEdit|FileCreate|FileDelete|CommandRun|TestRun|LintRun|GitDiff|PatchAccepted|PatchRejected|UserCorrection|ManualNote",
  "tool": "Edit",
  "file_path": "src/main.rs",
  "symbol_refs": ["main", "edit_file"],
  "payload_json": { ... },
  "privacy_level": "Private|Redacted|Shareable|Collective",
  "client_event_id": "optional-id-for-dedupe"
}
```

**Response `ApiResponse<EventResponse>`:**

```json
{
  "ok": true,
  "data": {
    "event_id": "event-uuid",
    "payload_hash": "sha256:...",
    "queued_jobs": []
  }
}
```

**Deduplication:**
- If `client_event_id` is provided and an event with that ID already exists, returns `DUPLICATE_EVENT` error
- If same `payload_hash` already exists in the workspace (within the same session), returns `DUPLICATE_PAYLOAD` error

**Unknown event type:** Returns `INVALID_EVENT_TYPE` error if `event_type` is not in the supported list.

---

### `POST /v1/events/batch`

Ingest a batch of events atomically.

**Request `BatchEventRequest`:**

```json
{
  "workspace_id": "workspace_key_hash",
  "events": [
    { ...event1... },
    { ...event2... }
  ]
}
```

**Response `ApiResponse<BatchEventResponse>`:**

```json
{
  "ok": true,
  "data": {
    "event_ids": ["id1", "id2"],
    "queued_jobs": [],
    "duplicates_skipped": 0
  }
}
```

**Behavior:**
- Events with duplicate `client_event_id` are skipped (counted in `duplicates_skipped`)
- If an individual event's `workspace_id` differs from the top-level `workspace_id`, normalize it to the batch level
- Returns partial success if some events fail

---

### `POST /v1/checkpoints/extract`

Extract a reasoning checkpoint from recent events.

**Request `ExtractCheckpointRequest`:**

```json
{
  "workspace_id": "workspace_key_hash",
  "session_id": "session-uuid",
  "event_ids": ["event-id-1", "event-id-2"],
  "transcript_path": null,
  "origin": "PreCompact|Manual|GeneratedFromCodeAudit"
}
```

**Response `ApiResponse<ExtractCheckpointResponse>`:**

```json
{
  "ok": true,
  "data": {
    "checkpoint_id": "checkpoint-uuid",
    "claim_ids": [],
    "uncertainty_ids": [],
    "evidence_ids": [],
    "status": "NeedsReview",
    "warnings": []
  }
}
```

**Notes:**
- When `SIFTMEMORY_NO_LLM=1`, creates checkpoint with `NeedsReview` status without LLM
- If `event_ids` provided, extracts file paths from events and creates checkpoint scope
- If `event_ids` empty but `transcript_path` provided, creates checkpoint from metadata with warning about transcript parsing

---

### `POST /v1/resume/build`

Build a Reasoning Resume Pack from validated checkpoints.

**Request `BuildResumeRequest`:**

```json
{
  "workspace_id": "workspace_key_hash",
  "session_id": "session-uuid",
  "task": "Fix authentication bug in login flow",
  "mode": "standard|minimal|deep|audit",
  "token_budget": 4096,
  "include_private": false,
  "include_collective": false,
  "collective_policy": "validated_only"
}
```

**Response `ApiResponse<BuildResumeResponse>`:**

```json
{
  "ok": true,
  "data": {
    "resume_pack_id": "pack-uuid",
    "rendered_markdown": "# Reasoning Resume\n\n...",
    "pack_json": { ... },
    "consumed_checkpoint_ids": ["cp1", "cp2"],
    "warnings": []
  }
}
```

**Notes:**
- `task` is used for filtering checkpoints by title/summary
- `token_budget` is approximately respected
- If `include_collective` requested but not fully implemented, returns warning, not error

---

### `POST /v1/outcomes`

Record the outcome of a coding session.

**Request `RecordOutcomeRequest`:**

```json
{
  "workspace_id": "workspace_key_hash",
  "session_id": "session-uuid",
  "consumed_checkpoint_ids": ["checkpoint-id"],
  "files_changed": ["src/auth/login.rs"],
  "tests_run": [
    {
      "command": "cargo test auth",
      "passed": true,
      "output_excerpt": null,
      "failed_tests": null
    }
  ],
  "lint_result": null,
  "user_accepted_patch": true,
  "user_rejected_patch": null,
  "user_corrections": [],
  "new_claims": [],
  "invalidated_claim_ids": []
}
```

**Response `ApiResponse<RecordOutcomeResponse>`:**

```json
{
  "ok": true,
  "data": {
    "outcome_id": "outcome-uuid",
    "updated_checkpoint_ids": [],
    "invalidated_claim_ids": ["claim-id"],
    "confidence_updates": ["claim-123: invalidated", "tests_failed: confidence decreased"]
  }
}
```

**Side effects:**
- Updates claim statuses to `Invalid` for each `invalidated_claim_ids`
- Decreases confidence for claims in checkpoints consumed when tests fail
- Increases confidence for claims consumed when user accepted patch and tests passed

---

### `GET /v1/collective/status`

Get collective memory status for a workspace.

**Query Parameters:**
```json
{
  "workspace_id": "workspace_key_hash",
  "repo_root": "/path/to/repo"
}
```

**Response `ApiResponse<CollectiveStatusResponse>`:**

```json
{
  "ok": true,
  "data": {
    "workspace_id": "workspace_key_hash",
    "repo_collective_path": "/path/to/repo/.siftmemory/collective",
    "manifest_exists": true,
    "record_counts": {
      "checkpoints": 0,
      "claims": 0,
      "evidence_refs": 0,
      "uncertainties": 0,
      "conflicts": 0,
      "qa_reviews": 0,
      "tombstones": 0
    },
    "pending_reviews": 0,
    "unresolved_conflicts": 0,
    "last_import_ms": null,
    "last_export_ms": null,
    "warnings": []
  }
}
```

**Notes:**
- Counts non-empty lines in collective `.ndjson` files
- Returns zeros if files are missing (does not error)
- Resolves `repo_root` from workspace record if not provided

---

### `POST /v1/collective/import`

Import collective memory records.

**Request `CollectiveImportRequest`:**

```json
{
  "workspace_id": "workspace_key_hash",
  "repo_root": "/path/to/repo"
}
```

**Response `ApiResponse<CollectiveImportResponse>`:**

```json
{
  "ok": true,
  "data": {
    "imported_count": 0,
    "warnings": ["Full database import not yet implemented"]
  }
}
```

**Notes:**
- Reads `.siftmemory/collective/*.ndjson` files
- Validates JSON lines where possible
- Returns warning if full DB import not available

---

### `POST /v1/collective/export`

Export collective memory records.

**Request `CollectiveExportRequest`:**

```json
{
  "workspace_id": "workspace_key_hash",
  "repo_root": "/path/to/repo",
  "format": "ndjson|json"
}
```

**Response `ApiResponse<CollectiveExportResponse>`:**

```json
{
  "ok": true,
  "data": {
    "exported_count": 0,
    "output_path": "/path/to/repo/.siftmemory/exports/collective-export.ndjson",
    "warnings": []
  }
}
```

---

### `POST /v1/collective/promote`

Promote a checkpoint to collective memory.

**Request `CollectivePromoteRequest`:**

```json
{
  "workspace_id": "workspace_key_hash",
  "checkpoint_id": "checkpoint-uuid",
  "redact_raw_payloads": true
}
```

**Response `ApiResponse<CollectivePromoteResponse>`:**

```json
{
  "ok": true,
  "data": {
    "promoted_checkpoint_id": "checkpoint-uuid",
    "review_status": "pending",
    "warnings": []
  }
}
```

**Notes:**
- Loads checkpoint by ID
- Creates `.siftmemory/collective` if missing
- Appends redacted checkpoint record to `checkpoints.ndjson`
- Uses evidence pointers only, never raw event payloads
- Marks review status as `pending`

---

### `POST /v1/collective/validate`

Validate collective memory claims.

**Request `CollectiveValidateRequest`:**

```json
{
  "workspace_id": "workspace_key_hash",
  "checkpoint_id": "checkpoint-uuid"
}
```

**Response `ApiResponse<CollectiveValidateResponse>`:**

```json
{
  "ok": true,
  "data": {
    "validated_claims": 0,
    "invalidated_claims": 0,
    "disputed_claims": 0,
    "warnings": ["MVP validation not fully implemented yet"]
  }
}
```

---

### `GET /v1/collective/conflicts`

Get unresolved conflicts in collective memory.

**Query Parameters:**

```json
{
  "workspace_id": "workspace_key_hash",
  "repo_root": "/path/to/repo"
}
```

**Response `ApiResponse<CollectiveConflictsResponse>`:**

```json
{
  "ok": true,
  "data": {
    "conflicts": [],
    "unresolved_count": 0,
    "warnings": []
  }
}
```

**Notes:**
- Reads `{repo_root}/.siftmemory/collective/conflicts.ndjson`
- Returns empty list if file absent
- Skips lines that fail to parse with warning

---

## Supported Event Types

```
SessionStart
SessionEnd
UserPrompt
AssistantResponse
FileRead
FileEdit
FileCreate
FileDelete
CommandRun
TestRun
LintRun
GitDiff
PatchAccepted
PatchRejected
UserCorrection
ManualNote
```

**NOT supported (will return `INVALID_EVENT_TYPE`):**
- `FileWrite` — use `FileCreate` or `FileEdit`
- `Search` — use `CommandRun` or `ManualNote`
- `tool_failure` — use `ManualNote`
- `Unknown` — should not occur

---

## Error Codes

| Code | HTTP | Description |
|---|---|---|
| `WORKSPACE_NOT_FOUND` | 404 | Workspace database not found |
| `WORKSPACE_INIT_FAILED` | 500 | Failed to initialize workspace |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `DUPLICATE_EVENT` | 409 | Event with same client_event_id exists |
| `DUPLICATE_PAYLOAD` | 409 | Event with identical payload exists |
| `EVENT_PERSISTENCE_FAILED` | 500 | Failed to persist event |
| `CHECKPOINT_PERSISTENCE_FAILED` | 500 | Failed to persist checkpoint |
| `INVALID_EVENT_TYPE` | 400 | Unsupported event type |
| `FEATURE_NOT_IMPLEMENTED` | 501 | Feature not yet implemented |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SIFTMEMORY_DAEMON_URL` | `http://127.0.0.1:7777` | Daemon base URL |
| `SIFTMEMORY_NO_LLM` | `false` | Set to `1` to disable LLM and use deterministic fallback |
| `SIFTMEMORY_MIGRATIONS_DIR` | (auto) | Override migrations directory path |

---

## Storage Layout

```
~/.siftmemory/
└── workspaces/
    └── {workspace_key}/
        └── siftmemory.db    # SQLite database (NEVER inside repo .siftmemory)

{repo_root}/.siftmemory/      # Repo-local config (only if create_repo_config=true)
├── .gitignore
├── workspace.yaml
├── collective/
│   ├── manifest.json
│   ├── checkpoints.ndjson
│   ├── claims.ndjson
│   ├── evidence_refs.ndjson
│   ├── uncertainties.ndjson
│   ├── conflicts.ndjson
│   ├── qa_reviews.ndjson
│   ├── tombstones.ndjson
│   └── sync_state.json
└── policy/
    ├── collective-policy.yaml
    ├── promotion-policy.yaml
    ├── redaction-policy.yaml
    └── review-policy.yaml
```