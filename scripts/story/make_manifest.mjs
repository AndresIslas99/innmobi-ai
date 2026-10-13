// Builds docs/assets/story/manifest.json from the frame folders in docs/assets/story/v1/<scene>/{d,m}/NNNN.webp.
// Usage: node scripts/story/make_manifest.mjs
//
// Why docs/assets/story and not images/: build-site.mjs copies images/ into docs/assets/images/, which would
// store ~40 MB of frames twice. docs/assets/story is written to directly and never touched by the build.
// Version the folder (v1, v2...) when frames are re-rendered so browser caches are busted.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VERSION = 'v1';
const BASE = path.join(ROOT, 'docs', 'assets', 'story');
const SRC = path.join(BASE, VERSION);

// Scene order = story order. `focal` is the x position (0..1) of the story subject inside the frame; the mobile
// 4:5 crop is centred on it. `fit: 'contain'` means "fit the width" (used when no 4:5 crop can hold the subject).
// `mobileSource: 'd'` makes phones download the desktop frames for that scene (firma: both people sit in the
// outer thirds, so the pre-cropped mobile set cuts both faces off).
const SCENES = [
  { id: 'pide',    fps: 10, focalM: 0.5 },
  { id: 'voz',     fps: 12, focalM: 0.62 },
  { id: 'manana',  fps: 10, focalM: 0.5 },
  { id: 'sala',    fps: 12, focalM: 0.5 },
  { id: 'terraza', fps: 10, focalM: 0.5 },
  { id: 'firma',   fps: 10, focalM: 0.5, mobileSource: 'd', fitM: 'contain' },
];

function webpSize(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error('not webp: ' + file);
  const fourcc = b.toString('ascii', 12, 16);
  if (fourcc === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (fourcc === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (fourcc === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  throw new Error('unknown webp: ' + file);
}

function dirInfo(dir) {
  const files = fs.readdirSync(dir).filter((f) => /^\d{4}\.webp$/.test(f)).sort();
  const bytes = files.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
  const { w, h } = webpSize(path.join(dir, files[0]));
  return { frames: files.length, bytes, w, h };
}

const scenes = SCENES.map((s) => {
  const d = dirInfo(path.join(SRC, s.id, 'd'));
  const m0 = dirInfo(path.join(SRC, s.id, 'm'));
  const mobileDir = s.mobileSource || 'm';
  const m = mobileDir === 'd' ? d : m0;
  if (m.frames !== d.frames) throw new Error(`${s.id}: d/m frame counts differ`);
  const poster = path.join(SRC, s.id, 'poster.webp');
  return {
    id: s.id,
    frames: d.frames,
    fps: s.fps,
    posterBytes: fs.statSync(poster).size,
    d: { dir: 'd', w: d.w, h: d.h, bytes: d.bytes, focal: 0.5, fit: 'cover' },
    m: { dir: mobileDir, w: m.w, h: m.h, bytes: m.bytes, focal: s.focalM, fit: s.fitM || 'cover' },
  };
});

const manifest = { version: VERSION, base: `/assets/story/${VERSION}/`, scenes };
fs.writeFileSync(path.join(BASE, 'manifest.json'), JSON.stringify(manifest));
const mb = (n) => (n / 1048576).toFixed(2);
for (const s of scenes) console.log(s.id.padEnd(8), `${s.frames}f`, `d ${mb(s.d.bytes)} MB`, `m ${mb(s.m.bytes)} MB (${s.m.dir} ${s.m.w}x${s.m.h})`);
console.log('desktop total', mb(scenes.reduce((n, s) => n + s.d.bytes + s.posterBytes, 0)), 'MB');
console.log('mobile  total', mb(scenes.reduce((n, s) => n + s.m.bytes, 0)), 'MB');
