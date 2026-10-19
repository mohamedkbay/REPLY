# Design philosophy

## Expressive at the threshold, clear at the task

Reply is a working tool for a merchant, often on a phone. Its personality belongs in the entrance, navigation, product imagery and a few deliberate transitions. Inventory editing, availability and connection status must remain direct.

The visual direction was informed by the supplied [Afternow reference](https://afternow.co/): layered navigation, a confident scale, generous space and expressive movement. Reply adapts that direction to Arabic operations rather than copying a marketing page into an admin tool. The identity, product flow and code in this repository are its own implementation; no affiliation is implied.

## The response R

The symbol is a compact response-shaped R monogram with an open diagonal gesture. It should read as a single recognizable mark at small sizes. The full REPLY wordmark uses vector outlines, so its appearance does not depend on an installed Latin font.

**Current application placement:** standalone symbol at sign-in and in the shared header. The header image box is 52×48px; sign-in uses 60×56px. The SVG includes its own breathing room. The image retains the accessible name “Reply.” The symbol becomes white in dark mode; product photos are never inverted.

Use the full horizontal or stacked lockup in brand/editorial contexts where the name needs to be introduced. Do not put the full lockup on every section, add a second typed name beside it at the same size or scatter decorative logos through the interface. The large background wordmark is a bounded sign-in composition, separate from the top identity.

## Color is structure

| Identity color | Value | Role |
| --- | --- | --- |
| Ink | `#111111` | Primary light-mode writing and strong controls |
| Paper | `#ffffff` | Light surfaces |
| Lavender | `#e2d8ec` | Entrance atmosphere and menu layers |
| Cobalt | `#3e43e8` | Focused brand emphasis |
| Coral | `#ef916f` | Warm counterpoint in feature panels |
| Lemon | `#f5f480` | Workspace framing and selected expressive areas |

Most task surfaces are flat and ruled. Color separates meaningful areas rather than painting every control. Product availability, errors and dry-run state have semantic treatments; decorative colors must not obscure their meaning.

### Dark mode

| Token | Value | Role |
| --- | --- | --- |
| Background | `#0d0c11` | Page ground |
| Surface | `#151419` | Main panels, fields and navigation |
| Soft surface | `#1d1c23` | Nested functional regions |
| Primary ink/text | `#ffffff` | Headings and primary writing |
| Secondary ink | `#ded9e6` | Supporting labels and explanations |
| Border | `#35323e` | Quiet structural separation |
| Strong border | `#746d80` | Fields and defined controls |
| Action surface | `#ece5f6` | Light primary capsules with dark text |

Dark mode is a coordinated token set, not a filter over the whole application. The user's explicit requirement is clear white primary writing. Light action surfaces keep dark text for contrast. Form placeholders, select arrows, focus rings, the caret, selection and chat bubbles must be themed too.

## Cairo and readable Arabic

Cairo is self-hosted in weights 400, 500, 600 and 700. Both languages use the same family, avoiding an identity change when moving between Arabic and English. The shared head preloads local faces; text entrance and snapshot transitions wait for the required fonts.

Arabic is the default, with RTL document direction. English uses LTR. Layout should use logical inline properties and allow the server to render the correct locale. Saved product names, prices and customer-response text are data and keep their original wording. The language selector is an interface preference, not a translation service for merchant content.

Avoid wide tracking on Arabic, synthesized missing weights, remote-font dependency and Unicode glyphs used as a substitute for icons. The exported wordmark is outlined artwork; interface Arabic remains actual selectable text.

## Layout and hierarchy

The shared navigation lives at the top. Its full-screen menu provides deliberate section separation and a clear current location. A phone receives larger touch targets, stacked forms and a readable inventory rather than a compressed desktop table.

Inventory imagery has enough scale to identify the product. Editing uses familiar labelled fields. Settings groups account connections, business replies and preview into distinct destinations. A conversation preview should look like the actual product answer, including its optional photo, without pretending a live message was sent.

Forms have modest corners, panels use the identity's established radii and small actions may use capsules. Flat borders carry task structure; decorative halos and indiscriminate nested cards do not.

## Motion grammar

Motion has one job at a time: explain a change, retain orientation or introduce the identity. Controls are usable while artwork enters. Nothing important is hidden indefinitely behind an animation.

| Interaction | Current behavior |
| --- | --- |
| Shared menu | Layered WAAPI entrance; interruptible reversal from current rendered pose |
| Theme switch | 880ms organic cubic Bézier reveal from the selected control |
| Language switch | Same wave across the real server-rendered locale navigation |
| Page/stock entrances | Short, once-per-arrival choreography after fonts are ready |
| Sign-in artwork | Individual wordmark letters and bounded pattern movement, then rest |
| Reduced motion | Immediate preference changes and static finished artwork |

The preference wave expands from a small bean into a sweeping S-like contour. It is implemented with View Transitions and an animated path clip, not a circular wipe. Its direction mirrors when the control is on the opposite side of the viewport. Unsupported browsers receive the completed new state immediately.

Language switching opts into a cross-document transition only for that action. It preserves eligible ordinary form values, open-menu state and scroll for the matching return page. Passwords, files, hidden fields and code/token/secret/key fields are excluded. It does not turn ordinary navigation into a page-wide animation or introduce a second SPA state tree.

The preference control is 44×44px and exposes an accessible pressed state. Theme preference persists; Arabic remains the initial language default and light remains the initial theme default unless a saved preference exists.

## Accessibility and honest state

Text and controls stay legible in both themes. Keyboard focus must be visible, the menu traps focus while open and returns it on close, and Escape closes it. Main content is not interactive behind an open modal navigation layer. Images have useful alternatives; decorative patterns are hidden from assistive technology.

The checked mobile route set had no horizontal overflow or measured text-contrast failures in the local audit. That is evidence for those captured routes, not a certification of every future screen. New copy, data density and validation states still need checks.

Dry-run, disconnected, coming-soon, failed and delivered are different states. A beautiful interface must not collapse them into a successful-looking badge.

## Where the design lives

- `public/reply-studio.css`: shared visual and responsive composition.
- `public/reply-preferences.css`: controls, dark tokens and transition layers; loaded after Studio.
- `public/reply-motion.js`: menu and entrance choreography.
- `public/reply-preferences.js`: persisted preferences and theme/locale wave.
- `DESIGN.md` + `.impeccable/design.json`: recorded system and token references.
- `assets/brand/`: editable exports and identity baseline; the runtime subset lives in `public/brand/`.

Asset-kit baseline tokens do not replace runtime dark tokens. When extending the system, document the actual shipped values rather than inventing a separate palette for the documentation.
