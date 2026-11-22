import { writeFileSync } from 'node:fs';

const PORT = 9222;
const BASE = 'http://127.0.0.1:4173';
const list = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json());
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
  return new Promise((r) => pending.set(mid, r));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expression, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true });
  return r.result?.result?.value;
};
const shot = async (file) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(file, Buffer.from(r.result.data, 'base64'));
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: `${BASE}/?demo=1&noanim=1` });
await wait(1500);

await ev(`(() => { const d = document.querySelector('.deck'); const s=[...d.querySelectorAll('.slide')]; d.scrollTo({top: s[s.length-1].offsetTop}); return s.length; })()`);
await wait(700);
await shot('E:/workbuddy工作区/背单词软件/design/app-done.png');

await ev(`document.querySelector('[data-tab="review"]').click()`);
await wait(600);
await shot('E:/workbuddy工作区/背单词软件/design/app-reviewpage.png');
await ev(`document.querySelector('[data-start]')?.click()`);
await wait(700);
await shot('E:/workbuddy工作区/背单词软件/design/app-reviewdeck.png');

await ev(`history.back()`);
await wait(500);
await ev(`document.querySelector('[data-tab="library"]').click()`);
await wait(500);
await ev(`document.querySelector('[data-tab="library"]') && document.querySelectorAll('.item')[0].click()`);
await wait(700);
await shot('E:/workbuddy工作区/背单词软件/design/app-reading.png');

console.log('shots ok');
ws.close();
