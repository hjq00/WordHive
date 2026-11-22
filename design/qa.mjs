/* 轻量 QA：通过 CDP 驱动真实浏览器，验证滑动、停留判定与收藏 */

const PORT = process.env.CDP_PORT || 9222;
const BASE = process.env.APP_URL || 'http://127.0.0.1:4173';

async function connect() {
  for (let i = 0; i < 30; i += 1) {
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
  return new Promise((resolve) => pending.set(mid, resolve));
}

async function evaluate(expression, awaitPromise = false) {
  const res = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true
  });
  if (res.result?.exceptionDetails) {
    throw new Error(res.result.exceptionDetails.text + ' ' + (res.result.exceptionDetails.exception?.description || ''));
  }
  return res.result?.result?.value;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: `${BASE}/?noanim=1&fresh=${Date.now()}` });
await wait(1200);

const before = await evaluate(`document.querySelectorAll('.slide').length`);
const queue = await evaluate(`document.querySelector('.idx')?.textContent`);

const result = await evaluate(
  `new Promise((resolve) => {
    const deck = document.querySelector('.deck');
    const slides = [...deck.querySelectorAll('.slide')];
    const step = () => slides[1].offsetTop;
    setTimeout(() => {
      deck.scrollTo({ top: step() });
      setTimeout(() => {
        deck.scrollTo({ top: slides[2].offsetTop });
        setTimeout(() => {
          const raw = JSON.parse(localStorage.getItem('qingci.app.v1') || '{}');
          const cards = raw.cards || {};
          resolve(JSON.stringify({
            slides: slides.length,
            cards: Object.entries(cards).map(([id, c]) => ({ id, grade: c.grade, interval: c.interval, state: c.state, dwell: c.dwell })),
            favs: raw.favs || [],
            days: raw.days
          }));
        }, 420);
      }, 2100);
    }, 1200);
  })`,
  true
);

const parsed = JSON.parse(result);

/* 收藏第一个词 */
const favResult = await evaluate(
  `new Promise((resolve) => {
    const deck = document.querySelector('.deck');
    deck.scrollTo({ top: 0 });
    setTimeout(() => {
      const slide = deck.querySelector('.slide');
      slide.querySelector('[data-star]').click();
      setTimeout(() => {
        const raw = JSON.parse(localStorage.getItem('qingci.app.v1') || '{}');
        resolve(JSON.stringify({ favs: raw.favs, active: !!slide.querySelector('.star-btn.on') }));
      }, 300);
    }, 400);
  })`,
  true
);

/* 打开详情抽屉 */
const detail = await evaluate(
  `new Promise((resolve) => {
    document.querySelector('.slide [data-detail]').click();
    setTimeout(() => {
      const sheet = document.querySelector('.sheet');
      const h = sheet ? Math.round(sheet.getBoundingClientRect().height) : 0;
      const sections = [...document.querySelectorAll('.det-sec h4')].map((n) => n.textContent);
      resolve(JSON.stringify({ h, sections, scroll: document.querySelector('.sheet-body')?.scrollHeight }));
    }, 600);
  })`,
  true
);

/* 切到复习页 */
await evaluate(`document.querySelector('[data-tab="review"]').click()`);
await wait(700);
const review = await evaluate(
  `JSON.stringify({
    hero: document.querySelector('.review-hero .big')?.textContent.trim(),
    items: document.querySelectorAll('.qitem').length,
    stats: [...document.querySelectorAll('.stat-box b')].map(n => n.textContent)
  })`
);

console.log(
  JSON.stringify(
    { before, queue, deck: parsed, fav: JSON.parse(favResult), detail: JSON.parse(detail), review: JSON.parse(review) },
    null,
    2
  )
);
ws.close();
