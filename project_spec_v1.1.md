# Audio Notes Platform — Project Specification

**Version:** 1.0  
**Status:** Approved baseline specification  
**Purpose:** Take-home assessment for an Audio Notes Platform

---

## 1. Product Summary

Build a multi-user web application where authenticated users can:

1. Upload an audio file through drag-and-drop or a file picker.
2. Upload directly from the browser to Cloudflare R2 without sending the full audio binary through FastAPI.
3. See clear upload and processing progress.
4. Have the audio transcribed using Gnani's Speech-to-Text API.
5. Have the transcript summarized using a Gemini Flash-class LLM.
6. View, search, copy, rename, and delete previous recordings.
7. Open a dedicated detail page for each recording.
8. Understand failures and retryable states without the UI appearing frozen.
9. Read `/architecture` inside the application for a plain-English system explanation and GitHub repository link.

The application must be deployed and usable through a public URL.

---

## 2. Important Scope Decisions

### Authentication

Authentication is required.

- Email/password registration.
- Email/password login.
- Passwords must never be stored in plaintext.
- Each upload belongs to exactly one authenticated user.
- Users must never be able to access another user's audio or transcript data.

No social OAuth is required.

### Audio recording

Browser-side audio recording is **not** required and should not be implemented.

Only uploaded audio files are supported.

### Supported audio

The application should support the audio formats officially supported by Gnani.

The exact accepted MIME types/extensions must be derived from the official Gnani documentation stored locally under `docs/external/gnani/`.

Do not invent supported formats.

### Limits

Application-level limits:

- Maximum duration: 300 minutes.
- Maximum object size: 5 GB.

These limits must be configurable through environment/configuration rather than scattered magic numbers.

The system should reject obviously invalid uploads before unnecessary processing where possible.

---

## 3. User Experience

### 3.1 Upload page

Provide:

- Drag-and-drop zone.
- File picker.
- File validation.
- Upload progress.
- Current processing status.
- Clear error messages.
- Active-job visibility.

The UI should make it obvious whether the application is:

- Uploading
- Queued
- Transcribing
- Generating summary
- Completed
- Failed

### 3.2 Upload lifecycle

Expected user-facing flow:

```text
Select file
    ↓
Uploading
    ↓
Uploaded
    ↓
Queued
    ↓
Transcribing
    ↓
Generating summary
    ↓
Completed
```

Failures must visibly identify the relevant stage.

### 3.3 History

Authenticated users have a history/library view showing their own uploads.

Each item should show:

- File name
- Duration
- File size
- Upload time
- Status
- Summary preview
- Transcript availability where useful
- Copy controls

Users can:

- Open a recording.
- Copy the summary directly from the history item.
- Copy the transcript where appropriate.
- Rename the recording.
- Delete the recording.

### 3.4 Audio detail page

Each recording has a dedicated detail page.

The page should prominently show:

- File name
- Duration
- File size
- Upload time
- Current status
- Audio player
- Summary
- Transcript
- Copy buttons
- Search controls

The summary and transcript must be readable in a larger dedicated view.

### 3.5 Transcript search

Transcript search must support fuzzy matching.

Expected behavior:

- User enters a word or short phrase.
- Search operates over transcript segments.
- Exact and near matches should be returned.
- Results should show enough transcript context to understand the match.
- If timestamps are available, results should expose timestamps.
- Clicking a result may seek the audio player to the corresponding timestamp when timestamp data is available.

Use PostgreSQL trigram capabilities (`pg_trgm`) for server-side fuzzy matching rather than loading an entire potentially large transcript into the browser.

---

## 4. Processing

### Speech-to-text

Gnani is the transcription provider.

Before implementation:

1. Read the official assignment-linked Gnani API documentation.
2. Store relevant official documentation locally under `docs/external/gnani/`.
3. Verify authentication, endpoint, request format, response format, supported formats, limits, language behavior, code-switching behavior, errors, and batch/long-audio behavior.
4. Create a minimal real integration test against Gnani before integrating the provider into the main workflow.

The application must preserve the complete raw Gnani response.

### Language selection

Do not add unnecessary language-selection UX.

Determine the behavior from the actual Gnani API:

- If the user knows the language, allow a single supported language.
- If the user does not know the language, allow up to three supported Batch language codes for per-file identification.
- Do not describe this as arbitrary segment-level code-switching because the Batch documentation says language resolution is per file.
- Gujarati and Punjabi are supported by REST/Realtime but not Batch; do not silently promise those languages for long Batch recordings.

Indian multilingual audio is a relevant use case, but the application must follow Gnani's actual documented Batch behavior: up to three candidate language codes can be supplied for per-file language identification; this is not arbitrary intra-file segment-level code switching.

---

## 5. Summary

Summary provider:

**Google Gemini Flash-class model.**

Use a stable/current Flash-class model selected during implementation based on the current official Gemini API documentation.

The summary is generated automatically.

There is no user-configurable summary style in the product.

The application should primarily display the model's generated summary rather than inventing additional AI-derived fields.

If transcription succeeds but summary generation fails:

- Keep the transcript available.
- Mark summary generation as failed/retryable.
- Retry summary generation according to the retry policy.
- Do not throw away successful transcription.

---

## 6. Storage

Audio files live in:

**Cloudflare R2**

The browser uploads directly to R2.

FastAPI must never receive the complete audio binary.

Use presigned upload URLs / multipart upload for large objects.

The backend is responsible for:

- Authenticating the user.
- Creating the upload record.
- Initiating multipart upload where appropriate.
- Issuing presigned upload URLs.
- Completing/aborting multipart uploads.
- Validating metadata.
- Creating processing jobs.
- Issuing short-lived presigned download URLs when required by the application/provider.

---

## 7. Long Audio

Target:

- Up to 300 minutes.
- Up to 5 GB.

Gnani Batch STT supports a maximum of 4 hours per file. The application target is 300 minutes (5 hours), so the architecture must support a chunking fallback for recordings longer than 4 hours.

Normal path:

- recordings up to 4 hours: use Gnani Batch directly from the R2 object through a short-lived presigned HTTPS URL.
- recordings over 4 hours: split with FFmpeg into chunks safely below the provider's 4-hour limit, transcribe chunks through Batch, restore timestamp offsets, and merge the transcript.

Chunking must not be used for files that fit within the provider's documented 4-hour limit.

The application-level 5 GB limit is separate from Gnani's duration limit. Gnani's Batch cloud-storage path has no byte-size cap, but the object must be downloadable within the provider's documented 30-minute download-time limit.

---

## 8. Background Jobs

Use:

**ARQ**

Use a separate worker process.

Jobs should be:

- Retryable.
- Idempotent.
- Observable through structured logs.
- Associated with a recording/job identifier.
- Safe against duplicate execution.

Retry policy:

1. First retry: 1 minute
2. Second retry: 5 minutes
3. Third retry: 10 minutes

After the maximum retry count, mark the relevant operation as failed and expose the failure to the user.

Do not retry permanent validation errors.

---

## 9. Database

Use PostgreSQL.

Use migrations.

Do not manually mutate production schema.

Suggested conceptual entities:

- users
- audio_files
- processing_jobs
- transcript_segments
- summaries
- upload_sessions / multipart state where required

Exact schema is an architecture decision and should be documented before implementation.

All user-owned records must contain a clear ownership relationship.

---

## 10. API

Use FastAPI.

Default FastAPI OpenAPI/Swagger documentation is sufficient.

Expose clean API boundaries for:

- authentication
- upload initialization
- upload completion
- recording history
- recording detail
- rename
- delete
- processing status
- transcript search
- audio access URL

Do not expose internal provider credentials or raw storage credentials.

---

## 11. Failure Handling

The application must visibly handle:

- Unsupported file
- File too large
- Duration too long
- Upload failure
- Multipart upload failure
- Storage failure
- Queue failure
- Gnani timeout
- Gnani API error
- Gnani invalid response
- Transcription failure
- Gemini timeout
- Gemini API error
- Summary failure
- Database failure
- Worker crash/retry
- Expired presigned URL

The user must never be left looking at a permanently frozen processing state.

---

## 12. Security

Minimum requirements:

- Hash passwords with a modern password hashing algorithm.
- Never store plaintext passwords.
- Store secrets only in environment variables.
- Never expose API keys to the browser.
- Never commit secrets.
- Validate upload metadata.
- Validate file size.
- Validate allowed file types.
- Use safe object keys.
- Scope every recording query to the authenticated user.
- Use short-lived presigned URLs.
- Do not expose raw R2 credentials.
- Do not expose internal exception details to users.
- Do not log API keys, passwords, or sensitive credentials.
- Avoid unnecessarily logging complete audio/transcript contents.

---

## 13. Observability

Use structured logging.

Important fields should include, where applicable:

- request_id
- user_id
- recording_id
- job_id
- stage
- attempt
- duration
- file_size
- provider
- error_type

Provide:

- `GET /health`
- `GET /ready`

Health endpoints should distinguish basic process health from dependency/readiness health where practical.

---

## 14. Testing

Testing should be intentionally scoped for a take-home.

Minimum useful coverage:

### Backend

- Authentication test
- Ownership/access-control test
- Upload session test
- Processing state transition test
- Provider error/retry test
- Transcript search test

### Frontend

- Basic upload flow
- Processing state rendering
- Failure state rendering
- Detail page rendering

### Integration

At least one real or controlled integration test for the Gnani provider.

Do not generate hundreds of low-value tests.

---

## 15. CI

Use GitHub Actions.

At minimum:

```text
lint
typecheck
backend tests
frontend tests
frontend build
```

Do not make CI unnecessarily complex.

---

## 16. Deployment

Preferred deployment:

```text
Next.js frontend
    ↓
Vercel

FastAPI API
    ↓
Render Web Service

ARQ Worker
    ↓
Render Worker Service

PostgreSQL
    ↓
Managed PostgreSQL / Render PostgreSQL

Audio
    ↓
Cloudflare R2
```

Use the simplest reliable configuration available at deployment time.

No custom domain is required.

No Docker Compose local reproduction is required.

Docker may be used by deployment infrastructure if useful, but it is not a project requirement.

---

## 17. Architecture Page

The application must contain:

`/architecture`

It must explain in plain English:

- System components
- Upload flow
- R2 storage
- Authentication
- PostgreSQL
- ARQ workers
- Gnani transcription
- Gemini summarization
- Long-audio handling
- Synchronous vs background operations
- Failure/retry behavior
- Security decisions
- What would be improved with more time

It must include a link to the GitHub repository.

A diagram is optional.

---

## 18. Code Quality Principles

The project must optimize for:

1. Correctness
2. Clarity
3. Maintainability
4. Modularity
5. Security
6. Testability
7. Extensibility
8. Operational visibility

Do not optimize for number of lines of code.

Avoid:

- Giant route handlers
- Business logic inside React components
- Duplicated provider calls
- Scattered environment-variable access
- Magic constants
- Unnecessary abstractions
- Premature microservices
- Excessive dependencies
- Overengineered event systems

Prefer focused modules with clear responsibilities.

---

## 19. Explicit Non-Goals

Do not build:

- Browser audio recording
- Meeting-specific features
- Speaker diarization UI unless Gnani data naturally supports it and it requires minimal work
- Action-item extraction
- Sentiment analysis
- CRM integrations
- Notifications
- Team/workspace management
- Admin dashboard
- Microservice architecture
- Kubernetes
- Kafka
- Complex event bus infrastructure
- User-configurable AI summary modes

---

## 20. Definition of Done

The project is complete only when:

- A new user can register.
- The user can log in.
- The user can upload a supported audio file.
- The browser uploads audio directly to R2.
- The API never receives the complete audio binary.
- Processing happens in ARQ worker(s).
- Gnani produces a transcript.
- The raw Gnani response is stored.
- Gemini produces a summary.
- The transcript and summary are persisted.
- Progress is visible.
- Failures are visible.
- Retries work.
- History works.
- Detail page works.
- Rename works.
- Delete works.
- Copy works.
- Fuzzy transcript search works.
- Ownership isolation works.
- Health endpoints work.
- Migrations work.
- CI passes.
- The application is deployed.
- `/architecture` exists.
- GitHub repository is linked from `/architecture`.
- A fresh evaluator can use the public URL without local setup.
