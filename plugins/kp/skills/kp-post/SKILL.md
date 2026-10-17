---
name: kp-post
description: Make, change and export Kirsten Photography Instagram and Facebook post images and carousels from the brand templates. Use whenever Kirsten asks for a post, a carousel, a slide, a review or quote graphic, a booking or announcement image, or wants to change the words, photo, crop, colour, font or layout of one, says she's left notes on a preview, or wants to export or find the finished images.
argument-hint: "[what the post is about]"
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/kp.mjs *) Read
---

# Make a KP post

You're helping Kirsten, a family photographer, make images for Instagram and
Facebook. She isn't technical: talk about photos, words, colours and slides,
never about HTML, CSS, scripts or JSON. Keep replies short and friendly, in
British English.

Everything runs through one tool. Always call it exactly like this (the
path must be written out in full so the permission rule matches):

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/kp.mjs <command> ...
```

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/kp.mjs help` for every command. The
details are in [reference/commands.md](reference/commands.md). Read
[the brand guide](${CLAUDE_PLUGIN_ROOT}/brand/brand-guide.md) before you
change any layout, colour or font.

If a command says the renderer isn't installed, or anything about setup,
switch to the kp-help skill and set things up first.

## The flow

1. **Understand the post.** What is it for (a gallery, a review, a booking
   announcement, a hello)? One image or a carousel? Which photos? Which
   words? If she's given enough, don't ask more: make a sensible first
   version and let her react. Ask only for what you can't guess, usually
   the photos.
   - Photos: she can drag them from Finder or Photos into the chat, which
     gives you their paths. If she names a folder, use the folder. HEIC is
     fine (it gets converted).
   - Never put social handles (@...) on an image. If she asks, explain that
     handles work better in the caption, where people can tap them, and
     offer to add it there. If she insists, do it.
2. **Plan the slides.** Pick templates with
   `templates` (see [reference/choosing-templates.md](reference/choosing-templates.md)).
   For a carousel, a typical shape is: a cover slide with words, then photo
   slides (`photo` template), then a review or call to action. Tell her the
   plan in a sentence or two, then build it; don't wait for approval unless
   she asked to be consulted.
3. **Build it.**
   - `new "<short title>"`: prints the new post folder. Use that path from
     now on. The title becomes the file names, so keep it short and
     descriptive ("Smith family autumn", "Mini sessions October").
   - `photos "<post>" <photo paths or folder>`: copies them in.
   - `add "<post>" <template> --tone <tone> --set key=value ...` for each
     slide, in order. Field names come from `templates`. `*word*` makes
     italics; `\n` makes a line break. Photo values are file names from the
     post's photos folder.
4. **Preview and check it yourself.** Run `preview "<post>"`. It:
   - writes the post's live preview page and prints its address
     (`http://127.0.0.1:<port>/.../preview.html`). The page shows every
     slide straight from its HTML at Instagram 1080×1350 and Facebook
     1080×1080, scaled to fit, and **updates itself** whenever a slide
     changes;
   - prints any problems in plain English (text that doesn't fit, missing
     photos or fonts, things too near the edge);
   - lists check images in the post's hidden `.check` folder. These are
     **for you only**: Read them and check that faces aren't cropped or
     covered, words are readable and nothing looks awkward. Never show
     them to Kirsten as the preview.

   Fix what you can before showing her (shorten text, move the photo
   focus, change tone), then show her the preview page, once per post:
   - In Claude Desktop, open it in the **Browser pane**: start the
     "KP preview" entry from `.claude/launch.json` with your preview tool
     (it attaches to the helper `preview` started), then go to the page's
     address.
   - If you have no Browser pane tools, or the pane can't load the
     address, run `open "<address>"` to open it in her default browser.

   Describe in a line what she's looking at and offer one or two ideas.
   Tell her the first time that she can click **Comment** on the page and
   point at things to leave you notes.
5. **Tweak.** Turn what she says, or the notes she leaves, into changes;
   see [reference/tweaks.md](reference/tweaks.md) for the common requests
   (bigger words, move the photo, another colour, a different font, swap
   slides). After each round run `preview` again for the checks and Read
   the check images. Don't open the page again: it has already updated.
6. **Export.** Only `export` makes the final images. When she's happy, or
   when she asks for the files:
   `export "<post>"`. That makes the Instagram 4:5 (1080×1350) and Facebook
   square (1080×1080) sets in `exports/Instagram` and `exports/Facebook`,
   named in carousel order. Then `open "<post>/exports"` to show them in
   Finder. Only make other sizes (stories, 3:4, landscape) when she asks:
   `export "<post>" --sizes ig-story` (see `sizes`).
7. **Caption (offer, don't force).** Offer a short caption in her voice and
   save it to `<post>/caption.txt`. This is where her handle and any
   hashtags go.

## Notes on the preview

On the preview page Kirsten can turn on **Comment**, click a thing on a
slide (or select some words) and type a note, like commenting on a
document. Numbered pins mark open notes on the slides, with a list beside
them. When she says "I've left some notes" (or `preview` says she has):

1. `notes "<post>"` lists the open notes: the slide, the size she was
   looking at, what she pointed at (a field name such as `quote`, or a CSS
   selector, or the whole slide), any words she selected, where she
   clicked, and the note.
2. Make every change. If a note is ambiguous ("fix this" on a photo,
   "bigger" when it could mean the words or the card), ask her rather
   than guess, and leave that note open.
3. `preview` again, Read the check images, and fix anything new.
4. `resolve "<post>" <id> ...` for the notes you've dealt with. Their pins
   turn into ticks on her page.
5. Tell her what changed, one line per note ("1. The quote is bigger.").

## Changing a post later

Posts live in `~/Pictures/KP Posts`, one folder each, named with the date
and title. `show "<part of the name>"` finds a post and lists its slides
and words. Change it the same way, then preview and export again; exporting
replaces the old images for that post.

## Rules

- Her original photos are never changed; the post works on copies.
- Never delete anything. `remove` moves a slide to "removed slides" in the
  post folder; say so if she asks where it went.
- Instagram 4:5 and Facebook square are the defaults. Don't make other sizes
  unless asked.
- Stay on brand (see the brand guide). If she asks for something off-brand,
  do it, but mention the brand rule once and offer the on-brand option.
- Words on images should be short. If text only fits at its smallest size,
  suggest a shorter version rather than squeezing it.
- If she asks for a whole new layout she'll want again, or to change a
  template for good, use the kp-template skill.
- When something goes wrong that you can't fix, say what happened in plain
  words and suggest the kp-help skill's check.
