/* ad1：「+ 新增即時回報」是膠囊格的最後一個子元素，自己一行（不佔一顆膠囊的格子）、靠左、低調小字（DESIGN「新增鈕」，2026-11-06 改；以前是跟膠囊一樣大的一格）；
   沒登入不顯示、有一張在編輯時也藏起來；
   點了照原本行為（桌面左右兩欄＝開始編輯一筆空白的並選到、手機＝開對話框）。固定 8300 埠
   2026-11-11 改寫：2026-11-06 單卡編輯後新增鈕是 .auth-only（登入、沒有在編輯時才出現），不再是「編輯中」才出現；改用 common.js 登入與模擬 GitHub */
const c=require('./common');
(async()=>{let bad=0;const ok=(x,m)=>{console.log((x?'OK  ':'FAIL')+' '+m);if(!x)bad++};
for(const [w,h,sc,tag] of [[1300,860,'dark','d'],[1300,860,'light','dl'],[412,900,'dark','m']]){
const {b,mk,login}=await c.setup();   /* 每種都從沒有身分的資料開始 */
const p=await mk(w,h,sc,false);await p.waitForFunction(()=>!document.body.classList.contains('intro'));await p.waitForTimeout(600);
const m=()=>p.evaluate(()=>{const a=$('#addEvent'),e=document.querySelector('#events .events>.ev:not([open])'),r=x=>{const q=x.getBoundingClientRect();return [Math.round(q.width),Math.round(q.height)]};
  const g=a.parentElement.getBoundingClientRect(),q=a.getBoundingClientRect(),capBottom=Math.max(...[...a.parentElement.querySelectorAll(':scope>.ev')].map(x=>x.getBoundingClientRect().bottom));
  return {inGrid:a.parentElement.className,shown:a.offsetParent!==null,add:r(a),cap:r(e),lastCell:a.parentElement.lastElementChild===a,ownRow:q.top>=capBottom-1,left:Math.round(q.left-g.left),font:getComputedStyle(a).fontSize}});
const v0=await m();console.log(tag,'logged out',JSON.stringify(v0));ok(!v0.shown,tag+' 沒登入不顯示');
await login(p);await p.waitForTimeout(500);
const v1=await m();console.log(tag,'logged in',JSON.stringify(v1));
ok(v1.shown&&v1.inGrid==='events'&&v1.lastCell&&v1.ownRow&&v1.left===0&&v1.add[1]<v1.cap[1]&&v1.add[0]<v1.cap[0]&&v1.font==='13px',tag+' 登入後在膠囊格最後、自己一行靠左、低調小字');
await p.locator('#livePanel').screenshot({path:`ad_${tag}.png`});
/* 有一張在編輯時藏起來 */
const id=await p.evaluate(()=>liveOrder()[0].id);await p.evaluate(i=>startEdit('e:'+i),id);await p.waitForTimeout(700);
const v2=await m();console.log(tag,'editing',JSON.stringify(v2));ok(!v2.shown,tag+' 編輯中藏起來');
await p.evaluate(()=>cancelEdit());await p.waitForTimeout(700);
await p.click('#addEvent');await p.waitForTimeout(700);
const r=await p.evaluate(()=>({dlg:$('#dlg').open?$('#dlgForm b').textContent:null,editing,sel:selEv&&(state.events.find(e=>e.id===selEv)||{}).name,split:$('#liveMD').classList.contains('split'),nameOpen:!!document.querySelector('#evDetail .evf.open [data-e=name]')}));
console.log(tag,'after click',JSON.stringify(r),'errs',p.errs);
if(w>=1000)ok(!r.dlg&&r.editing&&r.sel==='新的即時回報'&&r.split&&r.nameOpen,tag+' 桌面：開始編輯一筆空白的並選到');
else ok(r.dlg==='新增即時回報'&&!r.editing,tag+' 手機：開對話框');
ok(!p.errs.length,tag+' 沒有錯誤');
await b.close()}
process.exitCode=bad?1:0})();
