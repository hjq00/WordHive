import { writeFileSync } from 'node:fs';

const list = await fetch('http://127.0.0.1:9222/json').then((r) => r.json());
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
};
const send = (method, params = {}) => {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(mid);
      resolve({ timeout: true, method });
    }, 5000);
    pending.set(mid, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expression, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true });
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.text };
  return r.result?.result?.value;
};
const shot = async (file) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(file, Buffer.from(r.result.data, 'base64'));
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: 'http://127.0.0.1:4173/?demo=1&noanim=1' });
await wait(1400);

const highlightClick = await ev(
  `new Promise((resolve) => {
    document.querySelector('[data-tab="library"]').click();
    setTimeout(() => {
      document.querySelector('.item').click();
      setTimeout(() => {
        const hl = document.querySelector('.para .hl');
        hl.click();
        setTimeout(() => {
          resolve(JSON.stringify({
            hl: hl.textContent,
            sheet: !!document.querySelector('.sheet'),
            word: document.querySelector('.det-word')?.textContent,
            sections: document.querySelectorAll('.det-sec h4').length
          }));
        }, 250);
      }, 400);
    }, 300);
  })`,
  true
);

/* 关掉抽屉与二级页，回到学习，滚到最后一屏 */
console.log('step: close sheet', await ev(`document.querySelector('.sheet [data-close]')?.click(); 'closed'`));
await wait(300);
await send('Page.navigate', { url: 'http://127.0.0.1:4173/?demo=1&noanim=1' });
await wait(1400);
console.log('step: done eval');
const done = await ev(
  `new Promise((resolve) => {
    document.querySelector('[data-tab="study"]').click();
    setTimeout(() => {
      const d = document.querySelector('.deck');
      d.style.scrollBehavior = 'auto';
      const s = [...d.querySelectorAll('.slide')];
      d.scrollTop = s[s.length - 1].offsetTop;
      setTimeout(() => {
        resolve(JSON.stringify({
          slides: s.length,
          doneVisible: !!document.querySelector('.done'),
          title: document.querySelector('[data-done-title]')?.textContent,
          stats: document.querySelector('[data-done-stats]')?.textContent,
          scrollTop: d.scrollTop,
          max: d.scrollHeight - d.clientHeight,
          doneTop: s[s.length - 1].offsetTop
        }));
      }, 350);
    }, 500);
  })`,
  true
);
await wait(400);
await shot('E:/workbuddy工作区/背单词软件/design/app-done2.png');

console.log(JSON.stringify({ highlightClick: JSON.parse(highlightClick), done: JSON.parse(done) }, null, 2));
ws.close();
