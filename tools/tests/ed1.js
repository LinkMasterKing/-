/* 單卡編輯（2026-11-06，render.js 的 cardEdit）：頁首沒有「編輯」；沒登入看不到任何編輯鈕與新增鈕；
   登入後：即時回報要展開才有「編輯」→ 只有那張進入編輯（逐欄、取消｜儲存），其他編輯鈕藏起來；改名稱 → 儲存（寫一筆 commit）；
   取消會還原；新增議題 → 開始編輯空白議題，取消就不留；甘特圖時間軸、議題詳情、完成紀錄各自的「編輯」。手機 412 與桌面 1300。固定 8300 埠 */
const c=require('./common');(async()=>{
const vis=(p,sel)=>p.evaluate(s=>[...document.querySelectorAll(s)].filter(e=>e.offsetParent!==null&&getComputedStyle(e).display!=="none").length,sel);
const S=p=>p.evaluate(()=>({editing,cardEdit,dirty,bars:document.querySelectorAll('.card-edbar').length,secEdit:[...document.querySelectorAll('.sec-edit')].map(e=>e.dataset.edbox)}));
for(const [w,touch] of [[412,true],[1300,false]]){const {b,mk,login,st}=await c.setup();   /* 每種寬度都從沒有身分的資料開始 */
  const p=await mk(w,860,'dark',touch);await p.waitForFunction(()=>!document.getElementById('splash'),null,{timeout:8000}).catch(()=>{});
  console.log(w,'logged out: header edit',!!(await p.$('#editBtn')),'edit btns',await vis(p,'.card-edit-btn'),'add',await vis(p,'#addEvent,#addIssue'));
  await login(p);
  console.log(w,'logged in: authed',await p.evaluate(()=>document.body.classList.contains('authed')),'add live',await vis(p,'#addEvent'));
  /* 即時回報：收合時看不到「編輯」，展開才有 */
  await p.evaluate(()=>setSection('live',{instant:true}));await p.waitForTimeout(500);
  const id=await p.evaluate(()=>liveOrder()[0].id);
  await p.evaluate(i=>{openEv.delete(i);selEv=null;render()},id);await p.waitForTimeout(300);
  console.log(w,'collapsed edit visible',await vis(p,`.ev[data-ev="${id}"] .card-edit-btn`),'open',await p.evaluate(i=>document.querySelector(`.ev[data-ev="${i}"]`).open,id));
  if(w<1000){await p.click(`.ev[data-ev="${id}"]>summary`);await p.waitForTimeout(700);console.log(w,'expanded edit visible',await vis(p,`.ev[data-ev="${id}"] .card-edit-btn`))}
  else{await p.click(`.ev[data-ev="${id}"]>summary`);await p.waitForTimeout(900);console.log(w,'detail edit visible',await vis(p,'#evDetail .card-edit-btn'))}
  const btn=w<1000?`.ev[data-ev="${id}"] .card-edit-btn`:'#evDetail .card-edit-btn';
  await p.click(btn);await p.waitForTimeout(700);
  console.log(w,'editing',JSON.stringify(await S(p)),'other edit btns visible',await vis(p,'.card-edit-btn'),'add visible',await vis(p,'#addEvent'));
  const box=w<1000?`.ev[data-ev="${id}"]`:'#evDetail';
  await p.click(`${box} [data-evpen=name]`);await p.waitForTimeout(300);await p.fill(`${box} .evf.open [data-e=name]`,'改過的名稱');await p.click(`${box} [data-evfx=ok]`);await p.waitForTimeout(300);
  await p.click(`${box} [data-edsave]`);await p.waitForTimeout(3200);
  await p.click('#dlg[open] [data-act=cancel]').catch(()=>{});await p.waitForTimeout(400);   /* 存完 2.6 秒後會跳「共用密碼太短」提醒（測試資料是 0000），關掉 */
  console.log(w,'saved',JSON.stringify(await S(p)),await p.evaluate(i=>state.events.find(e=>e.id===i).name,id),'commit:',(st.commits[0]||'').split('\n')[0]);
  /* 取消會還原 */
  if(w>=1000){await p.click('#evDetail .card-edit-btn');await p.waitForTimeout(600);await p.click('#evDetail [data-evpen=desc]');await p.fill('#evDetail .evf.open [data-e=desc]','不要存');await p.click('#evDetail [data-evfx=ok]');await p.waitForTimeout(300);
    await p.click('#evDetail [data-edcancel]');await p.waitForTimeout(800);console.log(w,'cancel reverted',await p.evaluate(i=>state.events.find(e=>e.id===i).desc!=='不要存',id),JSON.stringify(await S(p)))}
  /* 進度：新增議題＝開始編輯空白議題；取消就不留 */
  await p.evaluate(()=>{setSection('progress',{instant:true});progShow(null)});await p.waitForTimeout(700);
  const n0=await p.evaluate(()=>state.issues.length);
  console.log(w,'gantt edit btn',await vis(p,'#ganttEdBtn'),'add issue',await vis(p,'#addIssue'));
  await p.click('#addIssue');await p.waitForTimeout(900);
  console.log(w,'new issue',JSON.stringify(await S(p)),'title open',!!(await p.$('#cardDetail .evf.open [data-e=title]')),'tools',await vis(p,'#cardDetail .card-tools'));
  await p.click('#cardDetail [data-edcancel]');await p.waitForTimeout(900);console.log(w,'cancel new issue',await p.evaluate(()=>state.issues.length)===n0,JSON.stringify(await S(p)));
  /* 甘特圖時間軸：整區編輯 */
  await p.evaluate(()=>progShow(null));await p.waitForTimeout(500);await p.click('#ganttEdBtn');await p.waitForTimeout(600);
  console.log(w,'gantt edit',JSON.stringify(await S(p)),'range',await vis(p,'#pvGantt .range'));
  await p.click('#pvGantt [data-edcancel]');await p.waitForTimeout(700);
  /* 議題詳情的「編輯」 */
  const iid=await p.evaluate(()=>activeIssues()[0].id);await p.evaluate(i=>progShow(i),iid);await p.waitForTimeout(800);
  console.log(w,'issue edit btn',await vis(p,'#cardDetail .card-edit-btn'),'tools hidden',await vis(p,'#cardDetail .card-tools'));
  await p.click('#cardDetail .card-edit-btn');await p.waitForTimeout(700);console.log(w,'issue editing',JSON.stringify(await S(p)),'tools',await vis(p,'#cardDetail .card-tools'));
  await p.click('#cardDetail [data-edcancel]');await p.waitForTimeout(700);
  /* 完成紀錄：展開才有「編輯」 */
  await p.evaluate(()=>setSection('done',{instant:true}));await p.waitForTimeout(600);
  const did=await p.evaluate(()=>document.querySelector('.done-ev').dataset.done);
  await p.click(`.done-ev[data-done="${did}"]>summary`);await p.waitForTimeout(900);
  const dbtn=w<1000?`.done-ev[data-done="${did}"] .card-edit-btn`:'#doneDetail .card-edit-btn';
  console.log(w,'done edit visible',await vis(p,dbtn));
  await p.click(dbtn);await p.waitForTimeout(700);console.log(w,'done editing',JSON.stringify(await S(p)),'fields',await vis(p,'.sec-edit .evfs'));
  await p.screenshot({path:`ed_${w}.png`});
  await p.click('.sec-edit [data-edcancel]');await p.waitForTimeout(700);
  /* 週報頁：登入就有新增、編輯 */
  console.log(w,'week buttons',await p.evaluate(()=>[...document.querySelectorAll('#addWeek,[data-editweek]')].filter(e=>getComputedStyle(e).display!=='none').length));
  console.log(w,'errs',JSON.stringify(p.errs));await b.close();
}
})();
