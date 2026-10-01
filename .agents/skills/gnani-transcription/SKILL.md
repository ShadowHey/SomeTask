---
name: gnani-transcription
description: Gnani Batch STT integration procedures. Use when implementing or modifying the transcription pipeline.
---

# Gnani Batch STT Integration

## When to Use

- Implementing the GnaniTranscriptionProvider
- Modifying the transcription pipeline
- Debugging Gnani API issues
- Adding language support

## Required Procedure

### 1. Read the Reference First

Read `docs/external/gnani/gnani_stt_offline_reference.md` before making changes.

### 2. Batch Flow (Mandatory)

```
Create Job → Start Job → Poll → Get Files → Download Transcript
```

- POST /stt/v3/batch/jobs (create)
- POST /stt/v3/batch/jobs/{job_id}/start (start — creating does NOT start processing)
- GET /stt/v3/batch/jobs/{job_id} (poll status)
- GET /stt/v3/batch/jobs/{job_id}/files (get file list with transcript_url)
- GET transcript_url (download transcript JSON)

### 3. Authentication

Header: `X-API-Key-ID: <api-key>`

### 4. Cloud Storage Source

Use this source format to pass a presigned R2 URL:

```json
{
  "source": {
    "type": "cloud_storage",
    "auth": { "mode": "public" },
    "paths": ["https://presigned-r2-url..."]
  }
}
```

S3 presigned URLs are explicitly supported. R2 presigned URLs are S3-compatible.

### 5. Configuration

```json
{
  "config": {
    "model": "gnani-prisma-v2.5",
    "language_code": "en-IN",
    "mode": "transcribe",
    "with_diarization": false,
    "is_multi_channel": false,
    "with_denoise": false
  }
}
```

**ITN is NOT supported for Batch.** Do not use `format=transcribe` features.

## Important Constraints

### Polling
- Minimum interval: 10 seconds
- Prefer ~30 seconds
- More frequent polling risks rate limits

### Duration Limits
- Maximum per file: 4 hours
- Files >4 hours → FFmpeg chunking required
- Minimum: 0.1 seconds

### Cloud Storage Limits
- No byte-size cap
- 30-minute download time limit per file

### Supported Batch Languages
```
bn-IN  Bengali
en-IN  English
hi-IN  Hindi
kn-IN  Kannada
ml-IN  Malayalam
mr-IN  Marathi
ta-IN  Tamil
te-IN  Telugu
```

**gu-IN (Gujarati) and pa-IN (Punjabi) are NOT supported on Batch.**

### Language Identification
- Up to 3 comma-separated codes per file
- Resolution is per-file, NOT per-segment
- This is NOT arbitrary code-switching

### Transcript URL
- Expires in 1 hour
- Download immediately upon completion
- Store the JSON, not the temporary URL

### Terminal Statuses
```
COMPLETED, PARTIAL_FAILURE, FAILED, START_FAILED, CANCELLED
```

## Failure Modes

| Failure | Retryable | Action |
|---|---|---|
| HTTP 429 rate limit | Yes | Backoff and retry |
| HTTP 500/503 | Yes | Retry with backoff |
| AUDIO_TOO_LONG | No | Permanent — chunk or reject |
| Invalid credentials | No | Permanent — check config |
| Unreachable URL | Maybe | Check presigned URL expiry |
| START_FAILED | Maybe | Retry job creation |
| PARTIAL_FAILURE | Partial | Check per-file results |

## Verification Steps

1. Provider creates job and receives job_id
2. Provider calls /start and status transitions from CREATED
3. Polling respects ≥10s interval
4. Terminal status is correctly detected
5. Transcript is downloaded within 1-hour window
6. Raw JSON response is preserved in database
7. Segments are normalized to: sequence, start_ms, end_ms, text
8. Error classification distinguishes transient vs permanent
