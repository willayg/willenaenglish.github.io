# Login System Update Ideas

## Current State
- Easy Login flow: students use Korean name, English name, and 4-digit code to access scores and homework.
- Passwords are overwritten with a temporary random value during Easy Login.
- No rate-limiting, audit logging, or forced password change on first login.

## Security & Usability Improvements

### 1. Rate Limiting & Lockout
- Add per-user and per-IP rate limiting to Easy Login endpoints.
- Lock account after N failed attempts (e.g., 5) for a cooldown period.
- Add CAPTCHA after repeated failures.

### 2. Audit Logging
- Record every Easy Login attempt (success/fail) and every password change/reset.
- Suggested table: `auth_password_audit` (user_id, actor, source, ip, action, success, timestamp, note).

### 3. One-Time Session Tokens
- Replace password overwrite with server-issued short-lived session tokens for Easy Login.
- Authenticate sessions without changing the permanent password.

### 4. Forced Password Change
- If a temp password is set, require students to change it on first full login.
- Add `must_change_password` flag to profiles.

### 5. Password Strength Enforcement
- Reject weak passwords (e.g., equal to username or below entropy threshold).
- Patch bulk-upsert and teacher reset flows to prevent username-as-password.

### 6. Increase Code Entropy
- Move from 4-digit code to 6+ digits or alphanumeric codes for higher security.

### 7. Transport & Cookie Security
- Enforce HTTPS in production.
- Use Secure, HttpOnly, SameSite=None cookies for authentication.

### 8. Monitoring & Alerts
- Alert on excessive failed logins or bulk password changes.

## Next Steps
- Implement audit logging and rate-limiting first.
- Plan migration to session tokens for Easy Login.
- Review and patch all password-set flows for security.

---
Low volume now, but these updates will help scale securely as usage grows.
