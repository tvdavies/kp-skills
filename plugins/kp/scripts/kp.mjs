#!/usr/bin/env node
// kp: make Kirsten Photography post images from HTML templates.
// Run `node kp.mjs help` for the commands. Skills call this; people rarely need to.
import fs from 'node:fs';
import path from 'node:path';
import {
  PLUGIN_ROOT, TEMPLATES_DIR, postsRoot, myTemplatesDir, resolvePost, readJson, writeJson, slugify, UserError,
} from './lib/paths.mjs';
import { listTemplates, findTemplate, slideFields } from './lib/templates.mjs';
import {
  ensurePostsRoot, createPost, installBrand, addSlide, fillSlide, moveSlide, duplicateSlide, removeSlide,
  addPhotos, describePost, listSlides, slideByNumber,
} from './lib/posts.mjs';
import { loadSizes } from './lib/render.mjs';
import { renderPost } from './lib/output.mjs';
import { addFontToPost, bundledFamilies, myFonts } from './lib/fonts.mjs';
import { writePreviewPage, ensureServer, stopServer, serve, previewUrl, ensureLaunchConfig } from './lib/preview.mjs';
import { openNotes, readNotes, setStatus, describeNotes } from './lib/notes.mjs';

const HELP = `kp: Kirsten Photography post maker

Posts folder: ${postsRoot()}

  init                                   create the posts folder
  templates [--json]                     list templates
  sizes                                  list output sizes (* = exported by default)
  fonts                                  list fonts that can be added to a post
  new "<title>" [--date YYYY-MM-DD]      make a new post folder; prints its path
  show <post> [--json]                   slides, fields and photos in a post
  photos <post> <file|folder>...         copy photos into the post (HEIC is converted)
  add <post> <template> [--at N] [--tone T] [--set key=value]... [--json '{...}']
  fill <post> <slide> [--set key=value]... [--json '{...}']
  move <post> <slide> <to>               reorder
  duplicate <post> <slide>
  remove <post> <slide>                  moves it to "removed slides" (not deleted)
  preview <post> [--sizes ig,fb] [--no-check]
                                         live preview page (preview.html) for Kirsten, plus
                                         layout checks and check images for Claude
  notes <post> [--all] [--json]          notes Kirsten left on the preview page
  resolve <post> <id>...                 mark notes as done
  export <post> [--sizes default|all|ig,fb,...] [--format jpg|png] [--quality 95] [--slides 1,3]
                                         the final images (only export makes these)
  add-font <post> <family|file|folder> [--family "Name"]
  refresh <post>                         update the post's brand files to this plugin version
  save-template <post> <slide> "<name>" [--id id] [--description "..."]
  copy-template <template> "<new name>"  copy a template into My templates to change it
  example <name> [--title "..."]         make an example post (names: ${exampleNames().join(', ') || 'none'})
  gallery [--sizes ig,fb] [--out dir]    every template with sample content, as a preview
  serve [--port N] | stop-preview        run / stop the preview helper (preview starts it itself)

<post> is a post folder path, or part of its name. <slide> is its number.
Text values: *word* becomes italic; \\n or a real new line is a line break.
Photo values: a file in the post's photos folder, or a full path (it gets copied in).
`;

function parseArgs(argv) {
  const pos = [];
  const opts = { set: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split(/=(.*)/s, 2);
      const val = inline !== undefined ? inline : argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      if (k === 'set') opts.set.push(val);
      else opts[k] = val;
    } else pos.push(a);
  }
  return { pos, opts };
}

function valuesFrom(opts) {
  const values = {};
  if (opts.json) Object.assign(values, JSON.parse(opts.json));
  if (opts['json-file']) Object.assign(values, readJson(opts['json-file']));
  for (const s of opts.set) {
    const i = String(s).indexOf('=');
    if (i < 1) throw new UserError(`--set needs key=value, got "${s}".`);
    values[s.slice(0, i)] = s.slice(i + 1).replace(/\\n/g, '\n');
  }
  return values;
}

function exampleNames() {
  const dir = path.join(PLUGIN_ROOT, 'examples');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')) : [];
}

function print(lines) {
  console.log(Array.isArray(lines) ? lines.join('\n') : lines);
}

function renderLines(result) {
  const out = [];
  if (result.mode === 'export') {
    for (const s of result.sizes) {
      out.push(`${s.name}: ${s.files.length} image${s.files.length === 1 ? '' : 's'} in ${s.folder}`);
      for (const f of s.files) out.push(`  ${path.basename(f.file)}  ${f.width}×${f.height}`);
    }
    out.push('', 'Check images (for you, Claude; Kirsten uses the exports folders):');
  } else out.push('Check images (for you, Claude, to look at with Read; not for Kirsten):');
  for (const s of result.sizes) out.push(`  ${s.name}: ${s.contactSheet}`);
  if (result.problems.length) {
    out.push('', 'Needs attention:');
    out.push(...result.problems.map((p) => `  - ${p}`));
  } else out.push('', 'All slides rendered cleanly.');
  if (result.notes.length) {
    out.push('', 'Worth a look:');
    out.push(...result.notes.map((p) => `  - ${p}`));
  }
  return out;
}

function unknownWarning(unknown, fields) {
  if (!unknown.length) return [];
  return [`Ignored unknown field${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. This slide's fields: ${fields.join(', ') || '(none)'}.`];
}

/** Copy sample photos (from examples/photos or a template's folder) into a post. */
function samplePhotos(dir, values, searchDirs) {
  const out = { ...values };
  for (const [k, v] of Object.entries(out)) {
    if (!/^photo/.test(k) || !v) continue;
    const src = typeof v === 'object' ? v.src : v;
    const found = searchDirs.map((d) => path.join(d, src)).find((p) => fs.existsSync(p));
    const file = found ? addPhotos(dir, [found])[0] : '';
    out[k] = typeof v === 'object' ? { ...v, src: file } : file;
  }
  return out;
}

const EXAMPLE_PHOTOS = path.join(PLUGIN_ROOT, 'examples', 'photos');

function buildExample(name, { title, root } = {}) {
  const spec = readJson(path.join(PLUGIN_ROOT, 'examples', `${name}.json`));
  const dir = createPost(title || spec.title, { root });
  for (const slide of spec.slides) {
    const values = samplePhotos(dir, slide.values || {}, [EXAMPLE_PHOTOS]);
    addSlide(dir, slide.template, { values, tone: slide.tone });
  }
  if (spec.caption) fs.writeFileSync(path.join(dir, 'caption.txt'), spec.caption + '\n');
  return dir;
}

/** The posts folder a post belongs to (its parent, for posts kept elsewhere). */
function rootOf(post) {
  const root = postsRoot();
  return path.resolve(post).startsWith(root + path.sep) ? root : path.dirname(path.resolve(post));
}

/** preview: the live page for Kirsten, checks and check images for Claude. Returns lines to print. */
async function preview(post, opts) {
  const page = writePreviewPage(post, { sizes: opts.sizes });
  const lines = [];
  if (!opts['no-server']) {
    const root = rootOf(post);
    const base = await ensureServer(root);
    if (base) {
      if (root === postsRoot()) ensureLaunchConfig(root, Number(new URL(base).port));
      lines.push(`Preview for Kirsten (live; updates by itself and takes her notes): ${previewUrl(base, post, root)}`);
    } else lines.push(`The live preview helper wouldn't start. The page still works without live updates or notes: ${page}`);
  } else lines.push(`Preview page: ${page}`);
  const open = openNotes(post).length;
  if (open) lines.push(`She has left ${open} note${open === 1 ? '' : 's'}: run notes to read ${open === 1 ? 'it' : 'them'}.`);
  if (opts['no-check']) return lines;
  const result = await renderPost(post, { mode: 'preview', sizes: opts.sizes });
  if (opts.json) return [JSON.stringify(result, null, 2)];
  if (result.problems.length && opts.strict) process.exitCode = 2;
  return [...lines, '', ...renderLines(result)];
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, opts } = parseArgs(rest);
  switch (cmd) {
    case undefined:
    case 'help':
    case '--help':
      return print(HELP);

    case 'init': {
      const root = ensurePostsRoot();
      return print(`Posts folder ready: ${root}`);
    }

    case 'templates': {
      const all = listTemplates();
      if (opts.json) return print(JSON.stringify(all.map(({ dir, html, ...t }) => ({ ...t, folder: dir })), null, 2));
      return print(all.map((t) => `${t.id.padEnd(16)} ${t.name}${t.source === 'mine' ? ' (yours)' : ''}\n${' '.repeat(17)}${t.description}\n${' '.repeat(17)}fields: ${(t.fields || []).map((f) => f.key + (f.optional ? '?' : '')).join(', ') || '(none)'}`));
    }

    case 'sizes':
      return print(loadSizes().map((s) => `${s.default ? '*' : ' '} ${s.id.padEnd(13)} ${String(s.width + '×' + s.height).padEnd(10)} ${s.name}`));

    case 'fonts': {
      const lines = ['Bundled (free to use, licences included):'];
      for (const f of bundledFamilies()) lines.push(`  ${f.family}${f.core ? '  (brand font, in every post)' : ''}`);
      const mine = myFonts();
      lines.push('', `Yours (in ${path.join(postsRoot(), 'My fonts')}):`);
      lines.push(...(mine.length ? mine.map((f) => `  ${f.family}  (${f.files.length} file${f.files.length === 1 ? '' : 's'})`) : ['  none yet']));
      return print(lines);
    }

    case 'new': {
      const dir = createPost(pos.join(' ') || opts.title, { date: opts.date });
      return print(dir);
    }

    case 'show': {
      const d = describePost(resolvePost(pos[0]));
      if (opts.json) return print(JSON.stringify(d, null, 2));
      const lines = [`${d.title}  (${d.folder})`, `Photos: ${d.photos.join(', ') || 'none'}`, `Slides:`];
      for (const s of d.slides) {
        lines.push(`  ${s.n}. ${s.template}${s.tone ? ` [${s.tone}]` : ''}`);
        for (const f of s.fields) lines.push(`       ${f.key}: ${JSON.stringify(f.value)}`);
      }
      if (!d.slides.length) lines.push('  none yet');
      return print(lines);
    }

    case 'photos': {
      const post = resolvePost(pos[0]);
      const added = addPhotos(post, pos.slice(1));
      return print(added.length ? `Added: ${added.join(', ')}` : 'No photos found.');
    }

    case 'add': {
      const post = resolvePost(pos[0]);
      const r = addSlide(post, pos[1], { at: opts.at, tone: opts.tone, values: valuesFrom(opts) });
      return print([`Added slide ${r.n} (${r.template.name}): ${r.file}`, ...unknownWarning(r.unknown, (r.template.fields || []).map((f) => f.key)), ...r.fontWarnings]);
    }

    case 'fill': {
      const post = resolvePost(pos[0]);
      const r = fillSlide(post, pos[1], valuesFrom(opts));
      return print([`Updated slide ${r.slide.n}.`, ...unknownWarning(r.unknown, r.fields)]);
    }

    case 'move': {
      const post = resolvePost(pos[0]);
      moveSlide(post, pos[1], pos[2]);
      return print(listSlides(post).map((s) => `${s.n}. ${s.template}`));
    }

    case 'duplicate': {
      const post = resolvePost(pos[0]);
      const n = duplicateSlide(post, pos[1]);
      return print(`Copied slide ${pos[1]} to slide ${n}.`);
    }

    case 'remove': {
      const post = resolvePost(pos[0]);
      const s = removeSlide(post, pos[1]);
      return print(`Removed slide ${s.n} (moved to "removed slides").`);
    }

    case 'preview': {
      const post = resolvePost(pos[0]);
      return print(await preview(post, opts));
    }

    case 'notes': {
      const post = resolvePost(pos[0]);
      const notes = opts.all ? readNotes(post) : openNotes(post);
      if (opts.json) return print(JSON.stringify(notes, null, 2));
      return print(describeNotes(post, notes));
    }

    case 'resolve': {
      const post = resolvePost(pos[0]);
      if (pos.length < 2) throw new UserError('Which notes? Give their numbers, e.g. resolve <post> 1 2.');
      const r = setStatus(post, pos.slice(1), opts.withdraw ? 'withdrawn' : 'done');
      const lines = [r.changed.length ? `Marked done: ${r.changed.map((i) => '#' + i).join(', ')}.` : 'Nothing changed.'];
      if (r.missing.length) lines.push(`No such note: ${r.missing.map((i) => '#' + i).join(', ')}.`);
      const left = openNotes(post).length;
      lines.push(left ? `${left} note${left === 1 ? '' : 's'} still open.` : 'No open notes left.');
      return print(lines);
    }

    case 'serve': {
      const root = opts.root ? path.resolve(opts.root) : postsRoot();
      const server = await serve({ root, port: Number(opts.port) || 0 });
      return print(`Preview helper running at http://127.0.0.1:${server.address().port} for ${root}`);
    }

    case 'stop-preview': {
      const root = opts.root ? path.resolve(opts.root) : postsRoot();
      return print((await stopServer(root)) ? 'Preview helper stopped.' : 'No preview helper was running.');
    }

    case 'export': {
      const post = resolvePost(pos[0]);
      const result = await renderPost(post, { mode: cmd, sizes: opts.sizes, format: opts.format, quality: opts.quality, slides: opts.slides });
      if (opts.json) return print(JSON.stringify(result, null, 2));
      print(renderLines(result));
      if (result.problems.length && opts.strict) process.exitCode = 2;
      return;
    }

    case 'add-font': {
      const post = resolvePost(pos[0]);
      const r = addFontToPost(post, pos.slice(1).join(' '), { family: opts.family });
      return print(r.already ? `${r.family} is already available in this post. Use font-family: "${r.family}".` : `Added ${r.family} (${r.files.join(', ')}). Use font-family: "${r.family}".`);
    }

    case 'refresh': {
      const post = resolvePost(pos[0]);
      installBrand(post);
      return print('Brand files updated. Preview again to check nothing moved.');
    }

    case 'save-template': {
      const post = resolvePost(pos[0]);
      const s = slideByNumber(post, pos[1]);
      const name = pos.slice(2).join(' ') || opts.name;
      if (!name) throw new UserError('Give the new template a name.');
      const id = opts.id || slugify(name);
      const dir = path.join(myTemplatesDir(), id);
      if (fs.existsSync(dir) && !opts.replace) throw new UserError(`You already have a template called "${id}". Use --replace to overwrite it.`);
      fs.mkdirSync(dir, { recursive: true });
      const html = fs.readFileSync(s.file, 'utf8');
      fs.writeFileSync(path.join(dir, 'template.html'), html);
      let base = {};
      try { base = findTemplate(s.template); } catch { /* new layout */ }
      const fields = slideFields(html).map((f) => {
        const known = (base.fields || []).find((x) => x.key === f.key);
        return known || { key: f.key, kind: /^photo/.test(f.key) ? 'photo' : f.key === 'stars' ? 'stars' : 'text', label: f.key };
      });
      const sample = {};
      for (const f of slideFields(html)) if (!/^photo/.test(f.key)) sample[f.key] = f.value;
      // Extra fonts this slide uses, so posts made from the template get them too.
      const extraCss = path.join(post, '_kp', 'fonts-extra.css');
      const families = fs.existsSync(extraCss) ? [...new Set([...fs.readFileSync(extraCss, 'utf8').matchAll(/font-family: "([^"]+)"/g)].map((m) => m[1]))] : [];
      const fonts = [...new Set([...(base.fonts || []), ...families.filter((fam) => html.includes(fam))])];
      writeJson(path.join(dir, 'template.json'), {
        id, name, order: 200,
        description: opts.description || `Kirsten's template, saved from "${path.basename(post)}" slide ${s.n}${base.name ? ` (started from ${base.name})` : ''}.`,
        bestFor: [], photos: fields.filter((f) => f.kind === 'photo').length,
        basedOn: base.id || null, fields, sample, ...(fonts.length ? { fonts } : {}),
      });
      return print(`Saved as "${name}" (${id}) in ${dir}.`);
    }

    case 'copy-template': {
      const t = findTemplate(pos[0]);
      const name = pos.slice(1).join(' ') || `${t.name} copy`;
      const id = opts.id || slugify(name);
      const dir = path.join(myTemplatesDir(), id);
      if (fs.existsSync(dir)) throw new UserError(`You already have a template called "${id}".`);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(t.html, path.join(dir, 'template.html'));
      const meta = readJson(path.join(t.dir, 'template.json'));
      writeJson(path.join(dir, 'template.json'), { ...meta, id, name, order: 200, basedOn: t.id });
      return print(`Copied ${t.name} to ${dir}. Edit template.html there; it's used as "${id}".`);
    }

    case 'example': {
      const name = pos[0] || exampleNames()[0];
      if (!exampleNames().includes(name)) throw new UserError(`No example called "${name}". Examples: ${exampleNames().join(', ')}`);
      return print(buildExample(name, { title: opts.title }));
    }

    case 'gallery': {
      const out = path.resolve(opts.out || path.join(postsRoot(), '.kp', 'gallery'));
      // The gallery is generated: replace the previous one.
      const previous = path.join(out, 'gallery Template gallery');
      if (fs.existsSync(path.join(previous, 'post.json'))) fs.rmSync(previous, { recursive: true });
      const dir = createPost('Template gallery', { root: out, date: 'gallery' });
      const wanted = opts.template ? String(opts.template).split(',') : null;
      for (const t of listTemplates().filter((x) => (wanted ? wanted.includes(x.id) : x.id !== 'blank-canvas'))) {
        const values = samplePhotos(dir, t.sample || {}, [EXAMPLE_PHOTOS, t.dir]);
        addSlide(dir, t.id, { values, tone: opts.tone });
      }
      return print([...(await preview(dir, { ...opts, sizes: opts.sizes || 'default' })), '', `Gallery post: ${dir}`]);
    }

    default:
      throw new UserError(`Unknown command "${cmd}". Run "node kp.mjs help".`);
  }
}

main().catch((err) => {
  if (err instanceof UserError) {
    console.error(err.message);
    process.exit(1);
  }
  console.error(err.stack || String(err));
  process.exit(1);
});
