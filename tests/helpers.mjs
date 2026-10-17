import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PLUGIN = path.join(ROOT, 'plugins', 'kp');
export const KP = path.join(PLUGIN, 'scripts', 'kp.mjs');

export const read = (rel) => fs.readFileSync(path.join(PLUGIN, rel), 'utf8');
export const json = (rel) => JSON.parse(read(rel));

/** True when a renderer runtime is installed (dev runtime, KP_RUNTIME or ~/.kp-skills). */
export function hasRuntime() {
  const dirs = [process.env.KP_RUNTIME, path.join(PLUGIN, 'runtime'), path.join(os.homedir(), '.kp-skills', 'runtime')].filter(Boolean);
  return dirs.some((d) => {
    try {
      createRequire(path.join(d, 'package.json'))('playwright');
      return true;
    } catch {
      return false;
    }
  });
}

/** A throwaway posts folder; KP_POSTS points the CLI at it. */
export function tempPosts() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-test-'));
  return dir;
}

export function kp(postsDir, ...args) {
  return execFileSync(process.execPath, [KP, ...args], {
    env: { ...process.env, KP_POSTS: postsDir },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
