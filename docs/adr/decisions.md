# Architecture Decision Records

## ADR-001: Modular Monolith
**Status:** Accepted  
**Context:** The assignment requires multiple responsibilities (auth, upload, transcription, summarization, search) but is a take-home assessment.  
**Decision:** Use a modular monolith with a separate background worker rather than microservices.  
**Consequences:** Simpler deployment, shared database, easier to understand. Service boundaries exist in code (modules) not infrastructure.

## ADR-002: Direct-to-R2 Upload
**Status:** Accepted  
**Context:** Application supports up to 5 GB audio files. Routing through FastAPI would require buffering/streaming large files through the API server.  
**Decision:** Browser uploads directly to Cloudflare R2 using presigned multipart upload URLs. FastAPI manages upload sessions and issues presigned URLs.  
**Consequences:** FastAPI never receives the audio binary. Requires multipart upload orchestration in the frontend. R2 bucket stays private.

## ADR-003: ARQ Worker
**Status:** Accepted  
**Context:** Transcription and summarization are long-running operations (minutes to hours). They must not block HTTP requests.  
**Decision:** Use ARQ with Redis for background job processing. Separate worker process.  
**Consequences:** Requires Redis. Worker must be deployed separately. Jobs must be idempotent and retryable.

## ADR-004: Provider Adapters
**Status:** Accepted  
**Context:** The application depends on Gnani for transcription and Gemini for summarization. These are external services that may change or need replacement.  
**Decision:** Create TranscriptionProvider and SummaryProvider protocols. Gnani and Gemini implementations are adapters behind these interfaces.  
**Consequences:** Provider-specific HTTP code is isolated. Rest of the application uses domain interfaces. Providers can be swapped or mocked for testing.

## ADR-005: PostgreSQL Fuzzy Search (pg_trgm)
**Status:** Accepted  
**Context:** Users need to search transcripts with fuzzy matching. Transcripts can be very long.  
**Decision:** Use PostgreSQL's pg_trgm extension with GIN index on transcript_segments.text for server-side fuzzy search.  
**Consequences:** No additional search infrastructure needed. Search happens server-side, not by shipping entire transcripts to the browser. Requires pg_trgm extension in PostgreSQL.

## ADR-006: No Default FFmpeg Chunking
**Status:** Accepted  
**Context:** Gnani Batch supports up to 4 hours per file. Application target is 300 minutes (5 hours).  
**Decision:** Only chunk files that exceed Gnani's 4-hour limit. Files ≤4h are sent directly as a single Batch job.  
**Consequences:** Simpler path for most files. Chunking complexity only exists where required. Must implement chunking fallback for the 4h-5h range.

## ADR-007: Gnani Batch over REST
**Status:** Accepted  
**Context:** Gnani REST API is limited to 60-second audio clips. Application targets up to 300 minutes.  
**Decision:** Use Gnani Batch STT as the primary transcription path for all audio files.  
**Consequences:** Asynchronous flow (create→start→poll→download). More complex than REST but required by the duration requirements.

## ADR-008: Gemini Flash-class Model
**Status:** Accepted  
**Context:** Summaries must be generated automatically from transcripts. Need a cost-effective, fast model.  
**Decision:** Use Gemini 3.8 Flash (or current stable Flash-class model). Model ID is configurable via environment variable.  
**Consequences:** Depends on Google AI API. Large context window (1M tokens) handles long transcripts. Model can be updated via configuration.
