// Where things live: the plugin, the renderer runtime, Kirsten's posts folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BRAND_DIR = path.join(PLUGIN_ROOT, 'brand');
export const FONTS_DIR = path.join(PLUGIN_ROOT, 'fonts');
export const TEMPLATES_DIR = path.join(PLUGIN_ROOT, 'templates');
export const RUNTIME_SPEC_DIR = path.join(PLUGIN_ROOT, 'runtime');

export const KP_HOME = process.env.KP_HOME || path.join(os.homedir(), '.kp-skills');

/** The folder holding the pinned Playwright + Chromium install. */
export function runtimeDir() {
  if (process.env.KP_RUNTIME) return path.resolve(process.env.KP_RUNTIME);
  // A development checkout can keep its own runtime next to the spec.
  if (fs.existsSync(path.join(RUNTIME_SPEC_DIR, 'node_modules', 'playwright'))) return RUNTIME_SPEC_DIR;
  return path.join(KP_HOME, 'runtime');
}

export const POSTS_MARKER = '.kp-posts';
export const DEFAULT_POSTS_ROOT = path.join(os.homedir(), 'Pictures', 'KP Posts');
export const MY_TEMPLATES = 'My templates';
export const MY_FONTS = 'My fonts';

/** Find the posts folder: KP_POSTS, then a parent of cwd with the marker, then the default. */
export function postsRoot(start = process.cwd()) {
  if (process.env.KP_POSTS) return path.resolve(process.env.KP_POSTS);
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, POSTS_MARKER))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return DEFAULT_POSTS_ROOT;
}

export function myTemplatesDir(root = postsRoot()) {
  return path.join(root, MY_TEMPLATES);
}

/** Resolve a post folder from a path or a name inside the posts folder. */
export function resolvePost(arg) {
  if (!arg) throw new UserError('Which post? Give the post folder.');
  const candidates = [path.resolve(arg), path.join(postsRoot(), arg)];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'post.json'))) return c;
  }
  // Allow a unique partial match on the folder name, e.g. "smith".
  const root = postsRoot();
  if (fs.existsSync(root)) {
    const matches = fs.readdirSync(root).filter((n) => n.toLowerCase().includes(String(arg).toLowerCase()) && fs.existsSync(path.join(root, n, 'post.json')));
    if (matches.length === 1) return path.join(root, matches[0]);
    if (matches.length > 1) throw new UserError(`More than one post matches "${arg}": ${matches.join(', ')}`);
  }
  throw new UserError(`Can't find a post called "${arg}". Posts live in ${root}.`);
}

export class UserError extends Error {}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

export function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'post';
}

export function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function copyDir(src, dest, { filter } = {}) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (filter && !filter(s, entry)) continue;
    if (entry.isDirectory()) copyDir(s, d, { filter });
    else fs.copyFileSync(s, d);
  }
}
