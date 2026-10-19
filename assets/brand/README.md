# Reply identity library

This directory contains editable identity exports. The application serves only its required subset from `public/brand` and the local font subset from `public/fonts/cairo`.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="logos/svg/reply-horizontal-white.svg">
  <img src="logos/svg/reply-horizontal-ink.svg" width="280" alt="Reply horizontal identity">
</picture>

## Asset map

| Directory | Contents | Use |
| --- | --- | --- |
| `logos/svg` | Symbol, horizontal, stacked and wordmark variants in ink, white and cobalt | Editable master identity and scalable exports |
| `logos/png` | Raster logo exports | Tools that cannot import SVG |
| `patterns` | Filled/outlined identity pattern families | Bounded entrance or brand compositions |
| `icons/svg` | Individual interface icons | Consistent UI marks |
| `icons/reply-sprite.svg` | Combined symbol sprite | Reusable icon source |
| `app-icons` | SVG/PNG/ICO application icons | Favicons and app contexts |
| `social/svg` | Square, story and open-graph layouts | Editable social formats |
| `fonts` | Cairo WOFF2/TTF weights 400/500/600/700 and OFL | Local interface typography |
| `motion` | Wordmark/pattern SVG motion and entrance recording | Identity choreography reference |
| `tokens` | Identity-baseline JSON/CSS | Palette, type, spacing, radii and motion starting values |

## Current application usage

Use the **standalone R symbol** at sign-in and in shared navigation. Current boxes are 52×48px in the header and 60×56px at sign-in. The SVG already contains breathing room. Keep an accessible “Reply” name on functional identity images/links.

Use the full wordmark or lockups where the name needs introduction, such as this repository or a brand document. Avoid a full-size typed REPLY beside the symbol inside small application chrome. Do not repeat the logo across every functional panel. Preserve aspect ratio, clear space and the supplied geometry; do not stretch, outline or redraw it in a different font.

Ink belongs on light surfaces, white on dark surfaces and cobalt in selected brand contexts. The application inverts only the monochrome logo for dark mode, never product imagery. Patterns belong in bounded sign-in and menu feature areas; they must not reduce text contrast or obscure controls.

## Tokens and runtime truth

The asset-kit tokens record the original identity baseline. The current application's complete design system is `../../DESIGN.md` and `../../.impeccable/design.json`; dark tokens and preference controls are implemented in `../../public/reply-preferences.css`. Do not replace the live system with the smaller baseline file and lose the dark variant.

The current theme/language transition is the application's 880ms organic View Transition, implemented in `public/reply-preferences.js`. The SVG files here document other identity entrances; they are not the dark-mode switch implementation.

## Licensing and provenance

Preserve `fonts/OFL.txt` when redistributing Cairo. See [the project attribution record](../../NOTICE.md) for upstream software, the demonstration product photo and reference materials. The external inspiration video is not part of this asset library.
