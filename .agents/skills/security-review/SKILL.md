---
name: security-review
description: Security review checklist. Use before declaring the project complete.
---

# Security Review

## When to Use

- Before major releases
- After implementing authentication
- After implementing upload flow
- Before declaring the project complete

## Checklist

### Authentication
- [ ] Passwords hashed with Argon2
- [ ] No plaintext passwords stored
- [ ] HTTP-only secure cookies for auth tokens
- [ ] Token/session expiration configured
- [ ] Logout invalidates session

### Authorization
- [ ] Every recording query filters by user_id
- [ ] User A cannot access User B's audio by changing ID
- [ ] User A cannot access User B's transcript
- [ ] User A cannot access User B's summary
- [ ] User A cannot delete User B's recordings
- [ ] Authorization is server-side, not just frontend filtering

### Storage
- [ ] R2 bucket is private
- [ ] Object keys are generated (not user filenames)
- [ ] Presigned URLs have short expiry (15 minutes for upload, 1 hour for download)
- [ ] No permanent R2 credentials exposed to browser

### Upload Validation
- [ ] File type validated (extension + MIME)
- [ ] File size validated (≤ 5 GB)
- [ ] Safe object key generation (no path traversal)
- [ ] Content-Type restricted in presigned URLs

### Secrets
- [ ] No API keys in source code
- [ ] .env in .gitignore
- [ ] No secrets in git history
- [ ] Environment variables used for all credentials

### API
- [ ] Internal errors not exposed to users
- [ ] No stack traces in API responses
- [ ] No SQL errors in API responses
- [ ] No provider credentials in API responses
- [ ] Input validation on all endpoints
- [ ] CORS configured properly

### Logging
- [ ] No API keys in logs
- [ ] No passwords in logs
- [ ] No full audio content in logs
- [ ] User IDs logged for audit trail

## Verification Steps

1. Register as User A, create a recording
2. Register as User B
3. Try to GET /recordings/{user_a_recording_id} as User B → must be 404
4. Try to GET /recordings/{user_a_recording_id}/audio-url as User B → must be 404
5. Try to DELETE /recordings/{user_a_recording_id} as User B → must be 404
6. Check git log for any committed secrets
7. Check API error responses for internal details
