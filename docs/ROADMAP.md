# Release status and roadmap

This is a capability ledger, not a set of promised delivery dates.

## Implemented and locally verified

- Product-code inventory answers, availability, currency selection and optional product photos.
- Editable business topics, keyword automations, preview, activity and send-history surfaces.
- Connected-channel adapters and a bounded selected-video TikTok comment workflow, tested with mocked providers.
- Arabic/English administration, local Cairo, responsive top navigation, light/dark themes and organic theme/language transitions.
- Standalone top symbol at sign-in/shared header; anonymous root opens sign-in.
- Node customer service with email-OTP implementation, isolated workspaces, trial quotas and one account per platform.
- Docker/Caddy configuration and integrity-checked backup tooling; Node direct runtime tests.
- Editable identity library, design tokens, English handbook and automated repository checks.

## Required before public enrollment

1. Configure the real domain, HTTPS and verified email sender; exercise delivery, expiry and throttling.
2. Obtain each platform's actual permissions and test workspace-specific callbacks with real accounts. Add/verify Node token lifecycle scheduling before relying on unattended renewal.
3. Run the Docker image on the intended host and load-test realistic merchant traffic. Monitor memory, file descriptors, storage and failed sends.
4. Configure encrypted off-server backups and complete an isolated restore drill. Decide event/media retention and account deletion procedures.
5. Publish the operator's actual service/privacy/terms details and support process; replace preparation copy.

## Deferred by product decision

**eZone payments:** intentionally postponed. The UI states that online payment is coming soon. A future implementation needs provider documentation, server-verified payment callbacks, amount/currency checks, idempotent entitlement updates and reconciliation. No current customer route can purchase or activate paid access.

**Open enrollment:** not assumed by the presence of signup pages. Mail, operations, real platform access and service policies need to be ready first.

## Growth work after a measured pilot

- PostgreSQL-backed repositories before multiple application servers.
- Durable queue/outbox, distributed job coordination and provider-aware retry handling.
- Object storage for large product-image collections, with ownership and retention metadata.
- Better abuse controls and verified phone ownership if the business requires them.
- Broader TikTok coverage only where official access and rate limits support it.

No PostgreSQL, Redis/Valkey, object storage, eZone checkout or visual product recognition is connected in this version. “No Reply cap” describes an active paid entitlement; it is not an infrastructure capacity guarantee.
