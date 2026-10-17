// Checks that need no browser: templates, sizes, fonts, brand rules, helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { PLUGIN, read, json } from './helpers.mjs';
import { fillHtml, slideFields, textToHtml } from '../plugins/kp/scripts/lib/templates.mjs';
import { readFontInfo, bundledFamilies } from '../plugins/kp/scripts/lib/fonts.mjs';
import { exportName } from '../plugins/kp/scripts/lib/output.mjs';

const templateDirs = fs.readdirSync(path.join(PLUGIN, 'templates')).filter((d) => fs.existsSync(path.join(PLUGIN, 'templates', d, 'template.json')));

test('the old app templates are all ported, plus Photo', () => {
  for (const id of ['blank-canvas', 'hero-quote', 'bottom-banner', 'review-card', 'top-block', 'diagonal-slab', 'sticker-card', 'split-quote', 'photo-overlay', 'photo']) {
    assert.ok(templateDirs.includes(id), `missing template ${id}`);
  }
});

for (const id of templateDirs) {
  test(`template ${id}: metadata matches the HTML`, () => {
    const meta = json(`templates/${id}/template.json`);
    const html = read(`templates/${id}/template.html`);
    assert.equal(meta.id, id);
    assert.ok(meta.name && meta.description, 'needs a name and description');
    const htmlFields = [...html.matchAll(/data-field="([^"]+)"/g)].map((m) => m[1]);
    const metaFields = meta.fields.map((f) => f.key);
    assert.deepEqual([...new Set(htmlFields)].sort(), [...metaFields].sort(), 'template.json fields must match data-field names');
    for (const f of meta.fields) {
      const tag = html.match(new RegExp(`<[^>]*data-field="${f.key}"[^>]*>`))[0];
      if (f.optional) assert.match(tag, /data-optional|data-stars/, `${f.key} is optional in template.json but not in the HTML`);
    }
    assert.match(html, /<link rel="stylesheet" href="\.\.\/_kp\/brand\.css">/);
    assert.match(html, /<script src="\.\.\/_kp\/kp\.js"><\/script>/);
    assert.match(html, /class="kp-slide[ "]/);
    assert.doesNotMatch(html, /(src|href)="https?:/, 'templates must not load anything from the internet');
    for (const k of Object.keys(meta.sample || {})) assert.ok(metaFields.includes(k), `sample has unknown field ${k}`);
  });

  test(`template ${id}: no social handles anywhere`, () => {
    const all = read(`templates/${id}/template.html`) + read(`templates/${id}/template.json`);
    assert.doesNotMatch(all, /@[a-z0-9_.]{3,}/i, 'found something that looks like a social handle');
    assert.doesNotMatch(all, /eviemendez|iamkirstenphotography/i);
    assert.doesNotMatch(all, /data-field="handle"/);
  });
}

test('examples use real templates, fields and photos, and no handles', () => {
  const examples = fs.readdirSync(path.join(PLUGIN, 'examples')).filter((f) => f.endsWith('.json'));
  assert.ok(examples.length >= 2);
  for (const f of examples) {
    const spec = json(`examples/${f}`);
    assert.doesNotMatch(JSON.stringify(spec), /@[a-z0-9_.]{3,}/i);
    for (const s of spec.slides) {
      const meta = json(`templates/${s.template}/template.json`);
      for (const [k, v] of Object.entries(s.values || {})) {
        assert.ok(meta.fields.some((x) => x.key === k), `${f}: ${s.template} has no field ${k}`);
        if (k === 'photo') assert.ok(fs.existsSync(path.join(PLUGIN, 'examples', 'photos', typeof v === 'object' ? v.src : v)));
      }
    }
  }
});

test('example photos all have a licence record', () => {
  const credits = read('examples/photos/CREDITS.md');
  for (const f of fs.readdirSync(path.join(PLUGIN, 'examples', 'photos')).filter((x) => x.endsWith('.jpg'))) {
    assert.ok(credits.includes(f), `${f} is not in CREDITS.md`);
  }
});

test('sizes.json and kp.js agree, and the defaults are IG 4:5 and FB square', () => {
  const sizes = json('sizes.json').sizes;
  const src = read('brand/kp.js');
  const literal = src.match(/var SIZES = (\{[\s\S]*?\n {2}\});/)[1];
  const jsSizes = vm.runInNewContext(`(${literal})`);
  assert.deepEqual(Object.keys(jsSizes).sort(), sizes.map((s) => s.id).sort());
  for (const s of sizes) {
    const j = jsSizes[s.id];
    assert.deepEqual([j.w, j.h, j.aspect, j.dw, j.dh], [s.width, s.height, s.aspect, s.designWidth, s.designHeight], s.id);
  }
  const defaults = sizes.filter((s) => s.default).map((s) => `${s.id} ${s.width}x${s.height}`);
  assert.deepEqual(defaults, ['ig 1080x1350', 'fb 1080x1080']);
});

test('the renderer is pinned to an exact Playwright version', () => {
  const pkg = json('runtime/package.json');
  assert.match(pkg.dependencies.playwright, /^\d+\.\d+\.\d+$/);
  const lock = json('runtime/package-lock.json');
  assert.equal(lock.packages['node_modules/playwright'].version, pkg.dependencies.playwright);
});

test('every bundled font family has its licence and reads correctly', () => {
  const fams = bundledFamilies();
  assert.ok(fams.find((f) => f.family === 'Poppins' && f.core));
  assert.ok(fams.find((f) => f.family === 'Lora' && f.core));
  for (const f of fams) {
    assert.ok(fs.existsSync(path.join(f.dir, 'OFL.txt')), `${f.id} has no OFL.txt`);
    assert.match(fs.readFileSync(path.join(f.dir, 'OFL.txt'), 'utf8'), /SIL Open Font License/);
  }
  const lora = readFontInfo(path.join(PLUGIN, 'fonts/lora/Lora-Italic[wght].ttf'));
  assert.equal(lora.family, 'Lora');
  assert.equal(lora.italic, true);
  assert.deepEqual(lora.weightRange, [400, 700]);
  const pop = readFontInfo(path.join(PLUGIN, 'fonts/poppins/Poppins-SemiBold.ttf'));
  assert.equal(pop.weight, 600);
});

test('brand.css only references bundled font files', () => {
  const css = read('brand/brand.css');
  for (const m of css.matchAll(/url\("(fonts\/[^"]+)"\)/g)) {
    assert.ok(fs.existsSync(path.join(PLUGIN, decodeURIComponent(m[1]))), `missing ${m[1]}`);
  }
  assert.doesNotMatch(css, /https?:\/\//);
});

test('text values: asterisks make italics, new lines make breaks, HTML is escaped', () => {
  assert.equal(textToHtml('New work *is live.*'), 'New work <em>is live.</em>');
  assert.equal(textToHtml('Hi,\nI\'m <b>'), 'Hi,<br>I\'m &lt;b&gt;');
});

test('fillHtml fills text, photos, stars and tone, and reports unknown fields', () => {
  const html = '<main class="kp-slide x" data-tone="cream"><img class="kp-photo" data-field="photo" src="" style="--focus-x: 50%;"><h1 data-field="headline">Old <em>one</em></h1><div data-field="stars" data-stars="5"></div></main>';
  const { html: out, unknown } = fillHtml(html, { headline: 'New *two*', photo: { src: '../photos/a.jpg', focusY: 20 }, stars: 3, tone: 'sage', nope: 'x' });
  assert.match(out, /<h1 data-field="headline">New <em>two<\/em><\/h1>/);
  assert.match(out, /src="\.\.\/photos\/a\.jpg"/);
  assert.match(out, /--focus-x: 50%; --focus-y: 20%;/);
  assert.match(out, /data-stars="3"/);
  assert.match(out, /data-tone="sage"/);
  assert.deepEqual(unknown, ['nope']);
  const fields = Object.fromEntries(slideFields(out).map((f) => [f.key, f.value]));
  assert.deepEqual(fields, { photo: '../photos/a.jpg', headline: 'New *two*', stars: '3' });
});

test('fillHtml handles nested elements of the same tag', () => {
  const html = '<div data-field="a"><div>inner</div></div><div data-field="b">b</div>';
  const { html: out } = fillHtml(html, { a: 'x' });
  assert.equal(out, '<div data-field="a">x</div><div data-field="b">b</div>');
});

test('export names sort in carousel order', () => {
  assert.equal(exportName('autumn-minis', 1, 1, 'jpg'), 'autumn-minis.jpg');
  assert.equal(exportName('autumn-minis', 3, 10, 'png'), 'autumn-minis-03.png');
});

test('skills have the frontmatter Claude needs and use the plugin root', () => {
  for (const skill of ['kp-post', 'kp-template', 'kp-help']) {
    const md = read(`skills/${skill}/SKILL.md`);
    const fm = md.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(fm, `${skill} has no frontmatter`);
    assert.match(fm[1], new RegExp(`^name: ${skill}$`, 'm'));
    assert.match(fm[1], /^description: .{40,}/m);
    assert.match(md, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/kp\.mjs/);
    for (const m of md.matchAll(/\]\((reference\/[^)]+)\)/g)) {
      assert.ok(fs.existsSync(path.join(PLUGIN, 'skills', skill, m[1])), `${skill} links to missing ${m[1]}`);
    }
  }
});

test('marketplace and plugin manifests agree', () => {
  const mkt = JSON.parse(fs.readFileSync(path.join(PLUGIN, '..', '..', '.claude-plugin', 'marketplace.json'), 'utf8'));
  const plugin = json('.claude-plugin/plugin.json');
  const entry = mkt.plugins.find((p) => p.name === plugin.name);
  assert.ok(entry);
  assert.equal(path.resolve(PLUGIN, '..', '..', entry.source), PLUGIN);
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
});
