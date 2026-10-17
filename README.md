# kp-skills

Claude skills for Kirsten Photography: on-brand Instagram and Facebook post
images and carousels, made on the Mac by asking Claude in Claude Desktop's
**Code** tab. It replaces the `kp-templates` web app.

Kirsten asks for a post in plain English ("a carousel of the Smith session
with *Autumn light* on the cover"). Claude picks a template, fills in her
words and photos, checks the layout, and shows her a **live preview page**
in Claude Desktop's Browser pane (or her browser). The page shows every
slide straight from its HTML at the exact output sizes and updates itself as
Claude makes changes. She can switch on **Comment**, click something on a
slide (or select words) and leave a note; Claude reads the notes, makes the
changes and marks them done. When she's happy, Claude exports the finished
images to Finder:

- **Instagram 4:5**, 1080×1350, and **Facebook square**, 1080×1080, by default
- stories, 3:4 and landscape sizes only when she asks
- carousels named in order (`smith-family-autumn-01.jpg`, `-02`, ...)

Everything renders locally and offline with a pinned headless Chromium. No
photos leave the Mac.

## Install (Kirsten's Mac)

See **[docs/mac-setup.md](docs/mac-setup.md)** for the step-by-step guide.
In short:

1. In Claude Desktop, open the **Code** tab, choose the folder
   `~/Pictures/KP Posts` (make it first if needed), then
   **+ → Plugins → Add plugin**, and add the marketplace `tvdavies/kp-skills`.
2. Install the **kp** plugin.
3. Ask Claude: "Set up the KP post tools." It runs `setup.sh`, which installs
   Node (via Homebrew, if missing) and the pinned renderer into
   `~/.kp-skills`, then checks everything with a test render.

## What's in the box

```
.claude-plugin/marketplace.json    the marketplace (one plugin: kp)
plugins/kp/
  .claude-plugin/plugin.json
  skills/
    kp-post/        make, change and export posts (plus reference docs)
    kp-template/    make or change templates
    kp-help/        set-up, checks, troubleshooting
  brand/
    brand.css       tokens: tones, type, spacing, photo treatments, fonts
    kp.js           in-page runtime: sizing, text fitting, readiness, checks
    brand-guide.md  the rules
  templates/<id>/template.html + template.json   10 templates
  fonts/            Poppins and Lora (brand) plus a small free library, with OFL licences
  sizes.json        output sizes; ig + fb are the defaults
  scripts/kp.mjs    the command-line tool the skills drive
  scripts/doctor.mjs  plain-English health check
  runtime/          pinned Playwright version (package.json + lock)
  setup.sh          Mac set-up
  examples/         three example posts and CC0 photos (with credits)
tests/              node:test suite
```

### Templates

Ported from kp-templates, with social handles removed: Hero Quote, Bottom
Banner, Top Block, Diagonal Slab, Sticker Card, Split Quote, Review Card,
Photo Overlay and Blank Canvas, plus a new **Photo** slide for the picture
slides of a carousel. Every template lays out for 4:5 and square, with
adjustments for the optional sizes.

Kirsten's own templates go in `~/Pictures/KP Posts/My templates`, so they
survive plugin updates. One with the same id as a built-in template
replaces it.

### Posts

```
~/Pictures/KP Posts/2026-10-17 Smith family autumn/
  photos/  slides/  preview.html  notes.json  exports/Instagram/  exports/Facebook/
  _kp/  post.json  .check/ (Claude's check images)
```

### Live preview and notes

`kp.mjs preview <post>` writes the post's `preview.html` and starts a small
preview server from `kp.mjs` in the background on 127.0.0.1 (a free port;
it stops after four idle hours). The server serves only the posts folder,
answers only `127.0.0.1`/`localhost` host names, and accepts note writes
only from its own origin. It keeps a "KP preview" entry in
`KP Posts/.claude/launch.json` so the Desktop Browser pane can attach to
it. Notes are saved to `<post>/notes.json`; `kp.mjs notes` and
`kp.mjs resolve` read and close them. Only `export` makes images for
Kirsten. `preview` also lays the slides out headlessly to report problems,
with check images in the hidden `.check/` folder for Claude to look at.

This is built locally rather than with Claude artifacts: a published
artifact would need every photo embedded under a size cap and uploaded to
claude.ai, and its comment-to-session loop is documented only for
Team/Enterprise sharing.

Each post keeps its own copy of the brand files and fonts in `_kp/`, so a
plugin update never changes a post that's already made.

## Development

```bash
npm run setup:dev     # pinned Playwright + Chromium into plugins/kp/runtime
npm test              # 40 tests; the rendering tests need setup:dev
npm run gallery       # every template at every size into .gallery/ (check images in .check/)
npm run doctor
npm run validate      # claude plugin validate
node plugins/kp/scripts/kp.mjs help
```

Set `KP_POSTS=/tmp/somewhere` to keep test posts out of `~/Pictures`.

### Releasing

The plugin's `version` in `plugins/kp/.claude-plugin/plugin.json` controls
updates: Claude Desktop updates Kirsten's copy when the version changes.
Bump it when releasing. When you bump Playwright in
`plugins/kp/runtime/package.json`, regenerate the lock file; the doctor then
tells her to re-run set-up, which installs the new pinned version.

## Licences

Fonts are under the SIL Open Font License 1.1 (each family's `OFL.txt` is
next to its files). Example photos are CC0; see
`plugins/kp/examples/photos/CREDITS.md`.
