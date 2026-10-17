# Output sizes

Defaults (made for every post):

- **Instagram feed, 4:5 portrait: 1080×1350.** The tallest feed shape that
  has been standard for years, and the one the old app designed for.
- **Facebook feed, 1:1 square: 1080×1080.** Shown uncropped in the Facebook
  feed and on the page grid.

Optional (only when asked): Instagram 1:1, 3:4 (1080×1440), 1.91:1
landscape (1080×566), stories/reel covers 9:16 (1080×1920); Facebook 4:5,
9:16 and 1.91:1 (1200×630). `node ${CLAUDE_PLUGIN_ROOT}/scripts/kp.mjs sizes`
lists the ids.

Notes:

- Instagram's own help says photos are shared at up to 1080 pixels wide, in
  portrait shapes down to 4:5 (and 3:4 in newer versions of the app);
  anything wider than 1080 is downscaled. Source:
  https://help.instagram.com/1631821640426723/
- Keep a carousel one shape throughout; mixed shapes get cropped by the
  app. Exports always produce a full set per size.
- The 3:4 option is there because newer versions of Instagram accept it.
  Only use it if Kirsten asks: 4:5 is the agreed default.
- JPEG at quality 95 in sRGB is the default; PNG is available for slides
  that are mostly flat colour and type, at the cost of bigger files.
