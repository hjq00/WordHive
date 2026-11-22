import { icon } from '../core/icons.js';
import { esc, h, relTime, toast } from '../core/ui.js';
import * as store from '../core/store.js';
import { relativeDue, stateLabel, retention } from '../core/srs.js';
import { openDeckPage } from './study.js';
import { openWordDetail } from './detail.js';

/**
 * 复习页。
 *
 * 视觉体系：与开始界面共用一套 token（surface / 1px line / radius-xl / shadow-md），
 * 所有图表都是内联 SVG 或纯 CSS，没有引入任何图表库。
 *
 * 数据全部来自真实 store：
 * - `store.stats()`：counts / today / totalLearned / favCount / avgRetention / streak / dueCount
 * - `store.weekSeries()`：最近 7 天 { label, learn, review, key }
 * - `store.dueForecast()`：未来 7 天到期数 { day, n }
 * - `store.getState().cards[*].hist`：每次判定记录 [{ t, g, i }]，g 取 0/1/2，最多保留最近 12 条
 * - `store.getState().settings.dailyNew`：每日新词目标
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** 归一化比例 → 整数百分比 */
function pctOf(v) {
  return Math.round(clamp01(v) * 100);
}

/** 保留 2 位小数，避免把 42.30769230769231% 写进 style 属性 */
function round2(v) {
  return Math.round(v * 100) / 100;
}

/** 横轴标签读屏化：'今天' / '一' → '今天' / '周一' */
function weekName(label) {
  return label === '今天' ? '今天' : `周${label}`;
}

/**
 * 单值环形进度。用 `pathLength="100"` 把 dasharray 直接写成百分比，
 * 省掉周长计算，也避免浮点误差导致接缝。
 *
 * @param {object} cfg
 * @param {number} cfg.percent 0-1
 * @param {string} cfg.ariaLabel 读屏文本
 * @param {string} cfg.centerTop 圆心主文本
 * @param {string} cfg.centerBottom 圆心辅文本
 * @param {number} [cfg.size=92] 视觉直径（px）
 * @param {number} [cfg.stroke=8] 线宽（viewBox 单位）
 * @returns {string} HTML
 */
function ringHTML({ percent, ariaLabel, centerTop, centerBottom, size = 92, stroke = 8 }) {
  const r = (120 - stroke) / 2;
  const p = Math.round(clamp01(percent) * 100);
  // p === 0 时用 butt，否则 round 的端点会在起点留下一个孤立的圆点
  const cap = p > 0 ? 'round' : 'butt';
  return `<div class="rv-ring" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 120 120" role="img" aria-label="${esc(ariaLabel)}">
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--accent)" stroke-width="${stroke}"
        stroke-linecap="${cap}" pathLength="100" stroke-dasharray="${p} ${100 - p}"
        stroke-dashoffset="0" transform="rotate(-90 60 60)"/>
    </svg>
    <div class="rv-ring-label"><b>${esc(centerTop)}</b><span>${esc(centerBottom)}</span></div>
  </div>`;
}

/**
 * 多段环形（甜甜圈）。每段用 dashoffset 累加定位，段与段之间不留缝。
 *
 * @param {Array<{name:string, value:number, color:string}>} items
 * @param {object} cfg
 * @returns {string} HTML
 */
function donutHTML(items, { size = 120, stroke = 13, ariaLabel, centerTop, centerBottom }) {
  const total = items.reduce((sum, it) => sum + it.value, 0);
  let acc = 0;
  const segs = items
    .map((it) => {
      if (!it.value || !total) return '';
      const share = round2((it.value / total) * 100);
      const seg = `<circle class="${it.cls || ''}" cx="60" cy="60" r="${(120 - stroke) / 2}" fill="none"
        stroke="${it.color}" stroke-width="${stroke}" pathLength="100"
        stroke-dasharray="${share} ${round2(100 - share)}" stroke-dashoffset="${-round2(acc)}"
        transform="rotate(-90 60 60)"/>`;
      acc += share;
      return seg;
    })
    .join('');
  const r = (120 - stroke) / 2;
  return `<div class="rv-donut" style="width:${size}px">
    <svg viewBox="0 0 120 120" role="img" aria-label="${esc(ariaLabel)}">
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${stroke}"/>
      ${segs}
    </svg>
    <div class="rv-donut-label"><b>${esc(centerTop)}</b><span>${esc(centerBottom)}</span></div>
  </div>`;
}

/**
 * 正确率口径（唯一定义，页面文案也按这个口径写）：
 *   recognized = 所有卡片 hist 中 g === 2（认识）的条数
 *   total      = 所有卡片 hist 的总条数
 *   正确率     = recognized / total；total 为 0 时返回 null（显示「暂无数据」，不是 0%）
 *
 * @param {Record<string, object>} cards
 * @returns {{hit:number,total:number,pct:number|null}}
 */
function accuracyOf(cards) {
  let hit = 0;
  let total = 0;
  Object.values(cards).forEach((c) => {
    (c.hist || []).forEach((e) => {
      total += 1;
      if (e.g === 2) hit += 1;
    });
  });
  return { hit, total, pct: total ? hit / total : null };
}

/**
 * 最近 7 天逐日正确率：按 hist 的 t 落到 local dateKey 上聚合。
 * 没有记录的那天返回 pct = null（画极淡占位，不画 0 宽柱）。
 *
 * @param {Record<string, object>} cards
 * @param {Array<{label:string,key:string}>} series store.weekSeries()（顺序即横轴顺序）
 * @returns {Array<{label:string,key:string,total:number,pct:number|null}>}
 */
function dailyAccuracy(cards, series) {
  const byDay = new Map();
  Object.values(cards).forEach((c) => {
    (c.hist || []).forEach((e) => {
      const key = store.dateKey(new Date(e.t));
      const rec = byDay.get(key) || { hit: 0, total: 0 };
      rec.total += 1;
      if (e.g === 2) rec.hit += 1;
      byDay.set(key, rec);
    });
  });
  return series.map((d) => {
    const rec = byDay.get(d.key);
    const total = rec ? rec.total : 0;
    return { label: d.label, key: d.key, total, pct: total ? rec.hit / total : null };
  });
}

/** 正确率迷你柱：固定高度轨道，空数据日只显示一条极淡占位，避免布局跳动 */
function accuracyBars(list) {
  const aria = `最近 7 天正确率：${list
    .map((d) => `${weekName(d.label)} ${d.pct === null ? '无记录' : `${pctOf(d.pct)}%`}`)
    .join('，')}`;
  return `<div class="acc-bars" role="img" aria-label="${esc(aria)}">
    ${list
      .map((d) => {
        const has = d.pct !== null;
        const height = has ? Math.max(6, pctOf(d.pct)) : 4;
        return `<div class="acc-col"${has ? ` title="${esc(d.key)} · ${pctOf(d.pct)}%（${d.total} 条记录）"` : ''}>
          <div class="acc-track"><i class="${has ? '' : 'ghost'}" style="height:${height}%"></i></div>
          <span class="acc-lbl">${esc(d.label)}</span>
        </div>`;
      })
      .join('')}
  </div>`;
}

/** 最近 7 天趋势：双色堆叠柱（新学 accent / 复习 sky），今天那根加描边标记 */
function trendBars(series) {
  const totals = series.map((s) => s.learn + s.review);
  const max = Math.max(1, ...totals);
  if (totals.every((n) => n === 0)) {
    return `<p class="rv-empty-note">最近 7 天还没有学习记录，背一组词之后这里会出现节奏。</p>`;
  }
  const aria = `最近 7 天：${series
    .map((s) => `${weekName(s.label)}新学 ${s.learn} 复习 ${s.review}`)
    .join('，')}`;
  return `<div class="trend" role="img" aria-label="${esc(aria)}">
    ${series
      .map((s, i) => {
        const total = s.learn + s.review;
        const height = total ? Math.max(5, Math.round((total / max) * 100)) : 3;
        const learnShare = total ? round2((s.learn / total) * 100) : 0;
        const isToday = i === series.length - 1;
        return `<div class="trend-col"${total ? ` title="${esc(s.key)} · 新学 ${s.learn} · 复习 ${s.review}"` : ''}>
          <div class="trend-stack${isToday ? ' is-today' : ''}${total ? '' : ' empty'}" style="height:${height}%">
            ${s.learn ? `<i class="nw" style="height:${learnShare}%"></i>` : ''}
            ${s.review ? `<i class="rv" style="height:${round2(100 - learnShare)}%"></i>` : ''}
          </div>
          <span class="trend-lbl">${esc(s.label)}</span>
        </div>`;
      })
      .join('')}
  </div>`;
}

/** 未来 7 天到期负荷：紧凑条形 + 顶部次数，全 0 时给一句克制的占位 */
function forecastBars(list) {
  const max = Math.max(1, ...list.map((d) => d.n));
  const total = list.reduce((sum, d) => sum + d.n, 0);
  if (!total) {
    return `<p class="rv-empty-note">未来 7 天没有到期的词，可以放心往后推。</p>`;
  }
  const aria = `未来 7 天到期：${list
    .map((d) => `${d.day === 0 ? '今天' : `${d.day} 天后`} ${d.n} 词`)
    .join('，')}`;
  return `<div class="fc" role="img" aria-label="${esc(aria)}">
    ${list
      .map((d) => {
        const height = d.n ? Math.max(8, Math.round((d.n / max) * 100)) : 4;
        return `<div class="fc-col" title="${d.day === 0 ? '今天' : `${d.day} 天后`} · ${d.n} 词">
          <span class="fc-num">${d.n || ''}</span>
          <div class="fc-track"><i class="${d.n ? '' : 'ghost'}" style="height:${height}%"></i></div>
          <span class="fc-lbl">${d.day === 0 ? '今天' : `+${d.day}`}</span>
        </div>`;
      })
      .join('')}
  </div>`;
}

/** shadcn 风格空状态 */
function emptyState(iconName, title, desc) {
  return `<div class="ui-empty">${icon(iconName, 30)}<b>${esc(title)}</b><p>${esc(desc)}</p></div>`;
}

/**
 * 复习页视图工厂。
 *
 * @param {object} [cfg]
 * @param {Function} [cfg.onGoStudy] 复习组 / 收藏队列做完后，完成页「去学习」按钮的跳转动作
 *   （由 main.js 传入 switchTab('study')；不传则按钮只关闭卡片页不跳转）
 * @returns {{el: HTMLElement, destroy: Function, rerender: Function}}
 */
export function createReviewView({ onGoStudy } = {}) {
  const el = h('<div class="screen"></div>');
  let tab = 'due';

  function dueStats() {
    const due = store.dueQueue();
    const now = Date.now();
    const overdue = due.filter((x) => x.card.due < now - 3600000).length;
    return { due, overdue, today: due.length - overdue };
  }

  /** 今日已学：card.last 落在今天 */
  function learnedToday() {
    const key = store.dateKey();
    const start = new Date(`${key}T00:00:00`).getTime();
    return Object.entries(store.getState().cards)
      .filter(([, c]) => c.last >= start)
      .sort((a, b) => b[1].last - a[1].last)
      .map(([id, card]) => ({ word: store.allWords().find((w) => w.id === id), card }))
      .filter((x) => x.word);
  }

  function render() {
    const stats = store.stats();
    const { due, overdue, today } = dueStats();
    const book = store.currentBook();
    const favs = store.favWords();
    const learned = learnedToday();
    const cards = store.getState().cards;
    const settings = store.getState().settings;

    const mastered = Object.entries(cards)
      .filter(([, c]) => c.state === 'mastered')
      .map(([id]) => store.allWords().find((w) => w.id === id))
      .filter(Boolean);

    const reviewing = stats.counts.review + stats.counts.learning;
    const todayDone = learned.length;

    /* ---- 今日目标环（今日已学 / 每日新词目标） ---- */
    const target = Math.max(1, Number(settings.dailyNew) || 1);
    // 待复习为 0 → 环按「已完成」显示 100%，与文案一致
    const goalRatio = due.length ? clamp01(todayDone / target) : 1;
    const goalLabel = due.length
      ? `今日已学 ${todayDone} / 目标 ${target}，完成 ${pctOf(goalRatio)}%`
      : '今天的词都清完了';

    /* ---- 掌握分布 ----
       口径：环形只画「已学词」的构成（已掌握 / 复习中 / 学习中）。
       全书未学量常常是几千词，若把「未学」也塞进环里，圆环 99.8% 都是一段灰弧，
       剩下三段肉眼根本看不见（实测：未学 3451 / 已学 8）。
       所以未学改用下面那条全书进度条呈现——数值和占比照样给全，环还可读。 */
    const learnedTotal = stats.counts.mastered + stats.counts.review + stats.counts.learning;
    const newCount = stats.counts.new;
    const bookTotal = Math.max(1, learnedTotal + newCount);
    const learnedBase = Math.max(1, learnedTotal);
    const bookPct = (learnedTotal / bookTotal) * 100;
    const dist = [
      { name: '已掌握', value: stats.counts.mastered, color: 'var(--accent)' },
      { name: '复习中', value: stats.counts.review, color: 'var(--sky)' },
      { name: '学习中', value: stats.counts.learning, color: 'var(--rose)' }
    ];
    const distAria =
      `已学 ${learnedTotal} 词的掌握构成：` +
      `${dist.map((d) => `${d.name} ${d.value} 词`).join('，')}；` +
      `全书共 ${bookTotal} 词，未学 ${newCount} 词`;

    /* ---- 正确率 ---- */
    const series = store.weekSeries();
    const acc = accuracyOf(cards);
    const dailyAcc = dailyAccuracy(cards, series);
    const accText = acc.pct === null
      ? '暂无数据'
      : `${pctOf(acc.pct)}%`;

    /* ---- 保持率着色阈值 ---- */
    const retentionValue = pctOf(stats.avgRetention);
    const retentionClass = stats.avgRetention < 0.6 ? 'is-bad' : stats.avgRetention >= 0.8 ? 'is-good' : '';

    const tabs = [
      { id: 'due', name: '待复习', count: due.length },
      { id: 'learned', name: '今日已学', count: learned.length },
      { id: 'fav', name: '收藏', count: favs.length },
      { id: 'mastered', name: '已掌握', count: mastered.length }
    ];

    el.innerHTML = `
    <div class="page rv-page">
      <div class="page-head">
        <div>
          <h1>复习</h1>
          <p class="sub">${esc(book.name)} · 按记忆曲线安排</p>
        </div>
        <span class="ui-badge accent">${icon('flame', 12)} 连续 ${stats.streak} 天</span>
      </div>

      <section class="rv-hero">
        <div class="rv-hero-main">
          <div class="rv-hero-label">今天待复习</div>
          <div class="rv-hero-num">${due.length}<span>词</span></div>
          <p class="rv-hero-meta">${
            due.length
              ? `逾期 <b>${overdue}</b> · 今天到期 <b>${today}</b>`
              : '今天的词都清完了，明天再来'
          }</p>
          <div class="rv-hero-actions">
            <button class="ui-btn default" data-start ${due.length ? '' : 'disabled'}>
              ${icon('play', 14)} ${due.length ? '开始复习' : '暂无到期'}
            </button>
            ${favs.length ? `<button class="ui-btn ghost sm" data-fav-deck>${icon('star', 13)} 收藏 ${favs.length}</button>` : ''}
          </div>
        </div>
        ${ringHTML({
          percent: goalRatio,
          ariaLabel: `${goalLabel}，环形进度 ${pctOf(goalRatio)}%`,
          centerTop: `${pctOf(goalRatio)}%`,
          centerBottom: '今日目标'
        })}
      </section>

      <div class="rv-metrics">
        <div class="rv-metric"><b>${stats.counts.mastered}</b><span>已掌握</span></div>
        <i class="rv-div" aria-hidden="true"></i>
        <div class="rv-metric"><b>${reviewing}</b><span>复习中</span></div>
        <i class="rv-div" aria-hidden="true"></i>
        <div class="rv-metric"><b class="${retentionClass}">${retentionValue}%</b><span>保持率</span></div>
        <i class="rv-div" aria-hidden="true"></i>
        <div class="rv-metric"><b>${todayDone}</b><span>今日已学</span></div>
      </div>

      <div class="rv-grid">
        <section class="rv-card">
          <div class="ui-card-header">
            <div>
              <h3 class="ui-card-title">掌握分布</h3>
              <p class="ui-card-desc">已学 ${learnedTotal} 词 · 全书 ${bookTotal} 词</p>
            </div>
          </div>
          <div class="rv-mastery">
            ${donutHTML(dist, {
              ariaLabel: distAria,
              centerTop: `${learnedTotal}`,
              centerBottom: '已学词'
            })}
            <div class="rv-legend">
              ${dist
                .map(
                  (d) => `<div class="rv-lg-row">
                    <i style="background:${d.color}" aria-hidden="true"></i>
                    <span class="rv-lg-name">${esc(d.name)}</span>
                    <b class="rv-lg-val">${d.value}</b>
                    <span class="rv-lg-pct">${pctOf(d.value / learnedBase)}%</span>
                  </div>`
                )
                .join('')}
            </div>
          </div>
          <div class="rv-progress">
            <div class="rv-progress-track"><i style="width:${round2(bookPct)}%"></i></div>
            <p class="rv-progress-txt">
              全书进度 <b>${bookPct.toFixed(1)}%</b> · 未学 <b>${newCount}</b> 词
            </p>
          </div>
        </section>

        <section class="rv-card">
          <div class="ui-card-header">
            <div>
              <h3 class="ui-card-title">正确率</h3>
              <p class="ui-card-desc">${acc.total
                ? `答对 ${acc.hit} / ${acc.total} 次判定记录`
                : '还没有判定记录'}</p>
            </div>
          </div>
          <div class="rv-acc-head">
            <b class="rv-acc-num${acc.pct === null ? ' is-empty' : ''}">${esc(accText)}</b>
            <span class="rv-acc-hint">${acc.pct === null ? '背一组词后开始统计' : '「认识」占全部判定的比例'}</span>
          </div>
          ${accuracyBars(dailyAcc)}
        </section>

        <section class="rv-card">
          <div class="ui-card-header">
            <div>
              <h3 class="ui-card-title">复习趋势</h3>
              <p class="ui-card-desc">最近 7 天，新学与复习</p>
            </div>
            <div class="rv-card-key">
              <span><i class="k-nw" aria-hidden="true"></i>新学</span>
              <span><i class="k-rv" aria-hidden="true"></i>复习</span>
            </div>
          </div>
          ${trendBars(series)}
        </section>

        <section class="rv-card">
          <div class="ui-card-header">
            <div>
              <h3 class="ui-card-title">未来 7 天到期</h3>
              <p class="ui-card-desc">提前看到记忆曲线的负荷</p>
            </div>
          </div>
          ${forecastBars(store.dueForecast())}
        </section>
      </div>

      <div class="ui-section-head rv-list-head"><h2>单词列表</h2><span>点词查看详解</span></div>
      <div class="ui-tabs" role="tablist">
        ${tabs.map((t) => `<button class="ui-tab" role="tab" data-tab="${t.id}" aria-selected="${tab === t.id}">${t.name} ${t.count}</button>`).join('')}
      </div>
      <div id="tab-body" class="rv-tab-body">${tabBody(due, learned, favs, mastered)}</div>
      <p class="rv-note">
        复习时间由停留判定决定：不认识 10 分钟后再来，模糊约半天，认识按间隔往后推。
      </p>
    </div>`;

    bind();
  }

  function itemHTML(word, badgeHtml, metaText) {
    return `<button class="ui-item" data-word="${word.id}">
      <span class="ui-item-thumb" style="font-family:var(--font-serif);font-size:15px;font-weight:600">${esc(word.w.slice(0, 1).toUpperCase())}</span>
      <span class="ui-item-body">
        <span class="ui-item-title">${esc(word.w)}</span>
        <span class="ui-item-sub">${esc(metaText)}</span>
        <span class="ui-item-meta">${badgeHtml}</span>
      </span>
      <span class="ui-item-chev">${icon('chevronRight', 16)}</span>
    </button>`;
  }

  function tabBody(due, learned, favs, mastered) {
    if (tab === 'due') {
      if (!due.length) return emptyState('check', '没有到期的词', '去学新词，或明天再来。记忆曲线会把词送回来。');
      const groups = [
        { name: '已逾期', list: due.filter((x) => x.card.due < Date.now() - 3600000) },
        { name: '今天到期', list: due.filter((x) => x.card.due >= Date.now() - 3600000) }
      ].filter((g) => g.list.length);
      return `<div class="ui-list">${groups.map((g) => `
        <div>
          <div class="ui-section-head" style="margin-bottom:6px"><h2>${g.name}</h2><span>${g.list.length} 词</span></div>
          ${g.list.map(({ word, card }) => itemHTML(word,
            `<span class="ui-badge ${card.state === 'learning' ? 'rose' : 'sky'}">${stateLabel(card).name}</span><span class="ui-badge outline">${relativeDue(card.due)}</span>`,
            word.defs?.[0] ? `${word.defs[0][0]} ${word.defs[0][1]}` : (word.ph || '大纲词')
          )).join('')}
        </div>`).join('')}</div>`;
    }
    if (tab === 'learned') {
      if (!learned.length) return emptyState('clock', '今天还没背词', '去学习页背一组，背完的词会出现在这里。');
      return `<div class="ui-list">${learned.map(({ word, card }) => itemHTML(word,
        `<span class="ui-badge ${['rose','amber','accent'][card.grade ?? 2]}">${['不认识','模糊','认识'][card.grade ?? 2]}</span><span class="ui-badge outline">${relTime(card.last)}</span>`,
        word.defs?.[0] ? `${word.defs[0][0]} ${word.defs[0][1]}` : (word.ph || '大纲词')
      )).join('')}</div>`;
    }
    if (tab === 'fav') {
      if (!favs.length) return emptyState('star', '还没有收藏', '在词卡右上角点星标，生词会留在这里。');
      return `<div style="margin-bottom:10px"><button class="ui-btn outline block sm" data-fav-deck>${icon('play', 13)} 复习收藏 ${favs.length}</button></div>
      <div class="ui-list">${favs.map((w) => {
        const c = store.getState().cards[w.id];
        return itemHTML(w, `<span class="ui-badge outline">${c ? relativeDue(c.due) : '未学'}</span>`,
          w.defs?.[0] ? `${w.defs[0][0]} ${w.defs[0][1]}` : (w.ph || '大纲词'));
      }).join('')}</div>`;
    }
    if (!mastered.length) return emptyState('award', '还没有已掌握的词', '连续答对、间隔拉到 21 天以上，词就会进入这里。');
    return `<div class="ui-list">${mastered.map((w) => {
      const c = store.getState().cards[w.id];
      return itemHTML(w,
        `<span class="ui-badge accent">保持率 ${Math.round(retention(c) * 100)}%</span><span class="ui-badge outline">间隔 ${Math.round(c.interval)} 天</span>`,
        w.defs?.[0] ? `${w.defs[0][0]} ${w.defs[0][1]}` : (w.ph || '大纲词'));
    }).join('')}</div>`;
  }

  function bind() {
    el.querySelectorAll('[data-tab]').forEach((btn) =>
      btn.addEventListener('click', () => {
        tab = btn.dataset.tab;
        render();
      })
    );
    el.querySelectorAll('[data-start]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const list = store.dueQueue();
        if (!list.length) return;
        openDeckPage({
          title: '复习',
          subtitle: `${list.length} 个到期词 · 停留即判定`,
          words: list.map((x) => x.word),
          mode: 'review',
          onDone: render,
          // 复习完这组 → 完成页显示「去学习」，点了关掉卡片页并切到学习 tab
          onGo: () => onGoStudy?.()
        });
      })
    );
    el.querySelectorAll('[data-fav-deck]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const list = store.favWords();
        if (!list.length) return toast('收藏夹是空的');
        openDeckPage({
          title: '收藏复习',
          subtitle: `${list.length} 个词 · 收藏队列`,
          words: list,
          mode: 'fav',
          onDone: render,
          // 收藏队列是学习侧的补充练习，做完同样引导回学习页
          onGo: () => onGoStudy?.()
        });
      })
    );
    el.querySelectorAll('[data-word]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const word = store.allWords().find((w) => w.id === btn.dataset.word);
        if (word) openWordDetail(word, { onClose: render });
      })
    );
  }

  render();
  return { el, destroy() {}, rerender: render };
}
