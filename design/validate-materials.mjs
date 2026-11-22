import { READINGS, LISTENINGS, LONG_SENTENCES, SHOWS } from '../src/data/materials.js';
import { findWord } from '../src/data/books.js';
console.log('readings', READINGS.length, 'listenings', LISTENINGS.length, 'long', LONG_SENTENCES.length, 'shows', SHOWS.length);
const missing = [];
for (const r of READINGS) for (const w of r.words) if (!findWord(w)) missing.push(`reading ${r.id}: ${w}`);
for (const l of LISTENINGS) for (const w of l.words) if (!findWord(w)) missing.push(`listening ${l.id}: ${w}`);
console.log('missing word refs', missing.length ? missing : 'none');
for (const r of READINGS) {
  if (!r.title || !r.question?.q || r.question.options.length !== 4) console.log('bad reading', r.id);
}
for (const l of LISTENINGS) if (!l.lines?.length) console.log('bad listening', l.id);
for (const s of SHOWS) if (!s.lines?.length) console.log('bad show', s.id);
