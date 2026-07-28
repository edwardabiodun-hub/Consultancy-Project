# RunRate Ascent Logo — Integration Spec

## Context

This site currently ships under Eddie's personal name with the "Quiet Authority" visual system (see `DESIGN.md`: stone/forest-green/bronze palette, Georgia + Segoe UI, no company name, no logo/wordmark asset). Eddie has since decided on a **full replacement**: a registrable company identity replaces the personal-name branding, and the new visual system is free to diverge from Quiet Authority. This spec hands off one finished mark from that naming/branding exercise, "The Ascent," for integration into this codebase.

Two decisions upstream of this file are not yet closed and block a clean implementation:

1. **Company name.** The naming research in this engagement verified `RunRateAdvisory.com` as already registered (Jan 2026) and `RunRateGroup.com` as the domain that actually cleared. Eddie has been designing under "RunRate Advisory" in mockups since then without explicitly resolving this. **Before wiring the wordmark into the site, confirm with Eddie whether the entity is "RunRate Advisory" or "RunRate Group."** Every asset below uses "ADVISORY" as the subordinate line; if the answer is "Group," that's a one-line text swap in each SVG and in the `<Logo>` component described below, not a redesign.
2. **Quiet Authority tokens.** This mark's palette (steel blue / amber, see below) replaces the existing stone/forest/bronze tokens, it does not sit alongside them. Find wherever `DESIGN.md`'s tokens are implemented as CSS custom properties (likely a global stylesheet or theme file) and update the *values*, keeping the *variable names* stable so the rest of the site's components don't need to change, just what they resolve to.

## Design Rationale (for context, not re-litigation)

Two bars of unequal height plus a single diagonal, the simplest visual sentence for "trending up," reduced until it reads as a monogram rather than a chart. No axis lines, no gridlines, no more than two data points, so it never looks like a BI dashboard screenshot. Works standalone as an icon (favicon, app icon, social avatar) independent of the wordmark.

## Asset Manifest

All files already written to this repo, additive only, nothing existing was modified:

| File | Purpose |
|---|---|
| `app/icon.svg` | Next.js App Router auto-favicon. Self-adapting: includes an embedded `prefers-color-scheme` media query so the browser-tab icon flips between the light and dark bar color automatically. This is the file that actually sets the site's favicon; no further wiring needed for the favicon itself. |
| `public/brand/runrate-icon.svg` | Same icon mark as a standalone asset, for use anywhere else in the UI (header, footer, social share cards, app-icon exports at other sizes). |
| `public/brand/runrate-lockup-light.svg` | Full icon+wordmark lockup, dark-on-transparent, flattened text. **Reference export only** (see Typography note below), not the primary header implementation. |
| `public/brand/runrate-lockup-dark.svg` | Same lockup, light-on-transparent, for placement on dark surfaces. Reference export only. |
| `public/brand/runrate-mono-black.svg` | Single-color (pure black) lockup for 1-color print, stamps, embroidery digitizing reference. |
| `public/brand/runrate-mono-white.svg` | Single-color (pure white) lockup for reversed/dark-substrate print. |

## Design Tokens

```css
--brand-ink-light:    #23384A;  /* bars + wordmark, light backgrounds */
--brand-accent-light: #D98E2E;  /* diagonal accent only, light backgrounds */
--brand-ink-dark:     #E7E9E6;  /* bars + wordmark, dark backgrounds */
--brand-accent-dark:  #F0A84A;  /* diagonal accent only, dark backgrounds */
--brand-paper:        #EDEFEC; /* suggested new canvas tone if Quiet Authority's stone (#E6E3DA) is being replaced wholesale */
```

The accent color (`#D98E2E` / `#F0A84A`) is reserved for the single diagonal stroke only. It should never be used for the two bars, body text, or any UI chrome outside this mark, if it starts showing up as a general "brand color" elsewhere, that's a sign the system is drifting from the concept.

## Typography

The wordmark was designed against **Space Grotesk** (free, Google Fonts, geometric sans in the same family as the GT Walsheim / Founders Grotesk mood references used during concept development). It is not yet loaded anywhere in this codebase.

**Do not implement the header logo by dropping in `runrate-lockup-light.svg` as an `<img>`.** That file bakes the wordmark as flattened SVG `<text>` with a system-font fallback, useful for a quick visual reference or an OG-image export, but wrong for production: it's not selectable, not accessible, and won't match once Space Grotesk is actually loaded. The correct implementation:

1. Load Space Grotesk via `next/font/google` (weights 500 and 700 cover "ADVISORY" and "RUNRATE" respectively).
2. Build a `<Logo>` component: the icon (`public/brand/runrate-icon.svg`, inlined as a React component or via `next/image`) sits next to real HTML text, "RUNRATE" in the 700 weight and "ADVISORY" beneath it in the 500 weight with wide tracking, colored via the tokens above and switching on the same light/dark mechanism the rest of the site already uses.
3. Reserve the flattened SVG lockup files for contexts that require a single flat image: the OG/social share image, a PDF export, an email signature, not the live header.

## Verification

- Favicon: confirm the browser tab icon renders correctly in both a light-theme and dark-theme browser window, that's what the embedded media query in `app/icon.svg` is for; don't skip checking dark mode specifically.
- Header lockup: confirm real text (selectable, present in page source) rather than an embedded image.
- Contrast: check the amber accent (`#D98E2E` light / `#F0A84A` dark) against its background meets WCAG 2.2 AA if it's ever used for anything beyond a small decorative stroke, at the size it renders in the mark it's decorative and exempt, but don't reuse it for text or interactive elements without checking.
