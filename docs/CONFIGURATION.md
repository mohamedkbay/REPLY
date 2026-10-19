# Configuration and local development

## Select the runtime first

| Command | Runs or checks |
| --- | --- |
| `npm run build:saas` | Bundles shared TypeScript core into `dist/saas.mjs` |
| `npm run start:saas` | Node customer service, reading `.saas.env` |
| `npm run dev` | Single-shop Wrangler development server |
| `npm run deploy` | Publishes the single-shop Worker, not the SaaS service |
| `npm test` | Node test suite, including isolated SaaS integration tests |
| `npm run test:saas` | Only the customer service integration tests |
| `npm run test:runtime` | workerd compatibility checks with mocked network |
| `npm run check` | TypeScript and Wrangler deployment dry-run |

Node.js 24 or newer is required for the customer service and SQLite API. Install with `npm ci` from the committed lockfile. Build the SaaS bundle before starting it. After changing shared TypeScript source, rebuild and restart Node; after changing server modules, restart Node. Static assets are cached for one hour, so changed shared assets need their intended versioned URL or a development cache refresh.

## SaaS environment

`.saas.env.example` is a safe template. The README also provides a command that generates fresh local secrets without overwriting an existing configuration. The real `.saas.env` must remain private and outside Git.

| Variable | Purpose / default |
| --- | --- |
| `PUBLIC_ORIGIN` | Authoritative origin; `http://127.0.0.1:8791` for local development; public deployments require HTTPS |
| `AUTH_SECRET` | Independent random secret of at least 32 characters for keyed hashes and derived internal credentials |
| `ACCOUNT_ENCRYPTION_KEY` | Different independent random secret of at least 32 characters; required to decrypt saved social accounts |
| `RESEND_API_KEY` | Resend credential; blank means no email delivery |
| `EMAIL_FROM` | Sender verified with the mail provider; blank means no email delivery |
| `DRY_RUN` | Keep `true` for setup; live sending requires explicit `false` and valid connections |
| `HOST` | `127.0.0.1` locally; container sets `0.0.0.0` behind Caddy |
| `PORT` | `8791` locally; container uses internal `3000` |
| `REPLY_DATA_DIR` | `.reply-data` locally; container uses `/data` |
| `TRUST_PROXY` | `false` unless exactly `true`; Compose enables it only behind the configured proxy |

The service rejects short, identical or obvious example secrets. Losing the account-encryption secret prevents recovering stored platform credentials. Preserve secrets securely with the backup plan; do not paste them into issue reports or screenshots.

Mail setup requires a verified sending domain. There is no environment switch for a fixed OTP, no email code in application logs and no default customer account. The automated tests inject a fake mail function programmatically in isolated tests only.

## Data and examples

The SaaS service creates its control database at startup and a new workspace after first email verification. Numbered workspace migrations apply automatically when a workspace opens. Existing workspaces are not cleared during ordinary startup.

`scripts/demo-data.sql`, `product-demo.sql` and `reply-demo.sql` are explicit single-shop development examples. Do not load them into a paying customer's workspace. The prepared screenshots show synthetic inventory and are not evidence of real messages or customers.

`.reply-data`, `.wrangler`, `.dev.vars`, `.saas.env`, deployment `.env`, generated bundles and dependencies are excluded from Git. The repository includes no real email keys, platform credentials, customer databases or fixed production admin password.

## Single-shop Worker

The inherited Cloudflare runtime uses `.dev.vars.example`, `wrangler.jsonc`, D1 migrations and `ADMIN_TOKEN`. Follow [the archived guide](LEGACY-CLOUDFLARE.md) if you explicitly want that runtime. It remains useful for isolated development, but does not provide multi-customer email login or tenant selection.

Apply migrations before running that dashboard. Add demonstration records only deliberately. Real deployment changes require replacing the D1 placeholder, providing official platform credentials and validating callbacks.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Start refuses configuration | Node version, two distinct random secrets, no example placeholders |
| Sign-in code button disabled | Both mail key and verified sender must be configured; restart Node afterward |
| Shared source changes do not appear | Run `npm run build:saas`, restart Node and verify asset version/cache |
| Anonymous `/` appears to skip sign-in | Check whether the browser already has a valid customer session |
| A photo previews but does not send | The provider needs a public HTTPS media URL and valid send permissions |
| No TikTok replies | Live mode, approved account permissions, selected owned videos, enabled state and fresh eligible comments |
| Trial redirects to subscription | 24 hours elapsed or 50 reply attempts exhausted |
| A second same-platform account is rejected | Disconnect the first account, including a paused connection |
| Arabic looks wrong | Confirm local Cairo files load, exact weight exists, document direction and shared appearance head |

Run the relevant tests after a code change and `npm run check` before shipping. Report a reproducible case with sanitized logs; never include cookies, OTPs, tokens or real customer content.
