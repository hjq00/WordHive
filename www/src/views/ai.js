import { icon, iconFilled } from '../core/icons.js';
import { esc, h, toast, highlight } from '../core/ui.js';
import * as store from '../core/store.js';
import { generate, hasLLM, TOPICS } from '../core/ai.js';
import { openDeckPage } from './study.js';
import { searchButtonHTML, bindSearchButton } from './search.js';

const LEVELS = [
  { id: 'basic', name: '基础', desc: '短句为主' },
  { id: 'medium', name: '进阶', desc: '接近真题' },
  { id: 'hard', name: '冲刺', desc: '长难句多' }
];

/**
 * AI 阅读 / 改写视图。
 *
 * @param {object} [cfg]
 * @param {Function} [cfg.onGoStudy] 「本篇词汇」卡片队列做完后，完成页「去学习」按钮的跳转动作
 *   （由 main.js 传入 switchTab('study')；不传时按钮只关闭卡片页）
 * @returns {{el: HTMLElement, destroy: Function, rerender: Function}}
 */
export function createAIView({ onGoStudy } = {}) {
  const el = h('<div class="screen"></div>');
  let mode = 'reading';
  let topic = 'exam';
  let level = 'medium';
  const picked = new Set();
  let lastResult = null;
  let busy = false;

  function pool() {
    const st = store.getState();
    const out = [];
    const push = (w) => {
      if (w && w.ex?.en && !out.some((x) => x.id === w.id)) out.push(w);
    };
    store.favWords().forEach(push);
    Object.entries(st.cards)
      .filter(([, c]) => c.state === 'learning' || c.grade === 0)
      .forEach(([id]) => push(store.allWords().find((w) => w.id === id)));
    store.newQueue().forEach(push);
    store.allWords().forEach(push);
    return out.slice(0, 16);
  }

  function defaultPick() {
    if (picked.size) return;
    const st = store.getState();
    const all = pool();
    const weak = all.filter((w) => {
      const c = st.cards[w.id];
      return c && (c.grade === 0 || c.state === 'learning' || c.due < Date.now());
    });
    const rest = all.filter((w) => !weak.includes(w));
    [...weak, ...rest].slice(0, 5).forEach((w) => picked.add(w.id));
  }

  function render() {
    const st = store.getState();
    const words = pool();
    const pickedWords = words.filter((w) => picked.has(w.id));

    el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <div><h1>AI 学习</h1><p class="sub">用你正在背的词，生成只属于你的阅读</p></div>
        <div class="row" style="gap:8px;align-items:center">
          ${searchButtonHTML()}
          <span class="chip ${hasLLM(st.settings) ? 'accent' : ''}">${hasLLM(st.settings) ? esc(st.settings.api.model || '大模型') : '本地引擎'}</span>
        </div>
      </div>

      <div class="ai-tabs">
        <button class="ai-tab ${mode === 'reading' ? 'on' : ''}" data-mode="reading">
          <b>定制阅读</b><span>按主题生成精读短文</span>
        </button>
        <button class="ai-tab ${mode === 'story' ? 'on' : ''}" data-mode="story">
          <b>串词成文</b><span>把陌生词串成一个故事</span>
        </button>
      </div>

      <div class="card" style="padding:16px">
        ${mode === 'reading' ? `
        <div class="field">
          <label>主题</label>
          <div class="seg-row">
            ${TOPICS.map((t) => `<button class="chip-btn ${topic === t.id ? 'on' : ''}" data-topic="${t.id}">${t.name}</button>`).join('')}
          </div>
        </div>` : ''}

        <div class="field">
          <label>难度</label>
          <div class="seg-row">
            ${LEVELS.map((l) => `<button class="chip-btn ${level === l.id ? 'on' : ''}" data-level="${l.id}">${l.name} · ${l.desc}</button>`).join('')}
          </div>
        </div>

        <div class="field" style="margin-bottom:6px">
          <label>目标词 <span class="muted" style="font-weight:400">已选 ${picked.size} / 8</span></label>
          <div class="word-picker">
            ${words
              .map((w) => `<button class="pick ${picked.has(w.id) ? 'on' : ''}" data-pick="${w.id}">${esc(w.w)}</button>`)
              .join('')}
          </div>
          <p class="hint">默认取最近标记为“不认识 / 学习中”的词；本地生成需要例句，大纲词建议接入大模型。</p>
        </div>

        <button class="btn primary block" data-gen ${busy ? 'disabled' : ''}>
          ${busy ? '正在生成…' : mode === 'story' ? `生成故事 · ${picked.size} 个词` : `生成阅读 · ${picked.size} 个词`}
        </button>
        <p class="tiny muted" style="margin:10px 2px 0;line-height:1.6">
          ${hasLLM(st.settings)
            ? `将调用 ${esc(st.settings.api.model || '已配置模型')}，失败自动回退本地引擎。`
            : '当前使用本地引擎：用目标词的真题例句串成短文，离线可用。可在「我的 → 大模型」接入 API 获得更自然的生成。'}
        </p>
      </div>

      <div id="result" class="gen-out ${lastResult ? '' : 'hidden'}">${lastResult ? resultHTML(lastResult) : ''}</div>
    </div>`;

    bind();
  }

  function resultHTML(res) {
    const words = [...new Set(res.paras.flatMap((p) => p.words || []))];
    const count = res.paras.reduce((n, p) => n + p.en.split(/\s+/).length, 0);
    return `
      <div class="row between" style="margin-bottom:10px">
        <span class="chip ${res.engine === 'llm' ? 'accent' : ''}">${res.engine === 'llm' ? '大模型生成' : '本地引擎'}</span>
        <div class="row" style="gap:6px">
          <button class="chip-btn" data-zh>${icon('eyeOff', 12)} 译文</button>
          <button class="chip-btn" data-copy>${icon('edit', 12)} 复制</button>
        </div>
      </div>
      <div class="paper">
        <h3>${esc(res.title)}</h3>
        <div class="meta">${esc(res.titleZh || '')} · 约 ${count} 词 · ${res.paras.length} 段</div>
        ${res.paras
          .map(
            (p) => `<p>${highlight(p.en, words.length ? words : [])}</p>
              ${p.zh ? `<div class="zhs">${esc(p.zh)}</div>` : ''}`
          )
          .join('')}
      </div>
      <div class="row" style="gap:8px;margin-top:12px">
        <button class="btn ghost" style="flex:1" data-deck>用这篇的词复习</button>
        <button class="btn primary" style="flex:1" data-again>再生成一篇</button>
      </div>
      ${res.warning ? `<p class="tiny" style="color:var(--amber);margin:10px 2px 0">${esc(res.warning)}</p>` : ''}`;
  }

  function bind() {
    el.querySelectorAll('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        mode = b.dataset.mode;
        lastResult = null;
        render();
      })
    );
    el.querySelectorAll('[data-topic]').forEach((b) =>
      b.addEventListener('click', () => {
        topic = b.dataset.topic;
        el.querySelectorAll('[data-topic]').forEach((x) => x.classList.toggle('on', x === b));
      })
    );
    el.querySelectorAll('[data-level]').forEach((b) =>
      b.addEventListener('click', () => {
        level = b.dataset.level;
        el.querySelectorAll('[data-level]').forEach((x) => x.classList.toggle('on', x === b));
      })
    );
    el.querySelectorAll('[data-pick]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.pick;
        if (picked.has(id)) picked.delete(id);
        else {
          if (picked.size >= 8) return toast('最多选 8 个词');
          picked.add(id);
        }
        b.classList.toggle('on', picked.has(id));
        const label = el.querySelector('[data-gen]');
        const n = picked.size;
        label.textContent = mode === 'story' ? `生成故事 · ${n} 个词` : `生成阅读 · ${n} 个词`;
        el.querySelector('.field .muted') && (el.querySelector('.field .muted').textContent = `已选 ${n} / 8`);
      })
    );
    el.querySelector('[data-gen]')?.addEventListener('click', run);
    el.querySelector('[data-again]')?.addEventListener('click', run);
    el.querySelector('[data-zh]')?.addEventListener('click', (e) => {
      const out = el.querySelector('#result');
      out.classList.toggle('show-zh');
      e.currentTarget.classList.toggle('on', out.classList.contains('show-zh'));
    });
    el.querySelector('[data-copy]')?.addEventListener('click', () => {
      if (!lastResult) return;
      const text = lastResult.paras.map((p) => p.en).join('\n\n');
      navigator.clipboard?.writeText(text).then(
        () => toast('英文原文已复制'),
        () => toast('复制失败，请手动选择')
      );
    });
    el.querySelector('[data-deck]')?.addEventListener('click', () => {
      const words = pool().filter((w) => picked.has(w.id));
      if (!words.length) return toast('先选几个词');
      openDeckPage({
        title: '本篇词汇',
        subtitle: `${words.length} 个词`,
        words,
        mode: 'review',
        // 本篇词汇队列做完 → 完成页显示「去学习」，点了关掉卡片页并切到学习 tab
        onGo: () => onGoStudy?.()
      });
    });
    bindSearchButton(el);
  }

  async function run() {
    if (busy) return;
    defaultPick();
    const words = pool().filter((w) => picked.has(w.id)).slice(0, 8);
    if (!words.length) return toast('至少选一个词');
    busy = true;
    render();
    const res = await generate({ mode, topic, level, words, settings: store.getState().settings });
    busy = false;
    lastResult = res;
    render();
    el.querySelector('#result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  defaultPick();
  render();
  return { el, destroy() {}, rerender: render };
}
