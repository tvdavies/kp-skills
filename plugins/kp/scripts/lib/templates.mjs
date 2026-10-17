// Templates: listing, copying into posts, filling fields.
import fs from 'node:fs';
import path from 'node:path';
import { TEMPLATES_DIR, myTemplatesDir, readJson, UserError } from './paths.mjs';

/** All templates, Kirsten's own first. Her template wins when ids clash. */
export function listTemplates() {
  const seen = new Set();
  const out = [];
  const add = (dir, source) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir).sort()) {
      const tdir = path.join(dir, name);
      const meta = path.join(tdir, 'template.json');
      const html = path.join(tdir, 'template.html');
      if (!fs.existsSync(meta) || !fs.existsSync(html)) continue;
      let info;
      try {
        info = readJson(meta);
      } catch (err) {
        info = { id: name, name, description: `(template.json is broken: ${err.message})` };
      }
      const id = info.id || name;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ ...info, id, dir: tdir, html, source });
    }
  };
  add(myTemplatesDir(), 'mine');
  add(TEMPLATES_DIR, 'built-in');
  const order = (t) => (typeof t.order === 'number' ? t.order : 100);
  return out.sort((a, b) => (a.source === b.source ? order(a) - order(b) || a.id.localeCompare(b.id) : a.source === 'mine' ? 1 : -1));
}

export function findTemplate(id) {
  const all = listTemplates();
  const t = all.find((x) => x.id === id) || all.find((x) => x.name && x.name.toLowerCase() === String(id).toLowerCase());
  if (!t) throw new UserError(`No template called "${id}". Templates: ${all.map((x) => x.id).join(', ')}`);
  return t;
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeHtml(s).replace(/"/g, '&quot;');

/** Plain text to slide HTML: *words* become italic, new lines become line breaks. */
export function textToHtml(text) {
  return escapeHtml(text)
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\r?\n/g, '<br>');
}

/** Locate the element carrying data-field="key": [startTagStart, startTagEnd, closeStart, closeEnd]. */
function findField(html, key) {
  const re = new RegExp(`<([a-zA-Z][a-zA-Z0-9-]*)\\b[^>]*\\bdata-field="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'g');
  const m = re.exec(html);
  if (!m) return null;
  const tag = m[1].toLowerCase();
  const start = m.index;
  const openEnd = m.index + m[0].length;
  const voids = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source']);
  if (voids.has(tag) || m[0].endsWith('/>')) return { tag, start, openEnd, closeStart: openEnd, closeEnd: openEnd, open: m[0], isVoid: true };
  const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  tagRe.lastIndex = openEnd;
  let depth = 1;
  let t;
  while ((t = tagRe.exec(html))) {
    depth += t[1] ? -1 : 1;
    if (depth === 0) return { tag, start, openEnd, closeStart: t.index, closeEnd: t.index + t[0].length, open: m[0], isVoid: false };
  }
  throw new UserError(`The ${key} field in this slide isn't closed properly.`);
}

function setAttr(openTag, name, value) {
  const re = new RegExp(`\\s${name}="[^"]*"`);
  const attr = ` ${name}="${escapeAttr(value)}"`;
  if (re.test(openTag)) return openTag.replace(re, attr);
  return openTag.replace(/\s*\/?>$/, (end) => `${attr}${end.trim() === '/>' ? ' />' : '>'}`);
}

function setStyleVar(openTag, name, value) {
  const m = openTag.match(/\sstyle="([^"]*)"/);
  let style = m ? m[1] : '';
  const re = new RegExp(`${name}\\s*:\\s*[^;]*;?\\s*`);
  style = style.replace(re, '').trim();
  style = `${style}${style && !style.endsWith(';') ? '; ' : style ? ' ' : ''}${name}: ${value};`;
  return setAttr(openTag, 'style', style);
}

/**
 * Fill a slide's fields. values: { field: text | { src, focusX, focusY, zoom } | number }.
 * Special keys: tone. Returns { html, unknown: [...] }.
 */
export function fillHtml(html, values) {
  const unknown = [];
  for (const [key, raw] of Object.entries(values)) {
    if (key === 'tone') {
      html = html.replace(/(<[a-z]+\b[^>]*class="[^"]*\bkp-slide\b[^"]*"[^>]*>)/, (tag) => setAttr(tag, 'data-tone', String(raw)));
      continue;
    }
    const f = findField(html, key);
    if (!f) {
      unknown.push(key);
      continue;
    }
    let open = f.open;
    if (f.tag === 'img') {
      const v = typeof raw === 'object' && raw !== null ? raw : { src: raw };
      if (v.src !== undefined) open = setAttr(open, 'src', v.src || '');
      if (v.focusX !== undefined) open = setStyleVar(open, '--focus-x', pct(v.focusX));
      if (v.focusY !== undefined) open = setStyleVar(open, '--focus-y', pct(v.focusY));
      if (v.zoom !== undefined) open = setStyleVar(open, '--zoom', String(v.zoom));
      if (v.alt !== undefined) open = setAttr(open, 'alt', v.alt);
      html = html.slice(0, f.start) + open + html.slice(f.openEnd);
      continue;
    }
    if (/\bdata-stars="/.test(open)) {
      open = setAttr(open, 'data-stars', String(raw));
      html = html.slice(0, f.start) + open + html.slice(f.closeStart);
      continue;
    }
    html = html.slice(0, f.openEnd) + textToHtml(raw ?? '') + html.slice(f.closeStart);
  }
  return { html, unknown };
}

function pct(v) {
  if (typeof v === 'number') return `${v}%`;
  return /%$/.test(String(v)) ? String(v) : `${v}%`;
}

/** The fields a slide file actually has, with their current text. */
export function slideFields(html) {
  const out = [];
  const re = /<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*\bdata-field="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const key = m[2];
    if (out.some((f) => f.key === key)) continue;
    const f = findField(html, key);
    let value;
    if (f.tag === 'img') value = (m[0].match(/\ssrc="([^"]*)"/) || [])[1] || '';
    else if (/data-stars="/.test(m[0])) value = (m[0].match(/data-stars="([^"]*)"/) || [])[1];
    else value = html.slice(f.openEnd, f.closeStart).replace(/<br\s*\/?>/g, '\n').replace(/<\/?em>/g, '*').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    out.push({ key, value });
  }
  return out;
}
