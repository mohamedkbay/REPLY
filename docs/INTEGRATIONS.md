# Integrations and reply behavior

## Configure, verify, then enable

Reply contains working adapters and local tests. It does not contain a universal social-platform login, automatic provider approval or a workaround for unavailable permissions. Connection settings accept official credentials and account identifiers. A merchant must have the required account type, application access and permissions for the platform they use.

Keep `DRY_RUN=true` during setup. Test-mode matches are not delivered messages. Public platform callbacks and product photos need a publicly reachable HTTPS origin; a localhost URL cannot receive a provider webhook or supply an image to a provider's server.

## Capability matrix

| Platform/path | Incoming behavior | Outgoing behavior | Photo behavior |
| --- | --- | --- | --- |
| Instagram connected channel | Text/image DMs through signed Meta callbacks | Saved product/rule/business reply | Image then text; text fallback if image delivery fails |
| Facebook Messenger | Text/image messages through signed Meta callbacks | Saved product/rule/business reply | Image then text; text fallback |
| WhatsApp | Cloud API message callbacks | Saved product/rule/business reply | Image with caption when available |
| Telegram | Bot callbacks with configured secret header | Saved product/rule/business reply | Photo with caption when available |
| TikTok | Poll selected owned videos for eligible public comments | Public text answer | Text only; no product photo in comments |
| Legacy Instagram `/webhook` | Comments, DMs, starters, stories and referral events | Existing automation/private/public reply features | Legacy feature behavior; use connected-channel catalog workflow for the documented product-image path |

Account/API policy limits continue to apply. Reply is not a way to send arbitrary unsolicited messages outside provider rules. UI language selection does not translate saved outbound replies.

## Product image behavior

The catalog handles the customer's code. For an available product with an image, the result includes its name and price plus the public product image URL. WhatsApp and Telegram use captions; Instagram and Messenger issue an image message followed by text. If the image is rejected or cannot be loaded, the text answer remains the fallback and the warning is recorded.

A paused product or an unknown code does not send an image. An incoming photograph triggers code guidance, not visual recognition. The local preview can show a catalog image without any social account connection.

Upload limits and public-media storage are explained in [Architecture](ARCHITECTURE.md). Do not upload private documents as product photos.

## Workspace callback URLs

For the SaaS runtime, use the exact workspace-specific URLs displayed in Settings:

```text
https://your-domain/w/<customer UUID>/channels/instagram
https://your-domain/w/<customer UUID>/channels/facebook
https://your-domain/w/<customer UUID>/channels/whatsapp
https://your-domain/w/<customer UUID>/channels/telegram/<connection UUID>
https://your-domain/w/<customer UUID>/webhook
```

Meta paths verify HMAC signatures. Telegram verifies its secret-token header. Events are deduplicated and stale events are rejected according to the implemented channel rules. Do not register both the old and connected-channel route for the same event stream unless you have deliberately separated subscriptions; otherwise you risk duplicate business responses.

The Instagram/Facebook connection action can subscribe the account to the app once the required callback is configured. WhatsApp configuration still requires the appropriate Meta-side setup. Saving credentials is not a promise that all platform-side configuration has been completed.

## TikTok: an intentionally bounded first version

The code uses the official TikTok API for Business Accounts API workflow. It requires an approved application, the account owner's authorization, `open_id`, an access token and permissions to read/reply to owned-video comments. No browser password, session-cookie scraping or unofficial login is used.

The merchant supplies one to five owned video links. Connection validation checks account/comment reading for each selected video; that does not establish publishing permission. The connection and automatic replying start paused. Enabling starts from new comments; replacing the selected video list currently means reconnecting.

Each polling round examines the latest 30 returned public comments per selected video, rotates video priority and allows at most ten replies in that round. It skips ineligible cases such as old comments, owner comments, nested/hidden comments, previously processed events and comments already answered by the owner when represented in returned data. High-volume accounts may receive more comments than the poll window covers; this is not an all-comments guarantee.

The shared public resolver answers known product codes with name/price or unavailability and asks for the code on a price question. Keyword rules use their **public** reply text so a private DM response is not accidentally published. Reply caps public text at 150 characters. Product photos are not sent as TikTok comment replies.

Event keys protect against duplicate publication across overlapping work. An uncertain post outcome is recorded rather than retried blindly. In the Worker, cron invokes the minute path; in Node, the process interval invokes that path for active live tenants. Wrangler local development does not execute cron automatically; use the available local check action. Live TikTok delivery was not tested without the owner's real approved credentials.

## Inherited advanced Instagram tools

The original Worker path includes keyword automations by channel, optional public comment replies, conversation starters, story rules, referral links, follower checks, send history, retry controls and encrypted token storage. These remain separate from the simpler connected-channel product workflow. The [archived guide](LEGACY-CLOUDFLARE.md) records the original setup and matching rules.

Daily token renewal is declared in the Worker schedule. The Node pilot's current interval invokes only the minute TikTok schedule, so unattended daily token renewal must not be assumed for Node deployments. Add and test the required lifecycle work before live operations depend on it.

## Verification scope

Automated tests mock provider requests and exercise signature handling, matching, isolation, deduplication, image fallback and failure behavior. They cannot grant platform access or establish live deliverability. Before enabling a real account, verify its callbacks, fresh inbound event, expected answer, photo reachability, failure status and duplicate prevention against the actual provider.
