---
name: database-migrations
description: Alembic migration procedures. Use when creating or modifying database schema.
---

# Database Migrations (Alembic)

## When to Use

- Adding a new table
- Modifying existing columns
- Adding indexes
- Adding extensions (pg_trgm)
- Any schema change

## Required Procedure

### 1. Create Migration

```bash
cd backend
alembic revision --autogenerate -m "description of change"
```

### 2. Review Generated Migration

- Check the generated `upgrade()` and `downgrade()` functions
- Verify foreign keys, indexes, constraints
- Verify the migration is reversible
- Check for data loss risks in column changes

### 3. Apply Migration

```bash
alembic upgrade head
```

### 4. Verify

```bash
alembic current  # should show head revision
```

## Important Constraints

- Never manually modify production databases
- Every schema change goes through a migration
- Migrations must be reversible (have downgrade)
- Use `sa.Enum` for status fields with explicit `create_type=False` when the enum is shared
- pg_trgm extension must be created in a migration
- Foreign keys must have appropriate ON DELETE behavior
- Add indexes for: user_id lookups, status queries, created_at ordering
- Use UUID primary keys

## Key Tables

```
users: id, email, password_hash, created_at, updated_at
audio_files: id, user_id (FK), original_filename, display_name, object_key, mime_type, size_bytes, duration_seconds, status, language_code, created_at, updated_at, uploaded_at, completed_at, failure_code, failure_message
processing_jobs: id, audio_file_id (FK), job_type, status, attempt_count, provider_job_id, last_error, raw_provider_response (JSONB), started_at, completed_at, created_at, updated_at
transcript_segments: id, audio_file_id (FK), chunk_index, sequence, start_ms, end_ms, text, created_at
summaries: id, audio_file_id (FK), content, provider, model, status, attempt_count, raw_response (JSONB), created_at, updated_at
```

## Verification Steps

1. `alembic upgrade head` succeeds on a fresh database
2. `alembic downgrade base` succeeds
3. `alembic upgrade head` again succeeds (roundtrip)
4. Foreign key constraints are enforced
5. Required indexes exist
6. pg_trgm extension is installed
