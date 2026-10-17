---
name: kp-help
description: Set up, check and fix the Kirsten Photography post tools on this Mac, and explain what they can do. Use the first time, when Kirsten asks to set things up or what she can make, when a kp command says the renderer isn't installed, when images won't render or look wrong, after an update, or when she asks where her posts are.
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/kp.mjs *) Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs *) Bash(bash ${CLAUDE_PLUGIN_ROOT}/setup.sh *) Read
---

# KP help: set-up, checks and fixes

Kirsten isn't technical. Explain in a sentence what you're about to do and
why, then do it. Keep jargon out: "the image renderer", "your posts
folder", "the check".

## Setting up (first time, or after a problem)

1. Run the check: `node ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs`
2. If anything is ✗, run the set-up:
   `bash ${CLAUDE_PLUGIN_ROOT}/setup.sh`
   It installs Node (with Homebrew) if missing, downloads the pinned image
   renderer once (about 250 MB, a few minutes) into `~/.kp-skills`, creates
   `~/Pictures/KP Posts`, then runs the check again. It's safe to re-run.
   Tell her it may take a few minutes the first time.
3. If the set-up can't install Node because Homebrew is missing, or
   anything asks for a password, stop and say Tom will sort it; give her
   the exact message to pass on.
4. When the check says "All good", offer to make a first post, or to make
   an example (`node ${CLAUDE_PLUGIN_ROOT}/scripts/kp.mjs example autumn-minis`,
   then `export` it and `open` the exports folder) so she can see the
   results.

## What she can do (when she asks)

- Make a post or carousel from her photos: "Make a carousel of the Smith
  family session with a cover that says *Autumn light*." (kp-post)
- Change anything by asking: words, which photo, the crop, the colour,
  the font, the order of slides, bigger or smaller text.
- Get the finished images in Finder, already sized for Instagram (4:5) and
  Facebook (square), named in carousel order. Stories or other sizes when
  she asks.
- Save a layout she likes as her own template, or ask for a new one
  (kp-template).
- Watch the post change as Claude works, in a live preview page, and point
  at things on it to leave notes (**Comment**), instead of describing where
  they are.
- See all the templates: run `gallery` and show her the preview address it
  prints.

## Where things are

- Posts: `~/Pictures/KP Posts/<date> <title>/`. Finished images are in its
  `exports/Instagram` and `exports/Facebook` folders.
  `open ~/Pictures/KP\ Posts` shows them in Finder.
- Her templates: `~/Pictures/KP Posts/My templates`. Her fonts:
  `~/Pictures/KP Posts/My fonts` (she can drop .ttf/.otf files there).
- The renderer: `~/.kp-skills/runtime`. Safe to delete; the set-up
  reinstalls it.
- Each post's `preview.html` is the live preview, and `notes.json` holds
  her notes. The preview helper's details are in `KP Posts/.kp` and
  `KP Posts/.claude/launch.json` (both managed by the plugin).

## Fixing problems

| Symptom | Fix |
| --- | --- |
| "The image renderer isn't installed yet" | Run the set-up. |
| "version X installed, this plugin needs Y" (after a plugin update) | Run the set-up; it installs the new pinned version. |
| "The renderer's browser wouldn't start" | Run the set-up. If it still fails, run the check and pass its output to Tom. |
| A slide "never finished loading" | Its HTML was broken by an edit. Undo the last change to that slide, or `refresh` the post. |
| Fonts look wrong / "font isn't available" | `add-font` the family to that post, or `refresh` the post. |
| The preview page says "Not live" | The preview helper stopped (it stops after four idle hours). Run `preview` on the post again; the page reconnects by itself. |
| The Browser pane won't show the preview | `open "<address>"` opens it in her default browser instead; everything works the same there. |
| The preview page is blank or out of date | Run `preview` on the post again. If it's still wrong, `stop-preview`, then `preview`. |
| Text cut off or overlapping | `preview` the post and read its problem list; usually shorter words or a smaller `data-fit` minimum. |
| An old post looks different after an update | It shouldn't: each post keeps its own brand files. If she wants the new look, `refresh` that post, then preview. |
| Claude keeps asking permission to run commands | When it asks to run a `node .../kp.mjs` command, choose the option to always allow it; it won't ask again for those. |
| Can't see or save files in Pictures | macOS may be blocking Claude from Pictures: System Settings → Privacy & Security → Files and Folders → Claude → Pictures on. |

## Updates

With auto-update turned on for the kp-skills marketplace (Tom's set-up does
this), the plugin updates from Tom's GitHub repository when a session
starts, and the new version is used from the next session. If an update
brings a new renderer version, the next command says so; run the set-up.
Posts already made aren't changed by updates.

## Getting Tom's help

If something can't be fixed here, run the check, then write a short note
for Tom in `~/Pictures/KP Posts/Notes for Tom.md`: what she was doing, what
happened, and the check's output. Tell her the note is there.
