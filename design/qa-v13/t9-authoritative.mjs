/* v1.3 最终权威回归（对着当前已安装的 13:18 构建跑一遍完整断言） */
import fs from 'node:fs';
import { connect, wait } from './cdp.mjs';

const results = [];
const rec = (id, name, pass, detail) => {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  [${id}] ${name} :: ${detail}`);
};
const c = await connect();

async function shot(file) {
  try {
    const r = await Promise.race([
      c.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))
    ]);
    fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    return true;
  } catch (_) { return false; }
}

/* 清场：回首页 */
await c.send('Page.reload', { ignoreCache: false });
await wait(2600);
const build = JSON.parse(await c.evaluate(`JSON.stringify({
  plugins: (window.Capacitor?.PluginHeaders || []).map(h => h.name),
  native: window.Capacitor?.isNativePlatform?.(), ua: navigator.userAgent.match(/Chrome\\/[\\d.]+/)?.[0],
  speechSynthesis: 'speechSynthesis' in window,
  book: (JSON.parse(localStorage.getItem('qingci.app.v1')||'{}').settings||{}).book
})`));
console.log('build:', JSON.stringify(build));

/* 进入学习页 */
const entered = await c.evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /开始背单词/.test(x.textContent));
  if (b) { b.click(); return 'clicked'; }
  return document.querySelectorAll('.slide').length ? 'already' : 'none';
})()`);
await wait(1900);
const slideCount = await c.evaluate(`document.querySelectorAll('.slide').length`);
rec('0', '进入学习页', slideCount > 1, `入口=${entered}，slide=${slideCount}（含完成页）`);

/* 1. 发音覆盖 */
const cov = JSON.parse(await c.evaluate(`(() => {
  const rows = [...document.querySelectorAll('.slide')].map((s) => ({
    done: s.hasAttribute('data-done'),
    word: s.querySelector('.word')?.textContent?.trim() || null,
    say: s.querySelectorAll('[data-say]').length,
    sayEx: s.querySelectorAll('[data-say-ex]').length,
    hasEx: !!s.querySelector('.ex-block') && !!s.querySelector('[data-ex-text]')
  }));
  const cards = rows.filter(r => !r.done);
  return JSON.stringify({
    cards: cards.length,
    noSay: cards.filter(r => r.say < 1).map(r => r.word),
    exWithoutBtn: cards.filter(r => r.hasEx && r.sayEx === 0).map(r => r.word),
    extraBtn: cards.filter(r => !r.hasEx && r.sayEx > 0).map(r => r.word),
    doneSlide: rows.filter(r => r.done)
  });
})()`));
rec('1.1', '每张词卡都有单词发音按钮', cov.noSay.length === 0, `${cov.cards} 张词卡，缺失=${JSON.stringify(cov.noSay)}`);
rec('1.2', '有例句的卡都有例句发音按钮', cov.exWithoutBtn.length === 0 && cov.extraBtn.length === 0,
  `缺按钮=${JSON.stringify(cov.exWithoutBtn)}，多余=${JSON.stringify(cov.extraBtn)}`);
rec('1.3', '完成页无发音按钮', cov.doneSlide.length === 1 && cov.doneSlide.every((d) => d.say === 0 && d.sayEx === 0),
  `完成页 ${cov.doneSlide.length} 张，say/sayEx=${cov.doneSlide.map((d) => `${d.say}/${d.sayEx}`).join(',')}`);

/* 2. 点击例句发音 */
const ex = JSON.parse(await c.evaluate(`(() => {
  const w = document.getElementById('toast'); if (w) w.innerHTML = '';
  const s = [...document.querySelectorAll('.slide')].find(x => !x.hasAttribute('data-done') && x.querySelector('[data-say-ex]'));
  if (!s) return JSON.stringify({ err: 'none' });
  s.querySelector('[data-say-ex]').click();
  return JSON.stringify({ word: s.querySelector('.word')?.textContent?.trim(), text: s.querySelector('[data-ex-text]')?.textContent?.trim() });
})()`));
await wait(4500);
const exToasts = JSON.parse(await c.evaluate(`JSON.stringify([...document.querySelectorAll('.toast')].map(t => t.textContent.trim()))`));
rec('2.1', '点击例句发音无失败提示', exToasts.length === 0, `词「${ex.word}」例句="${ex.text}"，toast=${JSON.stringify(exToasts)}`);

/* 3. 原生 TTS 计时 */
const tts = JSON.parse(await c.evaluate(`(async () => {
  const t0 = performance.now(); let ok = null, err = null;
  try { ok = await window.Capacitor.nativePromise('TextToSpeech','speak',{ text:'a radiant sunrise', lang:'en-US', rate:0.9, pitch:1, volume:1, category:'playback', queueStrategy:0 }); }
  catch (e) { err = String(e && e.message || e); }
  return JSON.stringify({ ok: JSON.stringify(ok), err, ms: Math.round(performance.now()-t0) });
})()`, true));
rec('2.2', '原生 TTS 朗读成功且耗时>500ms', !tts.err && tts.ms > 500, `返回=${tts.ok} err=${tts.err} 耗时=${tts.ms}ms`);

/* 4. 抽测 5 个单词发音 */
const taps = JSON.parse(await c.evaluate(`(async () => {
  const out = [];
  const cards = [...document.querySelectorAll('.slide')].filter(s => !s.hasAttribute('data-done'));
  for (const i of [0, 5, 10, 14, 18]) {
    const s = cards[i]; if (!s) continue;
    const w = document.getElementById('toast'); if (w) w.innerHTML = '';
    s.querySelector('[data-say="us"]').click();
    await new Promise(r => setTimeout(r, 3000));
    out.push({ word: s.querySelector('.word')?.textContent?.trim(), toasts: [...document.querySelectorAll('.toast')].map(x => x.textContent.trim()) });
  }
  return JSON.stringify(out);
})()`, true));
const tapFail = taps.filter((x) => x.toasts.some((t) => /无法|失败|未就绪|没响应|没有可用/.test(t)));
rec('2.3', '抽测 5 个单词发音按钮无误报', taps.length === 5 && tapFail.length === 0,
  `${taps.map((t) => t.word).join(', ')}；失败=${JSON.stringify(tapFail)}`);

/* 5. 通知 */
rec('3.1', 'PluginHeaders 含 LocalNotifications', build.plugins.includes('LocalNotifications'), `插件=${build.plugins.join(', ')}`);
const perm = JSON.parse(await c.evaluate(`(async () => {
  const t0 = performance.now(); let raw = null, err = null;
  try { raw = await window.Capacitor.nativePromise('LocalNotifications','checkPermissions',{}); } catch (e) { err = String(e && e.message || e); }
  return JSON.stringify({ raw, err, ms: Math.round(performance.now()-t0) });
})()`, true));
rec('3.2', 'checkPermissions 返回 {display} 且不抛错', !perm.err && perm.raw && typeof perm.raw.display === 'string',
  `返回=${JSON.stringify(perm.raw)} err=${perm.err} 耗时=${perm.ms}ms`);
await c.evaluate(`document.querySelector('.tab[data-tab="me"]').click()`);
await wait(1400);
const me = JSON.parse(await c.evaluate(`(() => {
  const row = [...document.querySelectorAll('.setting')].map(r => ({
    label: r.querySelector('.lbl b')?.textContent?.trim(),
    hint: r.querySelector('.lbl span')?.textContent?.trim(),
    chip: r.querySelector('.chip')?.textContent?.trim() || null,
    btn: r.querySelector('.chip-btn')?.textContent?.trim() || null
  })).find(r => r.label === '系统通知');
  return JSON.stringify(row);
})()`));
rec('3.3', '我的页「系统通知」存在且文案合理', !!me && !/不支持|unknown|未就绪/.test(me.hint || '') && me.chip !== '不支持',
  `hint="${me?.hint}" chip=${me?.chip} btn=${me?.btn}`);

/* 6. 复习页 */
await c.evaluate(`document.querySelector('.tab[data-tab="review"]').click()`);
await wait(1500);
const rv = JSON.parse(await c.evaluate(`(() => JSON.stringify({
  rvPage: !!document.querySelector('.page.rv-page'),
  rvHero: !!document.querySelector('.rv-hero'),
  metrics: [...document.querySelectorAll('.rv-metric')].map(n => (n.querySelector('b')?.textContent||'')+'·'+(n.querySelector('span')?.textContent||'')),
  tabs: [...document.querySelectorAll('.ui-tab')].map(t => t.textContent.trim()),
  scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
  vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio
}))()`));
rec('4.1', '.rv-page 存在', rv.rvPage, `viewport=${rv.vw}x${rv.vh}@${rv.dpr}`);
rec('4.2', '.rv-hero 存在', rv.rvHero, `hero=${rv.rvHero}`);
rec('4.3', '.rv-metric 数量为 4', rv.metrics.length === 4, rv.metrics.join(' | '));
rec('4.4', '.ui-tab 数量为 4', rv.tabs.length === 4, rv.tabs.join(' / '));
rec('4.5', '无横向溢出', rv.scrollW <= rv.clientW + 1, `scrollWidth=${rv.scrollW} clientWidth=${rv.clientW}`);
rec('4.6', '复习页截图', await shot('E:/workbuddy工作区/背单词软件/design/qa-review.png'), 'design/qa-review.png');

const learned = JSON.parse(await c.evaluate(`(() => {
  const t = [...document.querySelectorAll('.ui-tab')].find(x => /今日已学/.test(x.textContent));
  t.click();
  const b = document.querySelector('#tab-body');
  return JSON.stringify({ items: b.querySelectorAll('.ui-item').length, empty: !!b.querySelector('.ui-empty'),
    titles: [...b.querySelectorAll('.ui-item-title')].map(n => n.textContent.trim()) });
})()`));
await wait(500);
rec('4.7', '今日已学 tab 有列表项或空状态', learned.items > 0 || learned.empty,
  `${learned.items} 项：${learned.titles.slice(0, 8).join(', ')}`);

fs.writeFileSync('E:/tmp/qa-v13-final.json', JSON.stringify(results, null, 1));
const pass = results.filter((r) => r.pass).length;
console.log(`\n=== ${pass}/${results.length} PASS ===`);
c.close();
