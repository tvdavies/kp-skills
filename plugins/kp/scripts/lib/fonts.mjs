// Fonts: the bundled library, reading font files, adding fonts to a post.
import fs from 'node:fs';
import path from 'node:path';
import { FONTS_DIR, postsRoot, MY_FONTS, UserError } from './paths.mjs';

/** Every post gets these; brand.css declares them. */
export const CORE_FONT_DIRS = ['poppins', 'lora'];

const FONT_EXT = /\.(ttf|otf|woff2?)$/i;

/** Read family, style and weight from a TTF/OTF file's name and OS/2 tables. */
export function readFontInfo(file) {
  const buf = fs.readFileSync(file);
  const info = { file, family: null, subfamily: null, weight: null, weightRange: null, italic: false, variable: false };
  const tag = buf.toString('latin1', 0, 4);
  if (tag === 'wOFF' || tag === 'wOF2') return guessFromName(file, info);
  const numTables = buf.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    tables[buf.toString('latin1', o, o + 4)] = { offset: buf.readUInt32BE(o + 8), length: buf.readUInt32BE(o + 12) };
  }
  if (tables.name) {
    const base = tables.name.offset;
    const count = buf.readUInt16BE(base + 2);
    const strings = base + buf.readUInt16BE(base + 4);
    const names = {};
    for (let i = 0; i < count; i++) {
      const r = base + 6 + i * 12;
      const platform = buf.readUInt16BE(r);
      const nameId = buf.readUInt16BE(r + 6);
      const len = buf.readUInt16BE(r + 8);
      const off = strings + buf.readUInt16BE(r + 10);
      let value;
      if (platform === 3 || platform === 0) {
        const b = Buffer.from(buf.subarray(off, off + len));
        b.swap16();
        value = b.toString('utf16le');
      } else if (platform === 1) value = buf.toString('latin1', off, off + len);
      if (value && (names[nameId] === undefined || platform === 3)) names[nameId] = value;
    }
    info.family = names[16] || names[1] || null;
    info.subfamily = names[17] || names[2] || null;
  }
  if (tables['OS/2']) {
    const o = tables['OS/2'].offset;
    info.weight = buf.readUInt16BE(o + 4);
    const fsSelection = buf.readUInt16BE(o + 62);
    info.italic = Boolean(fsSelection & 1);
  }
  if (tables.fvar) {
    info.variable = true;
    const o = tables.fvar.offset;
    const axesOffset = buf.readUInt16BE(o + 4);
    const axisCount = buf.readUInt16BE(o + 8);
    const axisSize = buf.readUInt16BE(o + 10);
    for (let i = 0; i < axisCount; i++) {
      const a = o + axesOffset + i * axisSize;
      if (buf.toString('latin1', a, a + 4) === 'wght') {
        info.weightRange = [Math.round(buf.readInt32BE(a + 4) / 65536), Math.round(buf.readInt32BE(a + 12) / 65536)];
      }
    }
  }
  if (/italic|oblique/i.test(info.subfamily || '')) info.italic = true;
  if (!info.family) return guessFromName(file, info);
  return info;
}

const WEIGHT_WORDS = [
  [/thin|hairline/i, 100], [/extra.?light|ultra.?light/i, 200], [/light/i, 300], [/medium/i, 500],
  [/semi.?bold|demi.?bold/i, 600], [/extra.?bold|ultra.?bold/i, 800], [/black|heavy/i, 900], [/bold/i, 700],
];

function guessFromName(file, info) {
  const base = path.basename(file).replace(FONT_EXT, '').replace(/\[.*\]/, '');
  const [fam, style = ''] = base.split(/[-_]/);
  info.family = info.family || fam.replace(/([a-z])([A-Z])/g, '$1 $2');
  info.italic = info.italic || /italic|oblique/i.test(style);
  if (!info.weight) {
    info.weight = 400;
    for (const [re, w] of WEIGHT_WORDS) if (re.test(style)) { info.weight = w; break; }
  }
  return info;
}

/** The bundled extra families (not copied into posts until asked for). */
export function bundledFamilies() {
  const out = [];
  for (const dir of fs.readdirSync(FONTS_DIR).sort()) {
    const full = path.join(FONTS_DIR, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    const files = fs.readdirSync(full).filter((f) => FONT_EXT.test(f));
    if (!files.length) continue;
    const family = readFontInfo(path.join(full, files[0])).family;
    out.push({ id: dir, family, dir: full, files: files.map((f) => path.join(full, f)), core: CORE_FONT_DIRS.includes(dir) });
  }
  return out;
}

/** Fonts Kirsten has dropped into "KP Posts/My fonts". */
export function myFonts() {
  const dir = path.join(postsRoot(), MY_FONTS);
  if (!fs.existsSync(dir)) return [];
  const byFamily = new Map();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (FONT_EXT.test(e.name)) {
        const info = readFontInfo(p);
        if (!byFamily.has(info.family)) byFamily.set(info.family, []);
        byFamily.get(info.family).push(p);
      }
    }
  };
  walk(dir);
  return [...byFamily.entries()].map(([family, files]) => ({ id: family, family, files, mine: true }));
}

function fontFace(family, relUrl, info) {
  const fmt = { '.ttf': 'truetype', '.otf': 'opentype', '.woff': 'woff', '.woff2': 'woff2' }[path.extname(relUrl).toLowerCase()];
  const weight = info.weightRange ? `${info.weightRange[0]} ${info.weightRange[1]}` : String(info.weight || 400);
  const url = relUrl.split('/').map(encodeURIComponent).join('/');
  return `@font-face { font-family: "${family}"; font-style: ${info.italic ? 'italic' : 'normal'}; font-weight: ${weight}; font-display: block; src: url("${url}") format("${fmt}"); }`;
}

/**
 * Add a font family to a post: copy its files into _kp/fonts/extra and
 * declare it in _kp/fonts-extra.css. `name` is a bundled family, a family
 * in My fonts, or a path to a font file or folder.
 */
export function addFontToPost(postDir, name, { family: familyOverride } = {}) {
  let files;
  let family;
  const asPath = path.resolve(name);
  if (fs.existsSync(asPath)) {
    files = fs.statSync(asPath).isDirectory()
      ? fs.readdirSync(asPath).filter((f) => FONT_EXT.test(f)).map((f) => path.join(asPath, f))
      : [asPath];
  } else {
    const wanted = name.toLowerCase().replace(/\s+/g, '');
    const match = [...myFonts(), ...bundledFamilies()].find((f) => f.id.toLowerCase().replace(/\s+/g, '') === wanted || (f.family || '').toLowerCase().replace(/\s+/g, '') === wanted);
    if (!match) {
      const names = bundledFamilies().map((f) => f.family);
      throw new UserError(`No font called "${name}". Bundled: ${names.join(', ')}. Or put the font files in "${path.join(postsRoot(), MY_FONTS)}".`);
    }
    if (match.core) return { family: match.family, files: [], already: true };
    files = match.files;
  }
  if (!files.length) throw new UserError(`No font files (.ttf, .otf, .woff, .woff2) in ${name}.`);
  const infos = files.map(readFontInfo);
  family = familyOverride || infos[0].family;
  const destDir = path.join(postDir, '_kp', 'fonts', 'extra', family.replace(/[^A-Za-z0-9 ._-]/g, ''));
  fs.mkdirSync(destDir, { recursive: true });
  const cssFile = path.join(postDir, '_kp', 'fonts-extra.css');
  let css = fs.existsSync(cssFile) ? fs.readFileSync(cssFile, 'utf8') : '';
  const lines = [];
  for (const info of infos) {
    const dest = path.join(destDir, path.basename(info.file));
    fs.copyFileSync(info.file, dest);
    const rel = path.relative(path.join(postDir, '_kp'), dest).split(path.sep).join('/');
    const rule = fontFace(family, rel, info);
    if (!css.includes(`src: url("${rel.split('/').map(encodeURIComponent).join('/')}")`)) lines.push(rule);
  }
  // Licence files travel with the font.
  for (const lic of ['OFL.txt', 'LICENSE.txt', 'LICENCE.txt', 'LICENSE']) {
    const src = path.join(path.dirname(files[0]), lic);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(destDir, lic));
  }
  if (lines.length) {
    css = `${css.trimEnd()}\n/* ${family} */\n${lines.join('\n')}\n`.replace(/^\n/, '');
    fs.writeFileSync(cssFile, css);
  }
  return { family, files: infos.map((i) => path.basename(i.file)), already: lines.length === 0 };
}
