// Fails if the story frames exceed the byte budget. Reads docs/assets/story/manifest.json.
// Usage: node scripts/story/check_budget.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'assets', 'story', 'manifest.json'), 'utf8'));
const MB = 1048576;
// Per-scene cap 4.2 MB (both variants; firma serves the desktop set on phones). Totals: the "story under 25 MB" rule.
const LIM = { scene: 4.2 * MB, desktop: 25 * MB, mobile: 15 * MB };
let bad = 0;
const fail = (msg) => { console.error('FAIL', msg); bad++; };
let d = 0, mo = 0;
for (const s of m.scenes) {
  d += s.d.bytes; mo += s.m.bytes;
  if (s.d.bytes > LIM.scene) fail(`${s.id} desktop ${(s.d.bytes / MB).toFixed(2)} MB`);
  if (s.m.bytes > LIM.scene) fail(`${s.id} mobile ${(s.m.bytes / MB).toFixed(2)} MB`);
}
if (d > LIM.desktop) fail(`desktop total ${(d / MB).toFixed(2)} MB`);
if (mo > LIM.mobile) fail(`mobile total ${(mo / MB).toFixed(2)} MB`);
console.log(`desktop ${(d / MB).toFixed(2)} MB, mobile ${(mo / MB).toFixed(2)} MB`, bad ? 'OVER BUDGET' : 'OK');
process.exit(bad ? 1 : 0);
