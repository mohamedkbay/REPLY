# Security and sensitive data

## Reporting

Do not post credentials, OTPs, cookies, customer data or exploitable private details in a normal issue. Use GitHub's private vulnerability reporting if it is enabled for this repository. Otherwise contact the service operator through **Helpdsek**, WhatsApp [0910278797](https://wa.me/218910278797), to arrange a private report. No response-time commitment is implied by this document.

Include the affected revision, a minimal reproduction and the boundary that failed. Redact secrets and use synthetic data. Do not test against another merchant's workspace or a live platform account you do not control.

## What the implementation does

- Email OTPs use keyed hashes, five-minute expiry, attempt limits and persisted request throttles.
- Sessions use random tokens stored as keyed hashes, server-side expiry/revocation and HttpOnly cookies; public HTTPS uses Secure cookies.
- The server selects the workspace from the verified customer session and overwrites customer-supplied legacy admin cookies before forwarding.
- Form POSTs require the configured origin outside platform callback paths. Providers have their own signature/secret verification.
- Platform credentials are encrypted; product media intentionally has public-read semantics.
- Trial reply reservations are atomic and per-platform account limits also have database constraints.

These mechanisms are implementation details supported by tests, not a claim of a completed independent security audit.

## Files that must stay private

`.saas.env`, `.dev.vars`, `deploy/.env`, `.reply-data/`, `.wrangler/`, backup directories, session exports and real provider responses are not repository artifacts. Example files contain placeholders only. Keep auth and encryption secrets different and preserve the encryption key in a separate secure recovery process.

Do not log email codes, authorization headers or full provider responses containing private content. Use isolated test mail functions and mocked APIs rather than adding a production OTP bypass.

## Deployment boundaries

The current SQLite runtime is single-process and single-host. Do not share its writable volume across replicas. Enable proxy trust only behind the configured proxy that overwrites the client-IP header. Keep the internal application port private, maintain HTTPS, patch the host and verify encrypted off-server backups by restoring them into an isolated environment.

Signup is not ready for public enrollment merely because it renders. Real mail, permissions, backup/restore, monitoring, retention and final service policies remain launch requirements. See [the deployment guide](deploy/README.md) and [roadmap](docs/ROADMAP.md).
