# Product concept and merchant journeys

## A stockroom that can answer

Reply serves a merchant who has products, a phone and repeated price questions. Its central object is the **product code**. A code makes the conversation unambiguous without requiring the customer to search a catalog or the merchant to maintain a complex commerce backend.

The product promise is concrete: “Send the code and receive the saved name, price and optional image.” Availability belongs to the merchant. Reply does not infer stock from a photograph, invent a price, claim a payment method exists or create a completed order.

## The customer journey

1. A customer asks the price or sends a product photograph.
2. The configured guidance asks for a product code.
3. A known available code returns the current inventory answer, optionally with its photo.
4. A known paused code receives the configured unavailable apology; an unknown code receives the check-your-code response.
5. Order, delivery and human-help questions use the merchant's enabled business-response topics or matching automation.

The current engine handles explicit product codes and deterministic topic/keyword matching. It is not an AI agent, a visual search engine or an order-management system. The language selector translates the interface; it does not rewrite merchant data or saved customer-facing replies.

## The merchant journey

### Start

An anonymous visit opens sign-in. Account creation collects a name, Libyan WhatsApp number, age and email. The minimum accepted age is 18. Email OTP verifies email ownership; it does not verify the WhatsApp number. A successful first verification creates the customer workspace and starts the trial.

### Maintain stock

Add a code, name, price and currency. LYD is the default; the stored currency is used in replies. Add an optional photo and toggle availability. A pause keeps the product in inventory while changing its customer response. Search and list/gallery views use the same saved products.

Product images are optional JPG/PNG files. Browser preparation targets JPEG up to 1400px; the saved maximum is 1.5MB. The server checks type/signature/size. Updating the price alone does not remove the image. An explicit remove action changes the stored association.

### Configure replies

The shared resolver checks a saved product answer first, active channel-compatible keyword rules second, and configured business guidance afterward. FAQ topics include greetings, delivery, payment, location, opening hours, returns, ordering, human help, thanks and fallback. Turning off a topic prevents the generic fallback from answering it. Platform-specific legacy Instagram features have their own entry points and precedence; see [Integrations](INTEGRATIONS.md).

Defaults are suggestions, not claims about a merchant's actual shipping rates, address or opening hours. The merchant supplies those details. The local preview lets the merchant inspect text/image output without connecting a platform or sending a real message.

### Connect one account per platform

Connections live in Settings. Credentials are encrypted, and the SaaS workspace enforces one connected account per platform, including paused accounts. Disconnect the existing account before replacing it. A saved configuration is not proof that every required platform publishing permission was approved.

### Observe

Overview, Sent messages, Activity and reply statistics expose actual stored events and delivery status. Dry-run matches must remain distinct from delivered messages. Demonstration screenshots are labelled; a new customer workspace has no demonstration products or seeded social credentials.

## Trial and planned subscription

| Rule | Current implementation |
| --- | --- |
| Trial starts | First successful email verification |
| Duration | Exactly 24 hours |
| Products | Up to 20 during trial |
| Automated replies | 50 reserved attempts; failed attempts still consume a reservation |
| Preview | Conversation preview is not charged against reply attempts |
| Platform accounts | One of each supported platform |
| Proposed paid price | LYD 30/month |
| Paid entitlement | `paid_until` removes Reply product/reply caps while active |
| Payment collection | Deferred; no checkout or customer-facing activation endpoint |

Expiry or exhausted replies stops automation and sends dashboard access to the account/subscription screen. A paid entitlement is an internal state, not evidence of a working billing integration. Platform limits and infrastructure remain applicable even when Reply's own caps are removed.

## Product principles

- Inventory is the source of price truth.
- Common actions should fit a phone and use direct language.
- Unavailability is a useful answer; silence and guessing are not substitutes.
- Interface polish must preserve readable Arabic and working forms.
- Status should describe reality: test, disconnected, disabled, failed or delivered.

## Scope boundaries

No payment processing, order fulfillment, stock quantity accounting, customer CRM, WhatsApp ownership verification, LLM responses or image recognition is included. Future extensions should preserve the simple code-to-answer flow rather than bury it under configuration.
