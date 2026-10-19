# Architecture

## Two runtimes, one shared domain

The repository has two execution paths. They must not be confused when operating the service.

| Runtime | Entry | Persistence | Authentication | Intended role |
| --- | --- | --- | --- | --- |
| Customer service | `server/start.mjs` → `server/app.mjs` | Control SQLite + one SQLite workspace per customer | Verified email OTP + server-revocable sessions | Controlled multi-customer pilot |
| Cloudflare Worker | `src/index.ts` | A D1 binding | Single-shop admin token | Inherited standalone prototype |

`server/build.mjs` bundles `src/saas-entry.ts` to `dist/saas.mjs`. The bundle exposes the Worker handler and shared HTML helpers. The Node service injects a customer-scoped environment and a D1-compatible adapter instead of maintaining a second copy of business logic.

## HTTP and tenant selection

`server/start.mjs` turns Node requests into Fetch API `Request` objects and translates `Response` objects back to HTTP. The configured public origin is authoritative. Public deployments require HTTPS. Form POSTs outside the workspace webhook namespace require the exact configured origin and reject cross-site requests.

The session token is looked up in the control database. The server then opens the UUID-named workspace for that customer. It replaces any customer-supplied legacy admin cookie with a short-lived, server-generated internal credential before invoking the shared Worker. A forged legacy cookie cannot choose another customer's workspace.

| Route | Purpose |
| --- | --- |
| `/` | Anonymous → sign-in; signed-in customer → protected workspace flow |
| `/auth/login`, `/auth/signup` | Sign-in and account creation |
| `/auth/verify` | Email code verification; short-lived HttpOnly challenge cookie preserves language navigation |
| `/auth/privacy` | Preparation privacy information |
| `/admin/*` | Customer-scoped dashboard, inventory, settings, activity and reports |
| `/admin/subscription` | Trial/entitlement status; payment marked coming soon |
| `/admin/language` | Same-origin validated locale return path |
| `/w/<customer UUID>/channels/...` | Workspace-specific platform callbacks |
| `/w/<customer UUID>/webhook` | Workspace-specific legacy Instagram webhook |
| `/media/products/<sha256>` | Public-read product image used by social platforms |
| `/healthz` | Control database health response |

## Control database

`server/auth.mjs` initializes these control-plane records:

| Table | Responsibility |
| --- | --- |
| `customers` | Verified profile, trial end, paid-until time and reply usage |
| `challenges` | Short-lived keyed OTP hashes, pending profile and attempt count |
| `sessions` | Keyed hashes of random session tokens and expiry |
| `rate_limits` | Persisted request/verification throttle windows |
| `media_routes` | Public image hash → customer workspace mapping |

OTP codes expire after five minutes and allow five attempts. Challenge consumption, customer creation and session creation commit together. Sign-in responses do not reveal whether an unknown email is registered. Sessions expire after seven days and can be revoked by logout.

## Workspace database

`server/database.mjs` uses Node's SQLite implementation with WAL, foreign keys, a busy timeout and full synchronization. `openWorkspace` applies numbered SQL migrations transactionally, records applied filenames, and removes inherited example rules only when provisioning a brand-new workspace.

A workspace holds inventory, product image blobs, automation rules/settings, connected accounts, encrypted tokens and event/delivery records. The migration files are the authoritative schema history. SaaS-specific triggers enforce the trial product cap, and partial unique indexes enforce one account per platform. Product codes and row IDs may overlap across workspaces safely because each workspace is a separate database file.

The process retains up to 32 idle workspace connections and does not evict a connection while it is serving a request. Active connections may temporarily exceed that number. There is no shared SQLite write volume across replicas and no implemented cross-host coordination.

## Reply pipeline

```text
signed callback / selected TikTok poll
        ↓
validate connection, event freshness and entitlement
        ↓
deduplicate event and resolve customer reply
        ↓
reserve an automated attempt atomically
        ↓
send with platform adapter, or record dry-run match
        ↓
persist result for Activity / Sent / statistics
```

The shared resolver lives in `src/smart-replies.ts`; product parsing/storage is in `src/products.ts`. Platform-specific handling lives in `src/channels.ts`, legacy Instagram handlers and `src/tiktok.ts`. Product matching does not call an external model.

A reply reservation is an atomic update of the customer's control record. This prevents concurrent requests from independently spending the last available trial slot. Delivery failure still consumes the reservation. Expired or exhausted tenants are stopped even if platform callbacks continue arriving.

## Media

Uploaded product images are validated and stored as blobs in the workspace. Content hashes produce stable public URLs; the control database routes each hash to its workspace. Old images remain readable so previous messages do not break. This requires a retention/storage policy before open enrollment.

Product media has **public-read semantics**. The URL is not a private document store. WhatsApp/Telegram can receive captions with an image; Instagram/Messenger use image then text, with a text fallback if image loading fails. TikTok comments remain text-only.

## Scheduled work

The Worker declares a minute TikTok cron and a daily Instagram token check. The Node pilot runs a minute interval, prevents overlapping scheduler rounds inside that process and polls eligible live customers. Its current scheduler calls the minute Worker path; it does **not** implement the daily Worker token-renewal schedule. Keep this distinction visible when operating Node deployments and add/test renewal scheduling before relying on unattended token lifecycle management.

There is no durable external queue or outbox in this pilot. TikTok responses with uncertain publication outcomes are not blindly retried. A multi-server implementation needs durable coordination, retry policy and idempotency boundaries.

## Source map

| Location | Responsibility |
| --- | --- |
| `server/` | HTTP host, auth, tenant adapter, database initialization, pages, backup |
| `src/index.ts` | Shared Worker routing and scheduled entry |
| `src/products.ts`, `product-images.ts`, `products-page.ts` | Catalog behavior, media validation and inventory UI |
| `src/smart-replies.ts`, `bot-preview.ts` | Deterministic business replies and local preview |
| `src/accounts.ts`, `channels.ts`, `tiktok.ts` | Connections and channel delivery |
| `src/dashboard.ts`, `theme.ts`, `settings-page.ts`, `sent-dms.ts` | Server-rendered administration surfaces |
| `src/i18n.ts`, `src/locales/` | Interface localization |
| `public/` | Runtime identity, fonts, styling and browser motion/preferences |
| `migrations/` | Ordered workspace/D1 schema history |
| `tests/` | Domain, integration and workerd verification |
| `deploy/` | Docker/Caddy composition and operational instructions |
| `assets/brand/` | Editable identity source library; not automatically served |

## Growth path

Keep the current service on one measured server while validating real merchant traffic. Before horizontal scaling, move central records and domain repositories to PostgreSQL, move large blobs to object storage and introduce a durable queue/outbox. Preserve isolation tests during that migration. These are future architectural changes; none of those services are already connected.
