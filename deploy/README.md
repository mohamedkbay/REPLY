# Reply SaaS · first server release

This is a separate multi-customer runtime. `npm run dev` / `wrangler deploy` still run the original single-shop Cloudflare prototype; they do **not** provide SaaS authentication or workspace isolation. Do not publish that prototype as the customer service.

## What works

- `/auth/signup` and `/auth/login`: verified email OTP through Resend. Signup collects name, Libyan WhatsApp number, age (18+ default), email. WhatsApp ownership is not verified. OTPs expire after five minutes, allow five attempts, and are stored as keyed hashes. Request throttling is stored in SQLite. Sessions use random, server-revocable, hashed tokens and HttpOnly cookies, Secure on public HTTPS.
- Each customer receives an independent SQLite database. IDs and product codes may overlap across workspaces without sharing inventory, automations, social credentials or logs. Existing migration examples are cleared only while provisioning a brand-new workspace. Old `.wrangler` demo data is preserved outside this runtime.
- Trial starts on email verification, lasts exactly 24 hours, allows 20 products and 50 automated reply attempts (including incoming test-mode matches, excluding the conversation-preview tool). Reservations are atomic and failed delivery attempts consume a slot. Expiry/quota stops automation and redirects the dashboard to account/subscription.
- One account of each supported platform, including paused accounts; disconnect before replacing. Enforced by friendly server validation plus partial unique database indexes. Platform access/permissions are still required. TikTok comments remain text-only and depend on approved TikTok Business API permissions.
- Paid access uses `paid_until` and removes Reply's product/reply cap, subject to platform rules and available infrastructure. **No checkout, automatic charging, subscription activation endpoint or eZone integration exists yet.** The UI says “coming soon.” No customer-facing route can set `paid_until`.

## Local run

Node.js 24 or newer is required. Build with `npm ci && npm run build:saas`. Generate two independent secrets, set `.saas.env` (gitignored, permissions600), and run `npm run start:saas`. The prepared local instance uses `http://127.0.0.1:8791`; its data directory is `.reply-data`. It starts empty.

Set `PUBLIC_ORIGIN`, `AUTH_SECRET` and `ACCOUNT_ENCRYPTION_KEY`. Add `RESEND_API_KEY` and `EMAIL_FROM` only after verifying the sending domain with Resend. There is no local OTP shortcut, email-code logger, fixed verification code or default customer password. Without mail configuration the button is disabled and POST fails safely. Tests inject a fake mail function in an isolated temporary directory; it is not available through environment variables or HTTP.

The prior local single-shop dashboard remains on port8787 and retains its old administrator password/data. It is not a SaaS customer account.

## Docker on a VPS

1. Copy `deploy/.env.example` to `deploy/.env`; replace both secret placeholders, domain, origin and sender. Keep the environment file outside version control. Back up the encryption key securely: losing it prevents decrypting connected accounts.
2. Point your domain to the VPS public IP, allow inbound80/443, and start `docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build` from the repository root. The CLI environment file supplies Compose's domain interpolation; the Reply service separately loads its application environment from `deploy/.env`. Caddy receives only `DOMAIN`, not application secrets. Caddy handles public HTTPS. Reply's port3000 is internal only. Trust-proxy mode is enabled only behind this Caddy, which overwrites `X-Real-IP`; do not expose Reply directly with this mode.
3. Keep `DRY_RUN=true` until each social integration has been verified. Add actual social accounts through settings; no seed token is copied into customer workspaces. Copy each workspace-specific `/w/<customer UUID>/channels/...` callback into the platform dashboard.

Compose configuration was validated locally. The Docker daemon was not running during implementation, so the actual container image/startup has **not** been tested here. The Node runtime was run and integration-tested directly. This is a first server release for a controlled pilot, not a claimed production rollout or load-tested capacity guarantee.

## Database/storage and scaling boundary

Current: a control SQLite database for verified accounts/sessions/trial state and one SQLite database per customer for inventory/images/settings/events. All SQLite files live on the VPS local disk in a persistent Docker volume, with WAL enabled. No network filesystem, no concurrent replicas of this service and no shared writable volume across multiple hosts. The app runs a single process; TikTok scheduling has a local overlap lock. Application quotas are checked at each request and reply reservation.

This retains the existing SQLite queries and avoids unsafe tenant-filter rewrites. It is suitable for a measured single-server pilot; database-per-customer does not establish unlimited concurrency. Before growing to multiple application servers, migrate the central records and product/event repositories to PostgreSQL, add an explicit durable job queue/outbox, and test tenant isolation again. PostgreSQL, Redis/Valkey and object storage are **not connected** by these files.

Images are currently stored in each customer's database, max1.5MB per JPG/PNG, with content-hashed public URLs for social platforms. They have public-read semantics, not private document storage. The control database maps those hashes to workspaces. For large image collections, move blobs to S3-compatible object storage; keep metadata, ownership and product references in the database. Plan storage alarms and event/media retention before open enrollment.

The process keeps up to32 idle workspace connections, retaining active connections until their requests finish. The runtime is deliberately a pilot. Load-test realistic active merchant counts and monitor SQLite/file descriptors/disk before advertising capacity or adding replicas. Sessions expire after seven days. Trial abuse prevention currently covers verified email plus per-IP/email throttles; it does not verify phone ownership, guarantee one trial per human, or include CAPTCHA.

## Back up and restore before launch

Take backups outside the VPS and encrypt them (for example with restic, configured separately). A VPS snapshot alone is insufficient. Proposed initial retention:7daily +4weekly; confirm requirements before enabling deletion. Keep a second recovery copy with a separate provider/failure domain.

For a consistent snapshot across all databases, briefly stop the Reply process, run `server/backup.mjs <new-output-directory>` against the data directory, then restart. The script uses SQLite's backup API (including WAL), runs integrity checks and writes SHA256 manifests. Do not copy just a live `.sqlite` file and omit its WAL. In Docker, use a one-off Reply container with the same data volume and a separately mounted backup-output directory while the service container is stopped; run the backup script there, then start the service again. Do not use `docker compose down -v`.

To restore: stop Reply, preserve the current volume as a recoverable snapshot, verify manifest hashes/integrity, restore `control.sqlite` plus all `workspaces/*.sqlite` together into a fresh data directory, restore the original secrets, set ownership for the `node` user, start and verify one customer login/inventory and one signed webhook. Restore to an isolated test environment before any live cutover; there is no destructive restore command in this package.

## Before public enrollment

Confirm domain/sending-domain delivery, HTTPS, real platform permissions and callback checks, encrypted external backups plus restore, monitoring/storage retention and a realistic load test. Publish the service owner's actual details, final privacy/terms and support process; the local privacy page is explicitly marked as preparation copy. Keep registration publicly closed until these deployment checks pass. eZone remains a later task and needs verified server-side payment callbacks, idempotency and amount/currency checks before subscription activation.

Support: **Helpdsek**, WhatsApp **0910278797** / https://wa.me/218910278797.
