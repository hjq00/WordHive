import { writeFileSync } from 'node:fs';
import { ALL_WORDS } from '../src/data/books.js';
import { READINGS, LISTENINGS } from '../src/data/materials.js';

const words = [...new Set(ALL_WORDS.map((w) => w.w.toLowerCase()))];
const sentences = [];
for (const r of READINGS) for (const p of r.paras) sentences.push({ en: p.en, zh: p.zh });
for (const l of LISTENINGS) for (const x of l.lines) sentences.push({ en: x.en, zh: x.zh });
writeFileSync('design/materials.json', JSON.stringify({ words, sentences }));
console.log('words', words.length, 'sentences', sentences.length);
