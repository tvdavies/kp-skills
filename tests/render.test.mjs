// Rendering checks. These need the pinned Playwright + Chromium:
//   npm run setup:dev     (installs it into plugins/kp/runtime)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PLUGIN, hasRuntime, tempPosts, kp } from './helpers.mjs';
import { imageSize } from '../plugins/kp/scripts/lib/image-size.mjs';

const skip = hasRuntime() ? false : 'renderer not installed (run npm run setup:dev)';
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const listJpgs = (dir) => fs.readdirSync(dir).filter((f) => /\.(jpg|png)$/.test(f)).sort();

test('every template renders at every size with exact dimensions and no problems', { skip, timeout: 240000 }, () => {
  const root = tempPosts();
  const out = kp(root, 'gallery', '--out', root, '--sizes', 'all');
  assert.match(out, /All slides rendered cleanly/, out);
  const post = path.join(root, 'gallery Template gallery');
  const sizes = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'sizes.json'), 'utf8')).sizes;
  const count = fs.readdirSync(path.join(post, 'slides')).length;
  assert.ok(count >= 9);
  for (const s of sizes) {
    const dir = path.join(post, 'previews', s.folder);
    const files = listJpgs(dir);
    assert.equal(files.length, count, s.id);
    for (const f of files) {
      const d = imageSize(path.join(dir, f));
      assert.deepEqual([d.width, d.height], [s.width, s.height], `${s.id} ${f}`);
    }
    assert.ok(fs.existsSync(path.join(post, 'previews', `${s.folder} contact sheet.jpg`)));
  }
});

test('exports go to Instagram and Facebook folders with carousel names, replacing old exports', { skip, timeout: 120000 }, () => {
  const root = tempPosts();
  const post = kp(root, 'example', 'autumn-minis');
  assert.ok(post.startsWith(root));
  kp(root, 'export', post);
  const ig = path.join(post, 'exports', 'Instagram');
  const fb = path.join(post, 'exports', 'Facebook');
  assert.deepEqual(listJpgs(ig), [1, 2, 3, 4, 5].map((n) => `autumn-mini-sessions-0${n}.jpg`));
  assert.deepEqual(listJpgs(fb), listJpgs(ig));
  const igSize = imageSize(path.join(ig, 'autumn-mini-sessions-01.jpg'));
  const fbSize = imageSize(path.join(fb, 'autumn-mini-sessions-01.jpg'));
  assert.deepEqual([igSize.width, igSize.height], [1080, 1350]);
  assert.deepEqual([fbSize.width, fbSize.height], [1080, 1080]);
  assert.ok(!fs.existsSync(path.join(post, 'exports', 'Instagram story')), 'optional sizes are not exported by default');

  // Removing a slide and exporting again leaves no stale file behind.
  kp(root, 'remove', post, '3');
  kp(root, 'export', post);
  assert.deepEqual(listJpgs(ig), [1, 2, 3, 4].map((n) => `autumn-mini-sessions-0${n}.jpg`));
  assert.equal(fs.readdirSync(path.join(post, 'removed slides')).length, 1);

  // PNG on request, and an optional size only when asked.
  kp(root, 'export', post, '--sizes', 'ig-story', '--format', 'png');
  const story = path.join(post, 'exports', 'Instagram story');
  assert.equal(listJpgs(story).length, 4);
  assert.deepEqual(imageSize(path.join(story, 'autumn-mini-sessions-01.png')), { type: 'png', width: 1080, height: 1920 });
});

test('rendering is deterministic: the same post gives identical files', { skip, timeout: 120000 }, () => {
  const root = tempPosts();
  const post = kp(root, 'example', 'newborn-announcement');
  kp(root, 'export', post);
  const dir = path.join(post, 'exports', 'Instagram');
  const first = listJpgs(dir).map((f) => sha(path.join(dir, f)));
  kp(root, 'export', post);
  const second = listJpgs(dir).map((f) => sha(path.join(dir, f)));
  assert.deepEqual(second, first);
});

test('problems are reported in plain English: missing photo, text too long, internet fonts', { skip, timeout: 120000 }, () => {
  const root = tempPosts();
  const post = kp(root, 'new', 'Problem post');
  kp(root, 'add', post, 'hero-quote', '--set', 'photo=', '--set', 'headline=Short');
  kp(root, 'add', post, 'split-quote', '--set', `quote=${'Far too many words for this little box. '.repeat(12)}`, '--set', 'name=A very long client name that will not fit on one line at all');
  // Someone pastes in a web font: it must be blocked and reported, not fetched.
  const slide = path.join(post, 'slides', '01-hero-quote.html');
  fs.writeFileSync(slide, fs.readFileSync(slide, 'utf8').replace('</head>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">\n</head>'));
  const out = kp(root, 'preview', post);
  assert.match(out, /Slide 1.*photo "photo" is missing/);
  assert.match(out, /Slide 1.*blocked a request to the internet/);
  assert.match(out, /Slide 2.*"quote" doesn't fit/);
  assert.match(out, /Slide 2.*"name" doesn't fit/);
  assert.doesNotMatch(out, /All slides rendered cleanly/);
});

test('slides can be added, filled, moved and duplicated', { skip, timeout: 60000 }, () => {
  const root = tempPosts();
  const post = kp(root, 'new', 'Editing post');
  const photo = path.join(PLUGIN, 'examples', 'photos', 'baby-s-feet.jpg');
  kp(root, 'photos', post, photo);
  kp(root, 'add', post, 'review-card', '--tone', 'balsam', '--set', 'quote=Lovely.', '--set', 'name=Sam');
  kp(root, 'add', post, 'photo', '--at', '1', '--set', 'photo=baby-s-feet.jpg');
  kp(root, 'fill', post, '2', '--json', JSON.stringify({ stars: 4, quote: 'Really *lovely*.' }));
  kp(root, 'duplicate', post, '1');
  kp(root, 'move', post, '3', '1');
  const show = JSON.parse(kp(root, 'show', 'Editing', '--json'));
  assert.deepEqual(show.slides.map((s) => s.template), ['review-card', 'photo', 'photo']);
  assert.equal(show.slides[0].tone, 'balsam');
  const fields = Object.fromEntries(show.slides[0].fields.map((f) => [f.key, f.value]));
  assert.equal(fields.quote, 'Really *lovely*.');
  assert.equal(fields.stars, '4');
  assert.equal(show.slides[1].fields.find((f) => f.key === 'photo').value, '../photos/baby-s-feet.jpg');
  const out = kp(root, 'preview', post);
  assert.match(out, /All slides rendered cleanly/, out);
});

test('fonts can be added to a post and Kirsten can save her own templates', { skip, timeout: 60000 }, () => {
  const root = tempPosts();
  const post = kp(root, 'new', 'Font post');
  assert.match(kp(root, 'add-font', post, 'Playfair Display'), /Added Playfair Display/);
  const css = fs.readFileSync(path.join(post, '_kp', 'fonts-extra.css'), 'utf8');
  assert.match(css, /font-family: "Playfair Display"; font-style: normal; font-weight: 400 900/);
  assert.ok(fs.existsSync(path.join(post, '_kp', 'fonts', 'extra', 'Playfair Display', 'OFL.txt')));
  kp(root, 'add', post, 'review-card', '--set', 'quote=Hello', '--set', 'name=Sam');
  const slide = path.join(post, 'slides', '01-review-card.html');
  fs.writeFileSync(slide, fs.readFileSync(slide, 'utf8').replace('</style>', '.review-card .quote { font-family: "Playfair Display"; }\n</style>'));
  const out = kp(root, 'preview', post);
  assert.match(out, /All slides rendered cleanly/, out);

  assert.match(kp(root, 'save-template', post, '1', 'Playfair review'), /Saved as "Playfair review" \(playfair-review\)/);
  const list = JSON.parse(kp(root, 'templates', '--json'));
  const mine = list.find((t) => t.id === 'playfair-review');
  assert.equal(mine.source, 'mine');
  assert.ok(mine.fields.some((f) => f.key === 'quote'));
  assert.deepEqual(mine.fonts, ['Playfair Display']);
  // A post made from the saved template gets the extra font automatically.
  const post2 = kp(root, 'new', 'Uses my template');
  kp(root, 'add', post2, 'playfair-review');
  assert.match(kp(root, 'preview', post2), /All slides rendered cleanly/);
  // Without the font, the renderer says so.
  fs.writeFileSync(path.join(post2, '_kp', 'fonts-extra.css'), '');
  assert.match(kp(root, 'preview', post2), /font "Playfair Display" isn't available/);
});

test('doctor passes', { skip, timeout: 120000 }, () => {
  const root = tempPosts();
  const out = execFileSync(process.execPath, [path.join(PLUGIN, 'scripts', 'doctor.mjs')], { env: { ...process.env, KP_POSTS: root }, encoding: 'utf8' });
  assert.match(out, /✓ Test render: 4 images \(1080×1350, 1080×1080\)/, out);
  assert.match(out, /All good/);
});
