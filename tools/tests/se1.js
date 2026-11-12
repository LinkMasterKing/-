/* se1：編輯的範圍規則。2026-11-06 起是「單卡編輯」（render.js 的 cardEdit）：頁首沒有「編輯」、看板上沒有「編輯這區」；
   沒登入看不到任何編輯工具；登入後按一張卡片自己的「編輯」→ 只有那一張出現逐欄編輯工具（其他區、其他張都沒有，其他「編輯」鈕藏起來）；
   甘特圖時間軸是整區編輯（"s:gantt"）；取消後全部回檢視、再按「編輯」又只在那一張出現。
   （2026-11-11 從「按頁首編輯後三區一起出現」改寫成現在的規則；會長室「追蹤」由 mt1.js 涵蓋）桌面 1300 與手機 412。固定 8300 埠 */
const c=require('./common');
(async()=>{let bad=0;
for(const [w,h,tag] of [[1300,900,'d'],[412,900,'m']]){
const {b,mk,login}=await c.setup(__dirname+'/data_v5.json');
const p=await mk(w,h,'dark',tag==='m');await p.waitForFunction(()=>!document.getElementById('splash'),null,{timeout:8000}).catch(()=>{});
await p.evaluate(()=>localStorage.setItem('workboard:ghtoken','T'));
const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+tag+' '+m);if(!c)bad++};
const sec=async k=>{await p.evaluate(k=>{setSection(k,{instant:true});if(k==='progress')progShow(null)},k);await p.waitForTimeout(500)};
/* box：正在編輯的那張（data-edbox）；手機一次只顯示一區，進度區的工具切過去再看 */
const st=async box=>{const r=await p.evaluate(box=>{const V=x=>x.checkVisibility({visibilityProperty:true}),vis=s=>[...document.querySelectorAll(s)].filter(V).length;
  const inBox=x=>box&&(x.closest(`[data-edbox="${box}"]`)||x.closest('#evDetail.sec-edit,#evDetail .sec-edit'));
  return {editing,cardEdit,secBtns:document.querySelectorAll('[data-secedit]').length,headerEdit:!!document.getElementById('editBtn'),
   pens:[...document.querySelectorAll('[data-evpen],[data-ifpen]')].filter(V).length,pensOut:[...document.querySelectorAll('[data-evpen],[data-ifpen]')].filter(x=>V(x)&&!inBox(x)).length,
   evDel:vis('#events [data-evdel],#evDetail [data-evdel]'),editBtns:vis('.card-edit-btn'),addEv:vis('#addEvent'),bars:vis('.card-edbar')}},box);
  if(tag==='m'){const cur=await p.evaluate(()=>curSec);await sec('progress');const r2=await p.evaluate(()=>{const V=x=>x.checkVisibility({visibilityProperty:true});return {range:[...document.querySelectorAll('.range')].filter(V).length,addIssue:[...document.querySelectorAll('#addIssue')].filter(V).length,ganttBtn:[...document.querySelectorAll('#ganttEdBtn')].filter(V).length}});await sec(cur);return {...r,...r2}}
  return {...r,...await p.evaluate(()=>{const V=x=>x.checkVisibility({visibilityProperty:true});return {range:[...document.querySelectorAll('.range')].filter(V).length,addIssue:[...document.querySelectorAll('#addIssue')].filter(V).length,ganttBtn:[...document.querySelectorAll('#ganttEdBtn')].filter(V).length}})}};
let s0=await st();ok(!s0.editing&&!s0.headerEdit&&s0.pens===0&&s0.evDel===0&&s0.editBtns===0&&s0.addIssue===0&&s0.range===0,'沒登入：沒有任何編輯工具、頁首沒有「編輯」 '+JSON.stringify(s0));
await login(p);
await sec('live');
const id=await p.evaluate(()=>liveOrder()[0].id);
let s1=await st();ok(!s1.editing&&s1.pens===0&&s1.addIssue>0&&s1.ganttBtn>0&&s1.secBtns===0,'登入後：還沒有編輯中的卡片，新增鈕與卡片「編輯」出現，沒有「編輯這區」 '+JSON.stringify(s1));
const startEv=async()=>{await p.click(`.ev[data-ev="${id}"]>summary`);await p.waitForTimeout(800);await p.click(w<1000?`.ev[data-ev="${id}"] .card-edit-btn`:'#evDetail .card-edit-btn');await p.waitForTimeout(800)};
await startEv();
let s2=await st('e:'+id);ok(s2.editing&&s2.cardEdit==='e:'+id&&s2.pens>0&&s2.pensOut===0&&s2.evDel===1&&s2.bars===1,'按一張即時回報的「編輯」：只有那一張出現編輯工具 '+JSON.stringify(s2));
ok(s2.editBtns===0&&s2.addEv===0&&s2.addIssue===0&&s2.range===0&&s2.ganttBtn===0,'編輯中：其他「編輯」、新增鈕藏起來，甘特圖時間軸不在編輯');
await p.click('.card-edbar [data-edcancel]');await p.waitForTimeout(800);
let s3=await st();ok(!s3.editing&&s3.pens===0&&s3.evDel===0&&s3.bars===0,'取消後回檢視 '+JSON.stringify(s3));
/* 甘特圖時間軸：整區編輯 */
await sec('progress');await p.click('#ganttEdBtn');await p.waitForTimeout(700);
let s4=await st('s:gantt');ok(s4.editing&&s4.cardEdit==='s:gantt'&&s4.range>0&&s4.evDel===0&&s4.pensOut===0,'甘特圖「編輯」：只有時間軸那一區 '+JSON.stringify(s4));
await p.click('#pvGantt [data-edcancel]');await p.waitForTimeout(700);
await sec('live');await p.evaluate(()=>{openEv.clear();selEv=null;render()});await p.waitForTimeout(400);
await startEv();
let s5=await st('e:'+id);ok(s5.editing&&s5.cardEdit==='e:'+id&&s5.pens>0&&s5.pensOut===0,'再按「編輯」時又只在那一張出現 '+JSON.stringify(s5));
await p.click('.card-edbar [data-edcancel]');await p.waitForTimeout(600);
ok(!p.errs.length,'沒有錯誤 '+p.errs.join(' | '));
await b.close()}
if(bad)process.exitCode=1;
})();
