---
name: code-review
description: Code review checklist. Use before commits and before declaring phases complete.
---

# Code Review

## When to Use

- Before committing a phase
- Before declaring a feature complete
- When reviewing a major change

## Checklist

### Structure
- [ ] No giant files (>400 lines usually warrants splitting)
- [ ] No giant functions (>50 lines usually warrants splitting)
- [ ] Clear module boundaries
- [ ] No circular imports

### Logic
- [ ] No duplicated logic
- [ ] No swallowed exceptions
- [ ] No missing error handling
- [ ] Status transitions are valid
- [ ] Ownership checks present on all recording operations
- [ ] Idempotency maintained in worker jobs

### Security
- [ ] No secrets in code
- [ ] No unsafe SQL (use parameterized queries)
- [ ] Input validation present
- [ ] Authorization checks present

### Quality
- [ ] Good naming (variables, functions, files)
- [ ] No dead code
- [ ] No debugging artifacts (print statements, TODO hacks)
- [ ] No misleading comments
- [ ] Useful docstrings on public functions
- [ ] Type hints on function signatures

### Dependencies
- [ ] No unnecessary new dependencies
- [ ] Existing dependencies used where applicable
- [ ] Standard library preferred over third-party for simple tasks

### Tests
- [ ] Relevant tests pass
- [ ] New functionality has test coverage
- [ ] Both success and failure paths tested

## Verification Steps

1. Run linter (ruff for backend, eslint for frontend)
2. Run type checker (mypy for backend, tsc for frontend)
3. Run tests
4. Review git diff for unintended changes
5. Check for committed secrets
