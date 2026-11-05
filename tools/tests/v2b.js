// 新介面結構：補充測試（身分與專員、匯出匯入、週報與議題刪除、唯讀、減少動態、忘記裝置）
const {chromium}=require('playwright');const fs=require('fs');
const URL='http://127.0.0.1:8300/index.html';
const out=[];const log=(...a)=>{const s=a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ');out.push(s);console.log(s)};
(async()=>{const b=await chromium.launch();
let remote=JSON.parse(fs.readFileSync('data_test.json','utf8')),sha='s0',commits=[];
const ctx=await b.newContext({viewport:{width:1300,height:860},colorScheme:'light',acceptDownloads:true,serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url();
  if(u.includes('/commits?'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(commits)});
  if(q.method()==='GET')return r.fulfill({status:200,contentType:'application/json',headers:{ETag:'"'+sha+'"'},body:JSON.stringify({sha,content:Buffer.from(JSON.stringify(remote)).toString('base64')})});
  const bd=JSON.parse(q.postData());if(bd.sha!==sha)return r.fulfill({status:409,body:'{}'});
  remote=JSON.parse(Buffer.from(bd.content,'base64').toString());sha='s'+(commits.length+1);commits.unshift({sha,commit:{message:bd.message,committer:{date:new Date().toISOString()}}});
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha}})})});
await ctx.addInitScript(()=>{window.showSaveFilePicker=undefined});
const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
const go=async()=>{await p.goto(URL);await p.waitForFunction(()=>document.body&&!document.body.classList.contains('intro')&&document.querySelector('#tabbar .tab'));await p.waitForTimeout(900)};
const ok=()=>p.click('#dlgForm [data-act=ok]');const dlgTitle=()=>p.evaluate(()=>$('#dlg').open?($('#dlgForm b')||{}).textContent:null);
await go();await p.evaluate(()=>localStorage.setItem('workboard:ghtoken','TOK_A_123'));
// 身分與專員（從設定頁）：先登入（舊版看板流程）
await p.click('#setBtn');await p.waitForTimeout(500);await p.click('#setOv .set-gate .primary');await p.waitForTimeout(400);
await p.fill('#dlgForm input[name=pw]','0000');await ok();await p.waitForTimeout(500);
await p.fill('#dlgForm input[name=name]','王小明');await p.fill('#dlgForm input[name=p1]','wang-password-1');await p.fill('#dlgForm input[name=p2]','wang-password-1');await ok();await p.waitForTimeout(2500);
await p.click('#setOv [data-set=team]');await p.waitForTimeout(700);
log('team dlg:',await p.evaluate(()=>$('#dlg').open&&!!document.querySelector('[data-x=done]')),await p.textContent('.tm-note:last-of-type'));
await p.fill('#newStaff','陳專員');await p.click('[data-x=addstaff]');await p.waitForTimeout(300);await p.click('[data-x=done]');await p.waitForTimeout(2500);
log('team saved:',commits[0]&&commits[0].commit.message.split('\n')[0],'| remote staff:',remote.staff.map(s=>s.name));
// 匯出定型版、匯出備份、匯入備份
const dl1=p.waitForEvent('download',{timeout:8000});await p.click('#setOv [data-set=exportLocked]');const d1=await dl1.catch(e=>null);
log('export locked:',d1&&d1.suggestedFilename());await p.waitForTimeout(300);await p.click('#dlgForm [data-x=close]');await p.waitForTimeout(500);
const dl2=p.waitForEvent('download',{timeout:8000});await p.click('#setOv [data-set=exportEdit]');const d2=await dl2.catch(e=>null);
log('export backup:',d2&&d2.suggestedFilename());await p.waitForTimeout(300);await p.click('#dlgForm [data-x=close]');await p.waitForTimeout(500);
const fc=p.waitForEvent('filechooser',{timeout:5000});await p.click('#setOv [data-set=import]');const f=await fc.catch(e=>null);log('import chooser:',!!f);
await p.$eval('#setOv [data-set=report]',e=>e.scrollIntoView({block:'center'}));await p.click('#setOv [data-set=report]');await p.waitForTimeout(400);log('report dlg:',await dlgTitle());await p.keyboard.press('Escape');await p.waitForTimeout(400);
await p.click('#setClose');await p.waitForTimeout(400);
// 編輯中：週報摘要列的刪除、議題卡片的刪除
await p.click('#editBtn');await p.waitForTimeout(900);
await p.click('#weekBtn');await p.waitForTimeout(1300);
log('week del visible:',await p.$$eval('.week .week-del',x=>x.filter(e=>e.offsetParent).length),'| tools del:',await p.$$eval('.week-tools [data-delweek]',x=>x.length));
await p.screenshot({path:'v2b_week_edit.png'});
const w0=await p.$('#weekList .week');const wasOpen=await w0.evaluate(d=>d.open);await (await w0.$('.week-del')).click();await p.waitForTimeout(500);
log('week del dlg:',await dlgTitle(),'| open unchanged:',wasOpen===await w0.evaluate(d=>d.open));await p.keyboard.press('Escape');await p.waitForTimeout(400);
await p.click('#backMain');await p.waitForTimeout(900);await p.click('#tabbar [data-tab=progress]');await p.waitForTimeout(900);
await p.click('.card-tools [data-delissue]');await p.waitForTimeout(500);log('issue del dlg:',await dlgTitle());await p.keyboard.press('Escape');await p.waitForTimeout(400);
// 編輯中改設定：併入這次編輯
await p.click('#setBtn');await p.waitForTimeout(500);await p.click('#setOv [data-set=year]');await p.waitForTimeout(400);await p.fill('#dlgForm input[name=v]','115學年度');await ok();await p.waitForTimeout(600);
log('setting while editing:',await p.textContent('#toast'),'| dirty:',await p.evaluate(()=>dirty),'| commits:',commits.length);
await p.click('#setClose');await p.waitForTimeout(400);await p.click('#saveBtn');await p.waitForTimeout(3000);
log('saved with edit:',commits[0].commit.message.split('\n')[0]);
// 忘記這台裝置
await p.evaluate(async()=>{await remSave(meMember())});await p.click('#setBtn');await p.waitForTimeout(500);
log('forget row:',await p.$eval('#setOv [data-set=forget]',e=>e.textContent+'|'+e.getAttribute('aria-disabled')));
await p.$eval('#setOv [data-set=forget]',e=>e.scrollIntoView({block:'center'}));await p.waitForTimeout(200);await p.click('#setOv [data-set=forget]');await p.waitForTimeout(300);
log('after forget:',await p.evaluate(()=>({rem:localStorage.getItem(REM_KEY),logged:loggedIn()})),await p.textContent('#toast'));
await p.click('#setClose');await p.waitForTimeout(400);
// 唯讀（定型版）
await p.evaluate(()=>{state.locked=true;render()});await p.waitForTimeout(300);
log('locked header:',await p.$$eval('.hero-rule .actions button',x=>x.map(b=>b.id)));
await p.click('#setBtn');await p.waitForTimeout(500);log('locked settings:',await p.$$eval('#setOv .set-h',x=>x.map(h=>h.textContent)));
await p.click('#setClose');await p.waitForTimeout(400);
log('errs:',p.errs);
// 減少動態
await p.emulateMedia({reducedMotion:'reduce'});await go();
await p.click('#tabbar [data-tab=done]');log('reduced anims:',await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&a.effect&&a.effect.target&&a.effect.target.closest&&a.effect.target.closest('.layout')).length),'cur:',await p.evaluate(()=>curSec));
log('errs2:',p.errs);
await b.close();fs.writeFileSync('v2b_report.txt',out.join('\n'));
})();
