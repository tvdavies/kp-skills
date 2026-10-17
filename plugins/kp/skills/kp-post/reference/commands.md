# kp.mjs commands

Always run as `node ${CLAUDE_PLUGIN_ROOT}/scripts/kp.mjs <command>`. Quote any
argument with spaces. `<post>` is the post folder path or a unique part of its
name; `<slide>` is the slide number (1 is first).

| Command | What it does |
| --- | --- |
| `init` | Create `~/Pictures/KP Posts` with `My templates`, `My fonts` and a read-me. |
| `templates [--json]` | List templates (Kirsten's own first), with their fields. `?` marks optional fields. |
| `sizes` | List output sizes. `*` marks the defaults (Instagram 4:5, Facebook square). |
| `fonts` | List fonts that can be added to a post: bundled ones and hers in `My fonts`. |
| `new "<title>" [--date YYYY-MM-DD]` | Make `KP Posts/<date> <title>/`. Prints the folder. |
| `show <post> [--json]` | The post's photos, slides, tones and every field's current text. |
| `photos <post> <file or folder>...` | Copy photos into `photos/`. HEIC/TIFF become JPEG. Prints the names to use. |
| `add <post> <template> [--at N] [--tone T] [--set key=value]... [--json '{...}']` | Add a slide (at the end, or at position N). |
| `fill <post> <slide> [--set key=value]... [--json '{...}']` | Change a slide's words, photo, stars or tone. |
| `move <post> <slide> <to>` | Move a slide to a new position. |
| `duplicate <post> <slide>` | Copy a slide; the copy goes right after it. |
| `remove <post> <slide>` | Move a slide to `removed slides/` (never deleted). |
| `preview <post> [--sizes ...] [--slides 1,3]` | Render quick check images to `previews/` and a contact sheet per size. Lists problems. |
| `export <post> [--sizes default\|all\|ig,fb,...] [--format jpg\|png] [--quality 95] [--slides 1,3]` | Render the final images to `exports/<platform>/`. Replaces the previous export. |
| `add-font <post> <family, file or folder> [--family "Name"]` | Make a font usable in this post. |
| `refresh <post>` | Update the post's brand files (`_kp/`) to the installed plugin version. |
| `save-template <post> <slide> "<name>"` | Save a slide as one of Kirsten's templates. |
| `copy-template <template> "<new name>"` | Copy a template into `My templates` to change it. |
| `example <name>` | Make an example post (`autumn-minis`, `client-review`, `newborn-announcement`). |
| `gallery [--sizes ...] [--template a,b] [--out dir]` | Render every template with sample content, for a look at the options. |

## Values

- Text: `--set headline="Slow mornings."`. `*word*` is italic, `\n` is a new
  line. An empty value hides an optional field: `--set line=`.
- Photos: `--set photo=smith-03.jpg` (a file in the post's `photos/`), or a
  full path (copied in). To crop, use JSON:
  `--json '{"photo": {"src": "smith-03.jpg", "focusX": 50, "focusY": 30, "zoom": 1.2}}'`.
  `focusX`/`focusY` are 0–100 (% across/down the photo to keep in view);
  `zoom` 1 just fills the frame, 1.3 pushes in 30%.
- Stars: `--set stars=5` (0 hides them).
- Tone: `--set tone=sage` or `--tone sage` on `add`. Tones: cream, sand,
  rosette, sage, balsam, sienna.

## What's in a post folder

```
KP Posts/2026-10-17 Smith family autumn/
  post.json          title, file-name slug, default sizes and format
  photos/            copies of the photos used
  slides/01-hero-quote.html, 02-photo.html, ...   one page per slide
  previews/          check images and "<size> contact sheet.jpg"
  exports/Instagram/smith-family-autumn-01.jpg ...  1080×1350
  exports/Facebook/smith-family-autumn-01.jpg ...   1080×1080
  caption.txt        optional caption draft
  removed slides/    slides taken out (kept, just in case)
  _kp/               brand styles, scripts and fonts for this post
```

Single-image posts export as `<slug>.jpg`; carousels as `<slug>-01.jpg`,
`-02`, ... in slide order, so they upload in the right order.

`post.json` can set `"sizes": "ig,fb,ig-story"` to change what this post
exports by default, `"format": "png"`, or `"quality": 92`.

## Problems the renderer reports

| Message | Meaning and fix |
| --- | --- |
| "doesn't fit" | The text is too long for its box even at the smallest size. Shorten it (best), or widen the box / lower the minimum in the slide's style. |
| "is at its smallest size" | It fits, but only just. Usually worth shortening. |
| "photo ... is missing" | The photo file isn't in the post. Add it with `photos`, or fix the name. The slide shows brand stripes where the photo should be. |
| "font ... isn't available" | The slide asks for a font the post doesn't have. `add-font` it, or change it back. |
| "blocked a request to the internet" | Something in the slide points to a web address. Slides must use local files only; replace it with a local copy. |
| "... from the edge" | Text closer to the edge than the brand's 64px safe margin. Fine for a deliberate design; otherwise move it in. |
| "never finished loading" | The slide's HTML is broken, or the `_kp/kp.js` link was removed. Undo the last edit, or `refresh` the post. |
