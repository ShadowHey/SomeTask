# Audio Notes Platform — Architecture Specification

**Version:** 1.0  
**Status:** Approved baseline architecture

---

# 1. Architectural Goal

Build a modular monolith with a separate background worker.

The system should be simple enough for a take-home assignment but demonstrate real production engineering:

- clear service boundaries
- asynchronous processing
- object storage
- database persistence
- provider isolation
- retry handling
- ownership/security
- observability
- deployment separation

Avoid distributed-system complexity that is not justified by the requirements.

---

# 2. High-Level Architecture

```text
                        ┌──────────────────────┐
                        │      Next.js UI      │
                        │       Vercel         │
                        └──────────┬───────────┘
                                   │ HTTPS
                                   ▼
                        ┌──────────────────────┐
                        │     FastAPI API      │
                        │       Render        │
                        └──────┬───────┬───────┘
                               │       │
                     ┌─────────┘       └───────────┐
                     ▼                             ▼
             ┌──────────────┐              ┌──────────────┐
             │ PostgreSQL   │              │ Cloudflare R2│
             │              │              │ Audio files  │
             └──────────────┘              └──────────────┘
                     │                             ▲
                     │                             │
                     │                    Browser direct upload
                     │
                     ▼
             ┌──────────────┐
             │ Redis        │
             │ / ARQ queue  │
             └──────┬───────┘
                    │
                    ▼
             ┌──────────────┐
             │ ARQ Worker   │
             │    Render    │
             └──────┬───────┘
                    │
             ┌──────┴─────────┐
             ▼                ▼
       ┌───────────┐    ┌────────────┐
       │ Gnani STT │    │ Gemini     │
       │           │    │ Flash      │
       └───────────┘    └────────────┘
```

---

# 3. Core Architectural Principle

FastAPI is the control plane.

It does not become the audio-data transport layer.

The browser uploads audio directly to R2.

FastAPI manages:

- identity
- authorization
- upload sessions
- presigned URLs
- metadata
- state
- job creation
- API responses

The ARQ worker manages expensive/slow processing.

---

# 4. Authentication

Use application-owned email/password authentication.

Recommended implementation:

- FastAPI authentication endpoints
- Argon2 password hashing
- Secure HTTP-only cookie containing the authenticated session/token
- Short-lived access semantics with appropriate refresh/session strategy
- Server-side authorization on every user-owned resource

Do not store authentication state only in localStorage.

Every recording query must enforce:

```text
recording.user_id == authenticated_user.id
```

Never trust a user ID supplied by the frontend.

---

# 5. Frontend Architecture

Recommended structure:

```text
frontend/
├── app/
│   ├── login/
│   ├── register/
│   ├── upload/
│   ├── recordings/
│   ├── recordings/[id]/
│   └── architecture/
├── components/
│   ├── upload/
│   ├── recordings/
│   ├── transcript/
│   ├── processing/
│   └── ui/
├── lib/
│   ├── api/
│   ├── auth/
│   └── upload/
└── types/
```

Do not put API calls, upload orchestration, and complex business state directly into page components.

---

# 6. Direct-to-R2 Upload Architecture

For small and large files, use an upload-session abstraction.

Flow:

```text
Browser
  │
  │ POST /uploads/initiate
  ▼
FastAPI
  │
  ├── authenticate user
  ├── validate filename/type/size metadata
  ├── create audio record
  ├── create R2 multipart upload
  └── return upload instructions
  │
  ▼
Browser
  │
  ├── upload part 1 → R2
  ├── upload part 2 → R2
  ├── ...
  └── upload part N → R2
  │
  ▼
Browser
  │ POST /uploads/{id}/complete
  ▼
FastAPI
  │
  ├── complete R2 multipart upload
  ├── verify object exists
  ├── transition status
  └── enqueue processing job
```

The backend never receives the full audio payload.

---

# 7. Why Multipart Upload

The application supports up to 5 GB.

A single PUT is less resilient for large files.

Multipart upload provides:

- parallel/sequential part upload
- retry of individual parts
- progress reporting
- better recovery from transient network failure
- no need to buffer the entire file in FastAPI

The frontend should not expose permanent R2 credentials.

Presigned part URLs are short-lived.

---

# 8. Upload Progress

Upload progress is calculated from browser-side multipart progress.

Processing progress is state-based rather than pretending to know an exact percentage when the provider does not expose one.

Example:

```text
Uploading       72%
Queued          ✓
Transcribing    …
Generating      -
Complete        -
```

For transcription/summarization, display stage progress rather than fabricated percentages unless reliable provider progress exists.

---

# 9. Database Model

A likely initial schema:

## users

```text
id
email
password_hash
created_at
updated_at
```

## audio_files

```text
id
user_id
original_filename
display_name
object_key
mime_type
size_bytes
duration_seconds
status
created_at
updated_at
uploaded_at
completed_at
failure_code
failure_message
```

## processing_jobs

```text
id
audio_file_id
job_type
status
attempt_count
available_at
started_at
completed_at
last_error
created_at
updated_at
```

## transcript_segments

```text
id
audio_file_id
sequence
start_ms
end_ms
text
created_at
```

## transcripts / raw provider result

Store the complete raw Gnani response as JSONB.

Exact normalized transcript structure should be decided after inspecting Gnani's real response schema.

## summaries

```text
id
audio_file_id
content
provider
model
status
attempt_count
raw_response
created_at
updated_at
```

Use foreign keys and indexes.

---

# 10. Status Model

The application should distinguish upload state from processing state.

A practical recording lifecycle:

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

For provider-specific failure, store structured failure metadata rather than creating dozens of status values.

A failed summary should not erase a successful transcript.

---

# 11. ARQ Worker Architecture

Use separate worker process(es).

Suggested job boundaries:

```text
process_transcription(audio_file_id)
generate_summary(audio_file_id)
```

If chunking becomes necessary:

```text
prepare_chunks(audio_file_id)
transcribe_chunk(audio_file_id, chunk_id)
merge_transcript(audio_file_id)
```

Do not introduce chunk jobs until provider constraints justify them.

---

# 12. Retry Policy

Retries:

```text
attempt 1
   ↓ failure
wait 1 minute

attempt 2
   ↓ failure
wait 5 minutes

attempt 3
   ↓ failure
wait 10 minutes

final failure
```

Retry only transient failures:

- timeout
- temporary provider outage
- HTTP 429
- 5xx
- temporary storage/queue failures

Do not retry:

- unsupported format
- invalid API credentials
- malformed request
- permanent validation errors

Provider-specific retry classification belongs inside provider adapters/services, not UI code.

---

# 13. Idempotency

Every processing operation must be safe to run more than once.

Examples:

- duplicate transcription job must not create duplicate transcript rows
- duplicate summary job should replace/update the same summary version
- multipart completion must not corrupt state
- retry must not create a second logical recording

Use database constraints and deterministic identifiers where useful.

---

# 14. Gnani Provider Adapter

Create a provider boundary:

```text
TranscriptionProvider
        │
        └── GnaniTranscriptionProvider
```

The rest of the application must not know Gnani's HTTP details.

Example conceptual interface:

```python
class TranscriptionProvider(Protocol):
    async def transcribe(
        self,
        audio_url: str,
        options: TranscriptionOptions,
    ) -> TranscriptionResult:
        ...
```

`GnaniTranscriptionProvider` handles:

- authentication
- HTTP client
- timeout
- request construction
- response parsing
- error classification
- raw response preservation

The official Gnani documentation must be stored locally before implementation.

---

# 15. Gnani Long-Audio Strategy

The target is 300 minutes.

The preferred path is to use Gnani's documented batch/long-audio API where supported.

The architecture should pass a short-lived signed URL for the R2 object to Gnani rather than transferring the audio through FastAPI.

The exact URL lifetime must be long enough for Gnani to fetch the file but as short as practical.

Because the application explicitly targets 300 minutes while Gnani Batch caps each file at 4 hours, implement FFmpeg chunking only for files longer than 4 hours. Do not chunk shorter files merely because they are large.

---

# 16. Cloudflare R2 Security

Bucket should remain private.

Objects should use generated keys, for example:

```text
users/{user_id}/audio/{audio_id}/source
```

Do not use raw user filenames as object keys.

Frontend access uses short-lived signed GET URLs.

Gnani access uses a temporary signed URL generated server-side.

---

# 17. Transcript Storage

Store normalized transcript segments separately from raw provider response.

Why:

- search
- timestamps
- audio seeking
- future UI improvements
- provider abstraction

Also preserve the complete raw provider response for debugging and auditability.

---

# 18. Fuzzy Search Architecture

Use PostgreSQL's `pg_trgm` extension.

Recommended index:

```sql
CREATE INDEX transcript_segments_text_trgm_idx
ON transcript_segments
USING gin (text gin_trgm_ops);
```

Search should combine:

- exact/ILIKE matching
- trigram similarity
- sensible ranking

Return:

```text
segment id
text
start_ms
end_ms
similarity/rank
```

Avoid sending the entire transcript to the browser for every search.

Potential result:

```text
Search: "machine lerning"

1. "...we discussed machine learning..."
   00:04:21

2. "...the machine learning pipeline..."
   00:12:08
```

---

# 19. Gemini Summary Architecture

Create a provider boundary:

```text
SummaryProvider
      │
      └── GeminiSummaryProvider
```

Use a current stable Flash-class Gemini model selected from official documentation at implementation time.

As of October 2026, Google's official model documentation lists Gemini 3.8 Flash as a stable Flash model with audio input, a 1M-token context window, and 64K output limit. citeturn0search0turn0search2

Do not hard-code a preview model.

The model ID should be configurable.

---

# 20. Summary Input Strategy

For normal transcript lengths:

```text
normalized transcript
       ↓
summary prompt
       ↓
Gemini Flash
       ↓
summary text
```

For extremely long transcripts, the system should avoid blindly sending content beyond safe context limits.

If required, implement transcript summarization in stages:

```text
segments
   ↓
section summaries
   ↓
final summary
```

Do not add hierarchical summarization unless needed for actual supported input sizes.

---

# 21. Synchronous vs Background Work

### Synchronous

- authentication
- metadata validation
- upload initialization
- issuing presigned URLs
- upload completion request
- database reads/writes
- history queries
- transcript search
- rename/delete
- status retrieval

### Background

- transcription
- FFmpeg processing if required
- transcript normalization/merging
- summary generation
- provider retries

---

# 22. Failure State Architecture

A failed job should contain:

```text
stage
error_code
safe_user_message
internal_error_type
attempt_count
last_attempt_at
retryable
```

Frontend displays safe messages.

Logs contain diagnostic details.

Do not leak stack traces or provider credentials to users.

---

# 23. API Boundary

Conceptual endpoints:

```text
POST   /auth/register
POST   /auth/login
POST   /auth/logout
GET    /auth/me

POST   /uploads/initiate
POST   /uploads/{id}/parts
POST   /uploads/{id}/complete
POST   /uploads/{id}/abort

GET    /recordings
GET    /recordings/{id}
PATCH  /recordings/{id}
DELETE /recordings/{id}

GET    /recordings/{id}/status
GET    /recordings/{id}/audio-url
GET    /recordings/{id}/transcript/search

GET    /health
GET    /ready
```

The exact API surface may be adjusted after implementation planning.

---

# 24. Project Structure

Recommended backend:

```text
backend/
├── app/
│   ├── api/
│   ├── core/
│   ├── db/
│   ├── models/
│   ├── schemas/
│   ├── repositories/
│   ├── services/
│   │   ├── auth/
│   │   ├── storage/
│   │   ├── transcription/
│   │   ├── summarization/
│   │   └── search/
│   ├── workers/
│   └── main.py
├── migrations/
├── tests/
└── pyproject.toml
```

Frontend:

```text
frontend/
├── app/
├── components/
├── hooks/
├── lib/
├── types/
└── tests/
```

Documentation:

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

---

# 25. Deployment

Recommended:

```text
Vercel
  └── Next.js

Render
  ├── FastAPI Web Service
  └── ARQ Worker

Render PostgreSQL
  └── PostgreSQL

Cloudflare R2
  └── Audio objects

Redis-compatible service
  └── ARQ queue
```

The exact Redis hosting option should be chosen based on what is available/reliable at implementation time.

Do not add Redis Sentinel, clustering, or HA configuration for this assignment.

---

# 26. CI/CD

GitHub Actions:

```text
push / pull request
        ↓
lint
        ↓
typecheck
        ↓
tests
        ↓
build
```

Deployment can be connected to the selected hosting providers after CI is green.

---

# 27. Architecture Decisions

## ADR-001 — Modular monolith

Chosen because the assignment is small but contains multiple responsibilities.

## ADR-002 — Direct R2 upload

Chosen to prevent FastAPI from buffering/transporting 5 GB audio.

## ADR-003 — ARQ worker

Chosen because the assignment explicitly requires background jobs and the processing is long-running.

## ADR-004 — Provider adapters

Chosen to prevent vendor-specific HTTP code from leaking throughout the application.

## ADR-005 — PostgreSQL fuzzy search

Chosen to avoid shipping full transcripts to the browser and to provide a real server-side search capability.

## ADR-006 — No default FFmpeg chunking

Chosen because chunking adds complexity and should only exist when provider limits require it.

---

# 28. Security Boundary

```text
Browser
  │
  ├── authenticated API requests
  │
  └── signed R2 upload
       (no permanent R2 credentials)

FastAPI
  │
  ├── DB
  ├── R2 control operations
  ├── Gnani credentials
  └── Gemini credentials

Worker
  │
  ├── R2 read access
  ├── Gnani credentials
  ├── Gemini credentials
  └── PostgreSQL
```

Secrets stay server-side.

---

# 29. What More Time Could Improve

The `/architecture` page should explicitly mention realistic future improvements:

- resumable upload recovery across browser refreshes
- richer job observability
- provider fallback
- virus/malware scanning
- object lifecycle cleanup
- stronger rate limiting
- email verification/password reset
- richer transcript navigation
- better large-transcript hierarchical summarization
- automated end-to-end deployment smoke tests
- metrics/tracing
- more comprehensive test coverage

Do not implement these unless required.



## Current external-reference note

The architecture intentionally requires verifying provider behavior from official documentation at implementation time. Current Google Gemini documentation lists Gemini 3.8 Flash as a stable Flash-class model with audio input and a 1M-token context window; the exact model ID should remain configurable rather than being scattered through code.
