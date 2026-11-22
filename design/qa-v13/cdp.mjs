/* 轻量 CDP 客户端：连接 Android WebView 的 devtools，执行 JS / 截图 */
import fs from 'node:fs';

const PORT = process.env.CDP_PORT || 9336;

export async function connect() {
  const list = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json());
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('没有可用的 page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = (e) => rej(new Error('ws error: ' + e.message));
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
  const send = (method, params = {}) => {
    const mid = ++id;
    ws.send(JSON.stringify({ id: mid, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(mid, resolve);
      setTimeout(() => {
        if (pending.has(mid)) {
          pending.delete(mid);
          reject(new Error('CDP timeout: ' + method));
        }
      }, 60000);
    });
  };
  await send('Runtime.enable');
  await send('Page.enable');

  async function evaluate(expression, awaitPromise = false) {
    const res = await send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true,
      allowUnsafeEvalBlockedByCSP: true
    });
    if (res.result?.exceptionDetails) {
      const d = res.result.exceptionDetails;
      throw new Error(`${d.text} ${d.exception?.description || ''}`.trim());
    }
    return res.result?.result?.value;
  }

  async function screenshot(file) {
    const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(file, Buffer.from(res.result.data, 'base64'));
    return file;
  }

  return { send, evaluate, screenshot, close: () => ws.close() };
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
