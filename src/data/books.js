/**
 * 词书入口
 * 当前只保留资料库「六级核心词 1–7 天」，其余词书已按要求移除。
 */
import { CET6_DAYS } from './words/cet6-days.js';
import { HONGBAO_OCR } from './words/hongbao.js';
import { KAOYAN_5500 } from './words/kaoyan-5500.js';
import { ZHENTI_WORDS } from './words/zhenti-words.js';
import { ENRICHMENT } from './enrichment.js';

export const BOOKS = [
  {
    id: 'hongbao',
    name: '红宝书 · 考研必考词',
    subtitle: '扫描版 OCR · 建议抽查',
    short: '红',
    color: '#B8442F',
    kind: 'exam',
    words: HONGBAO_OCR
  },
  {
    id: 'kaoyan-5500',
    name: '考研 5500 · 你还在背单词吗',
    subtitle: '329 页全文重建 · 收录 2068 词',
    short: '五',
    color: '#955E12',
    kind: 'exam',
    words: KAOYAN_5500
  },
  {
    id: 'zhenti-words',
    name: '红宝书 · 十年真题词汇',
    subtitle: '扫描版 OCR · 真题重难点词',
    short: '真',
    color: '#2A7D33',
    kind: 'exam',
    words: ZHENTI_WORDS
  },
  {
    id: 'cet6-days',
    name: '六级核心词 · 1–7 天',
    subtitle: '资料库 · 每天 180 词 · 共 1259 词',
    short: '六',
    color: '#1F7C87',
    kind: 'exam',
    words: CET6_DAYS
  }
];

BOOKS.forEach((book) => {
  book.words.forEach((word, index) => {
    word.id = `${book.id}-${index}`;
    word.book = book.id;
    word.bookName = book.name;
    word.kind = book.kind;
  });
});

export const ALL_WORDS = BOOKS.flatMap((book) => book.words);
export const WORD_MAP = new Map(ALL_WORDS.map((word) => [word.id, word]));

/* 用开放数据源补全每个词的详情；已有字段优先保留 */
ALL_WORDS.forEach((word) => {
  const extra = ENRICHMENT[word.w.toLowerCase()];
  if (!extra) return;
  if (!word.ph) word.ph = extra.ph || '';
  for (const key of ['defs', 'mnes', 'ex', 'real', 'root', 'der', 'syn', 'ant']) {
    const value = extra[key];
    if (value == null) continue;
    if (Array.isArray(value) && !value.length) continue;
    if (word[key] == null || (Array.isArray(word[key]) && !word[key].length)) word[key] = value;
  }
  if (extra.annot) word.annot = extra.annot;
});

export function getBook(id) {
  return BOOKS.find((book) => book.id === id) || BOOKS[0];
}

export function findWord(text) {
  const lower = String(text || '').toLowerCase();
  return ALL_WORDS.find((word) => word.w.toLowerCase() === lower) || null;
}
