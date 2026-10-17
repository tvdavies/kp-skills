/*
 * kp.js: the small runtime every KP slide loads.
 *
 * - Picks the output size from the page address (?size=ig) and sets
 *   <html data-size data-aspect>, so templates can lay out per shape.
 * - Scales the slide to the output size when exporting, or to fit the window
 *   when previewing in a browser.
 * - Draws star ratings, marks empty optional fields, fills empty photo slots
 *   with brand stripes.
 * - Fits [data-fit] text to its box.
 * - Waits for fonts and photos, then sets <html data-kp-ready> and leaves a
 *   report in window.__kpReport (text that doesn't fit, missing photos and
 *   fonts) for the renderer.
 *
 * Keep SIZES in step with ../sizes.json (the test checks they match).
 */
(function () {
  'use strict';

  var SIZES = {
    'ig':           { w: 1080, h: 1350, aspect: 'four-five',    dw: 1080, dh: 1350, label: 'Instagram 4:5' },
    'fb':           { w: 1080, h: 1080, aspect: 'square',       dw: 1080, dh: 1080, label: 'Facebook 1:1' },
    'ig-square':    { w: 1080, h: 1080, aspect: 'square',       dw: 1080, dh: 1080, label: 'Instagram 1:1' },
    'ig-tall':      { w: 1080, h: 1440, aspect: 'three-four',   dw: 1080, dh: 1440, label: 'Instagram 3:4' },
    'ig-story':     { w: 1080, h: 1920, aspect: 'nine-sixteen', dw: 1080, dh: 1920, label: 'Instagram story' },
    'ig-landscape': { w: 1080, h: 566,  aspect: 'landscape',    dw: 1200, dh: 629,  label: 'Instagram 1.91:1' },
    'fb-portrait':  { w: 1080, h: 1350, aspect: 'four-five',    dw: 1080, dh: 1350, label: 'Facebook 4:5' },
    'fb-story':     { w: 1080, h: 1920, aspect: 'nine-sixteen', dw: 1080, dh: 1920, label: 'Facebook story' },
    'fb-landscape': { w: 1200, h: 630,  aspect: 'landscape',    dw: 1200, dh: 630,  label: 'Facebook 1.91:1' }
  };
  var PREVIEW_LINKS = ['ig', 'fb', 'ig-tall', 'ig-story', 'fb-landscape'];

  var STAR_PATH = 'M12 1.8l3.09 6.26 6.91 1-5 4.87 1.18 6.88L12 17.56l-6.18 3.25L7 13.93 2 9.06l6.91-1z';

  var params = new URLSearchParams(location.search);
  var sizeId = params.get('size') || 'ig';
  var size = SIZES[sizeId] || SIZES.ig;
  if (!SIZES[sizeId]) sizeId = 'ig';
  var rendering = params.get('render') === '1';
  var root = document.documentElement;
  root.setAttribute('data-size', sizeId);
  root.setAttribute('data-aspect', size.aspect);
  root.setAttribute('data-mode', rendering ? 'render' : 'preview');

  var report = { size: sizeId, overflow: [], atMinimum: [], missingPhotos: [], missingFonts: [], offCanvas: [], nearEdge: [] };
  window.__kpReport = report;

  function describe(el) {
    var field = el.getAttribute('data-field');
    if (field) return field;
    if (el.id) return '#' + el.id;
    return (el.className && typeof el.className === 'string') ? '.' + el.className.split(/\s+/)[0] : el.tagName.toLowerCase();
  }

  function slide() { return document.querySelector('.kp-slide'); }

  function place() {
    var s = slide();
    if (!s) return;
    s.style.setProperty('--kp-w', size.dw + 'px');
    s.style.setProperty('--kp-h', size.dh + 'px');
    var scale;
    if (rendering) {
      scale = size.w / size.dw;
      document.body.style.width = size.w + 'px';
      document.body.style.height = size.h + 'px';
      s.style.transform = scale === 1 ? 'none' : 'scale(' + scale + ')';
      return;
    }
    var barH = 40;
    var availW = window.innerWidth - 32;
    var availH = window.innerHeight - barH - 32;
    scale = Math.min(availW / size.dw, availH / size.dh, 1);
    var left = Math.max(16, (window.innerWidth - size.dw * scale) / 2);
    var top = Math.max(16, (window.innerHeight - barH - size.dh * scale) / 2);
    s.style.position = 'absolute';
    s.style.left = left + 'px';
    s.style.top = top + 'px';
    s.style.transform = 'scale(' + scale + ')';
    s.style.boxShadow = '0 10px 40px rgba(0,0,0,.45)';
  }

  function previewBar() {
    if (rendering) return;
    var bar = document.createElement('nav');
    bar.className = 'kp-preview-bar';
    PREVIEW_LINKS.forEach(function (id) {
      var a = document.createElement('a');
      var p = new URLSearchParams(location.search);
      p.set('size', id);
      a.href = '?' + p.toString();
      a.textContent = SIZES[id].label;
      if (id === sizeId) a.setAttribute('aria-current', 'true');
      bar.appendChild(a);
    });
    document.body.appendChild(bar);
  }

  function markEmpty() {
    document.querySelectorAll('[data-field]').forEach(function (el) {
      if (el.tagName === 'IMG' || el.hasAttribute('data-stars')) return;
      if (el.textContent.trim() === '' && !el.querySelector('img,svg')) el.setAttribute('data-empty', '');
      else el.removeAttribute('data-empty');
    });
  }

  function drawStars() {
    document.querySelectorAll('[data-stars]').forEach(function (el) {
      var n = parseInt(el.getAttribute('data-stars'), 10);
      if (isNaN(n)) n = 5;
      n = Math.max(0, Math.min(5, n));
      var html = '';
      for (var i = 0; i < n; i++) {
        html += '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR_PATH + '"/></svg>';
      }
      el.innerHTML = html;
      el.setAttribute('aria-label', n + (n === 1 ? ' star' : ' stars'));
      if (n === 0) el.setAttribute('data-empty', '');
    });
  }

  function photos() {
    var imgs = Array.prototype.slice.call(document.querySelectorAll('img.kp-photo'));
    return Promise.all(imgs.map(function (img) {
      var src = (img.getAttribute('src') || '').trim();
      var empty = function () {
        var div = document.createElement('div');
        div.className = img.className.replace('kp-photo', 'kp-photo-empty');
        div.setAttribute('style', img.getAttribute('style') || '');
        div.setAttribute('data-field', img.getAttribute('data-field') || 'photo');
        div.setAttribute('data-photo-missing', src || '(none)');
        img.replaceWith(div);
        report.missingPhotos.push({ field: img.getAttribute('data-field') || 'photo', src: src || null });
      };
      if (!src) { empty(); return null; }
      if (img.complete && img.naturalWidth > 0) return img.decode ? img.decode().catch(function () {}) : null;
      return new Promise(function (resolve) {
        img.addEventListener('load', function () {
          (img.decode ? img.decode() : Promise.resolve()).catch(function () {}).then(resolve);
        }, { once: true });
        img.addEventListener('error', function () { empty(); resolve(); }, { once: true });
      });
    }));
  }

  function fitRange(el) {
    var aspect = root.getAttribute('data-aspect');
    var spec = el.getAttribute('data-fit-' + aspect) || el.getAttribute('data-fit') || '';
    var parts = spec.trim().split(/\s+/).map(Number);
    var min = parts[0] || 24;
    var max = parts[1] || min;
    return [Math.min(min, max), Math.max(min, max)];
  }

  function wrapFitBody(el) {
    var body = el.querySelector(':scope > .kp-fit-body');
    if (body) return body;
    body = document.createElement('div');
    body.className = 'kp-fit-body';
    while (el.firstChild) body.appendChild(el.firstChild);
    el.appendChild(body);
    return body;
  }

  function fits(el, body) {
    return body.offsetHeight <= el.clientHeight + 0.5 && body.scrollWidth <= el.clientWidth + 0.5;
  }

  function fitText() {
    document.querySelectorAll('[data-fit]').forEach(function (el) {
      if (el.hasAttribute('data-empty')) return;
      var body = wrapFitBody(el);
      var range = fitRange(el);
      var lo = range[0], hi = range[1], best = lo;
      el.style.fontSize = hi + 'px';
      if (fits(el, body)) { best = hi; }
      else {
        for (var i = 0; i < 14; i++) {
          var mid = (lo + hi) / 2;
          el.style.fontSize = mid + 'px';
          if (fits(el, body)) { best = mid; lo = mid; } else { hi = mid; }
        }
      }
      best = Math.floor(best * 2) / 2;
      el.style.fontSize = best + 'px';
      el.setAttribute('data-fitted', String(best));
      if (!fits(el, body)) report.overflow.push({ field: describe(el), fontSize: best, note: 'does not fit even at the smallest size' });
      else if (best <= range[0] && range[0] < range[1]) report.atMinimum.push({ field: describe(el), fontSize: best });
    });
  }

  function checkOverflow() {
    var s = slide();
    if (!s) return;
    var sr = s.getBoundingClientRect();
    var scale = sr.width / size.dw;
    document.querySelectorAll('[data-field]').forEach(function (el) {
      if (el.hasAttribute('data-empty') || el.hasAttribute('data-fit')) return;
      if (el.tagName === 'IMG' || el.classList.contains('kp-photo-empty')) return;
      var style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      // Tall font metrics make scrollHeight a little larger than the line box,
      // so only count vertical overflow of more than a third of a line.
      var fontSize = parseFloat(style.fontSize) || 16;
      var over = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + fontSize * 0.35;
      if (over && el.clientWidth > 0 && el.clientHeight > 0) {
        report.overflow.push({ field: describe(el), note: 'text is longer than its space' });
      }
    });
    document.querySelectorAll('[data-field]:not(img):not(.kp-photo-empty)').forEach(function (el) {
      if (el.hasAttribute('data-empty')) return;
      if (getComputedStyle(el).display === 'none') return;
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      var left = (r.left - sr.left) / scale, top = (r.top - sr.top) / scale;
      var right = (sr.right - r.right) / scale, bottom = (sr.bottom - r.bottom) / scale;
      var min = Math.min(left, top, right, bottom);
      if (min < -1) report.offCanvas.push({ field: describe(el), by: Math.round(-min) });
      else if (min < 40) report.nearEdge.push({ field: describe(el), gap: Math.round(min) });
    });
  }

  function checkFonts() {
    var families = new Set();
    document.querySelectorAll('.kp-slide, .kp-slide *').forEach(function (el) {
      if (!el.textContent || !el.textContent.trim()) return;
      var fam = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
      if (fam) families.add(fam);
    });
    var generic = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];
    families.forEach(function (fam) {
      if (generic.indexOf(fam) >= 0) return;
      var found = false;
      document.fonts.forEach(function (face) {
        if (face.family.replace(/["']/g, '') === fam && face.status === 'loaded') found = true;
      });
      if (!found) report.missingFonts.push(fam);
    });
  }

  function ready() {
    root.setAttribute('data-kp-ready', '1');
  }

  function start() {
    place();
    previewBar();
    drawStars();
    markEmpty();
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.all([fontsReady, photos()]).then(function () {
      // Load every face the slide uses, then measure.
      var loads = [];
      document.querySelectorAll('.kp-slide, .kp-slide *').forEach(function (el) {
        var cs = getComputedStyle(el);
        loads.push(document.fonts.load(cs.fontStyle + ' ' + cs.fontWeight + ' 32px ' + cs.fontFamily).catch(function () {}));
      });
      return Promise.all(loads);
    }).then(function () { return document.fonts.ready; }).then(function () {
      fitText();
      checkOverflow();
      checkFonts();
      return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
    }).then(ready, function (err) {
      report.error = String(err && err.message || err);
      ready();
    });
    if (!rendering) window.addEventListener('resize', place);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
