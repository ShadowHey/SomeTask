---
name: testing
description: Test strategy and procedures. Use when writing or running tests.
---

# Testing

## When to Use

- Writing new tests
- Running tests before commits
- Verifying test coverage for a feature

## Test Strategy

This is a take-home — focus on meaningful tests, not volume.

### Backend (pytest)

Must test:
1. **Authentication** — register, login, logout, token validation
2. **Ownership isolation** — User A cannot access User B's recordings
3. **Upload session** — initiate, complete, abort lifecycle
4. **Processing state transitions** — valid and invalid transitions
5. **Gnani provider** — mocked success/failure responses, error classification
6. **Retry behavior** — transient errors retry, permanent errors don't
7. **Idempotency** — duplicate job execution doesn't create duplicate data
8. **Transcript search** — fuzzy matching returns relevant results
9. **Summary failure** — transcript preserved when summary fails

### Frontend (Jest/Vitest)

Must test:
1. Upload flow component
2. Processing state rendering
3. Failure state rendering
4. Detail page rendering

## Required Procedure

### Running Backend Tests

```bash
cd backend
pytest -v
```

### Running Frontend Tests

```bash
cd frontend
npm test
```

### Running Linting

```bash
# Backend
cd backend
ruff check .
ruff format --check .

# Frontend
cd frontend
npm run lint
npm run typecheck
```

## Important Constraints

- Use fixtures for database setup/teardown
- Mock external providers (Gnani, Gemini, R2) — don't call real APIs in unit tests
- Use factory functions for creating test data
- Test both success and failure paths
- Never fabricate test results — run the tests and report actual output
- Integration tests with real providers are separate and require credentials

## Verification Steps

1. `pytest` passes with 0 failures
2. Frontend tests pass
3. Linting passes
4. Type checking passes
5. No tests depend on external service availability
6. Tests actually verify behavior, not just existence
