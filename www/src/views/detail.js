import { icon, iconFilled } from '../core/icons.js';
import { esc, openSheet, toast, wordRegex } from '../core/ui.js';
import { speak } from '../core/speech.js';
import * as store from '../core/store.js';
import { stateLabel, relativeDue, retention } from '../core/srs.js';
import { syllabify } from '../core/syllable.js';

/** 详解页四个可左右滑动的面板（顺序即 tab 顺序） */
const PANES = ['联想助记', '词根词缀', '派生', '正反义词', '短语'];

function markWord(text, word) {
  return esc(text).replace(wordRegex(word), '<em>$1</em>');
}

/** 例句块：英文旁带 US / UK 两个发音按钮（整句朗读走原生 TTS / 系统语音） */
function quoteHTML({ en, zh, src, word }) {
  return `<div class="quote">
    <div class="en-row">
      <div class="en" data-ex-text>${markWord(en, word)}</div>
      <div class="quote-voices" role="group" aria-label="例句发音口音">
        <button class="speak" data-say-ex="us" aria-label="美音朗读例句" title="美音朗读例句">${icon('volume', 12)}US</button>
        <button class="speak" data-say-ex="uk" aria-label="英音朗读例句" title="英音朗读例句">${icon('volume', 12)}UK</button>
      </div>
    </div>
    ${zh ? `<div class="zh">${esc(zh)}</div>` : ''}
    ${src ? `<div class="src">${esc(src)}</div>` : ''}
  </div>`;
}

/** 空状态：数据缺失时给一行灰色提示，避免出现空白面板 */
function emptyHTML(text) {
  return `<p class="det-empty">${esc(text)}</p>`;
}

/**
 * 单词标签的「点击切换音节」属性串。
 *
 * 音节不再常驻显示：点一下单词 → 变成 `pol·i·cy`，再点回原词。
 * 切分不可靠（`syllabify` 返回原词 / 没有间隔点）时返回空串，
 * 标签就保持普通文本 —— 即「不给可点状态」，避免点了没反应。
 *
 * @param {string} text 单词原文
 * @returns {string} 形如 ` data-syl-toggle data-plain="policy" data-syl="pol·i·cy" role="button" tabindex="0"`
 */
export function sylToggleAttrs(text) {
  const syl = syllabify(text);
  if (!syl || !syl.includes('·') || syl === text) return '';
  return ` data-syl-toggle data-plain="${esc(text)}" data-syl="${esc(syl)}" role="button" tabindex="0" aria-label="点击查看音节拆分"`;
}

/**
 * 给 `root` 内所有 `[data-syl-toggle]` 绑上点击 / 键盘（Enter、Space）切换。
 *
 * - 只切 `textContent`，渲染期已把两种文本算好，点击时零计算
 * - `stopPropagation`：学习页词卡的点击是事件委托判定的，不能让单词点击冒泡出去
 * - 纯切换显示，不参与任何停留/判定信号（不调 onInteract）
 * - 幂等：同一元素重复调用只绑一次
 *
 * @param {HTMLElement} root 挂载容器
 * @returns {void}
 */
export function bindSyllableToggle(root) {
  root.querySelectorAll('[data-syl-toggle]').forEach((el) => {
    if (el.dataset.sylBound === '1') return;
    el.dataset.sylBound = '1';

    let split = false;
    const toggle = () => {
      split = !split;
      el.textContent = split ? el.dataset.syl : el.dataset.plain;
      /* 只做状态标记，样式上用极轻的字距过渡，不给颜色（避免看起来像链接） */
      el.dataset.sylOn = split ? '1' : '0';
    };

    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
  });
}

/** 词性小胶囊：ECDICT 里词性常是占位点（·），这种不渲染胶囊，只留中文释义 */
function defLineHTML([pos, cn]) {
  const p = String(pos || '').trim();
  const showPos = p && p !== '·' && p !== '-' && p !== '—' && p !== '*';
  return `<div class="line">${showPos ? `<span class="pos">${esc(p)}</span>` : ''}<span class="cn">${esc(cn)}</span></div>`;
}

/** 面板 1：联想助记（含词根词缀补充） */
function mnePaneHTML(word) {
  const mnes = word.mnes || [];
  if (!mnes.length) return emptyHTML('暂无联想助记');
  return mnes.map((m) => `
      <div class="mne-block">
        <span class="mne-tag">${esc(m.t)}</span>
        <p>${esc(m.x)}</p>
      </div>`).join('') + '<p class="det-hint">联想只是脚手架：先靠它记住，再靠例句把词义固定住。</p>';
}

/** 面板：词根词缀（独立一页，不再塞进联想助记底部） */
function rootPaneHTML(word) {
  const root = word.root;
  if (!root || !(root.parts || []).length) return emptyHTML('暂无词根词缀');
  return `<div class="root-parts">
      ${(root.parts || []).map(([t, m]) => `<span class="part"><b>${esc(t)}</b><span>${esc(m)}</span></span>`).join('')}
    </div>
    ${root.tip ? `<p class="tip">${esc(root.tip)}</p>` : ''}`;
}

/** 面板 2：派生（派生词 + 词形变化作为底部补充） */
function derPaneHTML(word) {
  const der = word.der || [];
  const forms = word.forms || [];
  const out = [];

  if (der.length) {
    out.push(`<div class="list-lines">
      ${der.map(([w, cn]) => `<div class="li"><b>${esc(w)}</b><span>${esc(cn)}</span></div>`).join('')}
    </div>`);
  }
  if (forms.length) {
    out.push(`<div class="det-sub">词形变化</div>
      <div class="list-lines">
        ${forms.map(([f, l]) => `<div class="li"><b>${esc(f)}</b><span>${esc(l)}</span></div>`).join('')}
      </div>`);
  }

  return out.length ? out.join('') : emptyHTML('暂无派生词');
}

/** 面板 3：正反义词（近义 / 反义两行 chip） */
function synPaneHTML(word) {
  const syn = word.syn || [];
  const ant = word.ant || [];
  if (!syn.length && !ant.length) return emptyHTML('暂无近义 / 反义词');

  return `${syn.length ? `
    <div class="det-sub">近义</div>
    <div class="chip-row">${syn.map((w) => `<span class="word-chip syn">${esc(w)}</span>`).join('')}</div>` : ''}
    ${ant.length ? `
    <div class="det-sub">反义</div>
    <div class="chip-row">${ant.map((w) => `<span class="word-chip ant">${esc(w)}</span>`).join('')}</div>` : ''}`;
}

/** 面板 4：短语 / 常用搭配 */
function colPaneHTML(word) {
  const col = word.col || [];
  if (!col.length) return emptyHTML('暂无常用短语');
  return `<div class="list-lines">
    ${col.map((c) => `<div class="li"><span>· ${esc(c)}</span></div>`).join('')}
  </div>`;
}

/**
 * 四页滑动区（联想助记 / 派生 / 正反义词 / 短语）。
 * 详解页与学习卡共用同一份结构，避免两处实现漂移。
 */
export function swipeBlockHTML(word) {
  const panes = [mnePaneHTML(word), rootPaneHTML(word), derPaneHTML(word), synPaneHTML(word), colPaneHTML(word)];
  return `<div class="det-swipe-wrap">
    <div class="det-swipe-tabs" role="tablist" aria-label="更多信息">
      ${PANES.map((name, i) => `<button class="det-tab${i === 0 ? ' is-on' : ''}" data-det-tab="${i}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}">${esc(name)}</button>`).join('')}
    </div>
    <div class="det-swipe" data-det-swipe>
      ${panes.map((html, i) => `<section class="det-pane" data-pane="${i}" role="tabpanel">${html}</section>`).join('')}
    </div>
  </div>`;
}

export function detailHTML(word) {
  const card = store.getState().cards[word.id];
  const st = stateLabel(card);
  const fav = store.isFav(word.id);
  const isShow = word.kind === 'show';

  /* 纵向固定顺序：单词 → 音标/发音 → 释义 → 例句 → 注释 → 四页滑动区 → 状态 */
  return `
  <div class="det">
    <div class="row between" style="align-items:flex-start">
      <div style="min-width:0">
        <h2 class="det-word"${sylToggleAttrs(word.w)}>${esc(word.w)}</h2>
        <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px">
          <span class="det-ph">${esc(word.ph)}</span>
          <button class="speak" data-say="us">${icon('volume', 12)}US</button>
          <button class="speak" data-say="uk">${icon('volume', 12)}UK</button>
        </div>
      </div>
      <button class="icon-btn ${fav ? 'fav-on' : ''}" data-fav aria-label="收藏">
        ${fav ? iconFilled('star', 19) : icon('star', 19)}
      </button>
    </div>

    <div class="det-sec">
      <h4>释义</h4>
      <div class="det-defs">
        ${(word.defs || []).map(defLineHTML).join('')}
      </div>
      ${word.note ? `<p class="det-note">${esc(word.note)}</p>` : ''}
    </div>

    <div class="det-sec">
      <h4>例句</h4>
      ${word.ex ? quoteHTML({ en: word.ex.en, zh: word.ex.zh, word: word.w }) : emptyHTML('暂无例句')}
      ${word.real ? `
        <div class="det-sub">${isShow ? '影视台词' : '真题例句'}</div>
        ${quoteHTML({ en: word.real.en, zh: word.real.zh, src: word.real.src, word: word.w })}` : ''}
    </div>

    ${word.annot ? `<div class="det-sec">
      <h4>注释</h4>
      <p class="det-annot">${esc(word.annot)}</p>
    </div>` : ''}

    ${swipeBlockHTML(word)}

    ${word.basic ? `<p class="det-note" style="margin-top:18px">${word.src?.includes('OCR') ? '词条由红宝书扫描件 OCR 生成，建议对照原书抽查；暂无联想与真题精讲。' : '词条来自 ECDICT（MIT）· 当前为大纲速刷版，暂无联想与真题精讲。'}</p>` : ''}

    <div class="det-foot">
      <div class="row between">
        <span class="tiny" style="color:var(--muted)">状态</span>
        <span class="chip" style="color:${st.color}">${st.name}</span>
      </div>
      <div class="row between" style="margin-top:8px">
        <span class="tiny" style="color:var(--muted)">下次复习</span>
        <span class="tiny">${card ? relativeDue(card.due) : '学完这一轮后安排'}</span>
      </div>
      <div class="row between" style="margin-top:8px">
        <span class="tiny" style="color:var(--muted)">记忆保持率</span>
        <span class="tiny">${card ? Math.round(retention(card) * 100) + '%' : '—'}</span>
      </div>
    </div>
  </div>`;
}

/**
 * 绑定四页滑动区的交互：点 tab → 滑到对应页；手指滑动 → 回写 tab 状态。
 *
 * - 只监听 scroll（rAF 节流），不碰 touchmove，纵向滚动完全交给外层 sheet
 * - 程序滚动期间用 `jumping` 标记跳过中间页，避免 tab 高亮闪烁
 * - 屏幕旋转 / 字号变化后按当前页重新对齐
 *
 * @param {HTMLElement} root 详解根节点
 * @returns {void}
 */
export function bindSwipe(root) {
  root.querySelectorAll('.det-swipe-wrap').forEach((wrap) => bindOneSwipe(wrap));
}

function bindOneSwipe(wrap) {
  const swipe = wrap.querySelector('[data-det-swipe]');
  const tabBar = wrap.querySelector('.det-swipe-tabs');
  const tabs = [...wrap.querySelectorAll('[data-det-tab]')];
  if (!swipe || !tabs.length) return;

  let cur = 0;
  let raf = null;
  /** 程序滚动（点 tab）期间锁定的目标页；为 null 表示现在是手指在滚 */
  let pending = null;
  let pendingTimer = null;

  const pageWidth = () => swipe.clientWidth || 1;

  /** 高亮第 idx 个 tab，并把它滚进页签条的可见区域 */
  function activate(idx) {
    const i = Math.max(0, Math.min(tabs.length - 1, idx));
    const changed = i !== cur;
    cur = i;
    tabs.forEach((tab, k) => {
      const on = k === i;
      tab.classList.toggle('is-on', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const active = tabs[i];
    if (changed && active && tabBar && tabBar.scrollWidth > tabBar.clientWidth + 1) {
      const target = active.offsetLeft - (tabBar.clientWidth - active.offsetWidth) / 2;
      tabBar.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }
  }

  /** 点 tab：平滑滚到目标页（滚动期间锁定 pending，避免途经的页面把 tab 高亮带跑） */
  function goTo(idx) {
    const i = Math.max(0, Math.min(tabs.length - 1, idx));
    activate(i);
    pending = i;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = null; }, 800);
    swipe.scrollTo({ left: i * pageWidth(), behavior: 'smooth' });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => goTo(Number(tab.dataset.detTab) || 0));
  });

  swipe.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const dest = pending === null ? null : pending * pageWidth();
      if (dest !== null) {
        if (Math.abs(swipe.scrollLeft - dest) < 3) {
          pending = null;
          clearTimeout(pendingTimer);
        }
        return;
      }
      const idx = Math.round(swipe.scrollLeft / pageWidth());
      if (idx !== cur) activate(idx);
    });
  }, { passive: true });

  /* 尺寸变化（横竖屏、字体缩放）后按当前页重新对齐，避免停在两张卡的中间 */
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      const target = cur * pageWidth();
      if (Math.abs(swipe.scrollLeft - target) > 4) swipe.scrollLeft = target;
    });
    ro.observe(swipe);
  }

  activate(0);
}

export function bindDetail(root, word, onChange) {
  root.querySelectorAll('[data-say]').forEach((btn) => {
    btn.addEventListener('click', () => {
      speak(word.w, { accent: btn.dataset.say, rate: store.getState().settings.ttsRate });
      onChange?.('audio');
    });
  });
  /* 例句整句朗读：文本直接取自渲染后的 .en（含 <em> 也能取到干净文本） */
  root.querySelectorAll('[data-say-ex]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const quote = btn.closest('.quote');
      const text = quote?.querySelector('[data-ex-text]')?.textContent?.trim() || word.ex?.en || '';
      if (text) speak(text, { accent: btn.dataset.sayEx, rate: store.getState().settings.ttsRate });
    });
  });
  const favBtn = root.querySelector('[data-fav]');
  favBtn?.addEventListener('click', () => {
    const on = store.toggleFav(word.id);
    favBtn.classList.toggle('fav-on', on);
    favBtn.innerHTML = on ? iconFilled('star', 19) : icon('star', 19);
    toast(on ? '已加入收藏' : '已取消收藏');
    onChange?.('fav');
  });
  bindSwipe(root);
  bindSyllableToggle(root);
}

export function openWordDetail(word, opts = {}) {
  const content = document.createElement('div');
  content.innerHTML = detailHTML(word);
  const extra = `<span class="tiny muted" style="margin-right:2px">${esc(word.bookName || '')}</span>`;
  const sheet = openSheet({
    title: '详解',
    content,
    headExtra: extra,
    onClose: () => opts.onClose?.()
  });
  bindDetail(content, word, opts.onInteract);
  return sheet;
}
