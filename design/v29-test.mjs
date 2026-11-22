import { writeFileSync } from 'node:fs';
const list = await (await fetch('http://127.0.0.1:9650/json')).json();
const page = list.find(x => x.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id=0; const pending=new Map();
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
const cmd=(m,p={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method:m,params:p}));});
const ev=async(e)=>(await cmd('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result?.result?.value;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const R=[];const CHK=(n,ok,d='')=>{R.push(ok);console.log(ok?'PASS':'FAIL',n,d);};

await cmd('Page.reload',{ignoreCache:true}); await sleep(3400);

// 1) 「我的」里有视频课地址输入
await ev(`document.querySelector('#tabbar [data-tab="me"]')?.click()`); await sleep(900);
const input=await ev(`(()=>{const i=document.querySelector('[data-videobase]');if(!i)return {found:false};
  return {found:true, type:i.type, placeholder:i.placeholder, val:i.value, visible:i.offsetParent!==null};})()`);
console.log('视频地址输入:', JSON.stringify(input));
CHK('我的页有视频课地址输入', input.found && input.visible, JSON.stringify(input).slice(0,120));

// 2) 填入并保存
const saved=await ev(`(async()=>{
  const i=document.querySelector('[data-videobase]');
  i.value='https://cdn.example.com/videos/';
  i.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(r=>setTimeout(r,500));
  const s=JSON.parse(localStorage.getItem('qingci.app.v1')||'{}').settings||{};
  return s.videoBase;
})()`);
console.log('保存值:', saved);
CHK('地址已持久化(去掉尾部斜杠)', saved==='https://cdn.example.com/videos', String(saved));

// 3) 视频页按在线地址拼接
await ev(`document.querySelector('#tabbar [data-tab="library"]')?.click()`); await sleep(800);
await ev(`document.querySelector('[data-tab="video"]')?.click()`); await sleep(700);
await ev(`document.querySelectorAll('[data-open]')[0]?.click()`); await sleep(1500);
const url=await ev(`(()=>{const v=document.querySelector('.lecture video');const h=document.querySelector('[data-hint]');
  return {src:(v?.src||'').slice(0,60), hint:h?.textContent.trim()};})()`);
console.log('播放地址:', JSON.stringify(url));
CHK('按前缀+文件名拼接', /cdn\.example\.com\/videos\//.test(url.src||''), url.src);
CHK('提示显示在线播放', /在线播放/.test(url.hint||''), url.hint);

let r=await cmd('Page.captureScreenshot',{format:'png'});
writeFileSync('design/v29-video.png',Buffer.from(r.result.data,'base64'));

// 4) 清空后回落本地
const cleared=await ev(`(async()=>{const st=await import('./src/core/store.js');st.setSetting('videoBase','');
  return st.getState().settings.videoBase;})()`);
CHK('可清空回本地模式', cleared==='', String(cleared));

const pass=R.filter(Boolean).length;
console.log(`\nRESULT ${pass}/${R.length}`);
ws.close();
