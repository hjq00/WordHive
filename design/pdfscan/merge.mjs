import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const boxes=JSON.parse(readFileSync('design/pdfscan/boxes.json','utf8'));
const lex=new Set(JSON.parse(readFileSync('design/pdfscan/lexicon.json','utf8')));
const lexByLen={}; for(const w of lex){(lexByLen[w.length]=lexByLen[w.length]||[]).push(w);}
function lev(a,b,cap){
  if(Math.abs(a.length-b.length)>cap)return cap+1;
  const m=a.length,n=b.length;let prev=Array.from({length:n+1},(_,j)=>j),cur=new Array(n+1);
  for(let i=1;i<=m;i++){cur[0]=i;let rm=i;
    for(let j=1;j<=n;j++){cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));if(cur[j]<rm)rm=cur[j];}
    if(rm>cap)return cap+1;[prev,cur]=[cur,prev];}
  return prev[n];}
function correct(w){
  if(lex.has(w))return {w,d:0};
  let best=null,bd=3;
  for(let L=Math.max(2,w.length-3);L<=w.length+3;L++)
    for(const c of (lexByLen[L]||[])){const d=lev(w,c,bd-1);if(d<bd){bd=d;best=c;if(d===1)break;}if(bd===1)break;}
  return best?{w:best,d:bd}:{w,d:99};}

const files=readdirSync('design/pdfscan/ocr_pages').filter(f=>f.endsWith('.json')).sort();
const hit=new Map(); let rawWords=0, inBox=0;
for(const f of files){
  const page=f.replace('.json','')+'.jpg';
  const meta=boxes[page]; if(!meta) continue;
  const rows=JSON.parse(readFileSync('design/pdfscan/ocr_pages/'+f,'utf8'));
  for(const r of rows){
    rawWords++;
    const t=(r.t||'').replace(/[^A-Za-z]/g,'').toLowerCase();
    if(t.length<3||t.length>22) continue;
    const cx=(r.x0+r.x1)/2, cy=(r.y0+r.y1)/2;
    const inside=meta.boxes.some(([a,y0,b,y1])=>{
      const ov=Math.min(r.y1,y1)-Math.max(r.y0,y0);
      const need=Math.min(r.y1-r.y0, y1-y0)*0.45;
      return ov>need && cx>=a-12 && cx<=b+12;
    });
    if(!inside) continue;
    inBox++;
    const c=correct(t);
    if(c.d<=1){ const k=c.w; hit.set(k,(hit.get(k)||0)+1); }
  }
}
const list=[...hit.entries()].sort((a,b)=>b[1]-a[1]);
console.log('整页词数:',rawWords,'| 落洋红块:',inBox,'| 唯一词条:',list.length);
const once=list.filter(x=>x[1]===1).length;
console.log('出现1次:',once,'| >=2次:',list.length-once);
writeFileSync('design/pdfscan/words_final.json',JSON.stringify(list));
console.log('样例:',list.slice(0,20).map(x=>x[0]).join(', '));
