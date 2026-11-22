import { icon } from './icons.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function toast(message, ms = 1900) {
  const wrap = document.getElementById('toast');
  if (!wrap) return;
  wrap.innerHTML = '';
  const node = h(`<div class="toast">${esc(message)}</div>`);
  wrap.appendChild(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transition = 'opacity .2s';
    setTimeout(() => node.remove(), 220);
  }, ms);
}

const overlay = () => document.getElementById('overlay');

/* ---------------- 底部抽屉 ---------------- */
export function openSheet({ title = '', content = '', headExtra = '', onClose } = {}) {
  const layer = overlay();
  layer.classList.add('on');
  const back = h('<div class="backdrop"></div>');
  const sheet = h(`
    <section class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-grip"></div>
      <header class="sheet-head">
        <h3>${esc(title)}</h3>
        <div class="row" style="gap:6px">${headExtra}<button class="icon-btn plain" data-close aria-label="关闭">${icon('close', 18)}</button></div>
      </header>
      <div class="sheet-body"></div>
    </section>`);
  const body = sheet.querySelector('.sheet-body');
  if (typeof content === 'string') body.innerHTML = content;
  else body.appendChild(content);
  layer.append(back, sheet);
  requestAnimationFrame(() => {
    back.classList.add('on');
    sheet.classList.add('on');
  });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    back.classList.remove('on');
    sheet.classList.remove('on');
    const done = () => {
      layer.innerHTML = '';
      layer.classList.remove('on');
      onClose?.();
    };
    setTimeout(done, 320);
  };

  back.addEventListener('click', close);
  sheet.querySelector('[data-close]').addEventListener('click', close);

  /* 下拉关闭 */
  const grip = sheet.querySelector('.sheet-grip');
  let startY = 0;
  let dragging = false;
  grip.addEventListener('pointerdown', (e) => {
    dragging = true;
    startY = e.clientY;
    grip.setPointerCapture(e.pointerId);
    sheet.style.transition = 'none';
  });
  grip.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
    back.style.opacity = String(Math.max(0, 1 - dy / 380));
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    const dy = Math.max(0, e.clientY - startY);
    sheet.style.transition = '';
    sheet.style.transform = '';
    back.style.opacity = '';
    if (dy > 110) close();
  };
  grip.addEventListener('pointerup', endDrag);
  grip.addEventListener('pointercancel', endDrag);

  return { close, body, sheet };
}

export function confirmSheet({ title, text, confirmText = '确定', cancelText = '取消', danger = false }) {
  return new Promise((resolve) => {
    const content = h(`
      <div>
        <p class="small" style="margin:2px 0 18px;color:var(--ink-2);line-height:1.7">${esc(text)}</p>
        <div class="row" style="gap:10px">
          <button class="btn ghost" data-cancel style="flex:1">${esc(cancelText)}</button>
          <button class="btn ${danger ? '' : 'primary'}" data-ok style="flex:1;${danger ? 'background:var(--rose);color:#fff' : ''}">${esc(confirmText)}</button>
        </div>
      </div>`);
    const sheet = openSheet({ title, content, onClose: () => resolve(false) });
    content.querySelector('[data-cancel]').addEventListener('click', () => sheet.close());
    content.querySelector('[data-ok]').addEventListener('click', () => {
      resolve(true);
      sheet.close();
    });
  });
}

/* ---------------- 二级页面 ---------------- */
const pageStack = [];

export function pushPage({ title, subtitle = '', content = '', headExtra = '', onClose } = {}) {
  const app = document.getElementById('app');
  document.querySelector('.reminder')?.remove();
  const page = h(`
    <section class="subpage">
      <header class="subpage-head">
        <button class="icon-btn plain" data-back aria-label="返回">${icon('arrowLeft', 20)}</button>
        <div class="subpage-title">
          <b>${esc(title)}</b>
          ${subtitle ? `<span>${esc(subtitle)}</span>` : ''}
        </div>
        <div class="row" style="gap:4px">${headExtra}</div>
      </header>
      <div class="subpage-body"></div>
    </section>`);
  const body = page.querySelector('.subpage-body');
  if (typeof content === 'string') body.innerHTML = content;
  else body.appendChild(content);
  app.appendChild(page);
  requestAnimationFrame(() => page.classList.add('on'));

  let closed = false;
  const destroy = () => {
    if (closed) return;
    closed = true;
    page.classList.remove('on');
    setTimeout(() => page.remove(), 300);
    const idx = pageStack.indexOf(api);
    if (idx >= 0) pageStack.splice(idx, 1);
    onClose?.();
  };
  const close = () => {
    if (history.state?.subpage) history.back();
    else destroy();
  };
  const api = { page, body, close, destroy };
  pageStack.push(api);
  page.querySelector('[data-back]').addEventListener('click', close);
  history.pushState({ subpage: true }, '');
  return api;
}

window.addEventListener('popstate', () => {
  const top = pageStack[pageStack.length - 1];
  if (top) top.destroy();
});

/* ---------------- 小组件 ---------------- */
export function emptyState(iconName, title, text) {
  return `<div class="empty">
    <div class="mark">${icon(iconName, 24)}</div>
    <b>${esc(title)}</b>
    <p>${esc(text)}</p>
  </div>`;
}

export function bars(series) {
  const max = Math.max(1, ...series.map((s) => s.learn + s.review));
  return `<div class="bars">${series
    .map((s) => {
      const total = s.learn + s.review;
      const hgt = Math.round((total / max) * 100);
      const learnShare = total ? (s.learn / total) * 100 : 0;
      return `<div class="col" title="${s.key} · 新学 ${s.learn} · 复习 ${s.review}">
        <div class="stack" style="height:${Math.max(3, hgt)}%">
          <i style="height:${100 - learnShare}%"></i>
          <i class="rv" style="height:${learnShare}%"></i>
        </div>
        <span class="lbl">${esc(s.label)}</span>
      </div>`;
    })
    .join('')}</div>`;
}

export function relTime(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const day = 86400000;
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))} 分钟前`;
  if (diff < day) return `${Math.round(diff / 3600000)} 小时前`;
  if (diff < day * 30) return `${Math.round(diff / day)} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

export function wordRegex(word) {
  const safe = String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b(${safe}(?:s|es|ed|d|ing|ly|ment|ness)?)\\b`, 'gi');
}

export function highlight(text, words) {
  let out = esc(text);
  const list = [...new Set(words.filter(Boolean))].sort((a, b) => b.length - a.length);
  list.forEach((w) => {
    out = out.replace(wordRegex(w), '<span class="hl">$1</span>');
  });
  return out;
}
