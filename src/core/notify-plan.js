/**
 * 智能通知决策层（纯函数）
 *
 * 不引用 DOM / Capacitor / store，只接收参数并返回结果，便于用 Node 直接测试。
 * 文案集中在本文件，语气温和、不指责、不含 emoji。
 */

const DAY = 86400000;
const TONES = ['gentle', 'lively', 'plain'];

/** 返回 b - a 的分钟差 */
export function gapMinutes(a, b) {
  return (Number(b) - Number(a)) / 60000;
}

/**
 * 统计最近 60 天学习行为的高频小时。
 *
 * @param {Record<string, object>} cards store.cards，每张卡含 hist: [{t, g, i}]
 * @param {number} now 基准时间（毫秒）
 * @returns {{hour:number, confidence:number, samples:number}}
 */
export function peakStudyHour(cards, now = Date.now()) {
  const cutoff = now - 60 * DAY;
  const byHour = new Map();
  let samples = 0;
  Object.values(cards || {}).forEach((card) => {
    const hist = Array.isArray(card?.hist) ? card.hist : [];
    hist.forEach((entry) => {
      const t = Number(entry?.t);
      if (!Number.isFinite(t) || t < cutoff || t > now) return;
      const hour = new Date(t).getHours();
      byHour.set(hour, (byHour.get(hour) || 0) + 1);
      samples += 1;
    });
  });
  if (samples < 5) return { hour: 20, confidence: 0, samples };
  let hour = 20;
  let best = -1;
  byHour.forEach((n, h) => {
    if (n > best) { best = n; hour = h; }
  });
  return { hour, confidence: Math.min(1, samples / 30), samples };
}

/** 解析 'HH:mm'，越界/非法回退 20:00 */
function parseHHMM(value) {
  const [hh, mm] = String(value || '20:00').split(':').map(Number);
  const hour = Number.isFinite(hh) ? Math.min(23, Math.max(0, hh)) : 20;
  const minute = Number.isFinite(mm) ? Math.min(59, Math.max(0, mm)) : 0;
  return { hour, minute };
}

/** 23:00–07:00 静默时段顺延到 08:00 */
function quietHour(hour, minute) {
  let h = ((Math.trunc(hour) % 24) + 24) % 24;
  let m = Math.min(59, Math.max(0, Math.trunc(minute) || 0));
  if (h >= 23 || h <= 7) { h = 8; m = 0; }
  return { hour: h, minute: m };
}

function titleFor(tone) {
  if (tone === 'lively') return 'WordHive · 该复习了';
  if (tone === 'plain') return 'WordHive · 复习提醒';
  return 'WordHive · 轻松复习';
}

function bodyFor(tone, priority, dueCount) {
  if (tone === 'lively') {
    if (priority === 'high') return `${dueCount} 个词到期，清掉它们！`;
    if (priority === 'medium') return `复习时间到，${dueCount} 个词等你。`;
    return `来热个身，${dueCount} 个词很快过完。`;
  }
  if (tone === 'plain') return `WordHive 复习提醒：${dueCount} 个词到期。`;
  if (priority === 'high') return `有 ${dueCount} 个词到期了，先挑 5 个开始就好。`;
  if (priority === 'medium') return `今天有 ${dueCount} 个词到期，抽几分钟过一遍。`;
  return `今天状态不错，来巩固 ${dueCount} 个词吧。`;
}

/**
 * 生成当天的通知槽位方案。
 *
 * @param {object} ctx
 * @param {number} [ctx.now] 当前时间戳
 * @param {number} ctx.dueCount 到期词数
 * @param {number} [ctx.overdueCount] 逾期词数
 * @param {object} [ctx.stats] 含 streak
 * @param {object} [ctx.settings] 用户设置
 * @param {string} [ctx.dayKey] 当天日期键
 * @param {number} [ctx.lastNotifyAt] 上次通知时间戳
 * @param {number} [ctx.notifyToday] 今日已通知次数
 * @param {{hour:number, confidence:number}} [ctx.peak] peakStudyHour 结果
 * @returns {{slots:Array<{id:number,hour:number,minute:number,title:string,body:string,priority:string}>, reason:string, suppress?:boolean, peakHour:number}}
 *          suppress=true 表示「用户主动要求无到期词时不提醒」，是有效意图，
 *          与「异常空计划」（slots 为空但没有 suppress）严格区分：后者由 schedulePlan 兜底。
 */
export function planNotifications(ctx = {}) {
  const now = Number(ctx.now) || Date.now();
  const dueCount = Number(ctx.dueCount) || 0;
  const overdueCount = Number(ctx.overdueCount) || 0;
  const settings = ctx.settings || {};
  const peak = ctx.peak || { hour: 20, confidence: 0 };
  const streak = Number(ctx.stats?.streak) || 0;

  // 基准时间：智能模式优先用高峰小时，否则用固定提醒时间
  const smart = settings.notifySmart === true && Number(peak.confidence) > 0;
  let peakHour;
  let base;
  if (smart) {
    const h = Number(peak.hour);
    peakHour = Number.isFinite(h) ? Math.min(23, Math.max(0, Math.trunc(h))) : 20;
    base = { hour: peakHour, minute: 0 };
  } else {
    base = parseHHMM(settings.remindAt);
    peakHour = base.hour;
  }

  const tone = TONES.includes(settings.notifyTone) ? settings.notifyTone : 'gentle';

  /* 基线文案：没有到期词时也不能催复习，改成「来学新词」的口吻，语气跟档位一致 */
  const BASE_BODY = {
    gentle: '今天暂时没有到期的词，打开 WordHive 学几个新词吧。',
    lively: '今天没有到期的词，来学几个新的？',
    plain: 'WordHive 每日提醒：暂无到期词。'
  };

  /* 次数达上限（frequency_cap）时**有**到期词，只是今天不再催。
     文案不带数字：槽位是 every:'day' 重复的，隔天用户没打开 App 重算时，
     写死的 N 会变成昨天的快照，与事实不符。 */
  const CAPPED_BODY = {
    gentle: '今天的复习提醒已到上限，明天早点来清到期的词。',
    lively: '今天就到这儿，明天早点来清到期的词！',
    plain: 'WordHive 提醒：今日通知已达上限，明天继续。'
  };

  /**
   * 基线槽位：永远至少排一条每日提醒。
   *
   * 为什么必须有：schedulePlan 的做法是「先取消 1001/1100/1101/1102，再按 slots 注册」。
   * 一旦返回空 slots，等于把所有已注册提醒清空；用户清完今天的复习后只要不再打开 App，
   * 就再也不会收到任何提醒（这正是「从不打开应用/清完复习后收不到提醒」的根因）。
   * 所以 no_due / frequency_cap 也返回一条 id=1100 的低优先级兜底提醒，
   * 时间取基准时间（智能高峰有置信度时用高峰小时，否则用 remindAt），并过静默时段顺延。
   * 文案按 reason 分流：no_due 说「来学新词」，frequency_cap 说「明天再清」（不带数字）。
   *
   * @param {string} reason 'no_due' | 'frequency_cap'
   */
  const makeBaseline = (reason) => {
    const at = quietHour(base.hour, base.minute);
    return {
      slots: [
        {
          id: 1100,
          hour: at.hour,
          minute: at.minute,
          title: titleFor(tone),
          body: reason === 'frequency_cap' ? CAPPED_BODY[tone] : BASE_BODY[tone],
          priority: 'low'
        }
      ],
      reason,
      peakHour
    };
  };

  if (dueCount <= 0) {
    /* 用户主动要求「没有到期词的日子不提醒」。
       必须用显式 suppress=true 表达，不能返回空 slots：schedulePlan 把空 slots
       视为异常空计划，会走 fallbackSlot 兜底注册一条，那样这个开关就失效了。
       suppress 只在这一支出现；其它分支都不带该标志。 */
    if (settings.notifyOnlyDue === true) {
      return { slots: [], reason: 'muted_by_user', suppress: true, peakHour };
    }
    return makeBaseline('no_due');
  }

  const maxRaw = Number(settings.notifyMax) || 2;
  const max = Math.min(3, Math.max(1, Math.trunc(maxRaw)));
  if ((Number(ctx.notifyToday) || 0) >= max) return makeBaseline('frequency_cap');

  const gapRaw = settings.notifyGapMin == null ? NaN : Number(settings.notifyGapMin);
  const gap = Number.isFinite(gapRaw) ? gapRaw : 120;
  const throttled = ctx.lastNotifyAt != null && gapMinutes(ctx.lastNotifyAt, now) < gap;

  const priority = (dueCount >= 30 || overdueCount >= 15)
    ? 'high'
    : (dueCount >= 10 ? 'medium' : 'low');
  const title = titleFor(tone);
  const baseBody = bodyFor(tone, priority, dueCount);

  const makeSlot = (id, hour, minute) => {
    const at = quietHour(hour, minute);
    let body = baseBody;
    // 逾期偏多时保留语气正文（含到期数），只补一句更温和的尾巴；连续天数句不得并存
    if (overdueCount > 10 && streak > 0) {
      body = `${baseBody} 先清掉最旧的 5 个就好，不用急。`;
    } else if (streak >= 3) {
      body = `${body} 已连续 ${streak} 天，别断今天。`;
    }
    return { id, hour: at.hour, minute: at.minute, title, body, priority };
  };

  const slots = [makeSlot(1100, base.hour, base.minute)];
  if (dueCount >= 15 || overdueCount >= 8) {
    const late = base.hour > 18;
    slots.push(makeSlot(1101, late ? 10 : base.hour + 4, late ? 0 : base.minute));
  }
  if (dueCount >= 40) slots.push(makeSlot(1102, 20, 0));

  const kept = slots.slice(0, max);
  return {
    slots: throttled ? kept.slice(0, 1) : kept,
    reason: smart ? 'smart_time' : 'fixed_time',
    peakHour
  };
}
