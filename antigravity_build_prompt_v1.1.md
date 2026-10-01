# Antigravity Master Build Prompt — Audio Notes Platform

You are the primary engineering agent for this repository.

Your task is to build the Audio Notes Platform described in:

- `project_spec.md`
- `architecture_spec.md`

These documents are the source of truth.

Do not immediately start writing application code.

---

# 0. Operating Principle

Build this like a careful software engineer, not like a code-generation benchmark.

The objective is not to maximize lines of code.

The objective is:

> minimum necessary code + clear architecture + correctness + maintainability + demonstrable engineering judgment.

Do not "vibe code" the assignment.

Never invent external API behavior.

Never claim something works unless it has actually been tested.

---

# 1. First Action — Inspect the Repository

Before modifying anything:

1. Inspect the complete repository.
2. Identify whether a frontend/backend already exists.
3. Inspect package managers.
4. Inspect existing environment/config files.
5. Inspect git state.
6. Identify existing documentation.
7. Identify existing tests.
8. Identify existing deployment configuration.
9. Do not delete or overwrite useful existing work without justification.

Create a short internal repository assessment.

---

# 2. Create the Engineering Documentation First

Before implementing the application, ensure these exist:

```text
docs/
├── product-requirements.md
├── architecture.md
├── decision-log.md
├── deployment.md
├── external/
│   └── gnani/
└── adr/
```

Also create/update:

```text
AGENTS.md
```

`AGENTS.md` must contain the permanent engineering rules in this prompt.

Do not rely only on this prompt for future decisions.

---

# 3. Gnani Documentation — Mandatory Research Step

Before writing the Gnani integration:

1. Navigate to the official Gnani documentation specified by the assignment.
2. Read the relevant Speech-to-Text documentation.
3. Download/save the relevant documentation or a faithful local reference under:

```text
docs/external/gnani/
```

At minimum document:

```text
authentication
endpoint
request format
response format
supported formats
file limits
duration limits
batch/long-audio behavior
language behavior
code-switching behavior
timeouts
errors
rate limits
retry behavior
URL requirements
```

Do not use random third-party tutorials as the source of truth.

If official documentation conflicts with an assumption in `architecture_spec.md`, stop and update the architecture document before implementation.

---

# 4. Validate Gnani With a Minimal Integration

Before integrating Gnani into the production workflow:

1. Create a tiny isolated provider test.
2. Send a real supported audio sample if credentials are available.
3. Verify authentication.
4. Verify request format.
5. Verify response format.
6. Record the actual response structure.
7. Verify long-audio/batch behavior if possible.
8. Verify language/code-switching behavior.
9. Verify the URL-fetch behavior needed for private R2 objects.
10. Update `docs/external/gnani/` with implementation notes.

The application must preserve the complete raw Gnani response.

Do not proceed with guessed fields.

---

# 5. Gemini Research Step

Before implementing summary generation:

1. Read the official Google Gemini API model documentation.
2. Select a current stable Flash-class model.
3. Put the model ID in configuration.
4. Do not use an obsolete/deprecated preview model.
5. Document the decision in an ADR.

As of the current project specification, Gemini 3.8 Flash is a valid stable Flash-class option with text/audio input and a large context window. Verify current availability before implementation rather than assuming this remains unchanged.

---

# 6. Product Scope

Implement:

- email/password registration
- email/password login/logout
- authenticated user ownership
- drag/drop upload
- file picker
- direct R2 upload
- multipart upload for large files
- upload progress
- processing status
- active jobs
- Gnani transcription
- raw Gnani response preservation
- Gemini summary
- history
- recording detail page
- transcript search
- fuzzy matching
- copy summary
- copy transcript
- rename recording
- delete recording
- `/architecture`
- health/readiness endpoints
- structured logging
- database migrations
- CI
- deployment configuration

Do not implement browser audio recording.

Do not implement meeting-specific functionality.

Do not add unnecessary AI features.

---

# 7. Hard Constraints

## Audio

Maximum:

```text
300 minutes
5 GB
```

Supported formats must come from official Gnani documentation.

## Storage

Cloudflare R2.

## Database

PostgreSQL.

## Background jobs

ARQ.

## Backend

FastAPI.

## Frontend

Next.js + TypeScript.

## Summary

Gemini Flash-class model.

## Deployment

Preferred:

```text
Vercel → Next.js
Render → FastAPI
Render → ARQ worker
Managed PostgreSQL
Cloudflare R2
Redis-compatible ARQ queue
```

Use the simplest reliable configuration.

---

# 8. Direct Upload Architecture

The backend must NEVER receive the complete audio binary.

The intended flow:

```text
Browser
  ↓
FastAPI: initialize upload
  ↓
FastAPI creates R2 multipart upload
  ↓
FastAPI returns signed upload instructions
  ↓
Browser uploads parts directly to R2
  ↓
Browser reports completed parts
  ↓
FastAPI completes multipart upload
  ↓
FastAPI enqueues processing job
```

Do not create a FastAPI endpoint that accepts a 5 GB audio body.

---

# 9. Authentication

Implement application-owned email/password authentication.

Requirements:

- secure password hashing
- secure HTTP-only authentication cookie/session mechanism
- no plaintext passwords
- no auth secrets in source code
- authorization on every recording operation
- users can access only their own records

Never trust a user ID from the request body when determining ownership.

---

# 10. Database

Use SQLAlchemy or another mature PostgreSQL ORM/query layer.

Use migrations.

Recommended migration tool:

```text
Alembic
```

Do not modify production schema manually.

Suggested tables:

```text
users
audio_files
processing_jobs
transcript_segments
summaries
```

Additional upload/multipart tables may be added only when justified.

Store raw Gnani response as JSONB.

---

# 11. Status Machine

Implement a clear state machine.

Suggested states:

```text
CREATED
UPLOADING
UPLOADED
QUEUED
TRANSCRIBING
SUMMARIZING
COMPLETED
FAILED
DELETED
```

Do not allow arbitrary status transitions.

Document legal transitions.

A failed summary must not erase a successful transcript.

---

# 12. Worker Design

Use ARQ.

Worker responsibilities:

```text
transcription job
summary job
optional audio preprocessing/chunk job
```

Jobs must be idempotent.

Retry transient failures:

```text
retry 1 → 1 minute
retry 2 → 5 minutes
retry 3 → 10 minutes
```

Then mark failed.

Do not retry permanent validation errors.

---

# 13. Long Audio

Target 300 minutes / 5 GB.

First determine whether Gnani's documented batch API supports the full target directly.

If yes:

> Do not chunk.

If no:

> Implement FFmpeg chunking as a fallback.

If chunking is implemented:

- deterministic chunk IDs
- ordered chunks
- retry individual chunks
- preserve timestamps
- merge transcript automatically
- avoid duplicate segments
- final logical transcript must look like one transcript

Do not add chunking for files that fit within Gnani Batch's 4-hour per-file limit.

---

# 14. Provider Isolation

Never call Gnani directly from API route handlers or worker business logic.

Create:

```text
TranscriptionProvider
└── GnaniTranscriptionProvider
```

Likewise:

```text
SummaryProvider
└── GeminiSummaryProvider
```

The rest of the application should use provider interfaces/domain services.

Provider code owns:

- HTTP requests
- authentication
- request construction
- response parsing
- provider error classification
- timeouts
- retry classification
- raw response preservation

---

# 15. Transcript Model

Normalize transcript output into segments:

```text
sequence
start_ms
end_ms
text
```

Preserve the raw Gnani response separately.

If Gnani provides timestamps, use them.

If it does not, do not invent timestamps.

---

# 16. Fuzzy Search

Use PostgreSQL `pg_trgm`.

Add the required extension and index.

Search endpoint should return relevant transcript segments rather than the entire transcript.

Results should include:

```text
text
timestamp
similarity/ranking
```

Frontend should display several close matches.

If timestamp data exists, clicking a result should seek the audio player.

Do not implement a fake fuzzy-search algorithm in the frontend if PostgreSQL can handle the search reliably.

---

# 17. Summary

Summary is automatically generated.

No user-selected summary style.

The summary should be derived from the transcript.

Do not add unsupported fields like:

- sentiment
- action items
- speakers
- topics

unless they are explicitly required later.

Store:

```text
summary content
provider
model
raw response where appropriate
status
attempt count
```

If summary generation fails:

```text
transcript remains available
summary marked failed/retryable
summary job retries
```

---

# 18. UI

The UI must clearly show:

```text
Uploading
Queued
Transcribing
Generating summary
Complete
Failed
```

Do not fabricate percentage progress for server-side stages where the provider does not expose actual progress.

Use stage-based progress.

History item should support:

- open
- copy summary
- copy transcript if practical
- rename
- delete

Detail page should provide:

- metadata
- audio player
- summary
- transcript
- search
- copy controls

---

# 19. Error Handling

Never hide errors.

Frontend messages should be human-readable.

Backend logs should contain diagnostic context.

Example:

User:

> "Transcription is temporarily unavailable. We'll retry automatically."

Internal log:

```text
recording_id=...
job_id=...
provider=gnani
attempt=2
error_type=timeout
```

Do not expose:

- stack traces
- API keys
- internal URLs
- SQL errors
- secret configuration

---

# 20. Structured Logging

Use structured logs.

Include when applicable:

```text
request_id
user_id
recording_id
job_id
stage
attempt
provider
duration_ms
file_size
error_type
```

Never log credentials.

Avoid logging full raw audio/transcript unless genuinely necessary for debugging.

---

# 21. API

Use clean FastAPI routers.

Potential endpoints:

```text
/auth/register
/auth/login
/auth/logout
/auth/me

/uploads/initiate
/uploads/{id}/complete
/uploads/{id}/abort

/recordings
/recordings/{id}
/recordings/{id}/status
/recordings/{id}/audio-url
/recordings/{id}/transcript/search

/health
/ready
```

Do not create dozens of unnecessary endpoints.

Use Pydantic request/response schemas.

Default FastAPI OpenAPI/Swagger is sufficient.

---

# 22. Frontend Engineering Rules

Do not put business logic in pages.

Use:

```text
components
hooks
API client
typed API models
upload service
```

Keep components focused.

Avoid massive React components.

Avoid duplicate API-fetch logic.

Handle:

- loading
- empty
- success
- error
- retry
- unauthorized
- deleted resources

---

# 23. Testing

Minimal but meaningful.

Must test:

1. Register/login
2. User ownership
3. Upload initialization
4. Processing state transition
5. Gnani error/retry behavior
6. Transcript search
7. Summary failure preserving transcript

Add a basic frontend flow test where practical.

Do not produce meaningless test volume.

---

# 24. CI

Create GitHub Actions.

At minimum:

```text
frontend lint
frontend typecheck
frontend build
backend lint
backend tests
```

Keep CI deterministic.

---

# 25. Security Checklist

Before declaring done, verify:

- no secrets committed
- `.env` ignored
- passwords hashed
- auth cookies secure
- ownership checks exist
- R2 bucket private
- signed URLs short-lived
- file size validation exists
- MIME/extension validation exists
- object keys are generated
- provider credentials server-side
- internal errors not exposed
- request validation exists

---

# 26. Architecture Documentation

The application must have:

```text
/architecture
```

The page must explain:

- architecture
- upload flow
- storage
- authentication
- worker
- Gnani
- Gemini
- retries
- long audio
- failure handling
- synchronous/background split
- tradeoffs
- future improvements

Link the GitHub repository.

Keep the explanation understandable to a software engineer reviewing a take-home.

---

# 27. Development Process

Follow these phases.

## Phase 0 — Discovery

Inspect repository and requirements.

Output:

```text
docs/repository-assessment.md
```

Do not code application features yet.

## Phase 1 — External API research

Download/read Gnani documentation.

Verify Gemini model.

Create:

```text
docs/external/gnani/*
docs/adr/*
```

## Phase 2 — Architecture

Finalize:

- DB schema
- status machine
- API contracts
- upload flow
- worker flow
- provider interfaces
- deployment topology

Do not implement until architecture is coherent.

## Phase 3 — Scaffold

Create:

```text
frontend/
backend/
docs/
.github/
```

Set up linting, formatting, migrations, testing, configuration.

## Phase 4 — Authentication

Implement and test auth.

## Phase 5 — R2 Upload

Implement direct multipart upload.

Test with real R2.

## Phase 6 — Processing Pipeline

Implement:

```text
R2
↓
ARQ
↓
Gnani
↓
PostgreSQL
```

Test with real Gnani.

## Phase 7 — Summary

Implement:

```text
transcript
↓
Gemini
↓
summary
```

## Phase 8 — History/detail/search

Implement user-facing functionality.

## Phase 9 — Failure handling

Test intentional failures.

## Phase 10 — Hardening

Review:

- security
- race conditions
- retries
- ownership
- idempotency
- cleanup
- UX states

## Phase 11 — Deployment

Deploy frontend/API/worker/database/queue/storage.

## Phase 12 — Smoke testing

Use the actual public URL.

Test:

```text
register
login
upload
wait
transcript
summary
history
search
copy
rename
delete
logout/login
```

## Phase 13 — Final review

Run all checks.

Only then declare complete.

---

# 28. No-Vibe-Coding Rules

Before implementing any non-trivial feature:

1. Identify the requirement.
2. Identify affected components.
3. Inspect existing code.
4. Identify failure modes.
5. Identify data/state changes.
6. Implement the smallest maintainable solution.
7. Test it.
8. Review it.

Do not silently invent requirements.

If an ambiguity materially affects architecture, stop and ask.

If the answer can be safely derived from the specification, proceed.

---

# 29. Dependency Discipline

Before installing a dependency:

1. Check whether an existing dependency already solves it.
2. Check whether the framework already provides the functionality.
3. Check whether the standard library is sufficient.
4. If a new dependency is justified, document why.

Do not add libraries simply because they are popular.

---

# 30. Code Review Before Completion

Perform a self-review.

Look specifically for:

- giant files
- giant functions
- duplicated logic
- poor naming
- dead code
- swallowed exceptions
- unsafe SQL
- missing ownership checks
- missing retries
- incorrect status transitions
- non-idempotent workers
- secrets in source
- unnecessary abstractions
- unnecessary dependencies
- fake progress
- misleading comments

Prefer deleting unnecessary code over adding more code.

---

# 31. Completion Rule

Never say:

> "The project is complete."

unless the actual implementation has passed:

```text
✓ frontend lint
✓ frontend typecheck
✓ frontend build
✓ backend lint
✓ backend tests
✓ migrations
✓ real Gnani integration
✓ real R2 upload
✓ real worker processing
✓ real Gemini summary
✓ authentication
✓ ownership isolation
✓ fuzzy transcript search
✓ failure/retry test
✓ deployment
✓ public URL smoke test
✓ /architecture page
```

If something could not be tested, explicitly say what could not be tested and why.

---

# 32. Final Deliverables

The repository should contain:

```text
README.md
AGENTS.md

docs/
├── product-requirements.md
├── architecture.md
├── decision-log.md
├── deployment.md
├── repository-assessment.md
├── external/
│   └── gnani/
└── adr/

frontend/
backend/

.github/workflows/
```

README must explain:

- what the application does
- architecture
- local development
- environment variables
- migrations
- worker
- deployment
- test commands

Do not expose secrets.

---

# 33. Final Engineering Principle

When choosing between:

```text
more code
```

and

```text
simpler correct code
```

choose the simpler correct code.

When choosing between:

```text
clever abstraction
```

and

```text
clear explicit implementation
```

choose the clear implementation unless abstraction provides a real extension/testing boundary.

When choosing between:

```text
pretending a feature works
```

and

```text
testing and reporting a limitation
```

choose testing and honesty.

The evaluator is expected to question the implementation.

Build something that can be explained line-by-line.
