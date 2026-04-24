# BeachDB Pixel-Art House Style + Ready-Made Prompts

## 1) Canonical BeachDB house style prompt

```text
Create a minimal grayscale pixel-art blog banner with a pure white background and lots of negative space. Use a clean retro pixel-art style with only black, white, and a few shades of gray. No colors at all.

Feature the established BeachDB mascot: a cute rounded pebble/rock with a simple kawaii face, tiny dot eyes, a small expressive mouth, soft grayscale shading, and a clear black outline. The mascot should be instantly recognizable across images and should feel playful, friendly, and lightweight.

Place the mascot in a tiny beach setting with a minimal shoreline, a few small pixel waves, and one or two subtle beach details such as a shell, pebble, tiny cloud, or tiny bird. Keep the beach motif small and simple so it acts as an identity anchor, not as dense scenery.

The image should visually explain a database or systems concept using a few pixel-art objects such as files, boxes, arrows, labels, flow steps, or simple diagrams. It should feel like a tiny technical explainer scene turned into pixel art.

Keep the composition sparse, readable, and optimized for a blog header. Prioritize clarity at small size. Use crisp simple labels only when needed. Avoid clutter, avoid busy scenery, avoid color, avoid gray page backgrounds, avoid photorealism, and avoid dense decorative detail.
```

## 2) Compact reusable style block

```text
Style: minimal grayscale pixel-art banner, 16:9, pure white background, cute rounded BeachDB pebble mascot, tiny beach motif, sparse composition, black/white/gray only, playful technical explainer feel, crisp readable labels, lots of negative space, blog-optimized, readable at small size.
```

## 3) Prompt template for future BeachDB post images

```text
Minimal grayscale pixel-art banner, 16:9, pure white background. Use the established BeachDB mascot style: a cute rounded pebble with a simple expressive face, black outline, and subtle grayscale shading only. Place the mascot on a tiny beach with a minimal shoreline and 1–3 small beach details. Show the concept of [TOPIC] using a few simple pixel-art objects such as [OBJECTS], with arrows, labels, boxes, or flow steps if needed. Make it feel like a playful systems diagram in retro pixel art. Keep it sparse, readable, lightweight, and optimized for a blog header. Only black, white, and gray. No colors, no gray background, no clutter, no dense scenery.
```

## 4) Ready-made prompt: Intro post / Building BeachDB

```text
Minimal grayscale pixel-art banner, 16:9, pure white background. Feature the established BeachDB pebble mascot standing proudly on a tiny pixel beach with a small shoreline, a couple of tiny waves, and one shell. The mascot should hold or stand beside a small flag labeled "DB" or "BeachDB". Nearby, show a tiny sandcastle or simple block-like structure to suggest “building” a database from scratch. Keep the scene playful, simple, and optimistic. Make the composition sparse and blog-friendly, with lots of white space. Only black, white, and gray. No colors, no gray background, no dense scenery.
```

## 5) Ready-made prompt: WAL / Durability post

```text
Minimal grayscale pixel-art banner, 16:9, pure white background. Feature the established BeachDB pebble mascot on a tiny pixel beach beside a very long write-ahead log file that stretches toward the horizon like an infinite paper trail. The mascot should be writing or placing entries into the log, or standing beside a small pixel log box labeled "WAL". Add a few simple arrows or motion cues to suggest append-only writes. The scene should communicate durability and logging in a clean, visual way. Keep the beach small and simple, and keep the composition sparse, readable, and blog-optimized. Only black, white, and gray. No colors, no gray background, no clutter.
```

## 6) Ready-made prompt: Memtable / Skip-list post

```text
Minimal grayscale pixel-art banner, 16:9, pure white background. Feature the established BeachDB pebble mascot on a tiny pixel beach next to a simple skip-list diagram made of stacked nodes and horizontal/vertical links. The mascot should appear to be interacting with or inserting a small data block into the skip-list. The skip-list should be readable but minimal, like a tiny technical diagram. Include a small shoreline, a few waves, and one or two subtle beach details so it still feels like BeachDB. Keep the composition sparse and clean, with lots of white space. Only black, white, and gray. No colors, no gray background, no dense scenery.
```

## 7) Ready-made prompt: SSTables / Making the on-disk state real

```text
Minimal grayscale pixel-art banner, 16:9, pure white background. Feature the established BeachDB pebble mascot on a tiny pixel beach next to a few simple file blocks labeled "SST". Show a tiny motion cue, arrow, or transfer arc from the mascot toward the SST files to suggest flushing state to disk or turning in-memory data into on-disk sorted files. The beach should remain minimal: a small shoreline, a few tiny waves, maybe one shell or pebble. The concept should feel like “making the on-disk state real” in a playful technical way. Keep it sparse, readable, and optimized for a blog header. Only black, white, and gray. No colors, no gray background, no clutter.
```

## 8) Ready-made prompt: Crash testing / Crash-only confidence

```text
Minimal grayscale pixel-art banner, 16:9, pure white background. Feature the established BeachDB pebble mascot on a tiny pixel beach, looking slightly nervous but still recognizable and intact. In front of the mascot, show a tiny crash-testing pipeline made of small pixel boxes and arrows labeled: PUT, WAL, FSYNC, APPLY, RECOVER. Mark the FSYNC boundary with a small target flag labeled "FAILPOINT" or "FSYNC". Above the scene, show a few small falling paper log files clearly labeled "LOG". To the side, include a tiny replay artifact receipt with a circular arrow labeled "REPLAY". Keep the composition very sparse and diagrammatic, like a playful systems explainer. Only black, white, and gray. No colors, no gray background, no dense scenery.
```

## 9) Optional stronger consistency prompt

```text
Keep the mascot visually consistent with previous BeachDB images: same rounded pebble body, same kawaii face proportions, same simple grayscale shading, same clean black outline, same lightweight beach identity, and same sparse pixel-art blog-banner aesthetic.
```

## 10) Practical negative prompt / exclusions

```text
Do not use any colors. Do not add a gray page background. Do not create a dense landscape or full scenic environment. Do not make the mascot look like a random rock; it should match the established BeachDB mascot style. Do not add unnecessary detail, noise, texture, or photorealism. Do not make the diagram too complex to read at small size.
```

-----

## Smaller Master Prompt

Minimal grayscale pixel-art banner, 16:9, pure white background. Use a clean, sparse retro pixel-art style with only black, white, and a few shades of gray, no color at all. Feature the cute BeachDB pebble mascot: a small rounded rock with a simple kawaii face, tiny dot eyes, soft cheerful or expressive mouth, and the same recognizable mascot look used in earlier BeachDB images. Place the mascot on a very simple pixel beach with a small shoreline, a few tiny waves, maybe one shell or pebble, and minimal sky details like tiny clouds or birds, all still grayscale on white.

The composition should visually explain a database/storage concept through a few simple pixel objects, boxes, arrows, labels, or files. Make it feel like a tiny technical diagram turned into pixel art: clean, readable, and playful. Keep the scene lightweight, uncluttered, and optimized for a blog header. Avoid dense scenery, avoid full backgrounds, avoid color gradients, and avoid noisy detail. Prioritize clarity, charm, and readability at small size.

### Reusable prompt template

(Use this whenever you want a new image in the same family)

Minimal grayscale pixel-art banner, 16:9, pure white background. Cute BeachDB pebble mascot in a sparse retro pixel-art style, matching the established mascot design: rounded pebble body, simple kawaii face, soft expression, black outline, grayscale shading only. Place the mascot on a tiny pixel beach with a minimal shoreline and 1–3 tiny beach details. Show the concept of [TOPIC] using a few simple pixel-art objects such as [OBJECTS], with arrows, labels, or boxes if needed. Keep it diagrammatic, blog-optimized, highly readable at small size, and emotionally light/playful. Only black, white, and gray. No colors, no gray page background, no busy scenery, no clutter, no photorealism.

### Short “style block” version

Style: minimal grayscale pixel art, pure white background, 16:9 blog banner, cute rounded BeachDB pebble mascot, sparse beach motif, clean black/gray/white palette only, tiny diagrammatic storytelling elements, crisp readable labels, lightweight composition, playful but technical, retro game feel, optimized for readability at small size.