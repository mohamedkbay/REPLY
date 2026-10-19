# Contributing to Reply

## Start with the product boundary

Read [the product guide](docs/PRODUCT.md), [architecture](docs/ARCHITECTURE.md) and [design philosophy](docs/DESIGN-PHILOSOPHY.md). Choose the runtime you are changing. A fix in the single-shop Worker does not automatically establish SaaS isolation or lifecycle behavior.

## Git workflow

Create a focused branch from `main`, for example `feat/product-search`, `fix/rtl-fields` or `docs/mail-setup`. Keep commits reviewable and use direct Conventional Commit subjects:

```text
feat: add a merchant-facing capability
fix: correct a reproducible behavior
style: refine presentation without changing behavior
refactor: change structure while preserving behavior
test: verify an important contract
ci: improve repository verification
docs: explain the current implementation
```

A pull request should state the concrete problem, resulting behavior and relevant verification. Include desktop/phone captures for visual work and Arabic/English evidence when direction or typography changes. Describe limitations honestly. Do not mix unrelated formatting, data migrations and visual replacements into one change without a clear reason.

## Validation

```bash
npm ci
npm run build:saas
npm test
npm run check
npm run test:runtime
```

Use meaningful tests for changed behavior: tenant isolation, quota concurrency, signature verification, image fallback and failure/deduplication are valuable contracts. Do not add tests that merely repeat CSS literals. Keep outbound platform requests mocked and temporary databases isolated.

## Interface conventions

Use shared templates/tokens and logical inline CSS properties. Preserve Cairo's local faces, Arabic RTL and English LTR. Theme new surfaces in both modes. Keep reduced-motion fallbacks, visible focus, actual labels and mobile touch targets. Translate interface copy in the locale layer; do not rewrite saved merchant replies or product data.

Use the existing R symbol at sign-in/header. Do not reintroduce a large second wordmark beside it. New motion should belong to the shared grammar and never conceal a working form behind an entrance.

## Storage and integrations

Add ordered migrations rather than editing an already-applied schema in place. Never test migrations against a real customer database. Preserve the per-workspace boundary and atomic reply reservations. Do not put credentials in fixtures or use customer data as test material.

Platform changes need provider-specific failure and duplicate handling. A successful credential save does not establish every publishing permission. Update [Integration behavior](docs/INTEGRATIONS.md) when supported behavior changes.

## Documentation and assets

All repository explanations are in English; Arabic examples may illustrate actual UI/reply content. Keep README links and screenshots current. Identity exports live in `assets/brand`; only runtime-needed files belong in `public`. Preserve font licenses and source attribution. Do not commit generated bundles, runtime databases, secret configuration, dependency folders or scratch work.
