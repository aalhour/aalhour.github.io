# aalhour.com Design Manual

This file documents the current shipped visual system for aalhour.com: palette,
typography, layout, page patterns, icon handling, and implementation structure.

## 1. Implementation Profile

- The site runs on Jekyll + Chirpy.
- `assets/css/jekyll-theme-chirpy.scss` is the only CSS entrypoint.
- `_sass/addon/` partials compile only when explicitly `@use`d from the CSS
  entrypoint.
- Styles are grouped by ownership: shell/layout, topbar, content, footer,
  reusable row lists, and page-specific partials.
- Shared Sass constants live in `_sass/addon/_tokens.scss`.
- Light/dark CSS custom properties live in `_sass/addon/_variables.scss`.
- Runtime fonts are self-hosted from `/assets/fonts/*.woff2`.
- Theme mode persists through `localStorage` via the bridge in
  `_includes/head.html`, immediately before Chirpy's `theme.min.js`.
- Post URLs use `permalink: /posts/:title/`.
- Giscus, OneDollarStats, and the Chirpy static assets submodule are part of the
  current site setup.

## 2. Design Intent

The shipped direction is "beach-paper technical notebook": warm paper, ink,
terracotta, teal, editorial density, and enough restraint for long technical
writing. It borrows the quiet academic rhythm of al-folio while keeping Chirpy's
post, archive, TOC, search, and build machinery.

Design qualities:

- technical, careful, and readable;
- warm rather than corporate;
- editorial rather than marketing-heavy;
- dense enough for scanning tables/lists;
- calm in dark mode, not neon;
- custom, but still maintainable as a Chirpy override layer.

Excluded directions:

- decorative blobs, gradient-orb backgrounds, or stock-landing-page composition;
- large hero cards around ordinary content;
- changing every page into a card grid;
- making "Programming" or any single category a catch-all navigation bucket;
- adding new abstractions unless a fourth repeated pattern appears.

## 3. Style Entry And Partial Ownership

CSS entrypoint:

```scss
assets/css/jekyll-theme-chirpy.scss
```

Current partial order:

```scss
@use 'main...';
@use 'addon/variables';
@use 'addon/fonts';
@use 'addon/typography';
@use 'addon/rouge';
@use 'addon/code';
@use 'addon/layout';
@use 'addon/topbar';
@use 'addon/shell';
@use 'addon/content';
@use 'addon/footer';
@use 'addon/row-list';
@use 'addon/home';
@use 'addon/writings';
@use 'addon/animations';
@use 'addon/about';
```

Ownership map:

- `_tokens.scss`: Sass constants only; no CSS output. Fonts, breakpoints, shell
  widths, topbar height, anchor offsets, list type scale.
- `_variables.scss`: CSS custom properties for light/dark modes. Mirrors
  Chirpy's selector structure so later cascade wins.
- `_fonts.scss`: self-hosted `@font-face` declarations.
- `_typography.scss`: global typeface application and content heading sizes.
- `_rouge.scss`: full Rouge syntax palette. Holds `$l-rouge-*` and `$d-rouge-*`
  SCSS variables (token literals) at top of file; mixins reference them — no
  raw hexes inside selector bodies.
- `_code.scss`: code-window chrome — `.code-header` background, bottom border,
  top corner radius, header label `font-weight: 500`; container box-shadow
  border; `.highlight` bottom corner radius. Rules live at root scope and
  consume CSS vars from both palette mixins of `_variables.scss` — mode
  switching falls out of the CSS-var cascade (no `@media` or `[data-mode]`
  gating). Also owns the block-code weight rule
  (`.highlight, .highlight pre, .highlight code, .highlight table pre {
  font-weight: 500 }`) and a defence-in-depth `.gh/.gu/.gs { font-weight: 600 }`
  reinforcement alongside the same rule in `_rouge.scss` mixins.
- `_layout.scss`: global structural flow around Chirpy's main wrapper.
- `_shell.scss`: reader-vs-panel widths and topbar alignment.
- `_topbar.scss`: fixed topbar, desktop nav, mobile drawer, mobile post TOC bar,
  heading anchor offsets.
- `_content.scss`: post/page content overrides, prompt callouts, TL;DR, 404.
- `_footer.scss`: footer layout and social link treatment.
- `_row-list.scss`: shared row-list primitive for `/talks/`, `/projects/`, and
  `/animations/`.
- `_home.scss`: home page hub, hero, now callout, and compact home lists.
- `_writings.scss`: annotated writings archive and browse card.
- `_animations.scss`: animation detail pages and used-in strips.
- `_about.scss`: about portrait float and text wrap.

## 4. Sass Tokens

Source: `_sass/addon/_tokens.scss`.

Fonts:

```scss
$font-body: 'Inter', system-ui, -apple-system, sans-serif;
$font-display: 'Space Grotesk', system-ui, sans-serif;
$font-display-bold: 'Space Grotesk Bold', $font-display;
$font-mono: 'JetBrains Mono', ui-monospace, monospace;
```

Breakpoints:

```scss
$bp-sm-max: 575px;
$bp-home-stack-max: 600px;
$bp-md-exclusive-max: 767px;
$bp-md-max: 768px;
$bp-lg-min: 992px;
$bp-lg-max: 991.98px;
$bp-xl-min: 1200px;
$bp-xxl-min: 1400px;
$bp-xxxl-min: 1650px;
```

Panel shell widths and gutters:

```scss
$shell-max-lg: 960px;
$shell-max-xl: 1140px;
$shell-max-xxl: 1320px;
$shell-max-xxxl: 1250px;

$shell-content-gutter-lg: 3.42rem;
$shell-content-gutter-xl: 2.25rem;
$shell-content-gutter-xxl: 4.5rem;
$shell-content-left-gutter-xxxl: 3.25rem;
$shell-content-right-gutter-xxxl: 6.25rem;
```

Reader shell:

```scss
$reader-content-max: 50rem;
$reader-shell-max: calc(#{$reader-content-max} + 3rem);
```

Use reader shell for home, `/writings/`, `/talks/`, `/projects/`,
`/animations/`, `/about/`, `/tags/`, and `/categories/`. Use panel shell for
post pages and `/archives/`.

Vertical shell and anchors:

```scss
$topbar-height: 3.25rem;
$topbar-shell-offset: 3.85rem;
$anchor-scroll-padding: 2.25rem;
$heading-scroll-margin: 2rem;
$short-page-shell-min-height: 80vh;
```

Listing type scale:

```scss
$fs-list-title:    1.2rem;
$fs-list-subtitle: 1rem;
$fs-list-meta:     0.85rem;
$fs-list-tag:      0.75rem;
$fw-list-title:    500;
```

The list scale applies to `/writings/`, `/talks/`, `/projects/`, and
`/animations/`. Home list titles intentionally use `1.1rem` because home renders
multiple list sections on one screen.

## 5. Color System

Source: `_sass/addon/_variables.scss`.

### Light Core

```scss
--main-bg: #FAF6EE;
--mask-bg: #F0E9D7;
--main-border-color: #E3DDC9;

--text-color: #1F1B16;
--text-muted: #7A6F5F;
--text-muted-color: #7A6F5F;
--heading-color: #1F1B16;
--label-color: #5A4F40;

--link-color: #C0623A;
--link-hover: #A04B26;
--link-underline-color: #E3DDC9;

--accent-color: #2E7E9A;
--accent-soft: #2E7E9A1A;
--border-color: #E3DDC9;
--selection-bg: #2E7E9A33;

--body-link-color: #1E5BB3;
--body-link-hover: #143D78;
```

Notes:

- The original plan's beach-paper teal was `#2D7A7B`; the shipped light accent
  is the slightly bluer glacier teal `#2E7E9A`.
- Body text links in light mode are blue for readability against warm paper.
  Navigation, rows, and chrome still use terracotta/teal.

### Dark Core

```scss
--main-bg: #14110D;
--mask-bg: #1B1813;
--main-border-color: #2A2620;

--text-color: #EFE7D6;
--text-muted: #A89A7E;
--text-muted-color: #A89A7E;
--heading-color: #EFE7D6;
--label-color: #C0B8A8;

--link-color: #E68A5C;
--link-hover: #F0A077;
--link-underline-color: #2A2620;

--accent-color: #4FB3B4;
--accent-soft: #4FB3B433;
--border-color: #2A2620;
--selection-bg: #4FB3B444;

--body-link-color: var(--link-color);
--body-link-hover: var(--link-hover);
```

### Component Colors

Callouts:

```scss
--prompt-tip-bg: teal wash;
--prompt-tip-icon-color: #2E7E9A light / #4FB3B4 dark;
--prompt-info-icon-color: #1E5BB3 light / #7DA7EA dark;
--prompt-warning-icon-color: #C0623A light / #E68A5C dark;
--prompt-danger-icon-color: #A04B26 light / #F0A077 dark;
```

Code:

```scss
// Body surface + text
--highlight-bg-color: #F4ECD8 light / #1B1813 dark;
--code-bg:            #F4ECD8 light / #1B1813 dark;
--inline-code-bg:     #E9E1CB light / #23201A dark;
--code-color:         #1A1611 light / #EFE7D6 dark;

// Window chrome (both modes — warm dark mirror)
--code-window-border-color:  #D8CBB0 light / #332D24 dark;  // container box-shadow border
--language-border-color:     #D8CBB0 light / #2A2620 dark;  // Chirpy internals (unchanged dark)
--code-header-bg:            #E9DDC2 light / #242018 dark;
--code-header-border-color:  #D8CBB0 light / #332D24 dark;
--code-header-text-color:    #5A4F40 light / #C0B8A8 dark;  // header label
--code-header-muted-color:   #B8AA91 light / #4A4034 dark;  // decorative dots
--code-header-icon-color:    #7A6F5F light / #8A7D68 dark;  // copy-button icon
--clipboard-checked-color:   #2E7E9A light / #4FB3B4 dark;
```

Topbar:

```scss
--topbar-bg: rgb(250 246 238 / 85%) light;
--topbar-bg: rgb(20 17 13 / 80%) dark;
--topbar-text-color: #5A4F40 light / #EFE7D6 dark;
```

Browse card:

```scss
--browse-card-bg: #F5F0E3 light / #1B1813 dark;
```

Legacy category color overrides currently exist for `career`, `philosophy`,
`books`, and `meta`. The canonical current category system is documented in
`_data/categories.yaml`; do not expand category colors unless the browse UI
actually needs differentiated category colors again.

## 6. Typography

Source: `_sass/addon/_fonts.scss` and `_sass/addon/_typography.scss`.

Runtime font policy:

- Inter: body and descriptions.
- Space Grotesk: navigation, titles, section headings.
- Space Grotesk Bold alias: actual bold heading face with `font-weight: 400`.
- JetBrains Mono: code, meta, dates, counters, technical labels.
- All fonts are self-hosted from `/assets/fonts/*.woff2`.
- `font-display: swap` for every face.
- JetBrains Mono ships three weights: 400 (Regular), 500 (Medium), 700 (Bold).
  Fenced code renders at 500 across the full selector list
  (`.highlight`, `.highlight pre`, `.highlight code`, `.highlight table pre` —
  the last covers Rouge's line-numbered table layout). Generic emphasis tokens
  (`.gh`, `.gs`, `.gu`) render at 600 (synthesized between Medium and Bold) —
  enforced in both `_rouge.scss` mixins and as a defence-in-depth rule in
  `_code.scss`. Code header label uses 500. Inline `<code>` in prose is not
  affected because the weight selector is rooted at `.highlight`. No raw
  `bold` keyword anywhere in the code stack — numeric weights only.

Important rule: headings should use the `Space Grotesk Bold` family alias
instead of applying CSS bold to regular Space Grotesk.

Global content type:

```scss
.post-content,
.page-content {
  font-family: $font-body;
  line-height: 1.75;
}

.post-content h2,
.page-content h2 { font-size: 1.85rem; line-height: 1.3; }

.post-content h3,
.page-content h3 { font-size: 1.55rem; line-height: 1.35; }

.post-content h4,
.page-content h4 { font-size: 1.35rem; line-height: 1.4; }

.post-content h5,
.page-content h5 { font-size: 1.2rem; line-height: 1.45; }

.post-content h6,
.page-content h6 { font-size: 1.1rem; line-height: 1.5; }
```

Feature settings:

```scss
Inter body: "cv01", "cv02", "cv11";
JetBrains Mono: "calt" 1, "liga" 1;
```

## 7. Layout Shells And Width

Source: `_layouts/default.html`, `_sass/addon/_layout.scss`,
`_sass/addon/_shell.scss`.

There are two shells:

- `body.shell-reader`: no right panel; centered reader width.
- `body.shell-panel`: posts and `/archives/`; keeps Chirpy-style panel width.

Decision:

- Reader pages clamp to `50rem + 3rem` shell max.
- Post pages retain more of Chirpy's panel layout because desktop posts need the
  right TOC rail.
- Short pages use `min-height: 80vh`, not Chirpy's original `100vh`, because the
  fixed topbar otherwise creates a blank footer-scroll band.
- At very wide viewports, reader pages force symmetric `1.5rem` horizontal
  padding to avoid Chirpy's panel-specific right padding pushing content left.

Reader-shell width rules live in `_shell.scss`. Structural page flow lives in
`_layout.scss`. Topbar-specific layout lives in `_topbar.scss`.

## 8. Topbar And Navigation

Source: `_includes/topbar.html`, `_sass/addon/_topbar.scss`.

Current public nav:

```text
~/aalhour | writings | talks | projects | animations | about | search | mode
```

Rules:

- All nav labels are lowercase.
- There is no `home` item; the brand links to `/`.
- The brand is `~/aalhour`, left aligned inside the current shell.
- Desktop nav starts at `992px`.
- Search trigger is visible at all viewport sizes.
- Mode toggle must retain `id="mode-toggle"` for Chirpy JS.
- Hidden `#sidebar-trigger` remains because Chirpy's bundled JS expects it.
- Mobile keeps a hamburger drawer for navigation.
- Mobile post pages preserve Chirpy's native post-title/TOC swap via `#toc-bar`,
  `#toc-popup`, and `.toc-trigger`.
- Anchor links use `scroll-padding-top` and heading `scroll-margin-top` so
  headings do not hide under the fixed topbar.

Topbar dimensions:

```scss
$topbar-height: 3.25rem;
desktop nav font-size: 1.0625rem; // 17px equivalent
```

## 9. Listing Patterns

### Row List Primitive

Source: `_sass/addon/_row-list.scss`.

Use `.row-list-*` for `/talks/`, `/projects/`, and `/animations/`.

Structure:

```text
[left meta] | [title + subtitle + optional info strip] | [optional arrow link]
```

Rules:

- Left meta is JetBrains Mono, uppercase, `$fs-list-meta`.
- `.status` inside meta is teal and same size as the parent.
- Titles use Space Grotesk at `$fs-list-title`.
- Subtitles use Inter at `$fs-list-subtitle`.
- `.row-list-info` is the teal mono strip for locations/actions.
- `.row-list-info--muted` is Inter/muted for secondary "used in" context.
- Mobile collapses to one column below `$bp-sm-max`.

### Home Lists

Source: `_sass/addon/_home.scss`.

Home intentionally keeps `.home-list-*` separate. It is denser than the single
purpose listing pages and uses `1.1rem` row titles instead of `$fs-list-title`.

Current home sections are compact and table-like:

- Selected Essays
- Recent writing
- Recent talks
- other small editorial groups as needed

Descriptions under home table items are not part of the current design; that
experiment was tested and rejected as too text-heavy.

### Writings Entries

Source: `_sass/addon/_writings.scss`.

`/writings/` is the annotated archive and browse hub. It intentionally has a
slightly different row structure:

```text
[date] | [title + optional note + category/read-time meta]
```

Rules:

- Dates use uppercase month/day style in templates, e.g. `APR 21`.
- Category link uses a folder icon and teal.
- Browse by tag shows top tags, sorted by post count.
- Years section is currently hidden/deferred.
- `/archives/` remains Chirpy default; `/writings/` is the polished archive.

## 10. Page-Specific Decisions

Home:

- First screen is the actual site hub, not a marketing landing page.
- Portrait links to `/about/`.
- Hero title is "Ahmad Alhour".
- Lede stays short, muted, and editorial.
- Current experiment callout uses thin teal left border and sand/teal wash.

Writings:

- Uses reader width, not full desktop width.
- "Selected Essays" is the preferred heading for featured/pinned writing.
- Shows all `pin: true` posts in selected sections.
- Recent writing shows the last 10 posts.

Talks:

- Uses `.row-list-*`.
- `short_description` is used for row subtitles when available.
- Date display is uppercase compact month/day style when a day exists.
- Info strip can include location, video, slides, and similar links.

Projects:

- Uses `.row-list-*`.
- Still data-driven from `_data/projects.yml`; collection migration is deferred.

Animations:

- Index uses `.row-list-*`.
- Detail pages use `_animations.scss` for intro, usage, and stage wrappers.
- Keep interactive includes under `_includes/animations/`.

About:

- Portrait floats right and text wraps around it.
- Mobile portrait shrinks and still floats right.

Posts:

- Desktop posts keep right-side TOC.
- Mobile posts preserve Chirpy's TOC bar behavior.
- `tldr:` front matter renders `.post-tldr`.
- Prompt callouts are palette-matched, thin-bordered blocks.
- Author repetition in post meta is hidden by local CSS.

Footer:

- Desktop: social icons left, copyright/built-with right.
- Mobile: centered.
- The footer is locally self-contained because Bootstrap flex utilities plus
  local CSS caused cross-browser risk.

## 11. Syntax Highlighting

Source: `_sass/addon/_rouge.scss` (token values + selectors) and
`_sass/addon/_code.scss` (code-window chrome).

The shipped palette has two halves:

- **Light mode**: "Beach-tuned One Light" — One Light's structure (purple
  keywords, green strings, blue functions, gold classes) recoloured into the
  Beach-paper hue family for cohesion with site chrome.
- **Dark mode**: Beach-paper — warm sunset/teal/plum/blue on deep ink.

Token literals live in `$l-rouge-*` and `$d-rouge-*` SCSS variables at the top
of `_rouge.scss`. Mixin bodies reference those variables only — there are no
raw hex literals inside selectors. To swap a palette, edit the variable block
at the top of the file; no selector hunt.

| Token group | Selectors | Light | Dark |
|---|---|---|---|
| Background | `.highlight`, `.highlight .w` | `#F4ECD8` | `#1B1813` |
| Base text | same | `#1A1611` | `#EFE7D6` |
| Keywords | `.k .kd .kn .kp .kr .kt .kv` | `#8F3D88` purple | `#E68A5C` sunset |
| Kw.const + ops + regex + interp | `.kc .o .ow .sr .si` | `#205F60` deep-teal | `#4FB3B4` shallow-water |
| Strings | `.s .sa .sc .dl .sd .s2 .se .sh .sx .s1 .ss .sb` | `#4E7333` olive | `#7DC47C` soft-green |
| Comments | `.c .ch .cd .cm .cp .cpf .c1 .cs` | `#6F6452` driftwood | `#A89A7E` driftwood |
| Numbers / decorators | `.m .mb .mf .mh .mi .il .mo .mx .l .ld .nd` | `#7A5028` bronze | `#D4A857` warm-gold |
| Functions / methods | `.nf .fm` | `#3D5A8E` muted-blue | `#B08ED4` soft-plum |
| Classes + vars + labels + exceptions | `.nc .no .nn .nv .vc .vg .vi .vm .nl .ne .py .bp` | `#8A6500` gold | `#7BA3D4` soft-blue |
| Tags / attributes | `.na .nt` | `#B5421C` terracotta | `#88BA6E` sage |
| Builtins | `.nb` | `#8A3A1A` deep-terra | `#F0A077` peach |
| Generic subhead | `.gu` | `#574E40` darker driftwood | `#A89A7E` driftwood |
| Diff inserted | `.gi` text + bg | `#205F60` + `#D9E8DE` | `#7DC47C` + `#1A2A1A` |
| Diff deleted | `.gd` text + bg | `#8A3A1A` + `#F2DAD0` | `#E68A5C` + `#2A1A12` |
| Error | `.err` text on bg | `#FAF6EE` on `#8A3A1A` | `#14110D` on `#C04040` |

Comments do not render italic (avoided unless required by Rouge generic
emphasis tokens). Generic emphasis (`.gh`, `.gs`, `.gu`) renders at numeric
`font-weight: 600`.

### Code-window chrome (both modes)

Source: `_sass/addon/_code.scss`.

The code block renders as a quiet warm terminal window in both modes. Light and
dark share the same component structure; only the chrome surface and border
hexes differ. Chrome rules live at root scope in `_code.scss` and consume
`--code-window-border-color`, `--code-header-bg`, `--code-header-border-color`
defined in both palette mixins of `_variables.scss` — mode switching falls out
of the CSS-var cascade. No `@media` or `[data-mode]` parent selector inside
`_code.scss`.

Corner-radius detail: Chirpy's container (`div[class^='language-']`) has
`border-radius: 10px` but no `overflow: hidden`, so child surfaces would paint
square corners over the rounded container clip. `_code.scss` compensates with
explicit `border-radius: 10px 10px 0 0` on `.code-header` (top corners) and
`border-radius: 0 0 10px 10px` on `.highlight` (bottom corners) so the header
bg and body bg both follow the container's rounded outline. Applies in both
modes.

Light mode:

- Container: `var(--code-window-border-color)` `#D8CBB0` 1px box-shadow border,
  10px border-radius (Chirpy default).
- Header (`.code-header`): warm cream bg `#E9DDC2` with 1px bottom border
  `#D8CBB0` separator. Label uses `font-weight: 500`. Three decorative dots
  (Chirpy default markup) tint to `#B8AA91`. Lang label `#5A4F40`, icon
  `#7A6F5F`, clipboard checked accent `#2E7E9A`.
- Body: `#F4ECD8` surface, `#1A1611` ink, JetBrains Mono Medium (500).

Dark mode (warm dark mirror):

- Container: `var(--code-window-border-color)` `#332D24` 1px box-shadow border.
- Header (`.code-header`): warm cocoa bg `#242018` with 1px bottom border
  `#332D24` separator. Label uses `font-weight: 500`. Decorative dots tint to
  coffee-grey `#4A4034` (lifts above the near-bg surface). Lang label
  `#C0B8A8`, copy icon `#8A7D68`, clipboard checked accent `#4FB3B4`.
- Body: `#1B1813` surface (unchanged), `#EFE7D6` ink (unchanged),
  JetBrains Mono Medium (500). Dark Rouge token palette ships as-is.

## 12. Taxonomy

Source: `_data/categories.yaml`.

Canonical categories:

- Databases
- Systems
- Hardware
- Languages
- AI
- Engineering
- Reading
- Reflections
- Meta

Rules:

- Keep categories broad and stable.
- Use tags for projects, technologies, languages, books, authors, and narrow
  concepts.
- BeachDB is not a category; it is a tag/series-level concept.
- `topic:` is deferred; categories and tags cover the current navigation model.

## 13. Browser Icons

The site uses raster artwork for its favicon and app icons. The current painted
icon remains raster because an automatic SVG conversion would either be
oversized, visually degraded, or a fake vector wrapper around raster data.

Current icon stack:

- Declare PNG browser favicons in the document head:
  - `32x32` for normal browser tab contexts.
  - `96x96` for higher-density browser UI and bookmark contexts.
- Declare a `180x180` PNG with `rel="apple-touch-icon"` for iOS and iPadOS home
  screen usage.
- Declare `/site.webmanifest` from the document head.
- Put `192x192` and `512x512` PNG icons in `site.webmanifest` for Android,
  install, launcher, and splash contexts.
- Keep `/favicon.ico` at the site root as an unlinked fallback for legacy
  browsers, crawlers, email clients, and other clients that probe that path
  directly.

`/favicon.ico` is kept at the site root but is not linked from the document
head. Modern browsers choose the declared PNG icons first.

An SVG favicon only fits the system if the site gets a deliberately designed
vector mark, such as a simple `~/aalhour` glyph or another small symbolic logo.
In that case, the SVG becomes the primary `rel="icon"` with `sizes="any"`, while
the PNG fallbacks and root `/favicon.ico` remain.

## 14. Deferred Work

These items are deferred and are not part of the current shipped design system:

- Pagefind search.
- Series pages and series banner.
- `/archives/` redesign.
- Projects collection migration.
- Sidenotes.
- Image zoom.
- Scroll progress bar.
- Poster fields for talks/animations.
