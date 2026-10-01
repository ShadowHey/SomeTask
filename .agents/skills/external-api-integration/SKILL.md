---
name: external-api-integration
description: Patterns for integrating external APIs (Gnani, Gemini, R2). Use when adding or modifying provider adapters.
---

# External API Integration

## When to Use

- Adding a new external provider
- Modifying provider adapter code
- Debugging provider communication issues

## Required Procedure

### 1. Provider Adapter Pattern

Every external service must be behind a provider interface:

```python
class TranscriptionProvider(Protocol):
    async def transcribe(self, audio_url: str, options: TranscriptionOptions) -> TranscriptionResult: ...

class SummaryProvider(Protocol):
    async def summarize(self, transcript: str) -> SummaryResult: ...

class StorageProvider(Protocol):
    async def create_multipart_upload(self, key: str, ...) -> str: ...
    async def generate_presigned_url(self, key: str, expires_in: int) -> str: ...
```

### 2. Provider Responsibilities

The provider adapter owns:
- HTTP client lifecycle
- Authentication header construction
- Request building
- Response parsing
- Error classification (transient vs permanent)
- Timeout configuration
- Raw response preservation
- Retry classification (NOT retry execution — that's the worker's job)

### 3. Error Classification

```python
class ProviderError(Exception):
    retryable: bool
    error_code: str
    provider_response: dict | None
```

Transient (retryable): timeout, 429, 500, 503, network error
Permanent (not retryable): 400 validation, 403 auth, unsupported format

## Important Constraints

- Never expose provider credentials in API responses or logs
- Never call provider APIs directly from route handlers — use service layer
- Always preserve the raw provider response for debugging
- Use httpx with explicit timeouts for all HTTP calls
- Configuration (API keys, model IDs, endpoints) from environment variables only

## Failure Modes

- Network timeout → retryable
- Provider rate limit (429) → retryable with backoff
- Invalid credentials → permanent, check env vars
- Malformed response → log raw response, classify as transient
- Provider outage → retryable

## Verification Steps

1. Provider adapter is behind a Protocol/ABC
2. No provider-specific code outside the adapter
3. Error classification covers all documented error codes
4. Raw responses are preserved
5. Timeouts are explicitly configured
6. No credentials in logs or responses
