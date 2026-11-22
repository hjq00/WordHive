const list = await (await fetch('http://127.0.0.1:9460/json')).json();
const page = list.find(x => x.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id=0; const pending=new Map();
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
const cmd=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}));});
const ev=async(e)=>(await cmd('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result?.result?.value;
const R=[];const CHK=(n,ok,d='')=>{R.push(ok);console.log(ok?'PASS':'FAIL',n,d);};

await ev(`document.querySelector('#tabbar [data-tab="study"]')?.click()`);
await new Promise(r=>setTimeout(r,800));
const st=await ev(`(()=>({title:document.querySelector('.ready-title')?.textContent?.trim(),hasStart:!!document.querySelector('[data-start-study]'),accent:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()}))()`);
CHK('开始页正常', st.hasStart && st.accent==='#41B349', JSON.stringify(st));

await ev(`document.querySelector('[data-start-study]')?.click()`);
await new Promise(r=>setTimeout(r,1300));
const deck=await ev(`(()=>{const c=[...document.querySelectorAll('.slide')].filter(x=>x.dataset.i!==undefined);return {cards:c.length,wordSay:c.filter(x=>x.querySelector('[data-say]')).length,ex:c.filter(x=>x.querySelector('[data-ex-text]')).length,exSay:c.filter(x=>x.querySelector('[data-say-ex]')).length};})()`);
CHK('词卡与发音未回归', deck.cards>0 && deck.cards===deck.wordSay && deck.ex===deck.exSay, JSON.stringify(deck));

const tts=await ev(`(async()=>{const t0=performance.now();try{await window.Capacitor.nativePromise('TextToSpeech','speak',{text:'ok',lang:'en-US',rate:.9,pitch:1,volume:1});return Math.round(performance.now()-t0);}catch(e){return 'ERR';}})()`);
CHK('TTS 可用', typeof tts==='number'&&tts>300, tts+'ms');

await ev(`(()=>{const d=document.querySelector('.deck');if(d)d.scrollTop=d.scrollHeight;})()`);
await new Promise(r=>setTimeout(r,1400));
const done=await ev(`(()=>{const b=document.querySelector('[data-go]');return b?b.textContent.trim():null;})()`);
CHK('完成页按钮', done==='去复习', done);

await ev(`document.querySelector('#tabbar [data-tab="review"]')?.click()`);
await new Promise(r=>setTimeout(r,1200));
const rv=await ev(`(()=>{const s=getComputedStyle(document.documentElement);return {rv:!!document.querySelector('.rv-page'),svg:document.querySelectorAll('.rv-page svg').length,charts:document.querySelectorAll('.rv-grid > *').length,sky:s.getPropertyValue('--sky').trim(),rose:s.getPropertyValue('--rose').trim()};})()`);
CHK('复习页图表与新色', rv.rv && rv.charts===4 && rv.sky==='#51C4D3' && rv.rose==='#E8654F', JSON.stringify(rv));

const perm=await ev(`(async()=>{try{return JSON.stringify(await window.Capacitor.nativePromise('LocalNotifications','checkPermissions',{}));}catch(e){return 'ERR';}})()`);
CHK('通知桥接', !String(perm).startsWith('ERR'), perm);

const pass=R.filter(Boolean).length;
console.log(`RESULT ${pass}/${R.length}`);
ws.close();
