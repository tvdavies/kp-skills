---
name: kp-template
description: Create, change, copy, rename or retire Kirsten Photography post templates (reusable slide layouts), or turn a slide she likes into a template. Use when Kirsten wants a new layout she'll use again, wants an existing template changed for good, or asks what templates she has.
argument-hint: "[what the template should look like]"
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/kp.mjs *) Read
---

# Make or change a KP template

A template is a reusable slide layout: an HTML page plus a short description
file. The built-in ones come with the plugin and are replaced when it
updates. **Kirsten's own templates live in `~/Pictures/KP Posts/My templates`**
and survive updates. A template of hers with the same id as a built-in one
replaces it.

Talk to Kirsten about how it looks, never about code. Run the tool exactly
as `node ${CLAUDE_PLUGIN_ROOT}/scripts/kp.mjs <command>` (see
[the commands](${CLAUDE_PLUGIN_ROOT}/skills/kp-post/reference/commands.md)).
Read [the brand guide](${CLAUDE_PLUGIN_ROOT}/brand/brand-guide.md) first, and
[reference/template-anatomy.md](reference/template-anatomy.md) before writing
any template HTML.

## Ways in

- **"Save this one as a template"** (a slide she likes in a post):
  `save-template "<post>" <slide> "<Name>"`. Then fix up the description and
  field labels in its `template.json` (see below) and test it.
- **"Change the X template"** (for good): `copy-template <id> "<Name>"`
  makes her own copy. To replace the built-in one everywhere, give the copy
  the same id: `copy-template hero-quote "Hero Quote" --id hero-quote`.
  Then edit the copy.
- **"A new layout that does ..."**: sketch it in a scratch post first.
  `new "Template draft"`, `add` the closest existing template (or
  `blank-canvas`), edit that slide until she likes it, then `save-template`.

## Building and testing

1. Design at **Instagram 4:5** first, then make sure **Facebook square**
   works: everything near the bottom anchored with `bottom:`, and
   `html[data-aspect="square"]` rules for anything that needs to move.
2. Preview with real-length words, then try it with **short and long**
   words (`fill` the scratch slide with a one-word headline, then a long
   one) and with **a landscape and a portrait photo**. Read the check
   images `preview` lists each time. Fitted text (`data-fit`) must stay readable at its
   minimum.
3. Check the optional sizes too (`preview "<post>" --sizes all`, then
   `preview "<post>"` again to put her page back to the default sizes): they don't
   need to be perfect, but nothing should overlap or fall off the slide. Add
   `html[data-aspect="..."]` fixes where needed.
4. Save it, then prove it works as a template: make a fresh post, `add` the
   new template by id with sample values, preview both default sizes, and
   check no problems are reported.
5. Show Kirsten the scratch post's live preview (as in the kp-post skill:
   Browser pane, or `open "<address>"`). She can leave notes on it with
   **Comment**; read them with `notes`. Tell her the template's name so she
   can ask for it next time.

## template.json

Write it so a future Claude knows when and how to use the template:

```json
{
  "id": "spring-mini",             // folder name, lowercase-with-dashes
  "name": "Spring Mini",           // what Kirsten calls it
  "description": "What it looks like, in one sentence.",
  "bestFor": ["when to use it", "..."],
  "photos": 1,
  "photoTip": "Where faces should be so cards don't cover them.",
  "tones": { "recommended": ["cream", "sage"] },
  "fields": [
    { "key": "photo", "kind": "photo", "label": "Photo" },
    { "key": "headline", "kind": "text", "label": "Headline", "hint": "Short; shrinks to fit.", "maxLength": 30 },
    { "key": "line", "kind": "text", "label": "Small line", "optional": true }
  ],
  "sample": { "photo": "family-standing-by-lake.jpg", "headline": "Spring minis" }
}
```

(No comments in the real file; it's plain JSON.) Every `data-field` in the
HTML must be listed in `fields`, and optional fields must carry
`data-optional` in the HTML.

## Managing her templates

- List: `templates` (hers are marked "yours").
- Rename: change `name` in its `template.json`. Changing the `id` (folder
  name) is also fine; existing posts aren't affected, because each post has
  its own copy of every slide.
- Retire: move its folder from `My templates` into `My templates/Retired`
  (create it). Never delete.
- Built-in templates can't be edited in place (updates would overwrite
  them); make a copy with the same id instead, as above.

## Rules

- Same brand rules as posts: tones, Poppins and Lora, the 64px safe margin,
  no social handles, no internet links, photos with a wash, scrim or card
  under any words.
- A template needs the two `_kp` links, a `kp-slide` element with a
  `data-tone`, and a `data-field` on everything that changes per post.
- If a template needs a font other than Poppins and Lora, list the family in
  `"fonts": ["Playfair Display"]` in its `template.json` (`save-template`
  does this for fonts added with `add-font`). `add` then adds the font to
  each post automatically. The font must be bundled or in `My fonts`.
- Brand-wide changes (new tone, new default font) aren't template changes:
  see "Changing the brand" in the brand guide.
