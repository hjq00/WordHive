/* v1.4 QA：验证「完成页上滑回看」与「tab 切换缓存 + 动画」
   通过 CDP 驱动真实 Chrome（同 design/qa.mjs 的做法）
   用法：node design/qa-v14.mjs
*/

const PORT = process.env.CDP_PORT || 9222;
const BASE = process.env.APP_URL || 'http://127.0.0.1:4173';

async function connect() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json());
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('无法连接 Chrome CDP');
}

const url = await connect();
const ws = new WebSocket(url);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
function send(method, params = {}) {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(mid, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)));
    setTimeout(() => reject(new Error(`timeout ${method}`)), 20000);
  });
}
async function evalJS(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

/* ---------- 打开页面 ---------- */
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
await send('Page.navigate', { url: `${BASE}/index.html?demo=1&tab=study` });
await sleep(2200);

const boot = await evalJS(`({ hasApp: !!document.getElementById('screens'), screens: document.getElementById('screens').children.length, tabs: document.querySelectorAll('[data-tab]').length })`);
check('页面启动', boot.hasApp && boot.tabs === 5, JSON.stringify(boot));

/* ---------- 问题二：tab 切换 ---------- */
const firstSwitch = await evalJS(`(() => {
  const t0 = performance.now();
  document.querySelector('[data-tab="review"]').click();
  return Math.round((performance.now() - t0) * 10) / 10;
})()`);
await sleep(400);
// 先把 5 个视图都建一遍（首次创建的成本只付一次）
await evalJS(`(async () => {
  for (const id of ['library','ai','me','study','review']) {
    document.querySelector('[data-tab="' + id + '"]').click();
    await new Promise((r) => setTimeout(r, 300));
  }
})()`);

const warmSwitch = await evalJS(`(() => {
  const out = {};
  const ids = ['library', 'ai', 'me', 'study', 'review', 'ai', 'me', 'library'];
  const times = [];
  for (const id of ids) {
    const btn = document.querySelector('[data-tab="' + id + '"]');
    const t0 = performance.now();
    btn.click();
    times.push([id, Math.round((performance.now() - t0) * 10) / 10]);
  }
  out.times = times;
  out.children = document.getElementById('screens').children.length;
  out.visible = [...document.getElementById('screens').children].filter((el) => el.style.display !== 'none').length;
  return out;
})()`);
console.log(`  首次进入 review 同步耗时 ${firstSwitch}ms（仅一次）`);
check('缓存命中后切 tab 同步耗时 < 20ms', warmSwitch.times.every(([, t]) => t < 20), JSON.stringify(warmSwitch.times));
check('5 个视图常驻缓存（不销毁重建）', warmSwitch.children === 5, `screens 子节点 = ${warmSwitch.children}`);
check('任何时刻只有一个视图可见（无重叠错位）', warmSwitch.visible === 1, `可见视图 = ${warmSwitch.visible}`);

// 每个 tab 都非空、有高度（无白屏）
const perTab = await evalJS(`(async () => {
  const out = [];
  for (const id of ['study','review','library','ai','me']) {
    document.querySelector('[data-tab="' + id + '"]').click();
    await new Promise((r) => setTimeout(r, 260));
    const el = [...document.getElementById('screens').children].find((e) => e.style.display !== 'none');
    out.push({ id, h: el.offsetHeight, text: el.innerText.trim().length, entering: el.classList.contains('is-entering') });
  }
  return out;
})()`);
check('各 tab 有内容无白屏', perTab.every((t) => t.h > 400 && t.text > 10), JSON.stringify(perTab.map((t) => `${t.id}:${t.h}px/${t.text}`)));

// 动画类被清理
await sleep(400);
const cleared = await evalJS(`[...document.getElementById('screens').children].filter((e) => e.classList.contains('is-entering')).length`);
check('入场动画结束后清理 is-entering', cleared === 0, `残留 ${cleared} 个`);

// 切回视图保留滚动位置
const scrollKeep = await evalJS(`(async () => {
  document.querySelector('[data-tab="me"]').click();
  await new Promise((r) => setTimeout(r, 260));
  const me = [...document.getElementById('screens').children].find((e) => e.style.display !== 'none');
  const page = me.querySelector('.page');
  if (!page) return { skip: true };
  page.scrollTop = 200;
  const before = page.scrollTop;
  document.querySelector('[data-tab="study"]').click();
  await new Promise((r) => setTimeout(r, 200));
  document.querySelector('[data-tab="me"]').click();
  await new Promise((r) => setTimeout(r, 300));
  const me2 = [...document.getElementById('screens').children].find((e) => e.style.display !== 'none');
  return { skip: false, before, after: me2.querySelector('.page').scrollTop };
})()`);
check('切回缓存视图保留滚动位置', scrollKeep.skip || scrollKeep.after === scrollKeep.before, JSON.stringify(scrollKeep));

/* ---------- 问题二附带：离开 tab 后停留计时暂停 ---------- */
const pauseTest = await evalJS(`(async () => {
  document.querySelector('[data-tab="study"]').click();
  await new Promise((r) => setTimeout(r, 300));
  const start = document.querySelector('[data-start-study]');
  if (start) start.click();
  await new Promise((r) => setTimeout(r, 1200));
  const before = document.querySelector('.deck .slide .dwell-txt')?.textContent;
  document.querySelector('[data-tab="me"]').click();
  await new Promise((r) => setTimeout(r, 3200));
  document.querySelector('[data-tab="study"]').click();
  await new Promise((r) => setTimeout(r, 600));
  const after = document.querySelector('.deck .slide .dwell-txt')?.textContent;
  return { before, after };
})()`);
const secOf = (s) => (s ? parseFloat(s) : NaN);
check('切走再切回不把时间算进停留判定', secOf(pauseTest.after) - secOf(pauseTest.before) < 1.6, `${pauseTest.before} -> ${pauseTest.after}`);

/* ---------- 问题一：完成页上滑回看 ---------- */
const setup = await evalJS(`(async () => {
  document.querySelector('[data-tab="study"]').click();
  await new Promise((r) => setTimeout(r, 350));
  const deck = document.querySelector('#deck');
  if (!deck) return { ok: false };
  const prevBehavior = deck.style.scrollBehavior;
  deck.style.scrollBehavior = 'auto';
  deck.scrollTop = deck.scrollHeight;
  await new Promise((r) => setTimeout(r, 400));
  deck.style.scrollBehavior = prevBehavior;
  const slides = [...deck.querySelectorAll('.slide')];
  const lastCard = slides[slides.length - 2];
  return {
    ok: true,
    slides: slides.length,
    scrollTop: Math.round(deck.scrollTop),
    max: Math.round(deck.scrollHeight - deck.clientHeight),
    lastCardTop: Math.round(lastCard.offsetTop),
    hintText: deck.querySelector('[data-done] .tiny:last-of-type')?.innerText || '',
    snapStop: getComputedStyle(lastCard).scrollSnapStop
  };
})()`);
check('完成页在底部', setup.ok && Math.abs(setup.scrollTop - setup.max) <= 2, JSON.stringify(setup));
check('文案改为「上滑回看」', (setup.hintText || '').includes('上滑回看'), setup.hintText);
check('slide 的 scroll-snap-stop 已改为 normal', setup.snapStop === 'normal', setup.snapStop);

// 真实触摸：手指向上滑
const deckBox = await evalJS(`(() => {
  const r = document.querySelector('#deck').getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y0: Math.round(r.top + r.height * 0.86), y1: Math.round(r.top + r.height * 0.14) };
})()`);
async function swipe(fromY, toY) {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: deckBox.x, y: fromY, id: 1 }] });
  for (let i = 1; i <= 6; i += 1) {
    const y = Math.round(fromY + ((toY - fromY) * i) / 6);
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: deckBox.x, y, id: 1 }] });
    await sleep(16);
  }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(1100);
}
const swipeUp = () => swipe(deckBox.y0, deckBox.y1);      // 手指向上滑
const swipeDown = () => swipe(deckBox.y1, deckBox.y0);    // 手指向下滑

await swipeUp();
const afterSwipe = await evalJS(`(() => {
  const deck = document.querySelector('#deck');
  return { scrollTop: Math.round(deck.scrollTop), lastCardTop: ${setup.lastCardTop}, max: Math.round(deck.scrollHeight - deck.clientHeight) };
})()`);
check('完成页手指上滑回到最后一个词卡', Math.abs(afterSwipe.scrollTop - afterSwipe.lastCardTop) <= 3, JSON.stringify(afterSwipe));

// 下滑仍由原生滚动支持（没有被手势逻辑挡掉）
const beforeDown = afterSwipe.scrollTop;
await swipeDown();
const afterDown = await evalJS(`Math.round(document.querySelector('#deck').scrollTop)`);
check('下滑回看仍可用（原生滚动未被拦）', afterDown < beforeDown - 100, `${beforeDown} -> ${afterDown}`);

// 回到完成页再做一次判定检查
await evalJS(`(async () => {
  const deck = document.querySelector('#deck');
  deck.style.scrollBehavior = 'auto';
  deck.scrollTop = deck.scrollHeight;
  await new Promise((r) => setTimeout(r, 300));
  deck.style.scrollBehavior = '';
})()`);

// 回看不重新计时 / 不重复判定
const regrade = await evalJS(`(() => {
  const cards = __qingci.store.getState().cards;
  const ids = Object.keys(cards);
  return { cardCount: ids.length, lastReps: ids.map((i) => cards[i].reps).reduce((a, b) => a + b, 0) };
})()`);
await sleep(1600);
const regrade2 = await evalJS(`(() => {
  const cards = __qingci.store.getState().cards;
  const ids = Object.keys(cards);
  return { cardCount: ids.length, lastReps: ids.map((i) => cards[i].reps).reduce((a, b) => a + b, 0) };
})()`);
check('回看时不重新计时/重复判定', regrade.lastReps === regrade2.lastReps && regrade.cardCount === regrade2.cardCount, `${JSON.stringify(regrade)} -> ${JSON.stringify(regrade2)}`);

/* ---------- 缓存副作用：在别的 tab 换词书，学习页要跟着变 ---------- */
const bookSwitch = await evalJS(`(async () => {
  document.querySelector('[data-tab="study"]').click();
  await new Promise((r) => setTimeout(r, 300));
  const before = document.querySelector('#study-screen .book-switch b')?.innerText || '';
  document.querySelector('[data-tab="me"]').click();
  await new Promise((r) => setTimeout(r, 250));
  const target = __qingci.store.getState().settings.bookId === 'cet6-days' ? 'hongbao' : 'cet6-days';
  __qingci.store.switchBook(target);
  document.querySelector('[data-tab="study"]').click();
  await new Promise((r) => setTimeout(r, 500));
  const after = document.querySelector('#study-screen .book-switch b')?.innerText || '';
  return { before, after, target };
})()`);
check('在别的 tab 换词书后学习页同步更新', bookSwitch.before !== bookSwitch.after && bookSwitch.after.length > 0, JSON.stringify(bookSwitch));

/* ---------- 汇总 ---------- */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
ws.close();
process.exit(failed.length ? 1 : 0);
