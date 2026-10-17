// Previews, exports and contact sheets for a post.
import fs from 'node:fs';
import path from 'node:path';
import { postInfo, listSlides } from './posts.mjs';
import { resolveSizes, withBrowser, renderSlide, screenshotPage, describeReport, describeNotes } from './render.mjs';
import { imageSize } from './image-size.mjs';

const MANIFEST = '.kp-export.json';

export function exportName(slug, n, total, ext) {
  return total === 1 ? `${slug}.${ext}` : `${slug}-${String(n).padStart(2, '0')}.${ext}`;
}

function pickSlides(postDir, only) {
  const slides = listSlides(postDir);
  if (!slides.length) throw new Error('This post has no slides yet.');
  if (!only) return { slides, all: slides };
  const wanted = new Set(String(only).split(/[,\s]+/).map((x) => parseInt(x, 10)));
  return { slides: slides.filter((s) => wanted.has(s.n)), all: slides };
}

/**
 * Render slides. mode 'preview' writes previews/<folder>/NN.jpg and a contact sheet;
 * mode 'export' writes exports/<folder>/<slug>-NN.<ext>, replacing the previous export.
 */
export async function renderPost(postDir, { mode = 'preview', sizes, format, quality, slides: only } = {}) {
  const info = postInfo(postDir);
  const sizeList = resolveSizes(sizes || info.sizes || 'default');
  const ext = mode === 'export' ? ((format || info.format || 'jpg') === 'png' ? 'png' : 'jpg') : 'jpg';
  const q = Number(quality || info.quality || (mode === 'export' ? 95 : 90));
  const { slides, all } = pickSlides(postDir, only);
  const result = { post: postDir, mode, sizes: [], problems: [], notes: [] };

  await withBrowser(async (browser) => {
    for (const size of sizeList) {
      const base = path.join(postDir, mode === 'export' ? 'exports' : 'previews', size.folder);
      fs.mkdirSync(base, { recursive: true });
      // An export replaces the previous one, so removed slides don't linger.
      if (mode === 'export' && !only) {
        const manifest = path.join(base, MANIFEST);
        if (fs.existsSync(manifest)) {
          for (const f of JSON.parse(fs.readFileSync(manifest, 'utf8')).files || []) fs.rmSync(path.join(base, f), { force: true });
        }
      }
      const files = [];
      for (const s of slides) {
        const name = mode === 'export' ? exportName(info.slug, s.n, all.length, ext) : `${String(s.n).padStart(2, '0')}.jpg`;
        const out = path.join(base, name);
        const r = await renderSlide(browser, s.file, size, out, { format: ext, quality: q });
        const dims = imageSize(out);
        if (dims.width !== size.width || dims.height !== size.height) {
          result.problems.push(`Slide ${s.n} (${size.name}) came out ${dims.width}×${dims.height}, not ${size.width}×${size.height}.`);
        }
        const label = `Slide ${s.n}${sizeList.length > 1 ? ` (${size.folder})` : ''}`;
        result.problems.push(...describeReport(label, r));
        result.notes.push(...describeNotes(label, r));
        files.push({ n: s.n, file: out, width: dims.width, height: dims.height });
      }
      if (mode === 'export') {
        const manifestFile = path.join(base, MANIFEST);
        let keep = [];
        if (only && fs.existsSync(manifestFile)) keep = JSON.parse(fs.readFileSync(manifestFile, 'utf8')).files || [];
        const names = [...new Set([...keep, ...files.map((f) => path.basename(f.file))])].sort();
        fs.writeFileSync(manifestFile, JSON.stringify({ files: names, size: size.id }, null, 2) + '\n');
      }
      const sheet = path.join(postDir, 'previews', `${size.folder} contact sheet.jpg`);
      await contactSheet(browser, files.map((f) => f.file), sheet, `${info.title}: ${size.name}`);
      result.sizes.push({ id: size.id, name: size.name, folder: base, contactSheet: sheet, files });
    }
  });
  result.problems = [...new Set(result.problems)];
  result.notes = [...new Set(result.notes)];
  return result;
}

/** A single image showing every slide in order, for a quick look. */
export async function contactSheet(browser, files, outFile, title) {
  const dir = path.dirname(outFile);
  fs.mkdirSync(dir, { recursive: true });
  const cols = Math.min(files.length, files.length <= 4 ? files.length : files.length <= 6 ? 3 : 4);
  const thumbW = cols <= 2 ? 520 : cols === 3 ? 420 : 340;
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:28px;background:#ece5da;font:500 15px/1.3 -apple-system,"Helvetica Neue",Arial,sans-serif;color:#3a2e27;width:max-content}
    h1{font-size:17px;margin:0 0 18px;font-weight:600}
    .grid{display:grid;grid-template-columns:repeat(${cols},${thumbW}px);gap:22px}
    figure{margin:0} img{width:100%;display:block;box-shadow:0 2px 10px rgba(0,0,0,.18)}
    figcaption{margin-top:6px;opacity:.7}
  </style><h1>${escape(title)}</h1><div class="grid">${files
    .map((f, i) => `<figure><img src="${encodeURI(path.relative(dir, f).split(path.sep).join('/'))}"><figcaption>${i + 1}</figcaption></figure>`)
    .join('')}</div>`;
  const page = path.join(dir, '.contact-sheet.html');
  fs.writeFileSync(page, html);
  try {
    await screenshotPage(browser, page, outFile, { width: cols * thumbW + (cols - 1) * 22 + 56 });
  } finally {
    fs.rmSync(page, { force: true });
  }
  return outFile;
}

function escape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
