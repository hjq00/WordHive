import { BOOKS, ALL_WORDS, WORD_MAP, getBook } from '../data/books.js';
import { DAY, blankCard, schedule, retention, stateLabel } from './srs.js';

const KEY = 'wordhive.app.v1';
const listeners = new Set();

const DEFAULTS = {
  version: 1,
  createdAt: 0,
  settings: {
    bookId: 'kaoyan',
    dailyNew: 20,
    flexible: true,
    remindAt: '20:00',
    ttsRate: 0.9,
    autoSpeak: true,
    accent: 'us',
    onlineVoice: true,
    dark: false,
    palette: 'green',
    /* 视频课在线地址前缀：填了之后按「前缀 + 文件名」在线播放 */
    videoBase: '',
    sensitivity: 'standard',
    showDwell: true,
    api: { base: '', key: '', model: '' },
    watchSite: ''
  },
  cards: {},
  favs: [],
  days: {},
  lastRemind: '',
  demo: false
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS),
      ...parsed,
      settings: { ...DEFAULTS.settings, ...(parsed.settings || {}), api: { ...DEFAULTS.settings.api, ...((parsed.settings || {}).api || {}) } },
      cards: parsed.cards || {},
      favs: Array.isArray(parsed.favs) ? parsed.favs : [],
      days: parsed.days || {}
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

const state = load();
if (!state.createdAt) state.createdAt = Date.now();
/* 旧版本备份没有 accent 字段；非法值也一并归一，避免把所有发音判成英音 */
if (state.settings.accent !== 'uk') state.settings.accent = 'us';

let timer = null;
function persist() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* 存储满或被禁用时静默降级，不影响当前会话 */
    }
  }, 120);
}

function emit() {
  persist();
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (err) {
      console.error(err);
    }
  });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

export function update(mutator, silent = false) {
  mutator(state);
  if (silent) persist();
  else emit();
}

/* ---------------- 日期 ---------------- */
export const dateKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const today = () => dateKey();

function touchDay() {
  const key = today();
  if (!state.days[key]) state.days[key] = { learn: 0, review: 0 };
  return state.days[key];
}

/* ---------------- 词书与队列 ---------------- */
export function currentBook() {
  return getBook(state.settings.bookId);
}

export function bookWords(bookId = state.settings.bookId) {
  return getBook(bookId).words;
}

export function bookProgress(bookId = state.settings.bookId) {
  const words = bookWords(bookId);
  const learned = words.filter((w) => state.cards[w.id]).length;
  const mastered = words.filter((w) => state.cards[w.id]?.state === 'mastered').length;
  return { total: words.length, learned, mastered, pct: words.length ? learned / words.length : 0 };
}

/** 今日新词：本书里还没学过的词 */
export function newQueue(limit = state.settings.dailyNew) {
  const words = bookWords().filter((w) => !state.cards[w.id]);
  return words.slice(0, Math.max(0, limit));
}

export function newLeft() {
  return bookWords().filter((w) => !state.cards[w.id]).length;
}

export function learnedToday() {
  return state.days[today()]?.learn || 0;
}

/** 到期复习：按逾期时长排序 */
export function dueQueue(now = Date.now()) {
  return Object.entries(state.cards)
    .filter(([, c]) => c.due <= now)
    .map(([id, c]) => ({ word: WORD_MAP.get(id), card: c }))
    .filter((x) => x.word)
    .sort((a, b) => a.card.due - b.card.due);
}

export function upcomingQueue(now = Date.now()) {
  return Object.entries(state.cards)
    .filter(([, c]) => c.due > now)
    .map(([id, c]) => ({ word: WORD_MAP.get(id), card: c }))
    .filter((x) => x.word)
    .sort((a, b) => a.card.due - b.card.due);
}

export function favWords() {
  return state.favs.map((id) => WORD_MAP.get(id)).filter(Boolean);
}

export function isFav(id) {
  return state.favs.includes(id);
}

export function toggleFav(id) {
  const i = state.favs.indexOf(id);
  if (i >= 0) state.favs.splice(i, 1);
  else state.favs.unshift(id);
  emit();
  return state.favs.includes(id);
}

/* ---------------- 评分写入 ---------------- */
export function gradeWord(id, grade, meta = {}) {
  const word = WORD_MAP.get(id);
  if (!word) return null;
  const prev = state.cards[id];
  const next = schedule(prev || blankCard(), grade, Date.now());
  next.auto = !!meta.auto;
  next.dwell = Math.round(meta.dwell || 0);
  next.grade = grade;
  state.cards[id] = next;

  const day = touchDay();
  if (prev) day.review += 1;
  else day.learn += 1;

  state.lastGrade = { id, grade, at: Date.now(), auto: !!meta.auto };
  emit();
  return next;
}

export function clearCard(id) {
  delete state.cards[id];
  emit();
}

/* ---------------- 统计 ---------------- */
export function stats() {
  const cards = Object.values(state.cards);
  const counts = { new: 0, learning: 0, review: 0, mastered: 0 };
  cards.forEach((c) => {
    counts[stateLabel(c).key] += 1;
  });
  const book = currentBook();
  counts.new = Math.max(0, book.words.length - cards.filter((c) => book.words.some((w) => w.id === c.id)).length);

  const day = state.days[today()] || { learn: 0, review: 0 };
  const totalLearned = cards.length;
  const avgRetention = cards.length
    ? cards.reduce((sum, c) => sum + retention(c), 0) / cards.length
    : 0;

  return {
    counts,
    today: day,
    totalLearned,
    favCount: state.favs.length,
    avgRetention,
    streak: streak(),
    dueCount: dueQueue().length
  };
}

export function streak() {
  let n = 0;
  const cursor = new Date();
  const has = (key) => {
    const d = state.days[key];
    return d && d.learn + d.review > 0;
  };
  if (!has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 400; i += 1) {
    if (!has(dateKey(cursor))) break;
    n += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

export function weekSeries() {
  const out = [];
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const rec = state.days[dateKey(d)] || { learn: 0, review: 0 };
    out.push({ label: i === 0 ? '今天' : labels[d.getDay()], ...rec, key: dateKey(d) });
  }
  return out;
}

/** 未来 7 天的到期分布 */
export function dueForecast() {
  const now = Date.now();
  const out = [];
  for (let i = 0; i < 7; i += 1) {
    const start = now + i * DAY;
    const end = start + DAY;
    const n = Object.values(state.cards).filter((c) => c.due >= start && c.due < end).length;
    out.push({ day: i, n });
  }
  return out;
}

/* ---------------- 设置 ---------------- */
export function setSetting(path, value) {
  const keys = path.split('.');
  let obj = state.settings;
  for (let i = 0; i < keys.length - 1; i += 1) obj = obj[keys[i]];
  obj[keys[keys.length - 1]] = value;
  emit();
}

export function switchBook(id) {
  if (!BOOKS.some((b) => b.id === id)) return;
  state.settings.bookId = id;
  emit();
}

/* ---------------- 数据 ---------------- */
export function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wordhive-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data.cards || !data.settings) throw new Error('格式不正确');
        state.cards = data.cards;
        state.settings = { ...DEFAULTS.settings, ...data.settings };
        if (state.settings.accent !== 'uk') state.settings.accent = 'us';
        state.favs = data.favs || [];
        state.days = data.days || {};
        emit();
        resolve(true);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function resetAll() {
  localStorage.removeItem(KEY);
  const fresh = structuredClone(DEFAULTS);
  fresh.createdAt = Date.now();
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, fresh);
  emit();
}

/* ---------------- 演示数据（?demo=1） ---------------- */
export function seedDemo() {
  if (state.demo) return;
  const now = Date.now();
  const words = BOOKS[0].words.slice(0, 8);
  const plan = [
    { interval: 34, state: 'mastered', ago: 9, reps: 5 },
    { interval: 26, state: 'mastered', ago: 12, reps: 4 },
    { interval: 4, state: 'review', due: -2.3, reps: 3 },
    { interval: 3, state: 'review', due: -1.2, reps: 3 },
    { interval: 2, state: 'review', due: -0.2, reps: 2 },
    { interval: 1, state: 'review', due: -0.1, reps: 2 },
    { interval: 0.4, state: 'learning', due: 0.08, reps: 1 },
    { interval: 0.5, state: 'learning', due: 0.2, reps: 1 }
  ];
  words.forEach((w, i) => {
    const p = plan[i];
    const due = p.due !== undefined ? now + p.due * DAY : now + p.interval * DAY;
    const ago = p.ago !== undefined ? p.ago : Math.max(0.3, p.interval * 0.7);
    state.cards[w.id] = {
      ...blankCard(),
      state: p.state,
      interval: p.interval,
      ease: 2.4 + (i % 3) * 0.1,
      reps: p.reps,
      lapses: i % 3 === 0 ? 1 : 0,
      last: now - ago * DAY,
      due,
      hist: []
    };
  });
  state.favs = [BOOKS[0].words[2]?.id, BOOKS[0].words[3]?.id, BOOKS[0].words[5]?.id].filter(Boolean);
  const counts = [
    { learn: 12, review: 18 },
    { learn: 20, review: 26 },
    { learn: 8, review: 12 },
    { learn: 22, review: 30 },
    { learn: 15, review: 24 },
    { learn: 10, review: 16 },
    { learn: 12, review: 28 }
  ];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    state.days[dateKey(d)] = counts[6 - i];
  }
  state.demo = true;
  emit();
}

export function allWords() {
  return ALL_WORDS;
}
