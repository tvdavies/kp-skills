// Notes Kirsten leaves on a post's preview page, in <post>/notes.json.
//   { "notes": [ { id, slide, slideNumber, size, field, selector, selectedText,
//                  note, x, y, created, status: "open" | "done" | "withdrawn", done? } ] }
import fs from 'node:fs';
import path from 'node:path';

export const NOTES_FILE = 'notes.json';
const MAX_NOTE = 2000;

function file(postDir) {
  return path.join(postDir, NOTES_FILE);
}

export function readNotes(postDir) {
  const f = file(postDir);
  if (!fs.existsSync(f)) return [];
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(j.notes) ? j.notes : [];
  } catch {
    return [];
  }
}

function writeNotes(postDir, notes) {
  const f = file(postDir);
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ notes }, null, 2) + '\n');
  fs.renameSync(tmp, f);
}

function clip(v, n) {
  return typeof v === 'string' ? v.slice(0, n) : null;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, Math.round(n * 1000) / 1000)) : null;
}

/** Add a note from the preview page. Returns the stored note. */
export function addNote(postDir, input) {
  const text = String(input?.note || '').trim();
  if (!text) throw new Error('A note needs some text.');
  const slide = String(input.slide || '');
  if (!/^slides\/[^/\\]+\.html$/.test(slide) || !fs.existsSync(path.join(postDir, slide))) throw new Error('That slide no longer exists.');
  const notes = readNotes(postDir);
  const next = notes.reduce((m, n) => Math.max(m, parseInt(String(n.id).replace(/\D/g, ''), 10) || 0), 0) + 1;
  const note = {
    id: next,
    slide,
    slideNumber: Number.isInteger(input.slideNumber) ? input.slideNumber : parseInt(path.basename(slide), 10) || null,
    size: clip(input.size, 40),
    field: clip(input.field, 80) || null,
    selector: clip(input.selector, 500) || null,
    selectedText: clip(input.selectedText, 500) || null,
    note: text.slice(0, MAX_NOTE),
    x: num(input.x),
    y: num(input.y),
    created: new Date().toISOString(),
    status: 'open',
  };
  notes.push(note);
  writeNotes(postDir, notes);
  return note;
}

/** Set notes' status. ids are numbers or "n3"/"#3". Returns { changed, missing }. */
export function setStatus(postDir, ids, status) {
  const notes = readNotes(postDir);
  const wanted = ids.map((i) => parseInt(String(i).replace(/\D/g, ''), 10)).filter(Number.isFinite);
  const changed = [];
  for (const n of notes) {
    if (wanted.includes(Number(n.id)) && n.status !== status) {
      n.status = status;
      if (status === 'done') n.done = new Date().toISOString();
      changed.push(n.id);
    }
  }
  if (changed.length) writeNotes(postDir, notes);
  const missing = wanted.filter((w) => !notes.some((n) => Number(n.id) === w));
  return { changed, missing };
}

export function openNotes(postDir) {
  return readNotes(postDir).filter((n) => n.status === 'open');
}

/** After slides are renamed (reordered), point notes at the new file names. map: old -> new ("slides/..."). */
export function renameSlidesInNotes(postDir, map) {
  const notes = readNotes(postDir);
  if (!notes.length) return;
  let touched = false;
  for (const n of notes) {
    if (map[n.slide] !== undefined) {
      n.slide = map[n.slide];
      if (n.slide.startsWith('slides/')) n.slideNumber = parseInt(path.basename(n.slide), 10) || n.slideNumber;
      touched = true;
    }
  }
  if (touched) writeNotes(postDir, notes);
}

/** Plain-English lines describing notes, for Claude. */
export function describeNotes(postDir, notes) {
  if (!notes.length) return ['No open notes.'];
  const lines = [];
  for (const n of notes) {
    const where = [
      `slide ${n.slideNumber ?? '?'} (${n.slide})`,
      n.size ? `seen at ${n.size}` : null,
      n.field ? `on "${n.field}"` : n.selector ? `on ${n.selector}` : 'on the slide',
    ].filter(Boolean).join(', ');
    lines.push(`#${n.id} ${where}${n.status !== 'open' ? ` [${n.status}]` : ''}`);
    if (n.selectedText) lines.push(`    selected: "${n.selectedText}"`);
    if (n.x !== null && n.x !== undefined) lines.push(`    point: ${Math.round(n.x * 100)}% across, ${Math.round(n.y * 100)}% down`);
    lines.push(`    note: ${n.note.replace(/\n/g, '\n          ')}`);
    if (!fs.existsSync(path.join(postDir, n.slide))) lines.push('    (that slide has been removed)');
  }
  return lines;
}
