import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const { setTimeout: sleep } = await import('node:timers/promises');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9421, BASE='http://127.0.0.1:4196/www/index.html?demo=1';
const w=Number(process.argv[2]||412), h=Number(process.argv[3]||915), tag=process.argv[4]||'m';
const chrome=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--no-first-run','--window-size='+w+','+h,'--user-data-dir=C:/Users/Administrator/AppData/Local/Temp/qcol2'+tag, BASE],{stdio:'ignore'});
await sleep(2500);
const getJSON=async p=>(await fetch(`http://127.0.0.1:${PORT}${p}`)).json();
let target; for(let i=0;i<40;i++){try{const l=await getJSON('/json');target=l.find(t=>t.type==='page'&&t.url.includes('4196'));if(target)break;}catch{} await sleep(250);}
if(!target){console.log('NO TARGET');chrome.kill();process.exit(1);}
const ws=new WebSocket(target.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map();
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
const cmd=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}));});
const ev=async(e)=>(await cmd('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result?.result?.value;
for(let i=0;i<30;i++){ if(await ev(`!!document.querySelector('.ready')`)) break; await sleep(400); }
await sleep(700);
let r=await cmd('Page.captureScreenshot',{format:'png'});
writeFileSync(`design/color-${tag}-ready.png`,Buffer.from(r.result.data,'base64'));
const acc=await ev(`(()=>{const s=getComputedStyle(document.documentElement);return {accent:s.getPropertyValue('--accent').trim(),bg:s.getPropertyValue('--bg').trim(),sky:s.getPropertyValue('--sky').trim(),rose:s.getPropertyValue('--rose').trim(),muted:s.getPropertyValue('--muted').trim()};})()`);
console.log(tag,'ready vars:',JSON.stringify(acc));
await ev(`document.querySelector('#tabbar [data-tab="review"]')?.click()`);
await sleep(1300); await ev(`window.scrollTo(0,0)`); await sleep(300);
r=await cmd('Page.captureScreenshot',{format:'png'});
writeFileSync(`design/color-${tag}-review.png`,Buffer.from(r.result.data,'base64'));
console.log(tag,'review saved');
ws.close(); chrome.kill();
