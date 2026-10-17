# Template anatomy

A template is a folder with two files:

```
My templates/spring-mini/
  template.html   the layout
  template.json   name, description, fields, sample content
```

## template.html

```html
<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>Spring Mini</title>
<link rel="stylesheet" href="../_kp/brand.css">
<script src="../_kp/kp.js"></script>
<style>
  /* Scope every rule to the template's class so slides never clash. */
  .spring-mini .card { position: absolute; left: var(--kp-margin); right: var(--kp-margin); bottom: 96px; height: 360px;
                       background: var(--tone-bg); color: var(--tone-ink); box-shadow: var(--kp-card-shadow); }
  .spring-mini .headline { left: var(--kp-card-pad); right: var(--kp-card-pad); top: 48px; height: 180px; }
  html[data-aspect="square"] .spring-mini .card { height: 320px; }
</style>
</head>
<body>
<main class="kp-slide spring-mini" data-tone="cream">
  <img class="kp-photo kp-fill" data-field="photo" src="" alt="" style="--focus-x: 50%; --focus-y: 40%; --zoom: 1;">
  <div class="card">
    <h1 class="kp-abs kp-display headline" data-field="headline" data-fit="52 96" data-valign="top">Spring minis</h1>
  </div>
</main>
</body>
</html>
```

### The canvas

- The slide is **1080 design pixels wide** (1200 for the 1.91:1 landscape
  sizes). Its height follows the size: 1350 (4:5), 1080 (square), 1440
  (3:4), 1920 (9:16), 629/630 (landscape).
- `kp.js` sets `<html data-size="ig" data-aspect="four-five">` before
  anything is drawn. Aspects: `four-five`, `square`, `three-four`,
  `nine-sixteen`, `landscape`. Write the 4:5 layout as the base, then
  `html[data-aspect="..."]` overrides.
- Anchor to the nearest edge: things in the lower half use `bottom:`, so
  they hold their place when the slide gets shorter.
- Nothing inside the slide scrolls; anything off the canvas is cut.

### Building blocks (from brand.css)

| Class | What it is |
| --- | --- |
| `kp-slide` | The slide itself. Needs `data-tone`. |
| `kp-abs` / `kp-fill` | `position: absolute` / fill the parent. |
| `kp-photo` | A photo `<img>`: covers its box, honours `--focus-x`, `--focus-y`, `--zoom`. |
| `kp-photo-frame` | A clipping box for an inset photo; put a `kp-photo` inside. |
| `kp-wash`, `kp-scrim-bottom`, `kp-scrim-ends` | Darkening layers that go over a photo, under text. |
| `kp-eyebrow`, `kp-display`, `kp-headline`, `kp-body`, `kp-name`, `kp-detail`, `kp-signature` | Type roles (see the brand guide). |
| `kp-on-photo`, `kp-on-photo-small` | Shadows for text directly on a washed photo; the small one also makes it white. |
| `kp-pill`, `kp-card`, `kp-rule`, `kp-stars` | Shapes. `kp-stars` with `data-stars="5"` draws stars. |

Tokens: `--tone-bg`, `--tone-ink`, `--tone-soft`, `--kp-ink`,
`--kp-margin` (72), `--kp-margin-type` (80), `--kp-margin-hero` (90),
`--kp-corner` (56), `--kp-card-pad` (52), `--kp-safe` (64), the type sizes,
`--kp-card-shadow`, `--kp-photo-shadow`, `--kp-tilt-sticker`,
`--kp-tilt-card`. The full list is at the top of `brand.css`.

### Attributes kp.js understands

| Attribute | Effect |
| --- | --- |
| `data-field="key"` | Marks something `fill` can change: text content, an `<img>` src and focus, or `data-stars`. Keys are lowercase; photos start with `photo` (`photo`, `photo2`). |
| `data-optional` | Hide the element when its text is empty (or stars are 0). |
| `data-fit="min max"` | Shrink text to the largest size between min and max that fits the box. The box needs a definite width and height. |
| `data-fit-square="min max"` (and `-four-five`, `-three-four`, `-nine-sixteen`, `-landscape`) | A different range for one aspect. |
| `data-valign="top\|center\|bottom"` | Where fitted text sits in its box (default centre). |
| `data-stars="n"` | Draw n stars (0–5). |

### Must-haves

- The `../_kp/brand.css` and `../_kp/kp.js` links, exactly as above (posts
  keep slides in `slides/` with brand files in `_kp/`).
- One `<main class="kp-slide <id>" data-tone="...">`.
- Every changeable thing has a `data-field`; every photo is an
  `<img class="kp-photo">` with `src=""` in the template.
- No `http(s)://` anywhere; no `@handles`; nothing animated.
- Text 64px from every edge.

## Checking it

`gallery --template <id> --sizes all` renders the template with its
`sample` content at every size. Read the check images it lists. Then try the
extremes in a scratch post (very short and very long words, landscape and
portrait photos) and fix anything that breaks.
