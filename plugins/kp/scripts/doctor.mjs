#!/usr/bin/env node
// doctor: check this Mac can make KP post images, in plain English.
// Usage: node doctor.mjs [--quick] [--json]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PLUGIN_ROOT, TEMPLATES_DIR, RUNTIME_SPEC_DIR, runtimeDir, postsRoot, readJson } from './lib/paths.mjs';
import { listTemplates } from './lib/templates.mjs';
import { createPost, addSlide, addPhotos, ensurePostsRoot } from './lib/posts.mjs';
import { renderPost } from './lib/output.mjs';

const args = new Set(process.argv.slice(2));
const checks = [];
const ok = (name, detail) => checks.push({ ok: true, name, detail });
const bad = (name, detail, fix) => checks.push({ ok: false, name, detail, fix });

const SETUP = `bash "${path.join(PLUGIN_ROOT, 'setup.sh')}"`;

async function run() {
  // 1. Node
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 20) ok('Node.js', `version ${process.versions.node}`);
  else bad('Node.js', `version ${process.versions.node} is too old (need 20 or newer)`, 'Run setup.sh; it installs a current Node with Homebrew.');

  // 2. Plugin files
  const plugin = readJson(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'));
  const templates = listTemplates();
  if (fs.existsSync(path.join(PLUGIN_ROOT, 'brand', 'brand.css')) && templates.length) ok('Plugin', `kp ${plugin.version}, ${templates.length} templates`);
  else bad('Plugin', 'brand files or templates are missing', 'Reinstall the kp plugin from the kp-skills marketplace.');

  // 3. Renderer runtime
  const dir = runtimeDir();
  const wanted = readJson(path.join(RUNTIME_SPEC_DIR, 'package.json')).dependencies.playwright;
  let installed = null;
  try {
    installed = createRequire(path.join(dir, 'package.json'))('playwright/package.json').version;
  } catch { /* not installed */ }
  if (!installed) {
    bad('Image renderer', `not installed (looked in ${dir})`, `Run: ${SETUP}`);
  } else if (installed !== wanted) {
    bad('Image renderer', `version ${installed} installed, this plugin needs ${wanted}`, `Run: ${SETUP}`);
  } else ok('Image renderer', `Playwright ${installed} in ${dir}`);

  // 4. Posts folder
  try {
    const root = ensurePostsRoot();
    const probe = path.join(root, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe);
    ok('Posts folder', root);
  } catch (err) {
    bad('Posts folder', `${postsRoot()} can't be written (${err.code || err.message})`, 'Check the folder exists and Claude has permission to use it (System Settings > Privacy & Security > Files and Folders).');
  }

  // 5. A real test render, offline, at both default sizes
  if (installed && installed === wanted && !args.has('--quick')) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-doctor-'));
    try {
      const post = createPost('Doctor check', { root: tmp, date: 'test' });
      const [photo] = addPhotos(post, [path.join(PLUGIN_ROOT, 'examples', 'photos', 'family-standing-by-lake.jpg')]);
      addSlide(post, 'hero-quote', { values: { photo, headline: 'Slow mornings.', line: 'Doctor check' } });
      addSlide(post, 'review-card', { values: { quote: 'A test of every brand font and the star rating.', name: 'Test', stars: 5 } });
      const started = Date.now();
      const r = await renderPost(post, { mode: 'export' });
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      const files = r.sizes.flatMap((s) => s.files);
      const sizesOk = r.sizes.every((s) => s.files.every((f) => f.width > 0));
      if (r.problems.length) bad('Test render', r.problems.join(' '), `Run: ${SETUP}`);
      else if (!sizesOk || files.length !== 4) bad('Test render', `expected 4 images, got ${files.length}`, `Run: ${SETUP}`);
      else ok('Test render', `${files.length} images (${r.sizes.map((s) => `${s.files[0].width}×${s.files[0].height}`).join(', ')}) in ${secs}s, fonts and photo loaded, no internet used`);
    } catch (err) {
      bad('Test render', err.message.split('\n')[0], `Run: ${SETUP}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  if (args.has('--json')) {
    console.log(JSON.stringify({ ok: checks.every((c) => c.ok), checks }, null, 2));
  } else {
    for (const c of checks) {
      console.log(`${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}`);
      if (!c.ok && c.fix) console.log(`    Fix: ${c.fix}`);
    }
    console.log(checks.every((c) => c.ok) ? '\nAll good: ready to make posts.' : '\nSomething needs fixing (see above).');
  }
  process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
}

run().catch((err) => {
  console.error(`✗ The check itself failed: ${err.message}`);
  process.exit(1);
});
