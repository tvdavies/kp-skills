// Posts: the folder for one Instagram/Facebook post (one image or a carousel).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  BRAND_DIR, FONTS_DIR, POSTS_MARKER, MY_TEMPLATES, MY_FONTS, postsRoot, readJson, writeJson,
  slugify, today, copyDir, UserError,
} from './paths.mjs';
import { CORE_FONT_DIRS, addFontToPost } from './fonts.mjs';
import { findTemplate, fillHtml, slideFields } from './templates.mjs';
import { renameSlidesInNotes } from './notes.mjs';

export const PHOTO_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const CONVERT_EXT = /\.(heic|heif|tiff?)$/i;

const POSTS_README = `KP Posts
========

Each folder here is one post (a single image or a carousel), made with the
kp-post skill in Claude.

Inside a post folder:
  photos/     the photos used in the post (copies; your originals are untouched)
  slides/     one web page per slide; Claude edits these
  preview.html  the live preview: open it to see every slide, and leave notes for Claude
  notes.json    the notes you left on the preview
  exports/    the finished images to upload, in one folder per platform
  _kp/        the brand styles and fonts this post was made with

My templates/  your own templates. They survive plugin updates.
My fonts/      font files you want to use. Drop .ttf or .otf files in here.
`;

const CLAUDE_BEGIN = '<!-- kp-skills: begin (this part is updated by the kp plugin) -->';
const CLAUDE_END = '<!-- kp-skills: end -->';
const CLAUDE_BLOCK = `${CLAUDE_BEGIN}
# KP Posts

This folder holds Kirsten Photography's social media posts, one folder per
post, made with the **kp** plugin. Kirsten isn't technical: talk about
photos, words, colours and slides, not code, and use British English.

- To make, change, preview or export a post, use the **kp-post** skill. If
  she says she's left notes, they're on a post's preview page: read them
  with the kp-post skill's notes command.
- For reusable layouts ("save this as a template"), use **kp-template**.
- For set-up, errors, "where are my posts" or "what can you do", use
  **kp-help**.
- Run the kp tool as the skills describe; don't hand-make images another way.
- Never delete posts, photos, templates or fonts. Removed slides go to the
  post's "removed slides" folder.
- Default exports are Instagram 4:5 (1080×1350) and Facebook square
  (1080×1080); make other sizes only when she asks.
- No social handles on images; they go in the caption.
- Brand-wide change requests (new colour, new default font): note them in
  "Brand requests.md" in this folder for Tom.
${CLAUDE_END}`;

/** Write or refresh the managed part of the posts folder's CLAUDE.md, keeping anything else in it. */
export function ensureClaudeMd(root) {
  const file = path.join(root, 'CLAUDE.md');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `${CLAUDE_BLOCK}\n\n# Kirsten's notes\n\nAnything written below here is kept when the plugin updates.\n`);
    return 'created';
  }
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf(CLAUDE_BEGIN);
  const end = text.indexOf(CLAUDE_END);
  let next;
  if (start !== -1 && end > start) next = text.slice(0, start) + CLAUDE_BLOCK + text.slice(end + CLAUDE_END.length);
  else next = `${CLAUDE_BLOCK}\n\n${text}`;
  if (next === text) return 'unchanged';
  fs.writeFileSync(file, next);
  return 'updated';
}

/** Make sure the posts folder exists, with its marker, CLAUDE.md and the My folders. */
export function ensurePostsRoot(root = postsRoot()) {
  fs.mkdirSync(root, { recursive: true });
  const marker = path.join(root, POSTS_MARKER);
  if (!fs.existsSync(marker)) fs.writeFileSync(marker, 'This folder holds KP posts made with the kp-skills Claude plugin.\n');
  for (const d of [MY_TEMPLATES, MY_FONTS]) fs.mkdirSync(path.join(root, d), { recursive: true });
  const readme = path.join(root, 'READ ME.txt');
  if (!fs.existsSync(readme)) fs.writeFileSync(readme, POSTS_README);
  ensureClaudeMd(root);
  return root;
}

/** Copy the brand files and core fonts into a post's _kp folder. */
export function installBrand(postDir, { keepExtraFonts = true } = {}) {
  const kp = path.join(postDir, '_kp');
  fs.mkdirSync(kp, { recursive: true });
  for (const f of ['brand.css', 'kp.js']) fs.copyFileSync(path.join(BRAND_DIR, f), path.join(kp, f));
  const extraCss = path.join(kp, 'fonts-extra.css');
  if (!fs.existsSync(extraCss) || !keepExtraFonts) fs.copyFileSync(path.join(BRAND_DIR, 'fonts-extra.css'), extraCss);
  for (const dir of CORE_FONT_DIRS) copyDir(path.join(FONTS_DIR, dir), path.join(kp, 'fonts', dir));
}

export function createPost(title, { date = today(), root = postsRoot() } = {}) {
  if (!title || !String(title).trim()) throw new UserError('Give the post a short title, such as "Smith family autumn".');
  ensurePostsRoot(root);
  const clean = String(title).trim().replace(/[/:\\]/g, '-');
  let name = `${date} ${clean}`;
  let n = 2;
  while (fs.existsSync(path.join(root, name))) name = `${date} ${clean} (${n++})`;
  const dir = path.join(root, name);
  for (const d of ['photos', 'slides', 'exports']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  installBrand(dir);
  writeJson(path.join(dir, 'post.json'), {
    title: clean,
    slug: slugify(clean),
    created: date,
    sizes: 'default',
    format: 'jpg',
  });
  return dir;
}

export function postInfo(postDir) {
  const info = readJson(path.join(postDir, 'post.json'));
  return { ...info, slug: info.slug || slugify(info.title || path.basename(postDir)) };
}

/** The post's slides in order: [{ n, file, name, template }]. */
export function listSlides(postDir) {
  const dir = path.join(postDir, 'slides');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /^\d+.*\.html$/i.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b))
    .map((f, i) => ({ n: i + 1, file: path.join(dir, f), name: f, template: f.replace(/^\d+-?/, '').replace(/\.html$/i, '') }));
}

export function slideByNumber(postDir, n) {
  const slides = listSlides(postDir);
  const num = parseInt(n, 10);
  const s = slides.find((x) => x.n === num);
  if (!s) throw new UserError(`This post has ${slides.length} slide${slides.length === 1 ? '' : 's'}; there's no slide ${n}.`);
  return s;
}

/** Rename slide files so they are numbered 01, 02, ... in the given order. */
function renumber(postDir, ordered) {
  const dir = path.join(postDir, 'slides');
  const temps = ordered.map((s, i) => {
    const tmp = path.join(dir, `.renumber-${i}-${process.pid}.html`);
    fs.renameSync(s.file, tmp);
    return { tmp, template: s.template };
  });
  const map = {};
  temps.forEach((t, i) => {
    const name = `${String(i + 1).padStart(2, '0')}-${t.template}.html`;
    fs.renameSync(t.tmp, path.join(dir, name));
    map[`slides/${ordered[i].name}`] = `slides/${name}`;
  });
  // Notes left on the preview page follow their slide.
  for (const k of Object.keys(map)) if (map[k] === k) delete map[k];
  renameSlidesInNotes(postDir, map);
}

/** Turn a photo value into a src relative to the slide, copying outside files into photos/. */
export function photoSrc(postDir, value) {
  if (!value) return '';
  const v = String(value).trim();
  if (v.startsWith('../photos/')) return v;
  const inPost = path.join(postDir, 'photos', v);
  if (fs.existsSync(inPost)) return `../photos/${v}`;
  const abs = path.resolve(v.replace(/^~(?=\/)/, process.env.HOME || '~'));
  if (fs.existsSync(abs)) return `../photos/${addPhotos(postDir, [abs])[0]}`;
  throw new UserError(`Can't find the photo "${v}". Add it to the post first, or give its full path.`);
}

function resolveValues(postDir, values, templateFields = []) {
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    const kind = templateFields.find((f) => f.key === k)?.kind;
    if (kind === 'photo' || /^photo/.test(k)) {
      if (v && typeof v === 'object') out[k] = { ...v, src: v.src !== undefined ? photoSrc(postDir, v.src) : undefined };
      else out[k] = { src: photoSrc(postDir, v) };
    } else out[k] = v;
  }
  return out;
}

export function addSlide(postDir, templateId, { at, values = {}, tone } = {}) {
  const t = findTemplate(templateId);
  const slides = listSlides(postDir);
  let html = fs.readFileSync(t.html, 'utf8');
  const filled = fillHtml(html, resolveValues(postDir, tone ? { ...values, tone } : values, t.fields));
  html = filled.html;
  const dir = path.join(postDir, 'slides');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${String(slides.length + 1).padStart(2, '0')}-${t.id}.html`);
  fs.writeFileSync(file, html);
  // Fonts the template needs beyond the brand fonts.
  const fontWarnings = [];
  for (const family of t.fonts || []) {
    try {
      addFontToPost(postDir, family);
    } catch (err) {
      fontWarnings.push(`This template uses the font "${family}", which isn't bundled or in My fonts: ${err.message}`);
    }
  }
  const position = at ? Math.max(1, Math.min(parseInt(at, 10), slides.length + 1)) : slides.length + 1;
  if (position !== slides.length + 1) {
    const all = listSlides(postDir);
    const added = all.find((s) => s.file === file);
    const rest = all.filter((s) => s.file !== file);
    rest.splice(position - 1, 0, added);
    renumber(postDir, rest);
  }
  return { n: position, template: t, unknown: filled.unknown, fontWarnings, file: slideByNumber(postDir, position).file };
}

export function fillSlide(postDir, n, values) {
  const s = slideByNumber(postDir, n);
  let t;
  try { t = findTemplate(s.template); } catch { t = { fields: [] }; }
  const html = fs.readFileSync(s.file, 'utf8');
  const filled = fillHtml(html, resolveValues(postDir, values, t.fields));
  fs.writeFileSync(s.file, filled.html);
  return { slide: s, unknown: filled.unknown, fields: slideFields(filled.html).map((f) => f.key) };
}

export function moveSlide(postDir, from, to) {
  const slides = listSlides(postDir);
  const s = slideByNumber(postDir, from);
  const rest = slides.filter((x) => x.n !== s.n);
  const pos = Math.max(1, Math.min(parseInt(to, 10), slides.length));
  rest.splice(pos - 1, 0, s);
  renumber(postDir, rest);
}

export function duplicateSlide(postDir, n) {
  const s = slideByNumber(postDir, n);
  const slides = listSlides(postDir);
  const copy = path.join(postDir, 'slides', `${String(slides.length + 1).padStart(2, '0')}-${s.template}.html`);
  fs.copyFileSync(s.file, copy);
  const all = listSlides(postDir);
  const added = all.find((x) => x.file === copy);
  const rest = all.filter((x) => x.file !== copy);
  rest.splice(s.n, 0, added);
  renumber(postDir, rest);
  return s.n + 1;
}

/** Remove a slide by moving it to the post's "removed slides" folder (never deleted). */
export function removeSlide(postDir, n) {
  const s = slideByNumber(postDir, n);
  const bin = path.join(postDir, 'removed slides');
  fs.mkdirSync(bin, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.renameSync(s.file, path.join(bin, `${stamp}-${s.name}`));
  renameSlidesInNotes(postDir, { [`slides/${s.name}`]: `removed slides/${stamp}-${s.name}` });
  renumber(postDir, listSlides(postDir));
  return s;
}

/** Copy photos into the post. HEIC/TIFF are converted to JPEG with macOS sips. */
export function addPhotos(postDir, files) {
  const dest = path.join(postDir, 'photos');
  fs.mkdirSync(dest, { recursive: true });
  const added = [];
  for (const f of files) {
    const src = path.resolve(String(f).replace(/^~(?=\/)/, process.env.HOME || '~'));
    if (!fs.existsSync(src)) throw new UserError(`Can't find the photo ${f}.`);
    if (fs.statSync(src).isDirectory()) {
      const inner = fs.readdirSync(src).filter((x) => PHOTO_EXT.test(x) || CONVERT_EXT.test(x)).sort().map((x) => path.join(src, x));
      added.push(...addPhotos(postDir, inner));
      continue;
    }
    let base = path.basename(src).replace(/\s+/g, '-');
    const convert = CONVERT_EXT.test(base);
    if (convert) base = base.replace(CONVERT_EXT, '.jpg');
    if (!convert && !PHOTO_EXT.test(base)) throw new UserError(`${path.basename(src)} isn't a photo type the renderer can use (JPEG, PNG, WebP, HEIC).`);
    let target = path.join(dest, base);
    if (fs.existsSync(target) && !sameFile(src, target)) {
      const ext = path.extname(base);
      let i = 2;
      while (fs.existsSync(target)) target = path.join(dest, `${path.basename(base, ext)}-${i++}${ext}`);
    }
    if (!fs.existsSync(target)) {
      if (convert) {
        if (process.platform !== 'darwin') throw new UserError(`${path.basename(src)} needs converting to JPEG first (only possible on a Mac).`);
        execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '95', src, '--out', target], { stdio: 'ignore' });
      } else fs.copyFileSync(src, target);
    }
    added.push(path.basename(target));
  }
  return added;
}

function sameFile(a, b) {
  try {
    const sa = fs.statSync(a);
    const sb = fs.statSync(b);
    return sa.size === sb.size && fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

export function describePost(postDir) {
  const info = postInfo(postDir);
  const slides = listSlides(postDir).map((s) => {
    const html = fs.readFileSync(s.file, 'utf8');
    const tone = (html.match(/class="[^"]*\bkp-slide\b[^"]*"[^>]*data-tone="([^"]+)"/) || html.match(/data-tone="([^"]+)"[^>]*class="[^"]*\bkp-slide\b/) || [])[1];
    return { n: s.n, file: path.relative(postDir, s.file), template: s.template, tone, fields: slideFields(html) };
  });
  const photos = fs.existsSync(path.join(postDir, 'photos')) ? fs.readdirSync(path.join(postDir, 'photos')).filter((f) => PHOTO_EXT.test(f)) : [];
  return { folder: postDir, ...info, photos, slides };
}
