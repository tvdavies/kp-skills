# Kirsten Photography brand guide (for post images)

This is the rulebook for every slide the kp plugin makes. The values are in
`brand.css`; this guide says how to use them. It was distilled from the
templates in Tom's kp-templates app (October 2026), so the look carries over.

When a request would break a rule here, do what Kirsten asks, but say once,
briefly, which rule it bends and offer the on-brand alternative.

## The feel

Warm, calm, editorial. Soft paper colours, generous space, one or two type
voices per slide, and the photo always comes first. Nothing shouts: no pure
black, no pure white backgrounds, no neon, no drop-shadowed headlines on flat
colour, no clip art.

## Colour

### Tones

Every slide has one **tone**, set with `data-tone` on the slide. A tone is
four colours that work together:

| Tone | Ground (`--tone-bg`) | Ink (`--tone-ink`) | Soft (`--tone-soft`) | Stripe (`--tone-stripe`) | Ink contrast |
| --- | --- | --- | --- | --- | --- |
| cream (default) | `#F3EBDE` | `#3A2E27` | `#E4D3BE` | `#C9B79A` | 11.1:1 |
| sand | `#E4D3BE` | `#3A2E27` | `#D4BFA3` | `#B8A285` | 9.0:1 |
| rosette | `#C98871` | `#3A2017` | `#D8A291` | `#B4725C` | 5.2:1 |
| sage | `#A6B49A` | `#2E3A2A` | `#B7C2AC` | `#8FA083` | 5.5:1 |
| balsam | `#5E6E5C` | `#F3EBDE` | `#7A8878` | `#4C5B4A` | 4.6:1 |
| sienna | `#B56B4A` | `#F3EBDE` | `#C48364` | `#9A5938` | 3.4:1 |

- **Ground** fills the slide, banners, cards, slabs and stickers.
- **Ink** is the colour of all type on the ground.
- **Soft** is for secondary surfaces (a second card, a panel behind a panel).
- **Stripe** is only for the empty-photo placeholder pattern.

Rules:

- Cream and sand are the everyday tones. Rosette and sage are accents: use
  them for a slide that should stand out, or one per carousel. Balsam and
  sienna are dark and strong: sparingly, for type-only slides.
- Sienna's ink contrast (3.4:1) is fine for large type but weak for small
  print. On sienna keep text at 28px or bigger and avoid long body copy.
- In a carousel, keep to two tones at most, and use the same tone for slides
  of the same kind (all reviews sage, say).
- On photos, the templates use the tone's ground colour for the words (Hero
  Quote), so pick a light tone (cream, sand) when words sit on a photo.

### Other colours

- `--kp-ink` `#3A2E27`: warm near-black. Use instead of black, always.
- White only for pills (`rgba(255,255,255,0.92)`) and small text on photos
  (with a shadow).
- No other colours. If Kirsten wants a new colour, add it as a new tone with
  all four roles (see *Changing the brand* below) rather than a one-off hex.

## Type

Two families, both bundled and both free (SIL Open Font License):

- **Poppins**, a geometric sans: labels, headlines with weight, body, names.
- **Lora**, a serif, mostly *italic*: quotes, emotional headlines, signatures.

Raleway is also bundled (it was the old app's display face) along with a
small library of other free fonts, for when Kirsten wants to try something
else. Add them to a post with `add-font`. Only Poppins and Lora are brand
fonts; anything else is an experiment until it's been used on purpose.

### Roles

Sizes are in design pixels on a 1080-wide slide.

| Role | Class | Font | Size | Notes |
| --- | --- | --- | --- | --- |
| Eyebrow / kicker | `kp-eyebrow` | Poppins 600, capitals | 24–30 | Letter-spacing 6px, 60–70% opacity. Often starts with an em dash: "— Kind words". |
| Display headline / quote | `kp-display` | Lora italic 500 | 56–128, fitted | Line height ~1.0–1.18, tracking −0.02em. |
| Bold headline | `kp-headline` | Poppins 600 | 52–96, fitted | Line height ~0.95, tight tracking (−0.03em). |
| Mixed headline | `kp-headline` + `<em>` | Poppins 600 then Lora italic | | Plain words first, the emotional tail in italics: "New work *is live.*" |
| Body / caption | `kp-body` | Poppins 400 | 28–32 | Line height 1.3, 75–80% opacity. Two lines at most. |
| Client name | `kp-name` | Poppins 600 | 24–28 | |
| Detail | `kp-detail` | Poppins 400 | 20–22 | 65–70% opacity. "Occasion · year" with a middle dot. |
| Signature | `kp-signature` | Lora italic 500 | 30–34 | 75% opacity, right-aligned. |
| Pill label | `kp-pill` | Poppins 600, capitals | 24–26 | Letter-spacing 3px, on a white or tone pill. |

Rules:

- At most two type roles that compete for attention per slide (one headline,
  one supporting line). Everything else is small.
- Headlines and quotes are fitted: they shrink to fit their box, between a
  minimum and maximum size. If text only fits at the minimum, shorten it.
- Nothing smaller than 20px on a 1080 slide: it's unreadable on a phone.
- Use real typography: curly quotes (“ ” ‘ ’), apostrophes (’), en dashes
  for ranges (9–5), em dashes for eyebrows, a middle dot (·) between details,
  the arrow (→) for calls to action.
- British English, sentence case, no exclamation marks in headlines.

## Space and layout

- Outer margin: **72px** for text and inset photos (80px on type-only
  slides, 90px for centred hero text). Corner pills sit **56px** in.
- **Safe zone:** no text within **64px** of any edge. The renderer warns
  when something gets closer than 40px.
- Cards and stickers: **52px** inner padding.
- Elements near the bottom are anchored to the bottom, so a layout works in
  4:5 (1350 tall) and square (1080 tall) without moving things by hand.
- Stories (9:16): keep text out of the top 220px and bottom 250px, where
  Instagram puts its own controls.
- Square corners on cards, banners and photos; fully rounded pills. No other
  radii.
- Tilts are small and only on floating cards: −2.5° (sticker), −1.5° (quote
  card). Never tilt text on its own.

## Photos

- Photos are the point. Use one photo per slide; no collages in this version.
- Text never sits on a bare photo. Use one of:
  - the **wash** (`kp-wash`, 35% black) for centred words over a photo,
  - the **bottom scrim** (`kp-scrim-bottom`) under a slab or caption,
  - the **ends scrim** (`kp-scrim-ends`) when there are things at the top and bottom,
  - or put the words on a tone card, banner or slab.
- Crop with focus, not by editing the photo: `--focus-x` / `--focus-y`
  (0–100%) pick the point that stays in view; `--zoom` (1 = fill) pushes in.
  Faces should never be cut by the slide edge or covered by a card.
- Kirsten's photos are copied into the post and never changed. The renderer
  doesn't recolour or retouch photos.
- Inset photos get a faint shadow (`--kp-photo-shadow`); full-bleed photos
  get none.

## Handles, logos and signatures

- **No social handles on images.** Not @iamkirstenphotography, not anyone
  else's. Handles go in the caption, where they're clickable.
- No logo in this version; if Kirsten wants one, Tom will add it as a brand
  asset rather than a pasted image.
- A signature ("Kirsten x") is fine where a template has a signature field.

## Sizes

| Output | Pixels | When |
| --- | --- | --- |
| Instagram feed 4:5 | 1080×1350 | **Default.** Every post. |
| Facebook feed 1:1 | 1080×1080 | **Default.** Every post. |
| Instagram 1:1, 3:4, 1.91:1; stories 9:16; Facebook 4:5, 9:16, 1.91:1 | see `kp.mjs sizes` | Only when Kirsten asks. |

Every slide in a carousel must be the same size; the renderer does this by
exporting each size as a full set.

## Changing the brand

A change for one post goes in that post's slide files. A change Kirsten
wants on every post from now on (a new tone, a different headline font) is a
brand change: it belongs in this plugin, which Tom maintains in the
`tvdavies/kp-skills` repository, because the installed plugin is replaced on
every update. Claude should add the request, with the exact values, to
`KP Posts/Brand requests.md` for Tom, and meanwhile apply it to the current
post or save a template in `My templates`.

In the repository: brand values live in `brand/brand.css`, the rules in this
guide, and the layouts in `templates/`. A post keeps the brand files it was
made with until someone runs `refresh` on it. To add a tone, add a
`[data-tone="name"]` rule with all four roles to `brand.css` and a row to the
table above, and check the ink contrast is at least 4.5:1 for small text.
