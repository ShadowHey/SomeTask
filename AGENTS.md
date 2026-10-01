# Audio Notes Platform — Engineering Rules

## Project Overview

Multi-user web application: upload audio → Gnani STT transcription → Gemini summary → view/manage recordings.

**Stack:** Next.js (frontend), FastAPI (backend), PostgreSQL, ARQ + Redis, Cloudflare R2, Gnani Batch STT, Gemini Flash.

## Source of Truth

1. `project_spec_v1.1.md` — product requirements
2. `architecture_spec_v1.1.md` — architecture decisions
3. `docs/external/gnani/gnani_stt_offline_reference.md` — Gnani API reference

Read these before making architectural changes.

## Mandatory Rules

### Correctness
- Never claim a feature works without verification.
- Never fabricate test results.
- Never fabricate API behavior — use documented provider behavior only.
- Run relevant tests after meaningful changes.

### Documentation
- Read project documentation before making architectural changes.
- Prefer official provider documentation over model memory.
- Record meaningful architecture decisions in `docs/adr/`.

### Security
- Keep secrets out of source code. Use environment variables only.
- Never log API keys, passwords, or sensitive user data.
- Follow least-privilege access.
- Every user's recordings must be isolated from other users.
- Authorization must be enforced server-side on every recording operation.
- Never trust a user ID from the request body for ownership.
- Presigned URLs must be short-lived.
- R2 bucket remains private.

### Database
- Schema changes must use Alembic migrations.
- Never manually modify production databases.

### Background Processing
- Long-running operations must not block HTTP requests.
- Background jobs must be retryable and idempotent.
- Retry policy: 1 min → 5 min → 10 min → mark failed.
- Do not retry permanent validation errors.
- Duplicate execution must not create duplicate data.

### External Services
- External API failures must be observable via structured logs.
- Preserve raw provider responses for debugging.
- Provider-specific code stays inside provider adapters.
- The rest of the application uses provider interfaces.

### Observability
- Use structured logging with recording_id, job_id, provider fields.
- Never log credentials or full audio/transcript contents.
- Include request_id, user_id in log context where applicable.

### Code Quality
- Keep the implementation understandable — the evaluator may ask about every decision.
- Avoid unnecessary complexity, abstractions, dependencies.
- No microservices, Kubernetes, Kafka, or event buses.
- Prefer focused modules with clear responsibilities.
- No giant route handlers or business logic in React components.

### Upload Architecture
- FastAPI must NEVER receive the complete audio binary.
- Browser uploads directly to R2 via presigned multipart upload.
- Validate: file type, extension, size, ownership, safe object key.

### Status Model
- Use explicit status enum: CREATED, UPLOADING, UPLOADED, QUEUED, TRANSCRIBING, SUMMARIZING, COMPLETED, FAILED, DELETED.
- Do not allow arbitrary status transitions.
- A failed summary must not erase a successful transcript.

### Gnani Integration
- Use Batch STT (not REST) for all audio processing.
- REST endpoint is limited to 60 seconds — not suitable for this application.
- Batch flow: Create Job → Start Job → Poll (≥10s interval) → Get Files → Download Transcript.
- Batch supports 8 languages (no gu-IN or pa-IN).
- Language identification is per-file, not per-segment.
- Maximum 4 hours per file. Files >4h require FFmpeg chunking.
- transcript_url expires in 1 hour — download immediately.
- Cloud storage path: no byte cap, 30-min download time limit.

### Audio Limits
- Maximum duration: 300 minutes (configurable).
- Maximum file size: 5 GB (configurable).
- Supported formats: WAV, MP3, OGG, FLAC, AAC, M4A (from Gnani docs).

## Skills Reference

See `.agents/skills/` for focused engineering procedures:
- `gnani-transcription/` — Gnani Batch STT integration
- `external-api-integration/` — External API patterns
- `background-jobs/` — ARQ worker patterns
- `database-migrations/` — Alembic migration procedures
- `testing/` — Test strategy and procedures
- `security-review/` — Security checklist
- `code-review/` — Code review checklist
