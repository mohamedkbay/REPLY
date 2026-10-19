---
name: Reply
description: Afternow-inspired Arabic workspace with layered navigation and expressive motion.
colors:
  ink: "#111111"
  text: "#242424"
  muted: "#60605c"
  paper: "#ffffff"
  surface-soft: "#f4f4f2"
  line: "#e2e2de"
  line-strong: "#b8b8b2"
  accent-hover: "#333333"
  coral: "#ef916f"
  lemon: "#f5f480"
  lavender: "#e2d8ec"
  cobalt: "#3e43e8"
  available: "#196744"
  available-soft: "#e9f4ec"
  warning: "#8a5a1f"
  warning-soft: "#f8efe1"
  danger: "#9a3a2c"
  danger-soft: "#f7e8e4"
  dark-bg: "#0d0c11"
  dark-surface: "#151419"
  dark-surface-soft: "#1d1c23"
  dark-ink: "#ffffff"
  dark-text: "#ffffff"
  dark-muted: "#ded9e6"
  dark-faint: "#ded9e6"
  dark-line: "#35323e"
  dark-line-strong: "#746d80"
  dark-accent: "#ece5f6"
  dark-accent-hover: "#d8caed"
  dark-accent-soft: "#292331"
  dark-mark: "#433451"
  dark-action-ink: "#17121e"
  dark-success: "#a3efc0"
  dark-success-soft: "#183427"
  dark-danger: "#ffc4ba"
  dark-danger-soft: "#352024"
  dark-warning: "#ffe0b6"
  dark-warning-soft: "#2b251e"
  dark-lavender: "#292233"
  dark-focus: "#bfa7ef"
  dark-placeholder: "#d5cfdf"
  dark-login: "#1d1726"
  dark-reply: "#30273d"
  dark-customer: "#464bcd"
typography:
  headline: {fontFamily: '"Cairo", Tahoma, Arial, sans-serif', fontSize: "clamp(46px,5.2vw,76px)", fontWeight: 500, lineHeight: 1.3, letterSpacing: "0"}
  title: {fontFamily: '"Cairo", Tahoma, Arial, sans-serif', fontSize: "28px", fontWeight: 500}
  body: {fontFamily: '"Cairo", Tahoma, Arial, sans-serif', fontSize: "15px", fontWeight: 400, lineHeight: 1.75}
  label: {fontFamily: '"Cairo", Tahoma, Arial, sans-serif', fontSize: "13px", fontWeight: 500}
rounded:
  field: "6px"
  conversation: "12px"
  panel: "14px"
  stage: "18px"
  pill: "999px"
spacing:
  compact: "8px"
  control: "12px"
  gap: "16px"
  phone-gutter: "20px"
  section: "24px"
  desktop-gutter: "32px"
components:
  button-primary: {backgroundColor: "{colors.ink}", textColor: "{colors.paper}", rounded: "{rounded.pill}", padding: "0 22px", height: "46px"}
  button-primary-hover: {backgroundColor: "{colors.accent-hover}"}
  button-secondary: {backgroundColor: "{colors.paper}", textColor: "{colors.ink}", rounded: "{rounded.pill}", padding: "0 22px", height: "46px"}
  input: {backgroundColor: "{colors.paper}", textColor: "{colors.text}", rounded: "{rounded.field}", padding: "10px 12px"}
  available-chip: {backgroundColor: "{colors.available-soft}", textColor: "{colors.available}", rounded: "5px", padding: "1px 8px"}
  navigation: {backgroundColor: "#f6f6f4", textColor: "{colors.ink}", rounded: "{rounded.panel}", padding: "6px 8px"}
  feature-tile: {backgroundColor: "{colors.cobalt}", textColor: "{colors.paper}", rounded: "{rounded.panel}", padding: "26px"}
  button-primary-dark: {backgroundColor: "{colors.dark-accent}", textColor: "{colors.dark-action-ink}", rounded: "{rounded.pill}", padding: "0 22px", height: "46px"}
  button-primary-dark-hover: {backgroundColor: "{colors.dark-accent-hover}"}
  input-dark: {backgroundColor: "{colors.dark-surface}", textColor: "{colors.dark-text}", rounded: "{rounded.field}", padding: "10px 12px"}
  theme-toggle: {backgroundColor: "{colors.paper}", textColor: "{colors.ink}", rounded: "{rounded.pill}", padding: "0", width: "44px", height: "44px"}
  theme-toggle-dark: {backgroundColor: "{colors.dark-surface}", textColor: "{colors.dark-ink}", rounded: "{rounded.pill}", padding: "0", width: "44px", height: "44px"}
---

# Design System: Reply

## Overview

**Creative North Star: "Afternow Studio"**

Reply combines an open white canvas, confident black type and expressive colored layers with a practical Arabic administration workspace. The user-pinned Afternow reference governs the layered navigation, varied image panels and movement; Cairo and RTL keep the interface native to its owner.

This is the adopted design across administration and login. The approved response R symbol appears alone at the top of sign-in and in the shared header, without an adjacent Reply wordmark; the footer and work sections stay free of repeated logos. Server HTML selects Studio and loads the shared stylesheet and deferred motion script; legacy browser palette choices do not override it. The code-led direction is recorded in `.impeccable/config.json`; seed `259df29c` is retained provenance, subordinate to the pinned reference.

**Key Characteristics:**
- Cairo, Arabic RTL and the standalone response R symbol.
- Compact navigation capsule, four-dot trigger and layered full-screen menu.
- Photo-led inventory, working reply workspace and a compact utility footer.
- Interruptible movement, reduced-motion support and honest operating status.
- Shared light/dark and Arabic/English controls with an organic preference wave.

## Colors

### Primary
Ink anchors actions and type; cobalt identifies the inventory feature and active full-screen navigation links.
### Secondary
Coral and lemon frame the live reply workspace; lavender supports navigation layers, feature panels, login and the menu layers. These broad fields are central to the adopted identity.
### Neutral
Paper holds the light canvas; soft surface groups controls and placeholders. Text, muted, line and strong line establish content hierarchy. Available green, warning and danger retain their existing operational meanings.

The approved dark variant uses dark-bg for the canvas, dark-surface for panels and dark-surface-soft for grouped controls. Dark-ink and dark-text are clear white; dark-muted and dark-faint remain pale for readable secondary writing. Dark-line and dark-line-strong distinguish dividers and fields. Dark-accent fills primary actions with dark-action-ink text; its hover and soft companions support interaction. Dark-success, dark-warning and dark-danger retain operational meaning with their paired surfaces. Dark-placeholder remains opaque, and dark-focus marks keyboard focus. Dark-login, dark-lavender, dark-mark, dark-reply and dark-customer adapt existing brand and conversation surfaces. The Reply logo becomes white while coral and the expressive feature fields retain their identity.

**The Clear Writing Rule.** Use white primary writing and the documented pale secondary writing on dark surfaces; preserve dark lettering on the light primary action and colored feature tiles.

## Typography

Locally served Cairo uses weights (400–700), with Tahoma, Arial and sans-serif fallbacks. All four faces are preloaded and use font-display:block; motion explicitly waits for the faces to load. Arabic is the default RTL interface; English uses the same font in LTR, selected at the top left of sign-in and persisted in a preference cookie. Headline and body tokens are normative; supporting introductions use (18px, 1.8) and a maximum measure of (58ch). Main headings become (44px, 1.4) on phones; support text becomes (16px). Arabic keeps natural spacing; the Latin wordmark alone uses tight tracking. Preserve bidi isolation for codes and URLs and tabular figures for stock values.

## Layout

The shared main shell has maximum width (1600px), padding (54px 32px 80px); the header reaches (1800px) with padding (16px 32px) and minimum height (82px). Below (1200px), header status disappears; below (1000px), the capsule disappears and the four-dot menu remains. At (700px), main padding becomes (30px 20px 48px), header height (70px), gallery and preview become single-column, and advanced starter rows stack their labels and selectors. Older field layouts retain (1050px) and (640px) adaptations.

Gallery uses three columns, two below (1000px), one below (700px). Product media remains contained; phone media height is (320px). List view preserves quick stock work. The full-screen menu scrolls internally; on phones, large links precede two compact feature tiles without the desktop offset. Footer links stack on phones without a large wordmark.

## Elevation & Depth

Layered lavender, coral and lemon sheets provide structural depth beneath the white menu. Offset cobalt and black tiles supply the signature asymmetry. Most administration sections remain flat and ruled; only the live workspace conversation lifts with shadow (recorded in the sidecar). Keyboard focus uses an ink outline (2px) offset (4px); fields darken their border without a glow. In dark mode the focus token colors the outline and focused field border, without changing the existing focus geometry.

## Shapes

Actions and view toggles are pills; fields have modest corners. Photo panels and feature tiles use the panel radius; menu sheets round their lower corners (18px). The lemon workspace frame encloses coral and a white conversation. The compact utility footer is a soft neutral ruled section, with no repeated wordmark.

## Components

- **Logo:** use the existing `/brand/reply-symbol-ink.svg` alone with accessible name Reply. The shared header sizes it at (52 × 48px); sign-in uses (60 × 56px), with contained proportions. Dark mode presents the symbol in white. The oversized background Reply artwork remains a separate sign-in treatment.
- **Buttons and fields:** black primary, outlined secondary, explicit danger states, labelled native controls and disabled opacity. Press scales buttons to (.96); arrow icons travel (4px). Preserve validation and keyboard focus.
- **Navigation:** capsule links indicate the current page; the four-dot trigger becomes a close mark. The full-screen menu locks background scrolling, makes main/footer inert, traps Tab, supports Escape and restores focus. Desktop feature tiles are vertically offset; touch devices suppress hover lift.
- **Menu motion:** native WAAPI captures the current rendered pose before cancelling animations, so rapid reversals remain continuous. Layers enter in (560ms), white sheet in (620ms), links in (450ms) with (35ms) stagger and tiles in (480ms). Closing sheet takes (280ms). Shared easing and remaining timings live in the sidecar.
- **Preferences:** the circular theme control is (44px) with a (20px) sun/moon icon, visible keyboard focus, an accessible pressed state and a localized status announcement. It sits beside the language control at sign-in and in the shared header. Theme persists in local storage and a cookie. Light remains the initial default.
- **Preference wave:** native View Transitions reveal the new theme or language from the selected control through a growing organic cubic Bézier contour over (880ms), with linear animation timing. A selection on the opposite side mirrors the contour. Theme changes interrupt the previous transition safely; cross-document animation opts in only for a language selection. Warm all four local Cairo faces before capture. Reduced motion and unsupported transitions apply the preference immediately. Locale navigation preserves scroll, an open menu and eligible ordinary form values for the matching return page; exclude password, file, hidden and secret/token/key/code fields. Do not extend this session handoff to sensitive data.
- **Continuity:** page titles reveal in (500ms); stock/provider/automation entrances run once in (480ms). The overview workspace scrolls from scale (.84) to (1). Gallery view changes use a local View Transition where supported; page arrivals use live text after Cairo loads, avoiding a raster snapshot of unloaded type. Reduced motion removes spatial animation and scroll scaling. Preference CSS loads after the Studio stylesheet through the shared appearance styles; the preference assets and shared motion script currently use version (4).
- **Inventory and status:** image/list views share actual saved products, codes, prices and availability switches. Use existing demo imagery or honest code placeholders. Status chips and DRY_RUN labels describe actual state.
- **Reply workspace, settings and login:** retain working forms, reply tests, provider disclosures and authentication; present them in the shared colored panels and shell. Login uses a white panel over lavender and an oversized background wordmark. Its letters assemble individually in (1150ms) with (75ms) stagger; filled and outlined four-dot motifs unfold and rotate into place within (3500ms). The form is available throughout, the artwork settles rather than looping, and reduced motion shows the finished composition immediately.

## Do's and Don'ts

### Do:
- **Do** apply this shared design to every page and preserve Cairo, RTL and clear phone layouts.
- **Do** retain the layered menu, expressive color fields and interruptible motion with a reduced-motion path.
- **Do** use actual inventory, saved replies and honest connection/DRY_RUN status.
- **Do** preserve the existing Cairo, Reply identity and light palette while applying the documented dark variant and accessible preference controls.
- **Do** use the same organic wave for theme and language, with immediate reduced-motion and unsupported-browser fallbacks.

### Don't:
- **Don't** restore palette preview gates or a monochrome table-only identity.
- **Don't** invent messages, connected accounts, results or testimonials.
- **Don't** introduce decorative raster assets; the shipped demo product photo already existed.
