---
name: background-jobs
description: ARQ worker patterns, retry policy, and idempotency. Use when implementing or modifying background jobs.
---

# Background Jobs (ARQ)

## When to Use

- Implementing new worker jobs
- Modifying retry behavior
- Debugging job failures
- Adding processing pipeline steps

## Required Procedure

### 1. Job Structure

```python
async def process_transcription(ctx: dict, audio_file_id: str) -> None:
    """Idempotent transcription job."""
    ...

async def generate_summary(ctx: dict, audio_file_id: str) -> None:
    """Idempotent summary generation job."""
    ...
```

### 2. Retry Policy

```
Attempt 1: immediate
Attempt 2: wait 1 minute
Attempt 3: wait 5 minutes
Attempt 4: wait 10 minutes (final)
→ Mark FAILED after 3 retries
```

### 3. Idempotency Requirements

Every job must be safe to run multiple times:
- Check if work is already done before starting
- Use upsert/replace for transcript segments (don't create duplicates)
- Use upsert/replace for summaries
- Check current status before transitioning

### 4. Status Updates

Jobs must update the audio_file status at each stage:
- QUEUED → TRANSCRIBING (when transcription starts)
- TRANSCRIBING → SUMMARIZING (when transcription completes)
- SUMMARIZING → COMPLETED (when summary completes)
- Any → FAILED (on permanent failure after retries exhausted)

### 5. Job Independence

- Summary failure must NOT delete the transcript
- Summary can be retried independently
- Transcription failure should not leave stale status

## Important Constraints

- Jobs run in a separate worker process
- Worker needs: DB connection, Redis connection, provider credentials
- Never enqueue the same job twice for the same recording simultaneously
- Use structured logging with recording_id, job_id, attempt count
- Do not retry permanent errors (validation, auth, unsupported format)

## Failure Modes

| Failure | Behavior |
|---|---|
| Provider timeout | Retry |
| Provider 500/503 | Retry |
| Provider 429 | Retry with backoff |
| Invalid audio format | Mark FAILED immediately |
| DB connection lost | Job fails, ARQ retries |
| Redis connection lost | Job cannot be enqueued |
| Worker crash mid-job | ARQ re-delivers; idempotency handles it |

## Verification Steps

1. Job runs successfully end-to-end
2. Duplicate execution does not create duplicate data
3. Retry delays match policy (1m, 5m, 10m)
4. Permanent errors are not retried
5. Status transitions are correct at each stage
6. Summary failure preserves transcript
7. Structured logs include recording_id, job_id, attempt
