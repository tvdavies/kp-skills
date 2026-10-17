// Live preview: a preview.html per post that shows every slide straight from
// its HTML, served by a tiny local web server that lets the page refresh
// itself when a slide changes and save Kirsten's notes. Nothing here renders
// images; only export does that.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { postsRoot, PLUGIN_ROOT, readJson } from './paths.mjs';
import { postInfo, listSlides } from './posts.mjs';
import { resolveSizes } from './render.mjs';
import { readNotes, addNote, setStatus } from './notes.mjs';

export const PREVIEW_FILE = 'preview.html';
export const LAUNCH_NAME = 'KP preview';
const KP_MJS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'kp.mjs');
const MAX_BODY = 16 * 1024;
// A helper left running from an older plugin version is replaced.
const VERSION = (() => {
  try { return readJson(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json')).version; } catch { return 'dev'; }
})();
const SERVER_ID = `${VERSION}:${KP_MJS}`;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** URL path (from the posts root) of a file, encoded for a browser. */
function urlPath(root, file) {
  return '/' + path.relative(root, file).split(path.sep).map(encodeURIComponent).join('/');
}

export function serverInfoFile(root = postsRoot()) {
  return path.join(root, '.kp', 'preview-server.json');
}

/** Write <post>/preview.html for the given sizes (default: the post's sizes). Returns its path. */
export function writePreviewPage(postDir, { sizes } = {}) {
  const info = postInfo(postDir);
  const sizeList = resolveSizes(sizes || info.sizes || 'default').map((s) => ({
    id: s.id, name: s.name, width: s.width, height: s.height,
  }));
  const slides = listSlides(postDir).map((s) => ({ n: s.n, file: path.relative(postDir, s.file).split(path.sep).join('/'), template: s.template }));
  const data = { title: info.title, sizes: sizeList, slides };
  const html = PAGE.split('__TITLE__').join(esc(info.title)).replace('__DATA__', JSON.stringify(data).replace(/</g, '\\u003c'));
  const file = path.join(postDir, PREVIEW_FILE);
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== html) fs.writeFileSync(file, html);
  return file;
}

// ---------------------------------------------------------------- the page

const PAGE = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__: preview</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #ece5da; color: #3a2e27;
         font: 500 15px/1.35 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; }
  .layout { display: flex; align-items: flex-start; }
  .content { flex: 1; min-width: 0; padding: 22px 28px 60px; }
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; margin-bottom: 6px; }
  h1 { font-size: 22px; margin: 0; font-weight: 650; }
  #status { font-size: 13px; opacity: .75; }
  #status.live::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%;
                         background: #5f8f5a; margin-right: 6px; vertical-align: 1px; }
  .controls { margin-left: auto; font-size: 13px; display: flex; gap: 6px; align-items: center; }
  button { font: inherit; border: 1px solid #b9ab99; background: #f7f2ea; color: inherit;
           border-radius: 999px; padding: 4px 12px; cursor: pointer; }
  button[aria-pressed="true"] { background: #3a2e27; color: #f7f2ea; border-color: #3a2e27; }
  button:disabled { opacity: .45; cursor: default; }
  #comment[aria-pressed="true"] { background: #b5553a; border-color: #b5553a; }
  .note { font-size: 13px; opacity: .75; margin: 0 0 16px; max-width: 70ch; }
  body.commenting .note.how { opacity: 1; color: #b5553a; }
  h2 { font-size: 16px; margin: 24px 0 12px; font-weight: 650; }
  h2 span { font-weight: 500; opacity: .65; }
  .grid { display: flex; flex-wrap: wrap; gap: 22px; }
  figure { margin: 0; }
  .frame { position: relative; overflow: hidden; background: #d9cfc1; box-shadow: 0 2px 12px rgba(0,0,0,.18); }
  .frame iframe { position: absolute; left: 0; top: 0; border: 0; transform-origin: 0 0; background: transparent; }
  .frame iframe.next { visibility: hidden; }
  body.commenting .frame { outline: 2px dashed #b5553a; outline-offset: 3px; }
  .pins { position: absolute; inset: 0; pointer-events: none; }
  .pin { position: absolute; width: 24px; height: 24px; margin: -12px 0 0 -12px; border-radius: 50%;
         background: #b5553a; color: #fff; font: 700 12px/24px -apple-system, Arial, sans-serif; text-align: center;
         box-shadow: 0 1px 4px rgba(0,0,0,.4); border: 2px solid #fff; pointer-events: auto; cursor: help; }
  body.commenting .pin { pointer-events: none; opacity: .7; }
  figcaption { margin-top: 7px; font-size: 13px; display: flex; justify-content: space-between; gap: 10px; }
  figcaption a { color: inherit; opacity: .6; }
  aside { width: 300px; flex: none; position: sticky; top: 0; max-height: 100vh; overflow: auto;
          padding: 22px 20px; border-left: 1px solid #d6cbbb; background: #f4eee5; min-height: 100vh; }
  aside h3 { font-size: 15px; margin: 0 0 4px; }
  aside p.hint { font-size: 13px; opacity: .7; margin: 0 0 14px; }
  aside ol { list-style: none; padding: 0; margin: 0; }
  aside li { background: #fff; border-radius: 10px; padding: 9px 11px; margin-bottom: 9px; font-size: 13px;
             box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  aside li .meta { opacity: .65; font-size: 12px; display: flex; justify-content: space-between; gap: 8px; }
  aside li .meta button { border: 0; background: none; padding: 0; opacity: .8; text-decoration: underline; font-size: 12px; }
  aside li.done { opacity: .55; }
  aside li .num { display: inline-block; min-width: 20px; height: 20px; border-radius: 50%; background: #b5553a; color: #fff;
                  text-align: center; font-weight: 700; font-size: 11px; line-height: 20px; margin-right: 6px; }
  aside li.done .num { background: #5f8f5a; }
  aside li q { display: block; font-style: italic; opacity: .75; margin: 3px 0; }
  #composer { position: fixed; z-index: 10; width: 320px; background: #fff; border-radius: 12px; padding: 14px;
              box-shadow: 0 10px 40px rgba(0,0,0,.3); display: none; }
  #composer.open { display: block; }
  #composer .where { font-size: 12px; opacity: .7; margin-bottom: 6px; }
  #composer q { display: block; font-style: italic; font-size: 13px; margin-bottom: 6px; }
  #composer q[hidden] { display: none; }
  #composer textarea { width: 100%; min-height: 84px; font: inherit; border: 1px solid #ccc; border-radius: 8px; padding: 8px; }
  #composer .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
  #composer .save { background: #3a2e27; color: #fff; border-color: #3a2e27; }
  .empty { opacity: .7; }
  @media (max-width: 860px) { .layout { flex-direction: column; } aside { width: auto; position: static; min-height: 0; border-left: 0; } }
</style>
</head>
<body>
<div class="layout">
<div class="content">
<header>
  <h1>__TITLE__</h1>
  <span id="status">Loading…</span>
  <div class="controls">
    <button id="comment" aria-pressed="false" title="Click something on a slide, or select some words, to leave a note for Claude">Comment</button>
    <span style="margin-left:8px">Size</span>
    <button data-thumb="240">S</button><button data-thumb="360">M</button><button data-thumb="520">L</button>
  </div>
</header>
<p class="note">These are the slides themselves, at the exact Instagram and Facebook sizes, scaled down to fit.
The finished images are made only when you export.</p>
<p class="note how">To leave a note, turn on <b>Comment</b>, then click the thing you mean (or select some words) and type.
When you're done, tell Claude "I've left some notes".</p>
<main id="sizes"></main>
</div>
<aside>
  <h3>Notes for Claude</h3>
  <p class="hint" id="notes-hint">None yet.</p>
  <ol id="notes"></ol>
</aside>
</div>
<div id="composer" role="dialog" aria-label="Leave a note">
  <div class="where"></div>
  <q hidden></q>
  <textarea placeholder="What would you like changed?"></textarea>
  <div class="row"><button class="cancel">Cancel</button><button class="save">Save note</button></div>
</div>
<script id="kp-data" type="application/json">__DATA__</script>
<script>
(function () {
  'use strict';
  var data = JSON.parse(document.getElementById('kp-data').textContent);
  var live = location.protocol === 'http:' || location.protocol === 'https:';
  var thumb = Number(localStorage.getItem('kp-thumb')) || 360;
  var commenting = false;
  var stamps = {};
  var listKey = '';
  var notesKey = '';
  var notes = { open: [], done: [] };
  var frames = [];
  var pending = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function src(slide, size, v) {
    return slide.file + '?size=' + encodeURIComponent(size.id) + '&render=1' + (v ? '&v=' + encodeURIComponent(v) : '');
  }

  // ------------------------------------------------------------ slides

  function build() {
    var main = document.getElementById('sizes');
    main.textContent = '';
    frames = [];
    if (!data.slides.length) {
      main.appendChild(el('p', 'empty', 'No slides yet.'));
      return;
    }
    data.sizes.forEach(function (size) {
      var h2 = el('h2', '', size.name + ' ');
      h2.appendChild(el('span', '', size.width + '×' + size.height));
      main.appendChild(h2);
      var grid = el('div', 'grid');
      data.slides.forEach(function (slide) {
        var scale = thumb / size.width;
        var fig = el('figure');
        var frame = el('div', 'frame');
        frame.style.width = thumb + 'px';
        frame.style.height = Math.round(size.height * scale) + 'px';
        var iframe = document.createElement('iframe');
        iframe.title = 'Slide ' + slide.n + ', ' + size.name;
        iframe.width = size.width;
        iframe.height = size.height;
        iframe.style.width = size.width + 'px';
        iframe.style.height = size.height + 'px';
        iframe.style.transform = 'scale(' + scale + ')';
        iframe.setAttribute('scrolling', 'no');
        var pins = el('div', 'pins');
        frame.appendChild(iframe);
        frame.appendChild(pins);
        var cap = el('figcaption');
        cap.appendChild(el('span', '', 'Slide ' + slide.n + ' · ' + size.name));
        var open = el('a', '', 'open');
        open.href = slide.file + '?size=' + encodeURIComponent(size.id);
        open.target = '_blank';
        cap.appendChild(open);
        fig.appendChild(frame);
        fig.appendChild(cap);
        grid.appendChild(fig);
        var f = { slide: slide, size: size, scale: scale, frame: frame, iframe: iframe, pins: pins };
        frames.push(f);
        iframe.addEventListener('load', function () { attach(f, iframe); drawPins(f); });
        iframe.src = src(slide, size, stamps[slide.file]);
      });
      main.appendChild(grid);
    });
  }

  // Load the new version out of sight, then swap, so a refresh doesn't flash.
  function reload(f, v) {
    var next = f.iframe.cloneNode(false);
    next.classList.add('next');
    var done = false;
    function swap() {
      if (done) return;
      done = true;
      next.classList.remove('next');
      if (f.iframe.parentNode) f.iframe.parentNode.removeChild(f.iframe);
      f.iframe = next;
      attach(f, next);
      drawPins(f);
    }
    next.addEventListener('load', function () {
      var tries = 0;
      (function wait() {
        var ready = false;
        try { ready = next.contentDocument.documentElement.getAttribute('data-kp-ready') === '1'; } catch (e) { ready = true; }
        if (ready || ++tries > 40) swap(); else setTimeout(wait, 75);
      })();
    });
    f.frame.insertBefore(next, f.pins);
    next.src = src(f.slide, f.size, v);
  }

  // ------------------------------------------------------------ comments

  function docOf(iframe) {
    try { return iframe.contentDocument; } catch (e) { return null; }
  }

  function targetAt(doc, node, x, y) {
    var t = node && node.nodeType === 1 ? node : node && node.parentElement;
    var field = t && t.closest ? t.closest('[data-field]') : null;
    if (field) return field;
    if (x !== undefined) {
      var hit = doc.elementsFromPoint(x, y).filter(function (e) { return e.hasAttribute('data-field'); })[0];
      if (hit) return hit;
    }
    return t;
  }

  function selectorFor(e) {
    var parts = [];
    while (e && e.nodeType === 1 && e.tagName !== 'BODY' && e.tagName !== 'HTML') {
      if (e.id) { parts.unshift('#' + e.id); break; }
      if (e.classList.contains('kp-slide')) { parts.unshift('.kp-slide'); break; }
      var cls = Array.prototype.filter.call(e.classList, function (c) { return c.indexOf('kp-note') !== 0; })[0];
      var part = e.tagName.toLowerCase() + (cls ? '.' + cls : '');
      var i = 1, sib = e;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === e.tagName) i++;
      parts.unshift(part + ':nth-of-type(' + i + ')');
      e = e.parentElement;
    }
    return parts.join(' > ');
  }

  function attach(f, iframe) {
    var doc = docOf(iframe);
    if (!doc || doc.__kpAttached) return;
    doc.__kpAttached = true;
    var style = doc.createElement('style');
    style.textContent = 'html.kp-commenting, html.kp-commenting * { cursor: crosshair !important; }' +
      '.kp-note-hover { outline: 4px solid #b5553a !important; outline-offset: 3px; }';
    doc.head.appendChild(style);
    doc.documentElement.classList.toggle('kp-commenting', commenting);
    var hovered = null;
    var justSelected = false;
    function setHover(t) {
      if (hovered === t) return;
      if (hovered) hovered.classList.remove('kp-note-hover');
      hovered = t;
      if (t && commenting) t.classList.add('kp-note-hover');
    }
    doc.addEventListener('mousemove', function (ev) {
      if (!commenting) return setHover(null);
      setHover(targetAt(doc, ev.target, ev.clientX, ev.clientY));
    });
    doc.addEventListener('mouseleave', function () { setHover(null); });
    doc.addEventListener('mouseup', function (ev) {
      if (!commenting) return;
      var sel = doc.getSelection();
      var text = sel && !sel.isCollapsed ? sel.toString().trim() : '';
      if (!text) return;
      justSelected = true;
      var r = sel.getRangeAt(0).getBoundingClientRect();
      var t = targetAt(doc, sel.anchorNode);
      compose(f, t, text, (r.left + r.width / 2), r.top, ev);
    });
    doc.addEventListener('click', function (ev) {
      if (!commenting) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (justSelected) { justSelected = false; return; }
      var t = targetAt(doc, ev.target, ev.clientX, ev.clientY);
      compose(f, t, '', ev.clientX, ev.clientY, ev);
    }, true);
  }

  function compose(f, target, selectedText, x, y, ev) {
    var field = target && target.getAttribute && target.getAttribute('data-field');
    var whole = !target || (target.classList && target.classList.contains('kp-slide'));
    pending = {
      page: location.pathname,
      slide: f.slide.file,
      slideNumber: f.slide.n,
      size: f.size.id,
      field: field || null,
      selector: field || whole ? (whole ? '.kp-slide' : null) : selectorFor(target),
      selectedText: selectedText || null,
      x: Math.max(0, Math.min(1, x / f.size.width)),
      y: Math.max(0, Math.min(1, y / f.size.height))
    };
    var box = document.getElementById('composer');
    box.querySelector('.where').textContent = 'Slide ' + f.slide.n + ' · ' + f.size.name +
      (field ? ' · ' + field : whole ? ' · whole slide' : '');
    var q = box.querySelector('q');
    q.hidden = !selectedText;
    q.textContent = selectedText || '';
    var rect = f.frame.getBoundingClientRect();
    var left = Math.min(window.innerWidth - 340, Math.max(10, rect.left + x * f.scale + 12));
    var top = Math.min(window.innerHeight - 230, Math.max(10, rect.top + y * f.scale + 12));
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.classList.add('open');
    var ta = box.querySelector('textarea');
    ta.value = '';
    setTimeout(function () { ta.focus(); }, 0);
  }

  function closeComposer() {
    document.getElementById('composer').classList.remove('open');
    pending = null;
  }

  function saveNote() {
    var ta = document.querySelector('#composer textarea');
    if (!pending || !ta.value.trim()) return;
    var body = Object.assign({}, pending, { note: ta.value.trim() });
    fetch('/__kp/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); return r.json(); })
      .then(function () { closeComposer(); poll(true); })
      .catch(function (err) { alert('Sorry, the note wasn\\'t saved: ' + err.message); });
  }

  function withdraw(id) {
    fetch('/__kp/notes/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: location.pathname, id: id }) }).then(function () { poll(true); });
  }

  function setCommenting(on) {
    commenting = on;
    document.body.classList.toggle('commenting', on);
    document.getElementById('comment').setAttribute('aria-pressed', String(on));
    frames.forEach(function (f) {
      var doc = docOf(f.iframe);
      if (doc) {
        doc.documentElement.classList.toggle('kp-commenting', on);
        if (!on) doc.querySelectorAll('.kp-note-hover').forEach(function (e) { e.classList.remove('kp-note-hover'); });
      }
    });
    if (!on) closeComposer();
  }

  function noteNumber(n) { return n.id; }

  function drawPins(f) {
    f.pins.textContent = '';
    var doc = docOf(f.iframe);
    notes.open.forEach(function (n) {
      if (n.slide !== f.slide.file) return;
      var x = (n.x || 0.5) * f.size.width, y = (n.y || 0.5) * f.size.height;
      if (n.size !== f.size.id && doc) {
        // On the other size, point at the same element if it can be found.
        var t = null;
        try { t = n.field ? doc.querySelector('[data-field="' + n.field + '"]') : n.selector ? doc.querySelector(n.selector) : null; } catch (e) { t = null; }
        if (t) { var r = t.getBoundingClientRect(); x = r.left + Math.min(r.width / 2, 40); y = r.top + Math.min(r.height / 2, 40); }
      }
      var pin = el('div', 'pin', String(noteNumber(n)));
      pin.style.left = Math.max(12, Math.min(f.size.width * f.scale - 12, x * f.scale)) + 'px';
      pin.style.top = Math.max(12, Math.min(f.size.height * f.scale - 12, y * f.scale)) + 'px';
      pin.title = n.note;
      f.pins.appendChild(pin);
    });
  }

  function drawNotes() {
    var list = document.getElementById('notes');
    list.textContent = '';
    var hint = document.getElementById('notes-hint');
    hint.textContent = !live ? 'Notes work in the live preview only.' :
      notes.open.length ? notes.open.length + ' waiting for Claude. Say "I\\'ve left some notes" when you\\'re ready.' :
      'None waiting. Turn on Comment to leave one.';
    notes.open.concat(notes.done).forEach(function (n) {
      var li = el('li', n.status === 'open' ? '' : 'done');
      var meta = el('div', 'meta');
      var label = el('span');
      label.appendChild(el('span', 'num', n.status === 'open' ? String(noteNumber(n)) : '✓'));
      label.appendChild(document.createTextNode('Slide ' + (n.slideNumber || '?') + (n.field ? ' · ' + n.field : '')));
      meta.appendChild(label);
      if (n.status === 'open') {
        var b = el('button', '', 'remove');
        b.title = 'Take this note back';
        b.addEventListener('click', function () { withdraw(n.id); });
        meta.appendChild(b);
      } else meta.appendChild(el('span', '', 'done'));
      li.appendChild(meta);
      if (n.selectedText) li.appendChild(el('q', '', n.selectedText));
      li.appendChild(el('div', '', n.note));
      list.appendChild(li);
    });
    frames.forEach(drawPins);
  }

  // ------------------------------------------------------------ live updates

  function status(text, isLive) {
    var e = document.getElementById('status');
    e.textContent = text;
    e.className = isLive ? 'live' : '';
  }

  var timer = null;
  function poll(once) {
    if (timer && once) clearTimeout(timer);
    fetch('/__kp/state?page=' + encodeURIComponent(location.pathname), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (state) {
        status('Live: changes show up here by themselves', true);
        if (data.pageStamp && state.page !== data.pageStamp) { location.reload(); return; }
        data.pageStamp = state.page;
        var nk = JSON.stringify(state.notes);
        if (nk !== notesKey) { notesKey = nk; notes = state.notes; drawNotes(); }
        var key = state.slides.map(function (s) { return s.file; }).join('|');
        var first = !listKey;
        if (key !== listKey) {
          data.slides = state.slides;
          state.slides.forEach(function (s) { stamps[s.file] = s.stamp + ':' + state.shared; });
          listKey = key;
          if (!first) build();
          return;
        }
        state.slides.forEach(function (s) {
          var v = s.stamp + ':' + state.shared;
          if (stamps[s.file] !== v) {
            stamps[s.file] = v;
            frames.forEach(function (f) { if (f.slide.file === s.file) reload(f, v); });
          }
        });
      })
      .catch(function () { status('Not live: the preview helper has stopped. Ask Claude to preview again.', false); })
      .then(function () { timer = setTimeout(poll, 1000); });
  }

  // ------------------------------------------------------------ start

  document.querySelectorAll('[data-thumb]').forEach(function (b) {
    b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-thumb')) === thumb));
    b.addEventListener('click', function () {
      thumb = Number(b.getAttribute('data-thumb'));
      localStorage.setItem('kp-thumb', String(thumb));
      document.querySelectorAll('[data-thumb]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      build();
    });
  });
  var commentBtn = document.getElementById('comment');
  commentBtn.addEventListener('click', function () { setCommenting(!commenting); });
  document.querySelector('#composer .cancel').addEventListener('click', closeComposer);
  document.querySelector('#composer .save').addEventListener('click', saveNote);
  document.querySelector('#composer textarea').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) saveNote();
    if (ev.key === 'Escape') closeComposer();
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { closeComposer(); } });

  build();
  drawNotes();
  if (live) poll();
  else {
    status('Not live: reload this page to see changes.', false);
    commentBtn.disabled = true;
    commentBtn.title = 'Notes need the live preview. Ask Claude to preview the post.';
  }
})();
</script>
</body>
</html>
`;

// ---------------------------------------------------------------- the server

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.txt': 'text/plain; charset=utf-8',
};

function stampOf(file) {
  try {
    const s = fs.statSync(file);
    return `${Math.round(s.mtimeMs)}-${s.size}`;
  } catch {
    return '0';
  }
}

/** Newest change anywhere under a folder (for photos and the post's brand files). */
function folderStamp(dir) {
  let newest = 0;
  let count = 0;
  const walk = (d) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        count++;
        try { newest = Math.max(newest, fs.statSync(p).mtimeMs); } catch { /* gone */ }
      }
    }
  };
  walk(dir);
  return `${Math.round(newest)}-${count}`;
}

/** What the preview page polls: each slide's stamp, one for shared files, and the notes. */
export function postState(postDir) {
  const slides = listSlides(postDir).map((s) => ({
    n: s.n, template: s.template, file: path.relative(postDir, s.file).split(path.sep).join('/'), stamp: stampOf(s.file),
  }));
  const shared = [folderStamp(path.join(postDir, 'photos')), folderStamp(path.join(postDir, '_kp'))].join('.');
  const all = readNotes(postDir);
  const notes = {
    open: all.filter((n) => n.status === 'open'),
    done: all.filter((n) => n.status === 'done').slice(-5).reverse(),
  };
  return { slides, shared, notes, page: stampOf(path.join(postDir, PREVIEW_FILE)) };
}

function indexPage(root) {
  const posts = fs.existsSync(root)
    ? fs.readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(root, e.name, PREVIEW_FILE)))
        .map((e) => e.name).sort().reverse()
    : [];
  const items = posts.map((p) => `<li><a href="${urlPath(root, path.join(root, p, PREVIEW_FILE))}">${esc(p)}</a></li>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>KP Posts</title>
<style>body{margin:0;padding:28px;background:#ece5da;color:#3a2e27;font:500 16px/1.5 -apple-system,"Helvetica Neue",Arial,sans-serif}
a{color:inherit} h1{font-size:22px}</style>
<h1>KP Posts</h1>${items ? `<ul>${items}</ul>` : '<p>No previews yet.</p>'}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Too much.'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('Not JSON.')); }
    });
    req.on('error', reject);
  });
}

/**
 * Run the preview server in this process on 127.0.0.1. port 0 picks a free
 * one. Records itself in <root>/.kp/preview-server.json. Resolves to the server.
 */
export function serve({ root = postsRoot(), port = 0, idleMinutes = Number(process.env.KP_PREVIEW_IDLE_MINUTES) || 240 } = {}) {
  root = path.resolve(root);
  let last = Date.now();
  let actualPort = port;
  const server = http.createServer(async (req, res) => {
    last = Date.now();
    const send = (code, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(body);
    };
    // Only answer pages from this machine, addressed to this server.
    const hosts = [`127.0.0.1:${actualPort}`, `localhost:${actualPort}`];
    if (!hosts.includes(String(req.headers.host))) return send(403, 'Wrong host.');
    const url = new URL(req.url, `http://127.0.0.1:${actualPort}`);
    const postFor = (page) => {
      const dir = path.resolve(root, '.' + path.posix.dirname(String(page || '/')));
      return dir.startsWith(root + path.sep) && fs.existsSync(path.join(dir, 'post.json')) ? dir : null;
    };

    if (req.method === 'POST') {
      const origin = String(req.headers.origin || '');
      if (!hosts.map((h) => `http://${h}`).includes(origin)) return send(403, 'Notes can only be saved from the preview page.');
      if (!/^application\/json/.test(String(req.headers['content-type'] || ''))) return send(415, 'Send JSON.');
      let body;
      try { body = await readBody(req); } catch (err) { return send(400, err.message); }
      let postDir = null;
      try { postDir = postFor(decodeURIComponent(String(body.page || ''))); } catch { /* bad page */ }
      if (!postDir) return send(404, 'No such post.');
      try {
        if (url.pathname === '/__kp/notes') return send(201, JSON.stringify(addNote(postDir, body)), 'application/json');
        if (url.pathname === '/__kp/notes/withdraw') return send(200, JSON.stringify(setStatus(postDir, [body.id], 'withdrawn')), 'application/json');
      } catch (err) {
        return send(400, err.message);
      }
      return send(404, 'Not found.');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Not allowed.');
    if (url.pathname === '/__kp/ping') return send(200, JSON.stringify({ kp: true, root, pid: process.pid, id: SERVER_ID }), 'application/json');
    if (url.pathname === '/__kp/state') {
      let postDir = null;
      try { postDir = postFor(decodeURIComponent(url.searchParams.get('page') || '')); } catch { /* bad page */ }
      if (!postDir) return send(404, 'No such post.');
      return send(200, JSON.stringify(postState(postDir)), 'application/json');
    }
    if (url.pathname === '/') return send(200, indexPage(root), TYPES['.html']);
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { return send(400, 'Bad address.'); }
    const file = path.resolve(root, '.' + rel);
    if (!file.startsWith(root + path.sep)) return send(403, 'Outside the posts folder.');
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return send(404, 'Not found.');
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': st.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  });
  const timer = setInterval(() => {
    if (Date.now() - last > idleMinutes * 60000) {
      clearInterval(timer);
      server.close(() => process.exit(0));
    }
  }, 30000);
  timer.unref();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      actualPort = server.address().port;
      const info = serverInfoFile(root);
      fs.mkdirSync(path.dirname(info), { recursive: true });
      fs.writeFileSync(info, JSON.stringify({ port: actualPort, pid: process.pid, root, started: new Date().toISOString() }, null, 2) + '\n');
      resolve(server);
    });
  });
}

async function ping(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/__kp/ping`, { signal: AbortSignal.timeout(800) });
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({}));
    return j.kp ? j : null;
  } catch {
    return null;
  }
}

function readServerInfo(root) {
  try { return JSON.parse(fs.readFileSync(serverInfoFile(root), 'utf8')); } catch { return null; }
}

/**
 * Make sure a preview server is running for this posts folder, starting one
 * in the background on a free port if needed. Returns its base URL, or null.
 */
export async function ensureServer(root = postsRoot()) {
  root = path.resolve(root);
  const known = readServerInfo(root);
  if (known?.port) {
    const p = await ping(known.port);
    if (p && p.root === root && p.id === SERVER_ID) return `http://127.0.0.1:${known.port}`;
    if (p && p.root === root && p.pid === known.pid) {
      try { process.kill(p.pid); } catch { /* already gone */ }
    }
  }
  const child = spawn(process.execPath, [KP_MJS, 'serve', '--port', '0'], {
    detached: true, stdio: 'ignore', env: { ...process.env, KP_POSTS: root },
  });
  child.unref();
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const info = readServerInfo(root);
    if (info?.pid === child.pid) {
      const p = await ping(info.port);
      if (p && p.root === root) return `http://127.0.0.1:${info.port}`;
    }
  }
  return null;
}

/** Stop this posts folder's preview server, if one is running. */
export async function stopServer(root = postsRoot()) {
  const info = readServerInfo(path.resolve(root));
  if (!info?.pid) return false;
  const p = await ping(info.port);
  if (!p || p.pid !== info.pid) return false;
  try { process.kill(info.pid); return true; } catch { return false; }
}

/** The preview page's address on the server. */
export function previewUrl(base, postDir, root = postsRoot()) {
  return base + urlPath(path.resolve(root), path.join(path.resolve(postDir), PREVIEW_FILE));
}

/**
 * Keep a "KP preview" entry in the posts folder's .claude/launch.json, so
 * Claude Desktop's Browser pane can attach to the running preview server.
 * Anything else in the file is kept; a file that isn't plain JSON is left alone.
 */
export function ensureLaunchConfig(root, port) {
  const file = path.join(root, '.claude', 'launch.json');
  const entry = { name: LAUNCH_NAME, url: `http://127.0.0.1:${port}`, port };
  let config = { version: '0.0.1', autoVerify: false, configurations: [] };
  if (fs.existsSync(file)) {
    try {
      config = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Array.isArray(config.configurations)) config.configurations = [];
    } catch {
      return 'left alone';
    }
  }
  const others = config.configurations.filter((c) => c.name !== LAUNCH_NAME);
  const current = config.configurations.find((c) => c.name === LAUNCH_NAME);
  if (current && JSON.stringify(current) === JSON.stringify(entry)) return 'unchanged';
  config.configurations = [...others, entry];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
  return current ? 'updated' : 'created';
}
