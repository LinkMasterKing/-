/* 秘書處「會議」分頁（2026-11-06）：完成紀錄併進即時回報、會議報告事項一次看一個部門（部門膠囊、上一個／下一個）、
   會長室開放時編輯 → 儲存寫回該部門 → 修改記進秘書處的 minutes → 匯出會議紀錄預覽。也檢查會長室分頁（文件、小開關）。
   GitHub API 用 common.js 模擬。固定 8300 埠 */
const c=require('./common');c.q='?d=secretariat';(async()=>{const {b,mk,login,st}=await c.setup();
const API=c.API,d0=new Date(),T=`${d0.getFullYear()}-${String(d0.getMonth()+1).padStart(2,'0')}-${String(d0.getDate()).padStart(2,'0')}`;
const ev=(id,name,desc)=>({id,name,desc,report:true,times:[{id:'t'+id,label:'場勘',start:T+'T16:00',end:'',place:'六宿'}],links:[],staff:[],labels:[],touched:[T],createdAt:T});
st.puts[API+'data-president.json']={schemaVersion:11,id:'board-president',members:[],issues:[],events:[],weeks:[],meetGrant:{date:T,by:'小芸',at:T+' 09:00'}};
st.puts[API+'data-marketing.json']={schemaVersion:11,id:'board-marketing',members:[],issues:[],events:[ev('m1','社群內容排程','十一月貼文'),ev('m2','世新學運報導','初版')],weeks:[]};
st.puts[API+'data-events.json']={schemaVersion:11,id:'board-events',members:[],issues:[],events:[ev('e1','迎新活動','場地確認')],weeks:[]};
const p=await mk(412,860,'dark',true);
/* 網站上的 data-*.json（測試資料夾裡可能有真的資料檔）一律當成不存在；先放權杖再重新整理，各部門資料都從模擬的 GitHub 讀 */
await p.context().route(/127\.0\.0\.1:8300\/data-.*\.json/,r=>r.fulfill({status:404,body:''}));
await p.evaluate(([o,r])=>{localStorage.setItem('workboard:ghtoken','T');localStorage.setItem('workboard:board-secretariat',JSON.stringify({id:'board-secretariat',issues:[],events:[],members:[],weeks:[],savedAt:'2000-01-01 00:00',sync:{owner:o,repo:r,branch:'main',path:'data-secretariat.json'}}))},API.split('/repos/')[1].split('/').slice(0,2).map(decodeURIComponent));await p.reload();await p.waitForTimeout(3500);await login(p);await p.waitForTimeout(800);for(let i=0;i<3;i++){const t=await p.evaluate(()=>{const d=document.querySelector('#dlg[open]');if(!d)return null;const t=d.querySelector('#dlgForm>b')?.textContent;d.close('cancel');return t});if(!t)break;console.log('closed dialog after login:',t);await p.waitForTimeout(500)}
console.log('tabs',await p.evaluate(()=>[...document.querySelectorAll('#tabbar .tab')].map(t=>t.dataset.tab).join(' ')),'done in live',await p.evaluate(()=>!!document.querySelector('.sgroup[data-sec=live] #donePanel')));
await p.click('#tabbar [data-tab=ext]');await p.waitForTimeout(1200);
console.log('chips',await p.evaluate(()=>[...document.querySelectorAll('#meetPick [data-mtpick]')].map(x=>x.textContent).join(' | ')),'shown',await p.evaluate(()=>[...document.querySelectorAll('#meetEdList .mt-dept')].map(x=>x.dataset.mtdept).join()));
await p.click('#meetStep [data-mtstep="1"]');await p.waitForTimeout(700);console.log('after next',await p.evaluate(()=>[MTS.sel,document.querySelector('#meetStep').textContent.replace(/\s+/g,' ')]));
await p.click('#meetPick [data-mtpick=marketing]');await p.waitForTimeout(600);
await p.screenshot({path:'mt2_meet.png'});await p.evaluate(()=>document.getElementById('wkPanel').scrollIntoView());await p.waitForTimeout(300);await p.screenshot({path:'mt2_week.png'});await p.click('#wkBody .wk-cap summary').catch(()=>{});await p.waitForTimeout(800);console.log('week cap opened',await p.evaluate(()=>[...document.querySelectorAll('#wkBody .wk-cap')].map(d=>d.open)));await p.evaluate(()=>document.getElementById('meetEdPanel').scrollIntoView());
console.log('edit btn visible',await p.evaluate(()=>{const b=document.querySelector('#meetEdPanel [data-edit]');return !b.hidden&&!!b.offsetParent}));
await p.click('#meetEdPanel [data-edit]');await p.waitForTimeout(900);
/* 真的在畫面上改（2026-11-06：以前直接改資料，沒抓到膠囊少了 data-ev 就不能點欄位編輯）：展開第一顆 → 點「說明」→ 改字 → 完成 */
await p.click('#meetEdList .mt-ev[data-ev=m1] summary');await p.waitForTimeout(700);
console.log('ui: capsule open',await p.evaluate(()=>document.querySelector('#meetEdList .mt-ev[data-ev=m1]').open));
await p.click('#meetEdList .mt-ev[data-ev=m1] [data-evpen=desc]');await p.waitForTimeout(400);
await p.fill('#meetEdList .mt-ev[data-ev=m1] textarea[data-e=desc]','十一月貼文（會議決定延到下週）');
await p.click('#meetEdList .mt-ev[data-ev=m1] [data-evfx=ok]');await p.waitForTimeout(500);
console.log('ui: dirty',await p.evaluate(()=>MT.depts.get('marketing').dirty),'still open',await p.evaluate(()=>document.querySelector('#meetEdList .mt-ev[data-ev=m1]').open));
/* 手機一次只開一張：打開第二顆，第一顆收起來 */
await p.click('#meetEdList .mt-ev[data-ev=m2] summary');await p.waitForTimeout(800);
console.log('one open at a time',await p.evaluate(()=>[...document.querySelectorAll('#meetEdList .mt-ev')].map(d=>d.dataset.ev+':'+d.open).join(' ')));
await p.screenshot({path:'mt2_edit.png'});
await p.waitForTimeout(300);await p.click('#meetEdPanel [data-edsave]');await p.waitForTimeout(4000);
const mk2=st.puts[API+'data-marketing.json'],sec=st.puts[API+'data-secretariat.json'];
console.log('marketing written',mk2.events.find(e=>e.id==='m1').desc,'| commits',st.commits.slice(0,3).map(x=>x.split('\n')[0]));
console.log('minutes',JSON.stringify(sec&&sec.minutes&&sec.minutes.map(m=>({date:m.date,by:m.by,items:m.items.map(i=>i.deptName+':'+i.name+':'+i.changed.join('/'))}))));
console.log('info',await p.evaluate(()=>document.getElementById('minutesInfo').textContent));
for(let i=0;i<3;i++){const t=await p.evaluate(()=>{const d=document.querySelector('#dlg[open]');if(!d)return null;const t=d.querySelector('#dlgForm>b')?.textContent;d.close('cancel');return t});if(!t)break;console.log('closed dialog:',t);await p.waitForTimeout(500)}
await p.click('#minutesBtn');await p.waitForTimeout(700);
console.log('dialog',await p.evaluate(()=>document.querySelector('#dlg[open] #dlgForm>b')?.textContent));
await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(2500);
console.log('preview',await p.evaluate(()=>{const o=document.getElementById('rptOv');return o?[o.querySelector('.anim-title b').textContent,[...o.querySelectorAll('.rpt-h1')].map(x=>x.textContent).join(' '),o.querySelectorAll('.rpt-issue').length,o.querySelector('.rpt-st')?.textContent]:null}));
await p.screenshot({path:'mt2_minutes.png'});
console.log('errs',p.errs);
/* 會長室分頁 */
c.q='?d=president';const q=await mk(1300,900,'light',false);await q.waitForTimeout(3000);
await q.click('#tabbar [data-tab=ext]');await q.waitForTimeout(1200);
console.log('president sw',await q.evaluate(()=>[document.getElementById('grantSw').getAttribute('aria-checked'),document.getElementById('grantSt').textContent]),'docs empty',await q.evaluate(()=>!!document.querySelector('#docsList .empty')),'errs',q.errs);
await b.close()})();
