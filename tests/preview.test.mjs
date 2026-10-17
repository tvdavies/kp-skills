// The live preview page, its local helper server, and Kirsten's notes.
// These don't need the renderer: preview --no-check only writes the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { tempPosts, kp } from './helpers.mjs';

/** A raw request, so tests can set the Host and Origin headers. */
function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function setup() {
  const root = tempPosts();
  kp(root, 'init');
  const post = kp(root, 'new', 'Notes test');
  kp(root, 'add', post, 'review-card', '--set', 'quote=Lovely words.');
  kp(root, 'add', post, 'photo');
  return { root, post };
}

test('preview writes a live page for every slide at the default sizes, and renders no images', async () => {
  const { root, post } = setup();
  try {
    const out = kp(root, 'preview', post, '--no-check');
    const url = out.match(/http:\/\/127\.0\.0\.1:\d+\/\S+preview\.html/)?.[0];
    assert.ok(url, out);
    const html = fs.readFileSync(path.join(post, 'preview.html'), 'utf8');
    const data = JSON.parse(html.match(/<script id="kp-data" type="application\/json">(.*?)<\/script>/s)[1]);
    assert.deepEqual(data.slides.map((s) => s.file), ['slides/01-review-card.html', 'slides/02-photo.html']);
    assert.deepEqual(data.sizes.map((s) => [s.id, s.width, s.height]), [['ig', 1080, 1350], ['fb', 1080, 1080]]);
    assert.match(html, /render=1/);
    assert.match(html, /Comment/);
    // Only export makes images.
    assert.deepEqual(fs.readdirSync(path.join(post, 'exports')), []);
    assert.ok(!fs.existsSync(path.join(post, '.check')));
    assert.ok(!fs.existsSync(path.join(post, 'previews')));

    // The helper serves the page and the slides, and reports slide changes.
    assert.equal((await request(url)).status, 200);
    const base = new URL(url).origin;
    const slide = await request(`${base}${new URL(url).pathname.replace('preview.html', 'slides/01-review-card.html')}`);
    assert.equal(slide.status, 200);
    assert.match(slide.text, /Lovely words/);
    const stateUrl = `${base}/__kp/state?page=${encodeURIComponent(new URL(url).pathname)}`;
    const before = JSON.parse((await request(stateUrl)).text);
    assert.equal(before.slides.length, 2);
    await new Promise((r) => setTimeout(r, 20));
    kp(root, 'fill', post, '1', '--set', 'quote=Changed words, a bit longer.');
    const after = JSON.parse((await request(stateUrl)).text);
    assert.notEqual(after.slides[0].stamp, before.slides[0].stamp);
    assert.equal(after.slides[1].stamp, before.slides[1].stamp);

    // Nothing outside the posts folder, and only this machine's addresses.
    assert.equal((await request(`${base}/..%2f..%2fetc%2fpasswd`)).status, 403);
    assert.equal((await request(url, { headers: { Host: 'evil.example:80' } })).status, 403);

    // The Desktop Browser pane can attach to it.
    const launch = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'launch.json'), 'utf8'));
    const entry = launch.configurations.find((c) => c.name === 'KP preview');
    assert.equal(entry.url, base);
    assert.equal(entry.port, Number(new URL(base).port));

    // Previewing again reuses the same helper.
    assert.ok(kp(root, 'preview', post, '--no-check').includes(base));
  } finally {
    kp(root, 'stop-preview');
  }
});

test('a note posted from the preview page is saved to notes.json, and notes/resolve work', async () => {
  const { root, post } = setup();
  try {
    const url = new URL(kp(root, 'preview', post, '--no-check').match(/http:\/\/127\.0\.0\.1:\d+\/\S+preview\.html/)[0]);
    const note = {
      page: url.pathname, slide: 'slides/01-review-card.html', slideNumber: 1, size: 'ig',
      field: 'quote', selector: null, selectedText: 'Lovely', note: 'Can this be bigger?', x: 0.5, y: 0.42,
    };
    const post_ = (body, headers = {}) => request(`${url.origin}/__kp/notes`, {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', Origin: url.origin, ...headers },
    });
    // Other websites can't write notes.
    assert.equal((await post_(note, { Origin: 'https://example.com' })).status, 403);
    assert.ok(!fs.existsSync(path.join(post, 'notes.json')));

    const r = await post_(note);
    assert.equal(r.status, 201, r.text);
    const second = await post_({ ...note, slide: 'slides/02-photo.html', slideNumber: 2, field: null, selector: '.kp-slide', selectedText: null, note: 'Show more of the sky' });
    assert.equal(second.status, 201);
    assert.equal((await post_({ ...note, slide: '../../etc/passwd' })).status, 400);

    const saved = JSON.parse(fs.readFileSync(path.join(post, 'notes.json'), 'utf8')).notes;
    assert.equal(saved.length, 2);
    assert.deepEqual(
      { id: saved[0].id, slide: saved[0].slide, size: saved[0].size, field: saved[0].field, selectedText: saved[0].selectedText, note: saved[0].note, status: saved[0].status },
      { id: 1, slide: 'slides/01-review-card.html', size: 'ig', field: 'quote', selectedText: 'Lovely', note: 'Can this be bigger?', status: 'open' },
    );
    assert.ok(Date.parse(saved[0].created));
    assert.equal(saved[1].selector, '.kp-slide');

    // The page sees open notes.
    const state = JSON.parse((await request(`${url.origin}/__kp/state?page=${encodeURIComponent(url.pathname)}`)).text);
    assert.equal(state.notes.open.length, 2);

    // Claude reads them...
    const list = kp(root, 'notes', post);
    assert.match(list, /#1 slide 1 \(slides\/01-review-card\.html\), seen at ig, on "quote"/);
    assert.match(list, /selected: "Lovely"/);
    assert.match(list, /note: Can this be bigger\?/);
    assert.match(list, /#2 slide 2/);
    assert.match(kp(root, 'preview', post, '--no-check'), /She has left 2 notes/);

    // ...notes follow their slide when slides move...
    kp(root, 'move', post, '2', '1');
    const moved = JSON.parse(kp(root, 'notes', post, '--json'));
    assert.equal(moved.find((n) => n.id === 2).slide, 'slides/01-photo.html');
    assert.equal(moved.find((n) => n.id === 1).slide, 'slides/02-review-card.html');

    // ...and marks them done.
    assert.match(kp(root, 'resolve', post, '1'), /Marked done: #1\.\n1 note still open\./);
    assert.match(kp(root, 'resolve', post, '#2', '9'), /Marked done: #2\.\nNo such note: #9\.\nNo open notes left\./);
    assert.equal(kp(root, 'notes', post), 'No open notes.');
    assert.match(kp(root, 'notes', post, '--all'), /#1 .*\[done\]/);

    // Kirsten can take a note back from the page.
    const third = JSON.parse((await post_({ ...note, slide: 'slides/02-review-card.html', note: 'Actually, never mind' })).text);
    const w = await request(`${url.origin}/__kp/notes/withdraw`, {
      method: 'POST', body: JSON.stringify({ page: url.pathname, id: third.id }),
      headers: { 'Content-Type': 'application/json', Origin: url.origin },
    });
    assert.equal(w.status, 200);
    assert.equal(kp(root, 'notes', post), 'No open notes.');
  } finally {
    kp(root, 'stop-preview');
  }
});

test('the managed launch.json keeps other servers', () => {
  const root = tempPosts();
  fs.mkdirSync(path.join(root, '.claude'));
  fs.writeFileSync(path.join(root, '.claude', 'launch.json'), JSON.stringify({ version: '0.0.1', configurations: [{ name: 'other', port: 3000 }] }));
  kp(root, 'init');
  const post = kp(root, 'new', 'Launch test');
  kp(root, 'add', post, 'photo');
  try {
    kp(root, 'preview', post, '--no-check');
    const launch = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'launch.json'), 'utf8'));
    assert.deepEqual(launch.configurations.map((c) => c.name), ['other', 'KP preview']);
  } finally {
    kp(root, 'stop-preview');
  }
});
