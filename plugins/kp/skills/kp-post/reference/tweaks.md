# Turning requests into changes

Prefer the simplest change that does what she asked: a field value first
(`fill`), then the photo focus or tone, and only then editing the slide's
HTML/CSS. Preview after each round and look at the result.

## Common requests

| She says | Do |
| --- | --- |
| "Change the words to ..." | `fill <post> <n> --set headline="..."` |
| "Make *this word* italic" | Wrap it in asterisks in the value: `New work *is live.*` |
| "Put it on two lines" | Use `\n` where the break goes. |
| "Hide the small line / stars / label" | Set it empty (`--set line=`) or `stars=0`. |
| "Use this photo instead" | `photos` it in, then `fill ... --set photo=<name>`. |
| "Her head's cut off" / "show more of the top" | Lower `focusY` (towards 0 shows more of the top): `--json '{"photo":{"focusY":20}}'`. Left/right: `focusX`. |
| "Zoom in" | `--json '{"photo":{"zoom":1.25}}'` (1 = no zoom). Zoom only goes in, never out. |
| "Different colour" | `--set tone=sage` (cream, sand, rosette, sage, balsam, sienna). |
| "Make the headline bigger / smaller" | Fitted text: change the `data-fit="min max"` numbers on that element in the slide file (the first is the smallest it may shrink to, the second the largest). Other text: change its `font-size` in the slide's `<style>`. |
| "Move the card / text up" | In the slide's `<style>`, change that element's `top`/`bottom` (design pixels; the slide is 1080 wide). |
| "Different font for the headline" | `fonts` to list options; `add-font <post> "<Family>"`; then set `font-family: "<Family>";` on that element in the slide's `<style>`. If she has her own font file, ask her to drop it into `KP Posts/My fonts`, then add it by name. |
| "Swap slides 2 and 3" | `move <post> 3 2` |
| "Another one like slide 2" | `duplicate <post> 2`, then `fill` the copy. |
| "Take that slide out" | `remove <post> <n>` |
| "Make a story version too" | `export <post> --sizes ig-story` (check `preview --sizes ig-story` first: stories crop differently). |
| "Undo that" | Put back the previous value with `fill`, or reverse your last edit to the slide file. Removed slides are in `removed slides/`. |
| "Use this layout again in future" | kp-template skill. |

## Editing a slide file directly

Each slide is `<post>/slides/NN-<template>.html`: a small, self-contained web
page. Use the Read and Edit tools on it. Its parts:

```html
<link rel="stylesheet" href="../_kp/brand.css">   <!-- brand tokens, fonts, building blocks -->
<script src="../_kp/kp.js"></script>              <!-- sizing, text fitting, checks: keep -->
<style>
  /* This slide's own layout. Edit freely. */
  .hero-quote .headline { height: 280px; }
  html[data-aspect="square"] .hero-quote .headline { ... }   /* only in the square version */
</style>
<main class="kp-slide hero-quote" data-tone="cream">
  <img class="kp-photo kp-fill" data-field="photo" src="../photos/x.jpg" style="--focus-x: 50%; --focus-y: 40%; --zoom: 1;">
  <h1 class="kp-display headline" data-field="headline" data-fit="64 128">Slow mornings.</h1>
  <p class="line" data-field="line" data-optional>Autumn family sessions</p>
</main>
```

- Measurements are design pixels on a slide 1080 wide. The height depends on
  the size: 1350 (Instagram 4:5) or 1080 (Facebook square). One slide file
  makes every size, so check both contact sheets after a layout change.
- Anchor things near the bottom with `bottom:` so they stay put in both
  sizes. For a size-specific tweak, prefix the rule with
  `html[data-aspect="square"]` (or `four-five`, `three-four`,
  `nine-sixteen`, `landscape`).
- Use the brand tokens (`var(--tone-ink)`, `var(--kp-margin)`, ...) and
  classes (`kp-eyebrow`, `kp-display`, `kp-headline`, `kp-body`, `kp-name`,
  `kp-detail`, `kp-signature`, `kp-pill`, `kp-rule`, `kp-card`, `kp-stars`)
  rather than new colours and fonts. They're listed in `_kp/brand.css`.
- `data-field="name"` marks text or a photo that `fill` can change. New
  pieces of text should get one. `data-optional` hides the element when
  empty. `data-fit="min max"` shrinks text to fit its box; the box needs a
  fixed height.
- Never load anything from the internet (web fonts, images by URL): the
  renderer blocks it. Photos go in `photos/`, fonts via `add-font`.
- Keep the two links at the top. Without `kp.js` the slide won't render.

## Looking at the result

`preview` prints problems and the contact sheet paths. Always Read the
contact sheet images and check them with your own eyes before telling
Kirsten it's done: faces, crops, readability, spacing, and that nothing new
overlaps. If a change looks worse, say so and offer to put it back.
