# Animations Workflow

Short guide for adding and maintaining animation gallery entries.

## File Map

- `_data/animations.yml`: Defines gallery entries, slugs, titles, summaries, detail text, detail-page URLs, include paths, and preview variants.
- `_tabs/animations.md`: Renders the `/animations/` gallery page from `_data/animations.yml`.
- `animations/*.md`: One detail page per animation, e.g. `animations/lsm-tree.md`, `animations/skiplist.md`, `animations/fsync.md`.
- `_includes/animations/*.html`: Embeds each interactive animation, loads its scripts, accepts optional container IDs, and emits the `<!-- animation: ... -->` usage marker.
- `_includes/animation-used-in.html`: Scans `site.posts` for animation markers and renders the dynamic “Used in:” list.
- `assets/js/*-animation/*.js`: Animation implementations, currently `lsm-animation`, `skiplist-animation`, and `fsync-animation`.
- `assets/vendor/anime.min.js`: Shared animation runtime used by the current demos.
- `assets/css/jekyll-theme-chirpy.scss`: Gallery card styles, static preview styles, detail-page animation sizing, and shared “Used in:” list styles.
- `_includes/topbar.html`: Local Chirpy topbar override for `/animations/<slug>/` breadcrumbs.
- `_includes/sidebar.html` and `_tabs/*.md`: Navigation/tab ordering; update only when the gallery itself moves or changes nav position.
- `_posts/*.md`: Posts embed animations with `{% include animations/<slug>.html %}`; these references drive “Used in:” automatically.
- `_data/workflows/animations.md`: This maintenance guide.

## Add A New Animation

1. Add the HTML include:
   - Create `_includes/animations/<slug>.html`.
   - Accept an optional `id`.
   - Load required JS/CSS assets with `relative_url`.
   - Add the marker comment:
     `<!-- animation: animations/<slug>.html -->`

2. Add assets:
   - Put JS under `assets/js/<slug>-animation/`.
   - Put shared/vendor assets under existing asset folders when possible.
   - Avoid hardcoded absolute paths unless the repo already uses them.

3. Add gallery metadata:
   - Update `_data/animations.yml`.
   - Required fields:
     - `slug`
     - `title`
     - `kind`
     - `include_path`
     - `url`
     - `summary`
     - `detail`
     - `preview.variant`

4. Add the detail page:
   - Create `animations/<slug>.md`.
   - Use `layout: page`.
   - Use `permalink: /animations/<slug>/`.
   - Assign the animation from `site.data.animations`.
   - Render `{% include animation-used-in.html include_path=animation.include_path %}`.
   - Render the animation include with a page-specific id.

5. Add card preview styling:
   - Update `assets/css/jekyll-theme-chirpy.scss`.
   - Add a new `.animation-preview-<variant>` block if needed.
   - Keep previews static and lightweight.

6. Verify:
   - Run `bundle exec jekyll build`.
   - Check `/animations/`.
   - Check `/animations/<slug>/`.
   - Confirm the animation does not overflow the content column.

## Existing Animation Used In A New Post

Usually no gallery update is needed.

1. In the post, include the animation:
   - `{% include animations/<slug>.html %}`
   - Use a custom `id` only if the page has multiple copies.

2. The “Used in” list updates automatically because:
   - The animation include emits `<!-- animation: animations/<slug>.html -->`.
   - `_includes/animation-used-in.html` scans `site.posts`.

3. Verify:
   - Run `bundle exec jekyll build`.
   - Check `/animations/`.
   - Check `/animations/<slug>/`.
   - Confirm the new post appears under “Used in:”.

## Update Or Rename An Existing Animation

Use this when the animation itself changes, or when slug/file names change.

1. If only behavior/visuals change:
   - Update `_includes/animations/<slug>.html`.
   - Update JS/CSS assets.
   - Update `summary` or `detail` in `_data/animations.yml` if the explanation changed.
   - Keep `slug`, `url`, and marker unchanged if possible.

2. If the slug changes:
   - Rename `_includes/animations/<old>.html` to `_includes/animations/<new>.html`.
   - Rename `animations/<old>.md` to `animations/<new>.md`.
   - Update the detail page permalink to `/animations/<new>/`.
   - Update `_data/animations.yml`:
     - `slug`
     - `include_path`
     - `url`
     - `title` if needed
     - `preview.variant` if needed
   - Update marker comment in the include:
     `<!-- animation: animations/<new>.html -->`
   - Update all posts that include the old path.

3. If asset paths change:
   - Update script/link paths inside the animation include.
   - Update any references in post text if they name the old asset or concept.

4. If the concept changes:
   - Update `summary`.
   - Update `detail`.
   - Update `kind` if the category changed.
   - Update the card preview if the old preview no longer represents it.
   - Update page title if the public name changed.

5. Verify:
   - Run `rg "animations/<old>"` when renaming.
   - Run `bundle exec jekyll build`.
   - Check `/animations/`.
   - Check `/animations/<new>/`.
   - Check posts that embed the animation.
