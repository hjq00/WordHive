/** 记忆调度：三档反馈 + FSRS 风格间隔重复（目标保持率可调） */

export const DAY = 86400000;
export const MIN = 60000;
export const ALG_VERSION = 2;
export const DEFAULT_TARGET = 0.9;

export const GRADES = [
  { key: 0, name: '不认识', short: '忘记', color: 'rose' },
  { key: 1, name: '模糊', short: '模糊', color: 'amber' },
  { key: 2, name: '认识', short: '认识', color: 'accent' }
];

export function blankCard() {
  return {
    state: 'new', ease: 2.5, interval: 0, due: 0,
    reps: 0, lapses: 0, last: 0, hist: [],
    s: 0, d: 5, alg: 2
  };
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const round = (v, n) => { const p = 10 ** n; return Math.round(v * p) / p; };

/** 计算下次复习；grade: 0 不认识 / 1 模糊 / 2 认识 */
export function schedule(card, grade, now = Date.now(), target = DEFAULT_TARGET) {
  const c = { ...blankCard(), ...card, hist: [...(card.hist || [])] };
  let S = Number(c.s) > 0 ? Number(c.s) : 0;
  let D = clamp(Number(c.d) || 5, 1, 10);
  let interval = 0;

  if (c.reps === 0 || S <= 0) {
    S = (grade === 0 ? 0.5 : grade === 1 ? 1.2 : 2.5) * clamp((11 - D) / 6, 0.6, 1.4);
    D = clamp(D + (grade === 0 ? 0.9 : grade === 1 ? 0.3 : -0.3), 1, 10);
    if (grade === 0) { interval = 0; c.due = now + 10 * MIN; }
    else {
      interval = 9 * S * (1 / target - 1);
      if (grade === 1) interval *= 0.6;
    }
  } else {
    const t = Math.max(0, (now - (c.last || now)) / DAY);
    const R = 1 / (1 + t / (9 * S));
    D = clamp(D + (grade === 0 ? 0.9 : grade === 1 ? 0.3 : -0.3), 1, 10);
    if (grade > 0) {
      const gain = grade === 2 ? 2.2 : 0.8;
      S = clamp(S * (1 + gain * (1 - R) * (11 - D) / 10), 0.4, 3650);
      interval = 9 * S * (1 / target - 1);
      if (grade === 1) interval *= 0.6;
    } else {
      S = clamp(S * 0.4, 0.4, 3650);
      interval = 0; c.due = now + 10 * MIN;
    }
  }

  if (grade > 0) {
    interval = clamp(interval, 0.5, 365);
    c.interval = interval;
    c.due = now + interval * DAY;
  } else {
    c.interval = 0;
    c.lapses += 1;
  }

  c.state = grade === 0 ? 'learning' : (interval >= 21 && c.reps >= 3 ? 'mastered' : 'review');
  c.ease = clamp(2.8 - (D - 1) / 9 * 1.5, 1.3, 2.8);
  c.s = round(S, 2); c.d = round(D, 1); c.alg = 2;
  c.reps += 1; c.last = now;
  c.hist.push({ t: now, g: grade, i: round(interval, 1), s: round(S, 2), d: round(D, 1) });
  if (c.hist.length > 12) c.hist = c.hist.slice(-12);
  return c;
}

export function previewIntervals(card, now = Date.now(), target = DEFAULT_TARGET) {
  return GRADES.map((g) => {
    const next = schedule(card, g.key, now, target);
    return { ...g, next, label: next.interval === 0 ? '10 分钟后' : formatInterval(next.interval) };
  });
}

export function formatInterval(days) {
  if (days < 1) { const hours = Math.max(1, Math.round(days * 24)); return `${hours} 小时后`; }
  if (days < 30) return `${Math.round(days)} 天后`;
  if (days < 365) return `${Math.round(days / 30)} 个月后`;
  return `${(days / 365).toFixed(1)} 年后`;
}

export function relativeDue(due, now = Date.now()) {
  const diff = due - now;
  if (diff <= -DAY) return `逾期 ${Math.floor(-diff / DAY)} 天`;
  if (diff <= 0) return '现在到期';
  if (diff < DAY) return `${Math.max(1, Math.round(diff / 3600000))} 小时后`;
  return `${Math.round(diff / DAY)} 天后`;
}

export function retention(card, now = Date.now()) {
  if (!card) return 0;
  const S = Number(card.s) > 0 ? card.s : Math.max(0.5, Number(card.interval) || 0) * 1.4;
  const t = Math.max(0, (now - (card.last || now)) / DAY);
  return clamp(1 / (1 + t / (9 * S)), 0, 1);
}

export function migrateCard(card) {
  if (!card || typeof card !== 'object') return card;
  if (card.alg === 2 && Number(card.s) > 0 && Number(card.d) >= 1) return card;
  const s = Math.max(0.5, Number(card.interval) || 0) * 1.4;
  const d = clamp(1 + (2.8 - clamp(Number(card.ease) || 2.5, 1.3, 2.8)) / 1.5 * 9, 1, 10);
  return { ...card, s: round(s, 2), d: round(d, 1), alg: 2 };
}

export function stateLabel(card) {
  if (!card || card.reps === 0) return { key: 'new', name: '未学', color: '#8a948d' };
  if (card.state === 'mastered') return { key: 'mastered', name: '已掌握', color: '#2c6a52' };
  if (card.state === 'learning' || card.interval < 1) return { key: 'learning', name: '学习中', color: '#b04f49' };
  return { key: 'review', name: '复习中', color: '#356b8c' };
}
