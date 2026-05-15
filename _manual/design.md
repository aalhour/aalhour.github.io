# Design Manual

This file records site design decisions that should stay stable across future theme work.

## Browser Icons

The site uses raster artwork for its favicon and app icons. Do not auto-convert the current painted icon into SVG; it would either be oversized, visually degraded, or a fake vector wrapper around raster data.

Use this icon stack:

- Declare PNG browser favicons in the document head:
  - `32x32` for normal browser tab contexts.
  - `96x96` for higher-density browser UI and bookmark contexts.
- Declare a `180x180` PNG with `rel="apple-touch-icon"` for iOS and iPadOS home screen usage.
- Declare `/site.webmanifest` from the document head.
- Put `192x192` and `512x512` PNG icons in `site.webmanifest` for Android, install, launcher, and splash contexts.
- Keep `/favicon.ico` at the site root as an unlinked fallback for legacy browsers, crawlers, email clients, and other clients that probe that path directly.

Do not link `/favicon.ico` from the document head unless a real compatibility issue proves it is needed. Modern browsers should choose the declared PNG icons first.

Only add an SVG favicon later if the site gets a deliberately designed vector mark, such as a simple `~/aalhour` glyph or another small symbolic logo. If that happens, make the SVG the primary `rel="icon"` with `sizes="any"`, keep the PNG fallbacks, and keep `/favicon.ico` at root.
