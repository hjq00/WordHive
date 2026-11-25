import { icon } from '../core/icons.js';
import { esc, emptyState, pushPage } from '../core/ui.js';
import { ALL_WORDS, BOOKS } from '../data/books.js';
import { openWordDetail } from './detail.js';
import { hasLLM, lookupWord } from '../core/ai.js';
import * as store from '../core/store.js';

/** 已绑定过的按钮，避免同一节点反复绑定（视图 rerender 时会复用 el） */
const boundButtons = new WeakSet();

/** 未输入时的占位提示 */
const HINT_HTML = '<p class="tiny muted" style="margin:10px 2px;line-height:1.7">输入单词开头或其中一段开始搜索</p>';

/** 结果上限，避免长查询把页面塞满 */
const MAX_RESULTS = 60;

/** 防抖时长（毫秒） */
const DEBOUNCE_MS = 120;

/** 免费在线英文词典（无需 key，返回 CORS 头 Access-Control-Allow-Origin: *） */
const DICT_API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

/**
 * 右上角搜词入口按钮的 HTML。
 * @returns {string}
 */
export function searchButtonHTML() {
  return `<button class="icon-btn" data-open-search aria-label="搜词">${icon('search', 18)}</button>`;
}

/**
 * 绑定一个搜词按钮。
 * @param {HTMLButtonElement} btn
 */
function bindOne(btn) {
  if (!btn || boundButtons.has(btn)) return;
  boundButtons.add(btn);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openSearchPage();
  });
}

/**
 * 在 root（以及可选的 page）内绑定所有搜词按钮。
 * 传入 page 时用 api.page 或 body 都可以；null 安全、可重复调用。
 *
 * @param {Element|null} root 主视图根元素或二级页元素
 * @param {Element|null} [page] 额外的查找范围（二级页 api.page / body）
 */
export function bindSearchButton(root, page) {
  if (root && typeof root.querySelectorAll === 'function') {
    root.querySelectorAll('[data-open-search]').forEach(bindOne);
  }
  if (page && page !== root) {
    if (typeof page.matches === 'function' && page.matches('[data-open-search]')) bindOne(page);
    if (typeof page.querySelectorAll === 'function') {
      page.querySelectorAll('[data-open-search]').forEach(bindOne);
    }
  }
}

/**
 * 执行英文匹配：前缀优先，其次包含；忽略大小写；同拼写跨书去重。
 * @param {string} raw 用户输入
 * @returns {Array<object>} 词条列表
 */
function matchWords(raw) {
  const q = String(raw || '').trim().toLowerCase();
  if (!q) return [];
  const starts = [];
  const contains = [];
  const seen = new Set();
  for (const w of ALL_WORDS) {
    const name = String(w.w || '').toLowerCase();
    if (seen.has(name)) continue;
    if (name.startsWith(q)) {
      starts.push(w);
      seen.add(name);
    } else if (name.includes(q)) {
      contains.push(w);
      seen.add(name);
    }
    if (starts.length + contains.length >= MAX_RESULTS) break;
  }
  return [...starts, ...contains];
}

/**
 * 单条搜索结果的 HTML。
 * @param {object} w 词条
 * @returns {string}
 */
function resultItemHTML(w) {
  const book = BOOKS.find((b) => b.id === w.book);
  const thumb = book && book.short ? book.short : String(w.w || '').slice(0, 1).toUpperCase();
  const def = w.defs && w.defs[0];
  const meta = `${def && def[0] ? `${def[0]} ` : ''}${def && def[1] ? def[1] : ''}${w.bookName ? ` · ${w.bookName}` : ''}`;
  return `<button class="ui-item" data-word="${esc(w.id)}">
    <span class="ui-item-thumb" style="font-family:var(--font-serif);font-size:15px;font-weight:600">${esc(thumb)}</span>
    <span class="ui-item-body">
      <span class="ui-item-title">${esc(w.w)}</span>
      <span class="ui-item-sub">${esc(w.ph || '')}</span>
      <span class="ui-item-meta"><span class="ui-badge outline">${esc(meta)}</span></span>
    </span>
    <span class="ui-item-chev">${icon('chevronRight', 16)}</span>
  </button>`;
}

/** 文案截断，避免长释义把结果卡片撑破 */
function clip(text, n = 60) {
  const s = String(text || '');
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** 词典接口偶尔给协议相对的音频地址，补成 https 才能播放 */
function normalizeAudio(audio) {
  const a = String(audio || '').trim();
  return a.startsWith('//') ? `https:${a}` : a;
}

/**
 * 查免费在线英文词典；404 视为「没有这个词」，其它失败向上抛。
 * @param {string} word
 * @returns {Promise<object|null>}
 */
async function fetchDictionary(word) {
  const url = DICT_API + encodeURIComponent(String(word || '').trim().toLowerCase());
  let controller = null;
  let timer = 0;
  let signal;
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    signal = AbortSignal.timeout(8000);
  } else {
    controller = new AbortController();
    signal = controller.signal;
    timer = setTimeout(() => controller.abort(), 8000);
  }
  try {
    const res = await fetch(url, { signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`在线词典返回 ${res.status}`);
    const list = await res.json();
    const data = Array.isArray(list) ? list[0] : null;
    if (!data) return null;
    const ph = data.phonetics?.find((p) => p && p.audio);
    return {
      word: data.word || word,
      phonetic: data.phonetic || data.phonetics?.[0]?.text || '',
      audio: normalizeAudio(ph?.audio),
      meanings: (data.meanings || [])
        .map((m) => ({
          pos: m.partOfSpeech || '',
          en: m.definitions?.[0]?.definition || '',
          example: m.definitions?.[0]?.example || ''
        }))
        .slice(0, 5)
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * 在线结果卡片（词典英文释义 / AI 中文释义共用）。
 * 点击卡片只展开内嵌释义，不打开新的详情页。
 *
 * @param {object} entry 归一化后的词条
 * @param {string} q 用户原始查询
 * @param {string} [chipText] 结果来源标识
 * @returns {string} HTML
 */
function onlineResultHTML(entry, q, chipText = '在线 · 英文释义') {
  const list = Array.isArray(entry.meanings) ? entry.meanings : [];
  const first = list[0] || {};
  const rows = list.length
    ? list
        .map((m) => {
          const pos = m.pos ? `<span class="ui-badge outline">${esc(m.pos)}</span>` : '';
          const text = esc(m.zh || m.en || '');
          const example = m.example ? `<span class="tiny muted">e.g. ${esc(m.example)}</span>` : '';
          return `<div class="online-mean">${pos}<div class="om-body"><p>${text}</p>${example}</div></div>`;
        })
        .join('')
    : '<p class="tiny muted">暂无释义</p>';
  const audioBtn = entry.audio
    ? `<button class="chip-btn" data-audio="${esc(entry.audio)}">${icon('volume', 13)} 播放发音</button>`
    : '';
  const notes = entry.notes
    ? `<p class="tiny muted" style="margin:8px 2px 0;line-height:1.65">${esc(entry.notes)}</p>`
    : '';
  return `<div class="online-card" data-online-card>
    <button class="ui-item" data-online aria-expanded="false">
      <span class="ui-item-thumb" style="background:var(--accent-soft);color:var(--accent)">${icon('bookOpen', 16)}</span>
      <span class="ui-item-body">
        <span class="ui-item-title">${esc(entry.word || q)}</span>
        <span class="ui-item-sub">${esc(entry.phonetic || '')}</span>
        <span class="ui-item-meta">
          <span class="ui-badge accent">${esc(chipText)}</span>
          <span class="ui-badge outline">${esc(clip(first.zh || first.en || '', 60))}</span>
        </span>
      </span>
      <span class="ui-item-chev">${icon('chevronRight', 16)}</span>
    </button>
    <div class="online-detail" hidden>${audioBtn}${rows}${notes}</div>
  </div>`;
}

/**
 * 打开搜词二级页。搜索始终覆盖全部词库，与当前词书无关。
 * @returns {object} pushPage 返回的页面 api
 */
export function openSearchPage() {
  let timer = 0;
  /** 在线请求竞态令牌：只接受最后一次查询的结果 */
  let seq = 0;
  const content = `<div class="search-page">
    <div class="field">
      <label>输入英文单词</label>
      <input type="search" data-q placeholder="支持前缀或包含匹配" autocomplete="off">
    </div>
    <div class="search-results" data-results>${HINT_HTML}</div>
  </div>`;

  const api = pushPage({
    title: '搜词',
    subtitle: '全部词库 · 英文匹配',
    content,
    onClose: () => {
      if (timer) clearTimeout(timer);
      seq += 1;
    }
  });
  const input = api.body.querySelector('[data-q]');
  const results = api.body.querySelector('[data-results]');

  /** 在线层：先查免费英文词典，404/失败再退回用户配置的 LLM 查中文释义 */
  async function lookupOnline(q, mySeq) {
    if (!results) return;
    results.innerHTML = '<p class="tiny muted" style="margin:10px 2px;line-height:1.7">正在查询在线词典…</p>';
    const settings = store.getState().settings;
    let entry = null;
    try {
      entry = await fetchDictionary(q);
    } catch {
      entry = null;
    }
    if (mySeq !== seq) return;
    if (entry && (entry.word || entry.meanings?.length)) {
      results.innerHTML = onlineResultHTML(entry, q);
      return;
    }

    if (hasLLM(settings)) {
      results.innerHTML = '<p class="tiny muted" style="margin:10px 2px;line-height:1.7">正在查询 AI 词典…</p>';
      try {
        const res = await lookupWord(q, settings);
        if (mySeq !== seq) return;
        const ai = res.data;
        if (res.ok && ai && !ai.error && (ai.word || ai.meanings?.length)) {
          const note = ai.notes ? String(ai.notes) : '';
          const example = ai.example && ai.example.en
            ? `${ai.example.en}${ai.example.zh ? `（${ai.example.zh}）` : ''}`
            : '';
          const aiEntry = {
            word: ai.word || q,
            phonetic: ai.phonetic || '',
            audio: '',
            meanings: (ai.meanings || []).map((m) => ({ pos: m.pos || '', zh: m.zh || '' })),
            notes: [note, example ? `例句：${example}` : ''].filter(Boolean).join(' · ')
          };
          results.innerHTML = onlineResultHTML(aiEntry, q, 'AI · 中文释义');
          return;
        }
      } catch {
        /* 落到下面的友好空状态 */
      }
    }
    if (mySeq !== seq) return;
    results.innerHTML = emptyState('search', '本地和在线都没找到', '确认拼写，或换个词试试');
  }

  const run = async (value) => {
    if (!results) return;
    const mySeq = ++seq;
    const q = String(value || '').trim();
    if (!q) {
      results.innerHTML = HINT_HTML;
      return;
    }
    const words = matchWords(q);
    if (!words.length) {
      await lookupOnline(q, mySeq);
      return;
    }
    /* 只有少量本地命中时才提示查在线词典，避免对整页结果造成误导 */
    const more = words.length < 3
      ? `<button class="online-lookup" data-online-lookup>${icon('search', 13)} 没找到？查在线词典</button>`
      : '';
    results.innerHTML = `<div class="ui-list">${words.map(resultItemHTML).join('')}</div>${more}`;
  };

  input?.addEventListener('input', (e) => {
    if (timer) clearTimeout(timer);
    const value = e.target.value;
    timer = setTimeout(() => run(value), DEBOUNCE_MS);
  });

  /* 事件委托：结果区重绘后无需重新绑定 */
  results?.addEventListener('click', (e) => {
    const t = e.target;
    /* 在线卡片：就地展开 / 收起释义，不打开新页面 */
    const onlineBtn = t.closest ? t.closest('[data-online]') : null;
    if (onlineBtn) {
      const detail = onlineBtn.closest('[data-online-card]')?.querySelector('.online-detail');
      if (!detail) return;
      detail.hidden = !detail.hidden;
      onlineBtn.setAttribute('aria-expanded', String(!detail.hidden));
      return;
    }
    const audioBtn = t.closest ? t.closest('[data-audio]') : null;
    if (audioBtn) {
      const url = audioBtn.dataset.audio;
      if (!url) return;
      try {
        const p = new Audio(url).play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {
        /* 当前 WebView 不支持时静默 */
      }
      return;
    }
    const more = t.closest ? t.closest('[data-online-lookup]') : null;
    if (more) {
      const q = input?.value.trim();
      if (q) lookupOnline(q, ++seq);
      return;
    }
    const target = t.closest ? t.closest('[data-word]') : null;
    if (!target) return;
    const word = ALL_WORDS.find((w) => w.id === target.dataset.word);
    if (word) openWordDetail(word);
  });

  setTimeout(() => input?.focus(), 0);
  return api;
}
