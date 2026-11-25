import { icon, iconFilled } from '../core/icons.js';
import { esc, h, openSheet, pushPage, toast, relTime, wordRegex } from '../core/ui.js';
import { speak, speakSequence } from '../core/speech.js';
import * as store from '../core/store.js';
import { blankCard, previewIntervals, stateLabel } from '../core/srs.js';
import { openWordDetail, sylToggleAttrs, bindSyllableToggle, swipeBlockHTML, bindSwipe } from './detail.js';
import { BOOKS } from '../data/books.js';
import { sensOf } from '../core/sens.js';
import { searchButtonHTML, bindSearchButton } from './search.js';

const RING = 2 * Math.PI * 9;
let lastDeck = null;

function defsHTML(word) {
  return word.defs
    .map(([pos, cn]) => {
      /* ECDICT 里词性常是占位符（· / - / — / *），这种不渲染胶囊，只留中文释义 */
      const p = String(pos || '').trim();
      const showPos = p && p !== '·' && p !== '-' && p !== '—' && p !== '*';
      return `<div class="def-line">${showPos ? `<span class="pos">${esc(p)}</span>` : ''}<span class="cn">${esc(cn)}</span></div>`;
    })
    .join('');
}

function exHTML(word) {
  return esc(word.ex.en).replace(wordRegex(word.w), '<em>$1</em>');
}


function slideHTML(word, i, total, mode, settings) {
  const card = store.getState().cards[word.id];
  const fav = store.isFav(word.id);
  const showMeta = mode === 'review' && card;
  const st = stateLabel(card);

  return `
  <div class="slide" data-i="${i}" data-id="${word.id}">
    <span class="bg-wm" aria-hidden="true">${esc(word.w)}</span>
    <header class="word-hero">
      <div class="hero-top">
        <span class="idx">${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
        <div class="card-tools">
          <button class="dwell ${settings.showDwell ? '' : 'hidden'}" data-dwell aria-label="本次判定">
            <svg viewBox="0 0 24 24" class="dwell-ring" aria-hidden="true">
              <circle cx="12" cy="12" r="9" class="ring-bg"></circle>
              <circle cx="12" cy="12" r="9" class="ring-fg" stroke-dasharray="${RING}" stroke-dashoffset="${RING}"></circle>
            </svg>
            <span class="dwell-txt">0.0s</span>
          </button>
          <button class="star-btn ${fav ? 'on' : ''}" data-star aria-label="收藏">
            ${fav ? iconFilled('star', 18) : icon('star', 18)}
          </button>
        </div>
      </div>

      <h2 class="word${mode === 'learn' ? '' : ' word-tap'}"${mode === 'learn' ? sylToggleAttrs(word.w) : ' data-detail'}>${esc(word.w)}</h2>
      <div class="phonetic-row">
        <span>${esc(word.ph)}</span>
        <button class="speak" data-say="us">${icon('volume', 12)}US</button>
        <button class="speak" data-say="uk">${icon('volume', 12)}UK</button>
      </div>
      ${showMeta ? `<div class="word-meta"><span>上次 ${relTime(card.last)}</span><i></i><span>${st.name}</span><i></i><span>第 ${card.reps + 1} 次</span></div>` : ''}
    </header>

    <article class="word-card">
      <div class="defs">${defsHTML(word)}</div>
      ${word.basic && word.forms?.length ? `<div class="form-row">${word.forms.slice(0, 3).map(([f, l]) => `<span><b>${esc(f)}</b>${esc(l)}</span>`).join('')}</div>` : ''}

      ${word.ex ? `<div class="ex-block">
        <p class="ex" data-ex-text>${exHTML(word)}</p>
        <div class="ex-voices" role="group" aria-label="例句发音口音">
          <button class="speak" data-say-ex="us" aria-label="美音朗读例句" title="美音朗读例句">${icon('volume', 12)}US</button>
          <button class="speak" data-say-ex="uk" aria-label="英音朗读例句" title="英音朗读例句">${icon('volume', 12)}UK</button>
        </div>
        ${word.ex.zh ? `<p class="ex-zh">${esc(word.ex.zh)}</p>` : ''}
      </div>` : `<p class="basic-note">${word.src?.includes('OCR') ? '扫描 OCR 词条 · 建议抽查释义，暂无例句' : '大纲词 · 暂无例句，先把释义和词形记牢'}</p>`}

      ${word.real ? `<button class="real-hint" data-detail>
        ${icon('bookOpen', 13)}
        <span>${word.kind === 'show' ? '影视台词' : '真题语境'} · ${esc(word.real.src || '')}</span>
        <i style="margin-left:auto;font-style:normal">›</i>
      </button>` : ''}

      <div class="card-extra">${swipeBlockHTML(word)}</div>

      <div class="card-foot">
        ${mode === 'learn' ? '' : `<button class="detail-link" data-detail>完整详解 ${icon('chevronRight', 13)}</button>`}
        <span class="swipe-hint">${icon('chevronUp', 12)} 上滑下一个</span>
      </div>
    </article>
  </div>`;
}

/**
 * 完成页。
 *
 * 完成页按钮的语义是「离开本组去另一条流水线」：
 * - 学习组（mode = 'learn'）做完 → 该去复习了，文案「去复习」；
 * - 复习组 / 收藏队列（mode = 'review' | 'fav'）做完 → 该去学新词了，文案「去学习」。
 *
 * 按钮统一用 data-go 标记，由 mountDeck 的委托点击处理，实际跳转目标由调用方的 onGo 决定。
 *
 * @param {boolean} hideMore 是否隐藏「再来一组」（复习页/收藏队列不提供再来一组）
 * @param {'learn'|'review'|'fav'} mode 队列模式，用来决定按钮文案
 * @returns {string} 完成页 slide 的 HTML
 */
function doneSlideHTML(hideMore = false, mode = 'learn') {
  const toStudy = mode === 'review' || mode === 'fav';
  const goLabel = toStudy ? '去学习' : '去复习';
  return `
  <div class="slide" data-done="1">
    <div class="done">
      <div class="mark">${icon('check', 30)}</div>
      <h2 data-done-title>这一组完成了</h2>
      <p data-done-text>停留时长已记进记忆曲线。不用赶进度，随时停下。</p>
      <div class="done-stats" data-done-stats></div>
      <div class="btns">
        <button class="btn ghost" data-go data-go-review>${goLabel}</button>
        <button class="btn primary" data-more ${hideMore ? 'hidden' : ''}>再来一组</button>
      </div>
      <p class="tiny" style="margin-top:18px;color:var(--muted)">下滑回看刚才的词</p>
    </div>
  </div>`;
}

/**
 * 把一个词卡队列挂到容器上：滑动切换 + 停留判定 + 收藏 + 详解
 */
export function mountDeck(deckEl, words, opts = {}) {
  const mode = opts.mode || 'learn';
  const settings = store.getState().settings;
  const sens = sensOf(settings);
  deckEl.innerHTML = words.map((w, i) => slideHTML(w, i, words.length, mode, settings)).join('') + doneSlideHTML(opts.hideMore, mode);
  /* 单词点击切换音节（每张卡独立绑定，幂等，不参与判定信号） */
  bindSyllableToggle(deckEl);
  bindSwipe(deckEl);

  const slides = [...deckEl.querySelectorAll('.slide')];
  const graded = new Map();
  const session = { 0: 0, 1: 0, 2: 0 };
  let active = -1;
  let dwellStart = 0;
  let acc = 0;
  let sig = { audio: 0, detail: false, fav: false };
  let raf = null;
  let ticker = null;
  let finished = false;
  let cancelAuto = null;
  let autoArmed = false;
  const autoEvents = [];

  function cancelAutoSpeech() {
    if (cancelAuto) {
      cancelAuto();
      cancelAuto = null;
    }
  }

  /**
   * 自动发音：只读单词本身（不再连例句一起读）。
   *
   * 例句会打断「看一眼就过」的节奏，也让同一个词被读两遍；
   * 需要听例句时用户点例句旁的 US / UK 按钮即可（[data-say-ex]，学习页与详解页都保留）。
   */
  function autoSpeak(i) {
    cancelAutoSpeech();
    const cfg = store.getState().settings;
    if (i < 0 || i >= words.length || !cfg.autoSpeak) return;
    const word = words[i];
    cancelAuto = speakSequence([word.w], { accent: cfg.accent, rate: cfg.ttsRate });
  }

  function armAuto() {
    if (autoArmed) return;
    autoArmed = true;
    autoSpeak(active);
  }
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((type) => {
    const fn = () => armAuto();
    autoEvents.push([type, fn]);
    document.addEventListener(type, fn, { passive: true });
  });

  const pillOf = (i) => slides[i]?.querySelector('[data-dwell]');
  const ringOf = (i) => slides[i]?.querySelector('.ring-fg');

  function paintPill(i, grade, sec) {
    const pill = pillOf(i);
    if (!pill) return;
    const txt = pill.querySelector('.dwell-txt');
    pill.classList.remove('g0', 'g1', 'g2', 'live', 'mid', 'over');
    if (grade === undefined) {
      pill.classList.add('live');
      pill.classList.toggle('mid', sec > sens.fast && sec <= sens.slow);
      pill.classList.toggle('over', sec > sens.slow);
      txt.textContent = `${sec.toFixed(1)}s`;
      const ring = ringOf(i);
      const ratio = Math.min(1, sec / sens.slow);
      ring.style.strokeDashoffset = String(RING * (1 - ratio));
      ring.style.stroke = sec <= sens.fast ? 'var(--accent)' : sec <= sens.slow ? 'var(--amber)' : 'var(--rose)';
      return;
    }
    pill.classList.add(`g${grade}`);
    txt.textContent = ['不认识', '模糊', '认识'][grade];
    const ring = ringOf(i);
    if (ring) {
      ring.style.strokeDashoffset = '0';
      ring.style.stroke = ['var(--rose)', 'var(--amber)', 'var(--accent)'][grade];
    }
  }

  /**
   * 判定环隐藏（settings.showDwell = false）时的非侵入反馈。
   *
   * 在左上角「03 / 20」后面短暂浮出本次判定（1.2s 后淡出，不占布局），
   * 让用户切词后立刻知道「刚才这一张被判成了什么」，比强制显示判定环克制得多。
   *
   * @param {number} i 卡片下标
   * @param {number} grade 0 不认识 / 1 模糊 / 2 认识
   * @returns {void}
   */
  function flashGrade(i, grade) {
    const idx = slides[i]?.querySelector('.idx');
    if (!idx) return;
    idx.dataset.flash = ['不认识', '模糊', '认识'][grade];
    idx.dataset.flashG = String(grade);
    clearTimeout(idx.__flashTimer);
    idx.__flashTimer = setTimeout(() => {
      delete idx.dataset.flash;
      delete idx.dataset.flashG;
    }, 1200);
  }

  /**
   * 停留时长 + 交互信号 → 判定。
   *
   * 停留时长是主信号，交互只做「上限约束」：
   * - 复听 ≥ 2 次：最多「模糊」（说明这个词还没进耳朵）
   * - 点开详解 / 收藏：最多「模糊」，但**不再**直接判「不认识」。
   *   旧逻辑只要点过详解就判 0，用户明明看懂了却被判「不认识」，切下一张时
   *   感觉「毫无反应 / 判错」。现在这两项只是「需要再确认一次」的信号，
   *   既不强行降级到不认识，也不允许停留再短就记「认识」。
   */
  function decide(sec, s) {
    /* 停留超过 60s：大概率人已经离开去干别的了，这次停留不可信。
       不判「不认识」（避免误伤 SRS 间隔），按「模糊」记录，等下次真正看一眼再定。 */
    if (sec > 60) return 1;
    let grade = sec <= sens.fast ? 2 : sec <= sens.slow ? 1 : 0;
    if (s.audio >= 2 && grade > 1) grade = 1;
    if (s.detail || s.fav) grade = Math.min(grade, 1);
    return grade;
  }

  /**
   * 结算一张卡的停留时间并落库（只结算一次）。
   *
   * 计时口径：`acc`（之前被 pause/visibilitychange 累积的毫秒数）+
   * 当前这段 `dwellStart → now`。调用方必须在把 `acc` 归零**之前**调用本函数
   * （setActive 里 finish(active) 在前、acc = 0 在后），否则上一张的停留时间会丢。
   */
  function finish(i) {
    if (i < 0 || i >= words.length) return;
    const word = words[i];
    const total = (acc + (dwellStart ? performance.now() - dwellStart : 0)) / 1000;
    const sec = Math.min(60, total);
    if (!graded.has(word.id)) {
      /* 判定读真实秒数（total），否则 >60s 的例外永远触发不到；落库仍存截断后的 60s */
      const grade = decide(total, sig);
      store.gradeWord(word.id, grade, { auto: true, dwell: sec * 1000 });
      graded.set(word.id, grade);
      session[grade] += 1;
      paintPill(i, grade, sec);
      /* 判定环被用户关掉时，用左上角浮出的短标签给一个不打断阅读的反馈 */
      if (!store.getState().settings.showDwell) flashGrade(i, grade);
      opts.onGraded?.(word, grade, sec);
    } else {
      paintPill(i, graded.get(word.id), sec);
    }
  }

  function setActive(i) {
    if (i === active) return;
    finish(active);
    active = i;
    acc = 0;
    opts.onProgress?.(Math.min(i, words.length), words.length);

    if (i >= words.length) {
      // 进入完成页：结束计时、标记完成、仅首次触发 onFinish
      dwellStart = 0;
      if (!finished) {
        finished = true;
        opts.onFinish?.(session);
        const stat = slides[i]?.querySelector('[data-done-stats]');
        if (stat) {
          stat.innerHTML = `<span><b>${session[2]}</b>认识</span><span><b>${session[1]}</b>模糊</span><span><b>${session[0]}</b>不认识</span>`;
        }
      }
      cancelAutoSpeech();
      return;
    }

    // 回看已判定的词：不再计时、不再判定，只保留已判结果
    if (graded.has(words[i].id)) {
      dwellStart = 0;
      paintPill(i, graded.get(words[i].id), 0);
      return;
    }

    dwellStart = performance.now();
    sig = { audio: 0, detail: false, fav: false };
    paintPill(i, undefined, 0);
    if (autoArmed) autoSpeak(i);
  }

  function onScroll() {
    raf = null;
    const rect = deckEl.getBoundingClientRect();
    let best = active;
    let bestOverlap = 0;
    slides.forEach((s, idx) => {
      const r = s.getBoundingClientRect();
      const overlap = Math.min(r.bottom, rect.bottom) - Math.max(r.top, rect.top);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = idx;
      }
    });
    if (bestOverlap > 0 && best !== active) setActive(best);
  }

  deckEl.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(onScroll);
  }, { passive: true });

  /* ---- 完成页手势：下滑回看 ----
     完成页在最底部，deck 已经滚到底。「往回看刚才背过的词」和「往前翻」在语义上
     是同一个方向的手势：手指往下拖 = 内容往回走。所以完成页这里**不做任何拦截**，
     把向下滑动完全交给原生滚动（配合 .slide 的 scroll-snap-stop: always，
     一次手势最多退回一张卡），用户能立刻看到上一张词卡。

     onTouchEnd 只做「吸附收尾」：判定为一次明确的向下滑（手指下移 ≥ 30px）时，
     平滑滚动到最后一张词卡的位置，把落点钉在「刚才那一组的尾巴」上，
     避免原生滚动停在两张卡之间的半格状态（词卡在 app.css 里是 height:auto，
     完成页又比词卡高，滚动位置可能出现不严格的整格）。

     词卡阶段（active < words.length）完全不插手：上滑翻到下一个词、
     下滑回看上一个词都走原生滚动，手感与 v1.6 一致。
     手势全程只监听 touchstart / touchend，没有 touchmove（无需 preventDefault）。 */
  const DONE_SWIPE_MIN = 30;      // 手指纵向位移超过 30px 才算一次滑动
  const DONE_SWIPE_MAX_MS = 900;  // 超过 900ms 视为慢拖/长按，不做吸附收尾
  let touchStartY = 0;
  let touchStartT = 0;
  let touchTracking = false;

  function onTouchStart(e) {
    if (e.touches.length !== 1) {
      touchTracking = false;
      return;
    }
    touchTracking = true;
    touchStartY = e.touches[0].clientY;
    touchStartT = performance.now();
  }

  /**
   * 完成页的向下滑动收尾：把落点吸附到最后一张词卡。
   *
   * 向下滑时原生滚动已经把页面往回带了一段，这里再 smooth 到上一张卡是「补一下」，
   * 不会和原生滚动打架（同一方向、同一目标）。上滑在完成页没有内容可翻，不处理。
   */
  function onTouchEnd(e) {
    if (!touchTracking) return;
    touchTracking = false;
    // 只在完成页生效：词卡阶段的滑动是正常翻页/回看，不能拦
    if (active < words.length) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    if (performance.now() - touchStartT > DONE_SWIPE_MAX_MS) return;
    const dy = touchStartY - t.clientY;   // > 0 表示手指向上滑，< 0 表示手指向下滑
    if (dy > -DONE_SWIPE_MIN) return;
    const prevSlide = slides[words.length - 1];
    if (!prevSlide) return;
    deckEl.scrollTo({ top: prevSlide.offsetTop, behavior: 'smooth' });
  }

  function onTouchCancel() {
    touchTracking = false;
  }

  deckEl.addEventListener('touchstart', onTouchStart, { passive: true });
  deckEl.addEventListener('touchend', onTouchEnd, { passive: true });
  deckEl.addEventListener('touchcancel', onTouchCancel, { passive: true });

  ticker = setInterval(() => {
    if (active < 0 || active >= words.length || document.hidden) return;
    if (!dwellStart) return;
    if (graded.has(words[active].id)) return;
    paintPill(active, undefined, (acc + performance.now() - dwellStart) / 1000);
  }, 120);

  /**
   * 页面可见性变化时暂停 / 恢复停留计时。
   *
   * 暂停时把这一段并进 `acc` 并把 `dwellStart` 清零，恢复时只在
   * `!dwellStart`（说明确实处于暂停态）时才重新取时间戳 —— 两侧都有守卫，
   * 不会重复累加同一段时间。已判定的卡恢复可见后不再重新计时。
   */
  function onVisibility() {
    if (document.hidden) {
      cancelAutoSpeech();
      if (dwellStart) {
        acc += performance.now() - dwellStart;
        dwellStart = 0;
      }
    } else if (active >= 0 && active < words.length && !dwellStart && !graded.has(words[active].id)) {
      dwellStart = performance.now();
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  /* 交互绑定（事件委托） */
  deckEl.addEventListener('click', (e) => {
    const slide = e.target.closest('.slide');
    if (!slide) return;

    // 完成页按钮优先处理：done slide 没有 data-i，不能被词卡逻辑拦截
    if (e.target.closest('[data-more]')) {
      opts.onMore?.();
      return;
    }
    // data-go 是完成页唯一出口（文案按 mode 变），旧属性 data-go-review 兜底兼容
    if (e.target.closest('[data-go]') || e.target.closest('[data-go-review]')) {
      if (opts.onGo) opts.onGo();
      else opts.onGoReview?.();
      return;
    }

    const i = Number(slide.dataset.i);
    const word = words[i];
    if (!word) return;

    const star = e.target.closest('[data-star]');
    if (star) {
      const on = store.toggleFav(word.id);
      if (on) {
        sig.fav = true;
        star.innerHTML = iconFilled('star', 18);
        toast('已收藏，本词判定最多记「模糊」');
      } else {
        star.innerHTML = icon('star', 18);
      }
      star.classList.toggle('on', on);
      return;
    }

    const say = e.target.closest('[data-say]');
    if (say) {
      cancelAutoSpeech();
      speak(word.w, { accent: say.dataset.say, rate: store.getState().settings.ttsRate });
      sig.audio += 1;
      return;
    }

    /* 例句发音：只朗读，不计入「是否认识」的音频信号 */
    const sayEx = e.target.closest('[data-say-ex]');
    if (sayEx) {
      e.preventDefault();
      e.stopPropagation();
      cancelAutoSpeech();
      const sentence = slide.querySelector('[data-ex-text]')?.textContent?.trim() || word.ex?.en || '';
      if (sentence) speak(sentence, { accent: sayEx.dataset.sayEx, rate: store.getState().settings.ttsRate });
      return;
    }

    const dwell = e.target.closest('[data-dwell]');
    if (dwell) {
      openGradeSheet(word, graded.get(word.id), () => {
        const g = store.getState().cards[word.id]?.grade;
        if (g === 0 || g === 1 || g === 2) {
          graded.set(word.id, g);
          paintPill(i, g, 0);
        }
      });
      return;
    }

    if (e.target.closest('[data-detail]')) {
      cancelAutoSpeech();
      sig.detail = true;
      openWordDetail(word, {
        onInteract: (kind) => {
          if (kind === 'audio') sig.audio += 1;
        }
      });
      return;
    }
  });

  /* 键盘（桌面预览） */
  function onKey(e) {
    if (lastDeck !== api) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const next = Math.max(0, Math.min(slides.length - 1, active + dir));
      deckEl.scrollTo({ top: slides[next].offsetTop, behavior: 'smooth' });
    }
  }
  window.addEventListener('keydown', onKey);

  requestAnimationFrame(() => {
    /* ⚠ 这里**不能**用 setActive(0) 建立初始状态。
       setActive 的第一行是 `if (i === active) return;`（切卡去重守卫），
       而 deck 复用时 active 的初值可能已经是 0 —— 守卫会直接 return，
       acc = 0 / dwellStart = performance.now() / paintPill 都不会执行，
       dwellStart 沿用上一次的时间戳，首卡一进来就已经「超时」：
       实测刚进页面 1.2s 时判定环就显示 5.5s 并进入 red(over) 态，
       全程拿不到「认识」。所以这里显式重置计时状态。

       active / acc / dwellStart / sig 都是 mountDeck 闭包内的变量，可直接赋值；
       顺序：先重置状态，再滚到顶部，再画 pill、发音。 */
    active = 0;
    acc = 0;
    dwellStart = performance.now();
    sig = { audio: 0, detail: false, fav: false };
    deckEl.scrollTop = 0;
    opts.onProgress?.(0, words.length);
    paintPill(0, undefined, 0);
    /* 交互监听在 mountDeck 内才注册，而「开始背单词」的 pointerdown 发生在 mountDeck 之前，
       那时 armAuto 尚不存在、autoArmed 必为 false。进入 deck 本身已是明确交互意图，
       所以首卡就绪后无条件发音一次（autoSpeak 内部已用 cfg.autoSpeak 保护用户设置）。
       setActive 内的切卡触发保持不变。 */
    autoArmed = true;
    autoSpeak(0);
  });

  const api = {
    destroy() {
      finish(active);
      cancelAutoSpeech();
      autoEvents.forEach(([type, fn]) => document.removeEventListener(type, fn));
      clearInterval(ticker);
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKey);
      deckEl.removeEventListener('touchstart', onTouchStart);
      deckEl.removeEventListener('touchend', onTouchEnd);
      deckEl.removeEventListener('touchcancel', onTouchCancel);
      if (lastDeck === api) lastDeck = null;
    },
    scrollToTop() {
      deckEl.scrollTo({ top: 0, behavior: 'smooth' });
    },
    /** 视图被切到后台（display:none）时暂停停留计时，避免回来时被判成「不认识」 */
    pause() {
      cancelAutoSpeech();
      if (dwellStart) {
        acc += performance.now() - dwellStart;
        dwellStart = 0;
      }
    },
    /** 视图重新显示时恢复计时；已判定的词与完成页不重新计时 */
    resume() {
      if (active < 0 || active >= words.length) return;
      if (dwellStart) return;
      if (graded.has(words[active].id)) return;
      dwellStart = performance.now();
    }
  };
  lastDeck = api;
  return api;
}

export function openGradeSheet(word, existing, onChange) {
  const card = store.getState().cards[word.id] || blankCard();
  const options = previewIntervals(card, Date.now(), store.getState().settings.targetRetention);
  const content = h(`
    <div>
      <p class="small" style="margin:0 0 14px;color:var(--muted);line-height:1.65">
        系统按停留时长自动判定。若判得不准，可以在这里改一次，之后仍按记忆曲线安排。
      </p>
      <div class="grade-list">
        ${options
          .map(
            (o) => `<button class="grade-row" data-g="${o.key}">
              <span class="dot ${o.color}"></span>
              <span class="g-name">${o.name}</span>
              <span class="g-next">${o.label}</span>
              ${existing === o.key ? '<span class="g-cur">当前</span>' : ''}
            </button>`
          )
          .join('')}
      </div>
      <p class="tiny" style="margin:14px 0 0;color:var(--muted);line-height:1.6">
        “不认识”会在 10 分钟后再次出现；“模糊”约半天；“认识”按当前间隔的 2.5 倍往后推。
      </p>
    </div>`);
  const sheet = openSheet({ title: `判定 · ${word.w}`, content });
  content.querySelectorAll('[data-g]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = Number(btn.dataset.g);
      store.gradeWord(word.id, g, { auto: false });
      toast(`已记为「${['不认识', '模糊', '认识'][g]}」`);
      sheet.close();
      onChange?.();
    });
  });
}

/* ---------------- 学习页 ---------------- */
export function createStudyView({ onBookChange, onGoReview } = {}) {
  const el = h('<div class="screen" id="study-screen"></div>');
  let deck = null;
  let started = false;
  /** 当前已渲染的词书 id，用来发现「在别的 tab 换了词书」 */
  let renderedBookId = null;
  /** 开始界面的依次入场动画只播一次（再次进入不重播） */
  let readyIntroPlayed = false;

  /**
   * 开始界面：不挂载卡片、不启动停留计时，给用户反应时间。
   *
   * 视觉为「苹果式」克制版：圆形徽章 + 紧字距大标题 + 一张三列数据卡 + 轻量规则说明 + 主/次按钮。
   * 入场动画靠内联 `--d`（序号）× 40ms 的 animation-delay 实现，只在首次渲染加 `.ready-in`；
   * `prefers-reduced-motion` 下由 CSS 直接关掉。
   */
  function readyHTML() {
    const book = store.currentBook();
    const queue = store.newQueue();
    const due = store.dueQueue().length;
    const learned = store.learnedToday();
    const playIntro = !readyIntroPlayed;
    readyIntroPlayed = true;
    const anim = playIntro ? ' ready-anim' : '';
    const step = (i) => `style="--d:${i}"`;

    return `
      <div class="ready">
        ${searchButtonHTML()}
        <div class="ready-inner${playIntro ? ' ready-in' : ''}">
          <div class="ready-mark${anim}" ${step(0)}>${icon('bookOpen', 26)}</div>
          <h1 class="ready-title${anim}" ${step(1)}>${esc(book.name)}</h1>
          <p class="ready-sub${anim}" ${step(2)}>${esc(book.subtitle)}</p>

          <div class="ready-card${anim}" ${step(3)}>
            <div class="ready-stat">
              <b class="ready-num${queue.length ? ' is-on' : ''}">${queue.length}</b>
              <span>今日新词</span>
            </div>
            <div class="ready-stat">
              <b class="ready-num${due ? ' is-accent' : ''}">${due}</b>
              <span>待复习</span>
            </div>
            <div class="ready-stat">
              <b class="ready-num${learned ? ' is-accent' : ''}">${learned}</b>
              <span>今日已学</span>
            </div>
          </div>

          <div class="ready-rule${anim}" ${step(4)}>
            ${icon('timer', 16)}
            <p>点「开始」后才计时。快速划过记「认识」，停留越久越可能记「不认识」；判得不准可在卡片右上角改。</p>
          </div>

          ${queue.length
            ? `<button class="ready-go${anim}" ${step(5)} data-start-study>${icon('play', 15)} 开始背单词</button>
               <button class="ready-book${anim}" ${step(6)} data-book>换一本词书</button>`
            : `<button class="ready-go${anim}" ${step(5)} data-book>${icon('refresh', 15)} 换一本词书</button>
               <button class="ready-book${anim}" ${step(6)} data-review>去复习 ${due ? `(${due})` : ''}</button>`}
        </div>
      </div>`;
  }

  function startSession() {
    started = true;
    render();
  }

  function headerHTML() {
    /* 顶部不再显示词书栏（书名 / 今日目标）：开始页已有这些信息，
       学习时把纵向空间留给词卡本身。进度条保留，作为本轮进度指示。 */
    return `<div class="study-top"><div class="progress-line"><i></i></div>${searchButtonHTML()}</div>`;
  }

  function deckHTML() {
    return `
      <div class="deck" id="deck"></div>
      <div class="deck-tip" id="deck-tip">停留即记录 · 快速划过记“认识”，读得越久越可能“不认识”</div>`;
  }

  function render() {
    deck?.destroy();
    deck = null;
    renderedBookId = store.getState().settings.bookId;
    if (!started) {
      el.innerHTML = readyHTML();
      bindStatic();
      return;
    }
    const queue = store.newQueue();
    if (!queue.length) {
      el.innerHTML = headerHTML() + `<div class="done" style="flex:1">
        <div class="mark">${icon('award', 30)}</div>
        <h2>这本书过完一轮了</h2>
        <p>${store.getState().settings.flexible ? '想再来一组就换本词书，不想就放下——没有单词债。' : `今天的 ${store.getState().settings.dailyNew} 个新词都学完了。去复习，或者换一本词书。`}</p>
        <div class="btns">
          <button class="btn ghost" data-book>换词书</button>
          <button class="btn primary" data-review>去复习 ${store.dueQueue().length ? `(${store.dueQueue().length})` : ''}</button>
        </div>
      </div>`;
      bindStatic();
      return;
    }
    el.innerHTML = headerHTML() + deckHTML();
    bindStatic();
    const deckEl = el.querySelector('#deck');
    deck = mountDeck(deckEl, queue, {
      mode: 'learn',
      onProgress(idx, total) {
        const bar = el.querySelector('.progress-line i');
        if (bar) bar.style.width = `${((Math.min(idx + 1, total)) / total) * 100}%`;
        if (idx > 0) el.querySelector('#deck-tip')?.classList.add('off');
      },
      onMore: () => {
        started = false;
        render();
      },
      onGoReview: () => onGoReview?.(),
      onFinish() {
        el.querySelector('#deck-tip')?.classList.add('off');
      }
    });
  }

  function bindStatic() {
    el.querySelectorAll('[data-book]').forEach((b) => b.addEventListener('click', openBookSheet));
    el.querySelector('[data-review]')?.addEventListener('click', () => onGoReview?.());
    el.querySelector('[data-start-study]')?.addEventListener('click', startSession);
    bindSearchButton(el);
  }

  function openBookSheet() {
    const st = store.getState();
    const content = h(`<div class="book-list">
      ${BOOKS.map((b) => {
        const p = store.bookProgress(b.id);
        const on = st.settings.bookId === b.id;
        return `<button class="book-card ${on ? 'on' : ''}" data-b="${b.id}">
          <span class="cover" style="background:${b.color}">${esc(b.short)}</span>
          <span class="info">
            <b>${esc(b.name)}${on ? ' · 当前' : ''}</b>
            <span>${esc(b.subtitle)} · ${p.total} 词${p.learned ? ` · 已学 ${p.learned}` : ''}</span>
            <span class="prog"><i style="width:${Math.round(p.pct * 100)}%;background:${b.color}"></i></span>
          </span>
        </button>`;
      }).join('')}
      <p class="tiny muted" style="margin:14px 2px 0;line-height:1.6">换书不会丢进度，每本书的掌握记录独立保存。</p>
    </div>`);
    const sheet = openSheet({ title: '选择单词书', content });
    content.querySelectorAll('[data-b]').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.switchBook(btn.dataset.b);
        sheet.close();
        started = false;
        render();
        onBookChange?.();
      });
    });
  }

  /** 缓存视图切回来时调用：正在背词就不打断当前这一组，只刷新顶部“今日”数字 */
  function refresh() {
    // 在别的 tab 换了词书：这一组已经不属于当前词书，直接重来
    if (renderedBookId !== store.getState().settings.bookId) {
      render();
      return;
    }
    if (started && deck) {
      const goal = el.querySelector('.goal');
      const st = store.getState();
      if (goal) {
        goal.innerHTML = st.settings.flexible
          ? `今日 <b>${store.learnedToday()}</b>`
          : `<b>${store.learnedToday()}</b> / ${st.settings.dailyNew} 今日`;
      }
      return;
    }
    render();
  }

  render();
  return {
    el,
    destroy: () => deck?.destroy(),
    rerender: render,
    refresh,
    pause: () => deck?.pause?.(),
    resume: () => deck?.resume?.()
  };
}

/* ---------------- 复习 / 收藏队列页 ---------------- */

/**
 * 打开一个独立的卡片队列页（复习 / 收藏复习）。
 *
 * @param {object} cfg
 * @param {string} cfg.title 页面标题
 * @param {string} [cfg.subtitle] 页面副标题
 * @param {Array<object>} cfg.words 本组词
 * @param {'learn'|'review'|'fav'} [cfg.mode='review'] 队列模式，决定完成页按钮文案
 * @param {Function} [cfg.onDone] 页面关闭后回调（用来刷新来源视图）
 * @param {Function} [cfg.onGo] 完成页「去学习 / 去复习」按钮点击后的跳转动作。
 *   包装时会先关闭当前 deck 页再执行 onGo，否则用户会看到「页面的按钮点了但页面还在」
 *   ——因为 subpage 盖在 tab 之上，不关掉的话 tab 切换在视觉上不可见。
 * @returns {object} pushPage 返回的页面 api（含 close / destroy）
 */
export function openDeckPage({ title, subtitle, words, mode = 'review', onDone, onGo }) {
  const wrap = h(`<div class="deck-page">
    <div class="deck-page-head">
      <span class="tiny muted" id="dp-count">1 / ${words.length}</span>
      <span class="tiny" id="dp-mode">${mode === 'review' ? '按到期顺序 · 停留判定' : '收藏队列 · 停留判定'}</span>
    </div>
    <div class="deck" id="dp-deck"></div>
  </div>`);
  let controller = null;
  const page = pushPage({
    title,
    subtitle,
    content: wrap,
    headExtra: searchButtonHTML(),
    onClose: () => {
      controller?.destroy();
      onDone?.();
    }
  });
  bindSearchButton(page.page);
  page.page.classList.add('page-deck');
  const deckEl = wrap.querySelector('#dp-deck');
  controller = mountDeck(deckEl, words, {
    mode,
    hideMore: true,
    onProgress(idx, total) {
      wrap.querySelector('#dp-count').textContent = `${Math.min(idx + 1, total)} / ${total}`;
    },
    onFinish(session) {
      wrap.querySelector('#dp-mode').textContent = `本轮：认识 ${session[2]} · 模糊 ${session[1]} · 不认识 ${session[0]}`;
    },
    // 先关页再跳转：onDone/onClose 会先销毁 deck，随后 onGo 切到目标 tab
    onGo: () => {
      page.close();
      onGo?.();
    }
  });
  return page;
}
