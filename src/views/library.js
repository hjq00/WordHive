import { icon } from '../core/icons.js';
import { esc, h, pushPage, toast, highlight, openSheet } from '../core/ui.js';
import { READINGS, LISTENINGS, LONG_SENTENCES } from '../data/materials.js';
import { LECTURES } from '../data/videos.js';
import { findWord } from '../data/books.js';
import { speak, speakSequence, stopSpeaking, speechSupported } from '../core/speech.js';
import * as store from '../core/store.js';
import { openWordDetail } from './detail.js';

const TABS = [
  { id: 'read', name: '真题阅读', icon: 'bookOpen' },
  { id: 'listen', name: '听力', icon: 'headphones' },
  { id: 'long', name: '长难句', icon: 'layers' },
  { id: 'video', name: '视频课', icon: 'play' }
];

/** 按 source 判断所属考试（考研一 / 考研二 / 六级） */
function examOf(item) {
  const src = String(item?.source || '');
  if (/英语二/.test(src)) return 'k2';
  if (/英语一|复试/.test(src)) return 'k1';
  if (/六级/.test(src)) return 'cet6';
  return 'other';
}

const EXAM_TABS = [
  { id: 'all', name: '全部' },
  { id: 'k1', name: '考研一' },
  { id: 'k2', name: '考研二' },
  { id: 'cet6', name: '六级' }
];

function bindWords(root) {
  root.addEventListener('click', (e) => {
    const hl = e.target.closest('.hl');
    if (!hl) return;
    const raw = hl.textContent.trim().replace(/[^a-zA-Z-]/g, '');
    const stems = [raw, raw.replace(/(ing|ed|es|s|d)$/i, ''), raw.replace(/ies$/i, 'y')];
    const word = stems.map((t) => findWord(t)).find(Boolean);
    if (word) openWordDetail(word);
    else toast('这个词还不在当前词库里');
  });
}

function readingPage(item) {
  let cancel = null;
  let vsheet = null;
  let pageGone = false;
  const wrap = h(`<div class="reader-wrap">
    <div class="reader-head">
      <div class="meta">
        <span class="chip accent">${esc(item.source)}</span>
        <span class="chip">${item.minutes} 分钟</span>
        ${item.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}
      </div>
      <h1>${esc(item.title)}</h1>
      <p class="sub">${esc(item.titleZh)} · 点击划线词查看详解</p>
    </div>
    <div id="paras">
      ${item.paras
        .map(
          (p, i) => `<div class="para" data-p="${i}">
            <p>${highlight(p.en, item.words)}</p>
            <div class="zh">${esc(p.zh)}</div>
          </div>`
        )
        .join('')}
    </div>

    <div class="det-sec" style="margin-top:26px">
      <h4>真题式设问</h4>
      <p class="small" style="margin:0 0 10px;font-weight:500;line-height:1.65">${esc(item.question.q)}</p>
      <div class="opts" data-answer="${item.question.answer}">
        ${item.question.options
          .map((o, i) => `<button class="opt" data-i="${i}"><b>${'ABCD'[i]}</b><span>${esc(o)}</span></button>`)
          .join('')}
      </div>
      <div class="explain" hidden>
        <b>答案解析</b>
        <p>${esc(item.question.explain)}</p>
      </div>
    </div>

    <div class="float-dock" role="toolbar" aria-label="阅读操作">
      <button class="dock-btn" data-all aria-label="朗读全文">
        <span class="dock-ico"><span class="prim">${icon('volume', 18)}</span><span class="alt">${icon('pause', 18)}</span></span>
        <span class="dock-label" data-label="all">朗读</span>
      </button>
      <button class="dock-btn" data-vocab aria-label="本篇生词表">
        <span class="dock-ico">${icon('bookOpen', 18)}</span>
        <span class="dock-label">生词表</span>
      </button>
      <button class="dock-btn" data-zh aria-label="显示译文">
        <span class="dock-ico"><span class="prim">${icon('eyeOff', 18)}</span><span class="alt">${icon('eye', 18)}</span></span>
        <span class="dock-label" data-label="zh">翻译</span>
      </button>
    </div>
  </div>`);

  const page = pushPage({
    title: '真题精读',
    subtitle: item.source,
    content: wrap,
    /* 返回/关闭二级页时：停朗读、收起可能开着的生词表抽屉 */
    onClose: () => {
      pageGone = true;
      cancel?.();
      vsheet?.close();
    }
  });
  bindWords(wrap);

  /* ------ 悬浮胶囊：翻译（译文/原文） ------ */
  let showZh = false;
  const zhBtn = wrap.querySelector('[data-zh]');
  const zhLabel = zhBtn.querySelector('[data-label="zh"]');
  zhBtn.addEventListener('click', () => {
    showZh = !showZh;
    zhBtn.classList.toggle('on', showZh);
    zhLabel.textContent = showZh ? '原文' : '翻译';
    zhBtn.setAttribute('aria-label', showZh ? '显示原文' : '显示译文');
    wrap.querySelectorAll('.para').forEach((p) => p.classList.toggle('show-zh', showZh));
  });

  /* ------ 悬浮胶囊：朗读全文（播放 / 取消） ------ */
  let playing = false;
  const playBtn = wrap.querySelector('[data-all]');
  const playLabel = playBtn.querySelector('[data-label="all"]');
  /* 只改 class 与文字节点，不重写 innerHTML——否则图标会被冲掉 */
  const setPlayingUI = (on) => {
    playing = on;
    playBtn.classList.toggle('on', on);
    playLabel.textContent = on ? '停止' : '朗读';
    playBtn.setAttribute('aria-label', on ? '停止朗读' : '朗读全文');
    if (!on) wrap.querySelectorAll('.para').forEach((p) => p.classList.remove('reading'));
  };
  playBtn.addEventListener('click', () => {
    if (!speechSupported()) return toast('当前浏览器不支持语音合成');
    if (playing) {
      cancel?.();
      cancel = null;
      setPlayingUI(false);
      return;
    }
    setPlayingUI(true);
    cancel = speakSequence(item.paras.map((p) => p.en), {
      rate: store.getState().settings.ttsRate,
      onIndex(i) {
        wrap.querySelectorAll('.para').forEach((p, idx) => p.classList.toggle('reading', idx === i));
      }
    });
  });

  /* ------ 悬浮胶囊：本篇生词表（底部抽屉，替代原页尾目标词区块） ------ */
  let pendingWord = null;
  const openVocabSheet = () => {
    if (vsheet) return;
    const rows = item.words
      .map((w) => {
        const word = findWord(w);
        if (!word) {
          return `<div class="vocab-row plain">
            <span class="vrow-main"><b>${esc(w)}</b><span class="vrow-zh">词库暂未收录该词</span></span>
          </div>`;
        }
        const def = word.defs && word.defs[0];
        const pos = def && def[0] && def[0] !== '·' ? `<i>${esc(def[0])}</i>` : '';
        const zh = esc((def && def[1]) || word.ph || '');
        return `<button class="vocab-row" data-word="${esc(word.id)}">
          <span class="vrow-main"><b>${esc(word.w)}</b><span class="vrow-zh">${pos}${zh}</span></span>
          <span class="vrow-chev">${icon('chevronRight', 16)}</span>
        </button>`;
      })
      .join('');
    const content = `<div class="vocab-list">${
      rows || '<p class="small muted" style="margin:12px 4px">本篇没有目标词</p>'
    }</div>`;

    vsheet = openSheet({
      title: '本篇生词表',
      headExtra: `<span class="tiny muted">${item.words.length} 词</span>`,
      content,
      onClose: () => {
        vsheet = null;
        const word = pendingWord;
        pendingWord = null;
        /* 抽屉收起后再开详解，避免两层 sheet 叠在同一个 overlay 上 */
        if (word && !pageGone) openWordDetail(word);
      }
    });

    vsheet.body.querySelectorAll('[data-word]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const word = store.allWords().find((x) => x.id === btn.dataset.word);
        if (!word) return toast('这个词还不在当前词库里');
        pendingWord = word;
        vsheet?.close();
      });
    });
  };
  wrap.querySelector('[data-vocab]').addEventListener('click', openVocabSheet);

  wrap.querySelectorAll('.opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      const answer = Number(wrap.querySelector('.opts').dataset.answer);
      const i = Number(btn.dataset.i);
      wrap.querySelectorAll('.opt').forEach((b) => b.classList.remove('right', 'wrong'));
      btn.classList.add(i === answer ? 'right' : 'wrong');
      if (i !== answer) wrap.querySelector(`.opt[data-i="${answer}"]`)?.classList.add('right');
      wrap.querySelector('.explain').hidden = false;
    });
  });

  return {
    page,
    destroy: () => {
      pageGone = true;
      cancel?.();
      playing = false;
      vsheet?.close();
    }
  };
}

function listeningPage(item) {
  const wrap = h(`<div>
    <div class="reader-head">
      <div class="meta">
        <span class="chip accent">${esc(item.source)}</span>
        <span class="chip">${esc(item.accent)}</span>
        <span class="chip">约 ${Math.round(item.seconds / 60)} 分钟</span>
      </div>
      <h1>${esc(item.title)}</h1>
      <p class="sub">${esc(item.titleZh)} · 先盲听，再逐句精听</p>
    </div>
    <div class="toolbar">
      <button class="chip-btn" data-play>${icon('play', 13)} 连播</button>
      <button class="chip-btn" data-zh>${icon('eyeOff', 13)} 显示中文</button>
      <button class="chip-btn" data-rate>0.9×</button>
    </div>
    <div id="lines">
      ${item.lines
        .map(
          (l, i) => `<div class="listen-line hide-zh" data-l="${i}">
            <button class="play" data-i="${i}">${icon('play', 14)}</button>
            <div class="txt"><div class="en">${esc(l.en)}</div><div class="zh">${esc(l.zh)}</div></div>
          </div>`
        )
        .join('')}
    </div>
    <div class="det-sec">
      <h4>本篇目标词</h4>
      <div class="chip-row">
        ${item.words
          .map((w) => {
            const word = findWord(w);
            return word
              ? `<button class="word-chip syn" data-open="${word.id}">${esc(w)}</button>`
              : `<span class="word-chip">${esc(w)}</span>`;
          })
          .join('')}
      </div>
    </div>
    <p class="tiny muted" style="margin:18px 2px 0;line-height:1.6">
      语音由浏览器语音合成生成，音色取决于设备。真人口音与连读仍需配合真实语料练习。
    </p>
  </div>`);

  let cancel = null;
  const page = pushPage({ title: '听力精听', subtitle: item.source, content: wrap, onClose: () => cancel?.() });
  const rates = [0.9, 0.75, 1.15];
  let rateIdx = 0;

  wrap.querySelector('[data-rate]').addEventListener('click', (e) => {
    rateIdx = (rateIdx + 1) % rates.length;
    e.currentTarget.textContent = `${rates[rateIdx]}×`;
    toast(`语速 ${rates[rateIdx]}×`);
  });

  let showZh = false;
  wrap.querySelector('[data-zh]').addEventListener('click', (e) => {
    showZh = !showZh;
    e.currentTarget.classList.toggle('on', showZh);
    e.currentTarget.innerHTML = `${icon(showZh ? 'eye' : 'eyeOff', 13)} ${showZh ? '隐藏中文' : '显示中文'}`;
    wrap.querySelectorAll('.listen-line').forEach((l) => l.classList.toggle('hide-zh', !showZh));
  });

  wrap.querySelectorAll('.play').forEach((btn) =>
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.i);
      speak(item.lines[i].en, { accent: item.accent === '英音' ? 'uk' : 'us', rate: rates[rateIdx] });
      wrap.querySelectorAll('.listen-line').forEach((l, idx) => l.classList.toggle('reading', idx === i));
      setTimeout(() => wrap.querySelectorAll('.listen-line').forEach((l) => l.classList.remove('reading')), 4000);
    })
  );

  wrap.querySelector('[data-play]').addEventListener('click', (e) => {
    if (!speechSupported()) return toast('当前浏览器不支持语音合成');
    const btn = e.currentTarget;
    if (cancel) {
      cancel();
      cancel = null;
      btn.classList.remove('on');
      btn.innerHTML = `${icon('play', 13)} 连播`;
      return;
    }
    btn.classList.add('on');
    btn.innerHTML = `${icon('pause', 13)} 停止`;
    cancel = speakSequence(item.lines.map((l) => l.en), {
      accent: item.accent === '英音' ? 'uk' : 'us',
      rate: rates[rateIdx],
      onIndex(i) {
        wrap.querySelectorAll('.listen-line').forEach((l, idx) => l.classList.toggle('reading', idx === i));
      }
    });
  });

  wrap.querySelectorAll('[data-open]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const word = store.allWords().find((w) => w.id === btn.dataset.open);
      if (word) openWordDetail(word);
    })
  );

  return { page, destroy: () => cancel?.() };
}

function longPage(item) {
  const trunk = item.trunk.replace(/…/g, '').trim();
  const marked = esc(item.en).replace(esc(trunk.split(',')[0]), `<mark>${esc(trunk.split(',')[0])}</mark>`);
  const wrap = h(`<div>
    <div class="reader-head">
      <div class="meta"><span class="chip accent">${esc(item.source)}</span><span class="chip">长难句拆解</span></div>
      <h1 style="font-size:21px">一句读懂</h1>
    </div>
    <div class="ls-block" style="margin-top:8px">
      <div class="en">${marked}</div>
      <div style="margin-top:12px" class="row">
        <button class="chip-btn" data-say>${icon('volume', 13)} 朗读</button>
        <button class="chip-btn" data-zh>${icon('eyeOff', 13)} 译文</button>
      </div>
      <div class="zh" hidden style="margin-top:12px;font-size:13px;line-height:1.75;color:var(--muted)">${esc(item.zh)}</div>
    </div>

    <div class="det-sec">
      <h4>主干</h4>
      <p class="tip" style="font-family:var(--font-serif);font-size:15px">${esc(item.trunk)}</p>
    </div>

    <div class="det-sec">
      <h4>成分拆解</h4>
      ${item.mods
        .map(
          ([role, part]) => `<div class="mod-row">
            <span class="mod-role">${esc(role)}</span>
            <span class="mod-part">${esc(part)}</span>
          </div>`
        )
        .join('')}
    </div>

    <div class="det-sec">
      <h4>读法提示</h4>
      <div class="quote"><div class="zh" style="margin:0;color:var(--ink-2);font-size:13px;line-height:1.75">${esc(item.tip)}</div></div>
    </div>
  </div>`);
  const page = pushPage({ title: '长难句', subtitle: item.source, content: wrap, onClose: () => stopSpeaking() });
  wrap.querySelector('[data-say]').addEventListener('click', () => speak(item.en, { rate: store.getState().settings.ttsRate }));
  wrap.querySelector('[data-zh]').addEventListener('click', (e) => {
    const zh = wrap.querySelector('.ls-block .zh');
    zh.hidden = !zh.hidden;
    e.currentTarget.classList.toggle('on', !zh.hidden);
    e.currentTarget.innerHTML = `${icon(zh.hidden ? 'eyeOff' : 'eye', 13)} ${zh.hidden ? '译文' : '隐藏'}`;
  });
  return { page, destroy() {} };
}

/** 内置视频课地址：用户没在「我的」里自定义时，默认走这里 */
const BUILTIN_VIDEO_BASE = 'https://pub-7386d83377ac4fdca5cee3188ac49679.r2.dev/videos';

function lecturePage(start = 0) {
  let i = Math.max(0, Math.min(LECTURES.length - 1, start));
  const wrap = h(`<div class="lecture">
    <div class="lecture-player">
      <video controls playsinline preload="metadata"></video>
      <div class="lecture-miss" hidden>
        <p>没有找到这一讲的视频。<br>可以在「我的 → 视频课地址」填入网盘前缀（支持直链的存储），或直接把视频放到手机上手动选一讲。</p>
        <button class="btn ghost" data-pick>从手机选择视频</button>
      </div>
      <input type="file" accept="video/*" data-file hidden>
    </div>
    <div class="lecture-body">
      <span class="chip sky" data-no></span>
      <h2 data-title></h2>
      <p class="tiny muted" style="margin:0" data-hint>本地视频课 · 需要手机里已有视频文件</p>
      <div class="row" style="gap:8px;margin-top:16px">
        <button class="btn ghost" data-prev style="flex:1">上一讲</button>
        <button class="btn primary" data-next style="flex:1">下一讲</button>
      </div>
      <p class="tiny muted" style="margin-top:14px;line-height:1.65">
        视频从云端播放，需要联网；如需离线观看，可用上面的按钮选择手机里的本地视频。
      </p>
    </div>
  </div>`);
  let video = null;
  const page = pushPage({
    title: '视频课',
    subtitle: '考研英语核心母词 990',
    content: wrap,
    onClose: () => { video?.pause(); if (objectUrl) URL.revokeObjectURL(objectUrl); }
  });
  page.page.classList.add('page-lecture');
  video = wrap.querySelector('video');
  const title = wrap.querySelector('[data-title]');
  const no = wrap.querySelector('[data-no]');
  const prev = wrap.querySelector('[data-prev]');
  const next = wrap.querySelector('[data-next]');

  const miss = wrap.querySelector('.lecture-miss');
  const pick = wrap.querySelector('[data-pick]');
  const fileInput = wrap.querySelector('[data-file]');
  const hint = wrap.querySelector('[data-hint]');
  let objectUrl = null;

  const clearLocal = () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  };

  video.addEventListener('error', () => { miss.hidden = false; });
  video.addEventListener('loadeddata', () => { miss.hidden = true; });
  pick.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    clearLocal();
    objectUrl = URL.createObjectURL(f);
    video.src = objectUrl;
    video.load();
    video.play().catch(() => {});
    miss.hidden = true;
    hint.textContent = `正在播放：${f.name}`;
  });

  const update = (n) => {
    i = Math.max(0, Math.min(LECTURES.length - 1, n));
    const item = LECTURES[i];
    clearLocal();
    video.pause();
    const custom = String(store.getState().settings.videoBase || '').trim();
    const base = custom || BUILTIN_VIDEO_BASE;
    const online = base && item.file
      ? base.replace(/\/+$/, '') + '/' + encodeURIComponent(item.file)
      : '';
    video.src = online || encodeURI(item.src);
    video.load();
    hint.textContent = custom ? '在线播放 · 自定义地址' : '在线播放 · 云端视频';
    miss.hidden = true;
    title.textContent = item.title;
    no.textContent = `第 ${item.no} 讲`;
    prev.disabled = i === 0;
    next.disabled = i === LECTURES.length - 1;
  };
  prev.addEventListener('click', () => update(i - 1));
  next.addEventListener('click', () => update(i + 1));
  video.addEventListener('ended', () => {
    if (i < LECTURES.length - 1) update(i + 1);
  });
  update(start);
  return page;
}

export function createLibraryView() {
  const el = h('<div class="screen"></div>');
  let tab = 'read';
  /** 当前考试筛选：all / k1 / k2 / cet6（切换 tab 时保留） */
  let exam = 'all';

  /** shadcn 风格统一列表项 */
  function itemHTML({ iconName, tone, title, sub, badges, id, chevron }) {
    const toneStyle = tone === 'sky' ? 'background:var(--sky-soft);color:var(--sky)'
      : tone === 'amber' ? 'background:var(--amber-soft);color:var(--amber)'
      : tone === 'accent' ? 'background:var(--accent-soft);color:var(--accent)'
      : '';
    return `<button class="ui-item" data-open="${id}">
      <span class="ui-item-thumb" style="${toneStyle}">${icon(iconName, 18)}</span>
      <span class="ui-item-body">
        <span class="ui-item-title">${title}</span>
        <span class="ui-item-sub">${sub}</span>
        <span class="ui-item-meta">${badges}</span>
      </span>
      <span class="ui-item-chev">${icon(chevron || 'chevronRight', 16)}</span>
    </button>`;
  }

  function emptyTip() {
    const name = EXAM_TABS.find((e) => e.id === exam)?.name || '';
    return `<div class="ui-empty"><p>${esc(name)}分类下暂无内容</p></div>`;
  }

  function list() {
    const kept = (arr) => exam === 'all' ? arr : arr.filter((x) => examOf(x) === exam);
    if (tab === 'read') {
      const rows = kept(READINGS);
      if (!rows.length) return emptyTip();
      return `<div class="ui-list">${rows.map((r) => itemHTML({
        id: r.id, iconName: 'bookOpen', tone: '', title: esc(r.title), sub: esc(r.titleZh),
        badges: `<span class="ui-badge accent">${esc(r.source)}</span><span class="ui-badge">${r.minutes} 分钟</span>${r.tags.slice(0, 2).map((t) => `<span class="ui-badge outline">${esc(t)}</span>`).join('')}`
      })).join('')}</div>`;
    }
    if (tab === 'listen') {
      const rows = kept(LISTENINGS);
      if (!rows.length) return emptyTip();
      return `<div class="ui-list">${rows.map((l) => itemHTML({
        id: l.id, iconName: 'headphones', tone: 'sky', title: esc(l.title), sub: esc(l.titleZh),
        badges: `<span class="ui-badge sky">${esc(l.accent)}</span><span class="ui-badge">${l.lines.length} 句</span><span class="ui-badge outline">${esc(l.source)}</span>`
      })).join('')}</div>`;
    }
    if (tab === 'long') {
      const rows = kept(LONG_SENTENCES);
      if (!rows.length) return emptyTip();
      return `<div class="ui-list">${rows.map((s) => itemHTML({
        id: s.id, iconName: 'layers', tone: 'accent', title: esc(s.en.slice(0, 52)) + '…', sub: `${s.mods.length} 个成分 · ${esc(s.source)}`,
        badges: `<span class="ui-badge accent">主干 + 修饰</span><span class="ui-badge outline">翻译</span>`
      })).join('')}</div>`;
    }
    if (tab === 'video') {
      return `<div class="ui-list">${LECTURES.map((v, i) => itemHTML({
        id: i, iconName: 'play', tone: 'sky', title: esc(v.title), sub: `考研核心母词 990 · 第 ${v.no} 讲`,
        badges: `<span class="ui-badge sky">本地视频</span><span class="ui-badge outline">MP4</span>`, chevron: 'play'
      })).join('')}</div>`;
    }
    // tab 仅有 read / listen / long / video 四种，均由上方分支返回
    return '';
  }

  /** 当前 tab 下、指定考试分类的条目数 */
  function countExam(id) {
    const arr = tab === 'read' ? READINGS : tab === 'listen' ? LISTENINGS : tab === 'long' ? LONG_SENTENCES : [];
    return id === 'all' ? arr.length : arr.filter((x) => examOf(x) === id).length;
  }

  /** 当前筛选下的实际条数 */
  function shownCount() {
    return countExam(exam);
  }

  function render() {
    const total = READINGS.length + LISTENINGS.length + LONG_SENTENCES.length;
    const current = TABS.find((t) => t.id === tab);
    const countFor = (id) => id === 'read' ? READINGS.length : id === 'listen' ? LISTENINGS.length
      : id === 'long' ? LONG_SENTENCES.length : LECTURES.length;
    el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1>素材</h1><p class="sub">在真实语境里再遇见这些词</p></div>
        <span class="ui-badge">${total} 篇 · ${LECTURES.length} 视频</span>
      </div>

      <section class="ui-card sm">
        <div class="ui-stat-grid">
          <div class="ui-stat"><b>${READINGS.length}</b><span>真题阅读</span></div>
          <div class="ui-stat"><b>${LISTENINGS.length}</b><span>听力</span></div>
          <div class="ui-stat"><b>${LONG_SENTENCES.length}</b><span>长难句</span></div>
        </div>
      </section>

      <div class="ui-tabs" role="tablist">
        ${TABS.map((t) => `<button class="ui-tab" role="tab" data-tab="${t.id}" aria-selected="${tab === t.id}">${t.name} ${countFor(t.id)}</button>`).join('')}
      </div>

      ${tab === 'video' ? '' : `<div class="exam-filter" role="group" aria-label="按考试筛选">
        ${EXAM_TABS.map((e) => `<button class="exam-chip${exam === e.id ? ' on' : ''}" data-exam="${e.id}" aria-pressed="${exam === e.id}">${e.name}<i>${countExam(e.id)}</i></button>`).join('')}
      </div>`}

      <div class="ui-section-head"><h2>${current.name}</h2><span>${shownCount()} 条</span></div>
      ${list()}
    </div>`;
    el.querySelectorAll('[data-tab]').forEach((btn) =>
      btn.addEventListener('click', () => {
        tab = btn.dataset.tab;
        render();
      })
    );
    el.querySelectorAll('[data-exam]').forEach((btn) =>
      btn.addEventListener('click', () => {
        exam = btn.dataset.exam;
        render();
      })
    );
    el.querySelectorAll('[data-open]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const id = btn.dataset.open;
        if (tab === 'video') {
          lecturePage(Number(id));
          return;
        }
        if (tab === 'read') {
          const item = READINGS.find((r) => r.id === id);
          if (item) readingPage(item);
        } else if (tab === 'listen') {
          const item = LISTENINGS.find((r) => r.id === id);
          if (item) listeningPage(item);
        } else if (tab === 'long') {
          const item = LONG_SENTENCES.find((r) => r.id === id);
          if (item) longPage(item);
        }
      })
    );
  }

  render();
  return { el, destroy() { stopSpeaking(); }, rerender: render };
}
