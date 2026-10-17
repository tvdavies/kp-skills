# Choosing templates

Run `templates` for the up-to-date list, including any of Kirsten's own
(hers come first and win when names clash). To see them all with sample
content, run `gallery` and open the contact sheets.

| Template | Looks like | Use it for |
| --- | --- | --- |
| `photo` | Just the photo, edge to edge. | The picture slides of a carousel; a single photo post. |
| `hero-quote` | Photo under a soft dark wash; big centred italic words; a small capitals line. | A carousel cover; a mood line ("Slow mornings."). |
| `bottom-banner` | Photo top two-thirds; tone banner below with "Plain words *italic tail*" and a caption. | New gallery or blog post; booking news. |
| `top-block` | Tone header with eyebrow and big serif headline; framed photo below. | Series or theme covers; when words shouldn't touch the photo. |
| `diagonal-slab` | Photo with an angled tone slab bottom-left (kicker + bold headline) and a pill top-right. | Offers, mini sessions, "Now booking". |
| `sticker-card` | Photo with a tilted tone "sticker" card, a pill label and a small call to action. | Introducing Kirsten; behind the scenes; friendly hellos. |
| `split-quote` | Client portrait on the left; tone panel on the right with quote, stars and names. | A review with the client's photo. |
| `photo-overlay` | Photo with a tilted quote card along the bottom and a stars pill. | A review over the client's own photo. |
| `review-card` | Type only: eyebrow, stars, big italic quote, name, signature. | A review without a photo; the words slide after photo slides. |
| `blank-canvas` | An empty tone background. | Something new; build it by hand from the brand pieces (see the kp-template skill). |

## Carousel recipes

- **Gallery sneak peek:** `hero-quote` or `top-block` cover, 4–8 `photo`
  slides, optional `review-card` or `bottom-banner` with "Full gallery: link
  in bio".
- **Booking announcement:** `diagonal-slab` cover ("Now booking / Autumn
  minis."), 2–3 `photo` slides, a `review-card`, then a `bottom-banner`
  with dates and how to book.
- **Review:** single `photo-overlay` or `split-quote`; or a two-slide
  carousel of `photo` then `review-card`.
- **Hello / about me:** `sticker-card`, then `photo` slides of her at work.

Instagram carousels take up to 20 slides; 5–10 is the sweet spot. Every
slide in a carousel exports at the same size automatically.

## Photo fit by template

- Full-bleed templates (`photo`, `hero-quote`, `diagonal-slab`,
  `sticker-card`, `photo-overlay`) crop a landscape photo heavily in 4:5;
  portrait photos work best. Use `focusX`/`focusY` to keep faces in.
- `split-quote` has a tall narrow frame: portrait photos, focus on faces.
- `top-block` and `bottom-banner` frames are close to square or wider:
  landscape photos are fine.
- Keep faces away from where cards and slabs sit (each template's
  `photoTip` in `templates --json` says where).
