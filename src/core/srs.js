/** 记忆调度：三档反馈 + 间隔重复（SM-2 变体，收敛到 180 天） */

export const DAY = 86400000;
export const MIN = 60000;

export const GRADES = [
  { key: 0, name: '不认识', short: '忘记', color: 'rose' },
  { key: 1, name: '模糊', short: '模糊', color: 'amber' },
  { key: 2, name: '认识', short: '认识', color: 'accent' }
];

export function blankCard() {
  return {
    state: 'new',
    ease: 2.5,
    interval: 0,
    due: 0,
    reps: 0,
    lapses: 0,
    last: 0,
    hist: []
  };
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** 计算下次复习；grade: 0 不认识 / 1 模糊 / 2 认识 */
export function schedule(card, grade, now = Date.now()) {
  const c = { ...blankCard(), ...card, hist: [...(card.hist || [])] };
  const first = c.reps === 0;

  if (grade === 0) {
    c.lapses += 1;
    c.ease = clamp(c.ease - 0.2, 1.3, 2.8);
    c.interval = 0;
    c.due = now + 10 * MIN;
    c.state = 'learning';
  } else if (grade === 1) {
    c.ease = clamp(c.ease - 0.05, 1.3, 2.8);
    c.interval = first ? 0.5 : clamp(c.interval * 1.2, 0.5, 180);
    c.due = now + c.interval * DAY;
    c.state = c.interval >= 21 && c.reps >= 3 ? 'mastered' : 'review';
  } else {
    c.ease = clamp(c.ease + 0.05, 1.3, 2.8);
    c.interval = first ? 1 : clamp(c.interval * c.ease, 1, 180);
    c.due = now + c.interval * DAY;
    c.state = c.interval >= 21 && c.reps >= 3 ? 'mastered' : 'review';
  }

  c.reps += 1;
  c.last = now;
  c.hist.push({ t: now, g: grade, i: Math.round(c.interval * 10) / 10 });
  if (c.hist.length > 12) c.hist = c.hist.slice(-12);
  return c;
}

/** 立即预览三档对应的下次间隔，用于按钮/提示文案 */
export function previewIntervals(card, now = Date.now()) {
  return GRADES.map((g) => {
    const next = schedule(card, g.key, now);
    return { ...g, next, label: next.interval === 0 ? '10 分钟后' : formatInterval(next.interval) };
  });
}

export function formatInterval(days) {
  if (days < 1) {
    const hours = Math.max(1, Math.round(days * 24));
    return `${hours} 小时后`;
  }
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

/** 估算当前记忆保持率（指数遗忘曲线） */
export function retention(card, now = Date.now()) {
  if (!card || !card.last || !card.interval) return 0;
  const strength = Math.max(0.5, card.interval) * DAY * 1.4;
  const r = Math.exp(-(now - card.last) / strength);
  return clamp(r, 0, 1);
}

export function stateLabel(card) {
  if (!card || card.reps === 0) return { key: 'new', name: '未学', color: '#8a948d' };
  if (card.state === 'mastered') return { key: 'mastered', name: '已掌握', color: '#2c6a52' };
  if (card.state === 'learning' || card.interval < 1) return { key: 'learning', name: '学习中', color: '#b04f49' };
  return { key: 'review', name: '复习中', color: '#356b8c' };
}
