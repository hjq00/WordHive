import { icon } from './core/icons.js';
import { esc, h, toast } from './core/ui.js';
import * as store from './core/store.js';
import * as notify from './core/notify.js';
import { createStudyView } from './views/study.js';
import { createReviewView } from './views/review.js';
import { createLibraryView } from './views/library.js';
import { createAIView } from './views/ai.js';
import { createMeView } from './views/me.js';

const TABS = [
  { id: 'study', name: '学习', icon: 'home' },
  { id: 'review', name: '复习', icon: 'refresh' },
  { id: 'library', name: '素材', icon: 'book' },
  { id: 'ai', name: 'AI', icon: 'sparkles' },
  { id: 'me', name: '我的', icon: 'user' }
];

const screens = document.getElementById('screens');
const tabbar = document.getElementById('tabbar');

let current = 'study';
let view = null;
let lastDue = -1;

function applyTheme() {
  const dark = !!store.getState().settings.dark;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const palette = store.getState().settings.palette;
  document.documentElement.dataset.palette = ['green', 'blue', 'gray'].includes(palette) ? palette : 'green';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1412' : '#f5f6f4');
}

function renderTabbar() {
  const due = store.dueQueue().length;
  // 首建或切换 tab 时重建；其余情况只增量更新角标，避免每次评分都重建整个 tabbar 造成卡顿
  if (!tabbar.querySelector('[data-tab]')) {
    tabbar.innerHTML = TABS.map(
      (t) => `<button class="tab ${current === t.id ? 'active' : ''}" data-tab="${t.id}" aria-label="${t.name}">
        ${icon(t.icon, 21)}
        <span>${t.name}</span>
        ${t.id === 'review' && due ? `<span class="badge">${due > 99 ? '99+' : due}</span>` : ''}
      </button>`
    ).join('');
    tabbar.querySelectorAll('[data-tab]').forEach((btn) =>
      btn.addEventListener('click', () => switchTab(btn.dataset.tab))
    );
    lastDue = due;
    return;
  }
  tabbar.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === current));
  if (due !== lastDue) {
    const reviewBtn = tabbar.querySelector('[data-tab="review"]');
    let badge = reviewBtn.querySelector('.badge');
    if (due) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge';
        reviewBtn.appendChild(badge);
      }
      badge.textContent = due > 99 ? '99+' : due;
    } else {
      badge?.remove();
    }
    lastDue = due;
  }
}

function makeView(tab) {
  // 学习页完成一组 → 去复习；复习页 / 收藏队列 / AI 本篇词汇完成一组 → 去学习。
  // 两边参数名不同，分别传对：study 与 me 用 onGoReview，review 与 ai 用 onGoStudy。
  const opts = { onGoReview: () => switchTab('review') };
  if (tab === 'study') return createStudyView({ ...opts, onBookChange: () => renderTabbar() });
  if (tab === 'review') return createReviewView({ onGoStudy: () => switchTab('study') });
  if (tab === 'library') return createLibraryView();
  if (tab === 'ai') return createAIView({ onGoStudy: () => switchTab('study') });
  return createMeView(opts);
}

/* 视图缓存：切 tab 时复用已建好的视图（每次销毁重建会让主线程卡一下） */
const viewCache = new Map();
let enterTimer = null;
let refreshRaf = null;

/** 新视图入场动画：只动 opacity / transform，走合成层不触发重排 */
function playEnter(el) {
  el.classList.remove('is-entering');
  // 先读一次布局，保证同一个 tab 连点时动画能重播
  void el.offsetWidth;
  el.classList.add('is-entering');
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => el.classList.remove('is-entering'), 260);
}

/**
 * 视图内主滚动容器的位置快照。
 * 缓存视图重新渲染会换掉 DOM 节点，滚动位置会丢，切回来时用这个恢复。
 * 只处理 `.page`（卡片列表页）；学习的 `.deck` 靠自身元素不被替换来保留位置，
 * 一旦它被重建（换词书/再来一组）就应该回到第 0 张，不能强行恢复旧位置。
 */
function snapshotScroll(el) {
  const node = el.querySelector('.page');
  return node ? node.scrollTop : 0;
}

function restoreScroll(el, top) {
  if (!top) return;
  const node = el.querySelector('.page');
  if (node) node.scrollTop = top;
}

/**
 * 切换底部 tab。
 *
 * 顺序刻意是「先给视觉反馈，再做重活」：
 * 1) 旧视图立刻 display:none，新视图立刻显示（缓存命中时零成本）；
 * 2) 立即更新 tabbar active 态，点击的按钮马上有响应；
 * 3) 数据刷新推迟到下一帧（requestAnimationFrame），不挡入场动画。
 */
function switchTab(tab) {
  if (!TABS.some((t) => t.id === tab)) return;
  if (view && current === tab) return;

  const prev = view;
  let next = viewCache.get(tab);
  let created = false;

  if (!next) {
    created = true;
    next = makeView(tab);
    viewCache.set(tab, next);
    // 先隐藏再插入，避免新视图在旧视图旁边闪一帧
    if (prev) next.el.style.display = 'none';
    screens.appendChild(next.el);
  }

  current = tab;
  view = next;

  if (prev && prev !== next) {
    prev.el.classList.remove('is-entering');
    prev.el.style.display = 'none';
    prev.pause?.();
  }

  next.el.style.display = '';
  playEnter(next.el);
  renderTabbar();
  // 只有首次创建视图才回到顶部；切回缓存视图保留原滚动位置
  if (created) window.scrollTo(0, 0);
  next.resume?.();

  if (refreshRaf) cancelAnimationFrame(refreshRaf);
  refreshRaf = requestAnimationFrame(() => {
    refreshRaf = null;
    // 新建的视图自己已经渲染过一次，不必再来一遍
    if (created) return;
    const refresh = next.refresh || next.rerender;
    if (!refresh) return;
    const scrollTop = snapshotScroll(next.el);
    refresh();
    restoreScroll(next.el, scrollTop);
  });
}

/* 提醒 */
let reminderTimer = null;
function checkReminder() {
  const st = store.getState();
  const due = store.dueQueue().length;
  if (!due) return;
  const [h, m] = String(st.settings.remindAt || '20:00').split(':').map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  if (st.lastRemind === store.dateKey(now)) return;
  store.update((s) => {
    s.lastRemind = store.dateKey(now);
  }, true);
  showReminder(due);
  notify.notifyDue(due);
}

function showReminder(count) {
  document.querySelector('.reminder')?.remove();
  const bar = h(`<div class="reminder">
    <span class="r-ic">${icon('clock', 17)}</span>
    <div class="r-txt"><b>${count} 个词到点了</b><span>按记忆曲线，现在复习最省力</span></div>
    <button class="r-go" data-go>去复习</button>
    <button class="r-x" data-x aria-label="关闭">${icon('close', 14)}</button>
  </div>`);
  document.getElementById('app').appendChild(bar);
  bar.querySelector('[data-go]').addEventListener('click', () => {
    bar.remove();
    switchTab('review');
    const start = document.querySelector('[data-start]');
    start?.click();
  });
  bar.querySelector('[data-x]').addEventListener('click', () => bar.remove());
  setTimeout(() => bar.remove(), 15000);
}

/* 启动 */
const params = new URLSearchParams(location.search);
if (params.get('demo') === '1') store.seedDemo();
if (params.get('dark') === '1') store.update((s) => { s.settings.dark = true; }, true);
if (params.get('noanim') === '1') document.documentElement.classList.add('no-anim');

applyTheme();
const initialTab = params.get('tab');
switchTab(TABS.some((t) => t.id === initialTab) ? initialTab : 'study');

const deepWord = params.get('word');
if (deepWord) {
  setTimeout(async () => {
    const { WORD_MAP } = await import('./data/books.js');
    const { openWordDetail } = await import('./views/detail.js');
    const word = WORD_MAP.get(deepWord);
    if (word) openWordDetail(word);
  }, 250);
}

// 每日定时提醒：仅在已授权时注册；App 关闭也能触发（原生）
(async () => {
  const st = store.getState();
  if (!st.settings.remindAt) return;
  const perm = await notify.status();
  if (perm.display !== 'granted') return;
  await notify.scheduleDaily(st.settings.remindAt, store.dueQueue().length);
})();

checkReminder();
reminderTimer = setInterval(checkReminder, 60000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkReminder();
});

let tabbarRaf = null;
store.subscribe(() => {
  // 同一帧内的多次评分合并成一次 tabbar 更新，避免背一组时重复重排 dueQueue
  if (tabbarRaf) cancelAnimationFrame(tabbarRaf);
  tabbarRaf = requestAnimationFrame(() => {
    tabbarRaf = null;
    renderTabbar();
    const reminder = document.querySelector('.reminder');
    if (reminder && !store.dueQueue().length) reminder.remove();
  });
});

window.addEventListener('beforeunload', () => clearInterval(reminderTimer));

/* 便于调试 */
window.__wordhive = { store, switchTab, toast };

if (params.get('debug') === '1') {
  setTimeout(() => {
    const r = (sel) => {
      const el = document.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().width * 10) / 10 : null;
    };
    const info = {
      innerWidth,
      dpr: devicePixelRatio,
      scrollWidth: document.documentElement.scrollWidth,
      app: r('.app'),
      screens: r('.screens'),
      tabbar: r('#tabbar'),
      card: r('.word-card'),
      slide: r('.slide'),
      deck: r('.deck'),
      sheet: r('.sheet'),
      sheetH: (() => {
        const el = document.querySelector('.sheet');
        return el ? Math.round(el.getBoundingClientRect().height) : null;
      })(),
      bodyScroll: (() => {
        const el = document.querySelector('.sheet-body');
        return el ? [el.scrollHeight, el.clientHeight] : null;
      })()
    };
    document.title = JSON.stringify(info);
    const pre = document.createElement('pre');
    pre.id = 'dbg';
    pre.textContent = JSON.stringify(info);
    pre.style.cssText = 'position:fixed;bottom:0;left:0;z-index:9999;font-size:10px;background:#fff;color:#000;padding:4px';
    document.body.appendChild(pre);
  }, 600);
}
