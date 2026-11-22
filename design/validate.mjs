import { BOOKS, ALL_WORDS } from '../src/data/books.js';

const problems = [];
const seen = new Map();
for (const b of BOOKS) {
  console.log(b.id, b.words.length, 'words');
  for (const w of b.words) {
    seen.set(w.w, (seen.get(w.w) || 0) + 1);
    if (!w.w || (!w.basic && !w.ph?.startsWith('/'))) problems.push(`${w.w}: phonetic`);
    if (w.basic) {
      if (!Array.isArray(w.defs) || !w.defs.length) problems.push(`${w.w}: defs`);
      if (!w.note) problems.push(`${w.w}: note`);
      continue;
    }
    if (!Array.isArray(w.defs) || !w.defs.length || w.defs.some((d) => !Array.isArray(d) || d.length !== 2)) problems.push(`${w.w}: defs`);
    if (!w.note) problems.push(`${w.w}: note`);
    if (!w.mnes?.length) problems.push(`${w.w}: mnes`);
    if (!w.ex?.en || !w.ex?.zh) problems.push(`${w.w}: example`);
    if (!w.real?.en || !w.real?.src) problems.push(`${w.w}: real`);
    if (!w.root?.parts?.length || !w.root.tip) problems.push(`${w.w}: root`);
    if (!w.der?.length) problems.push(`${w.w}: der`);
    if (!w.syn?.length || !w.ant?.length) problems.push(`${w.w}: syn/ant`);
    if (!w.col?.length) problems.push(`${w.w}: col`);
    if (w.syn?.some((s) => !/^[a-z][a-z '-]*$/i.test(s))) problems.push(`${w.w}: syn value ${JSON.stringify(w.syn)}`);
    if (w.ant?.some((s) => !/^[a-z][a-z '-]*$/i.test(s))) problems.push(`${w.w}: ant value ${JSON.stringify(w.ant)}`);
  }
}
const dups = [...seen.entries()].filter(([, n]) => n > 1);
console.log('total', ALL_WORDS.length, 'unique', seen.size);
console.log('duplicates', dups.length ? dups : 'none');
console.log('problems', problems.length);
problems.slice(0, 30).forEach((p) => console.log(' -', p));
