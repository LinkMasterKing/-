const {chromium}=require('playwright');const fs=require('fs');
const URL='http://127.0.0.1:8300/index.html';
const log=(...a)=>console.log(a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '));
(async()=>{const b=await chromium.launch();
let remote=JSON.parse(fs.readFileSync(process.env.DATA||'data_v5.json','utf8')),sha='s0',commits=[];
const mk=async({w=960,h=900,sc='light',touch=false}={})=>{
  const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:sc,hasTouch:touch,isMobile:touch,deviceScaleFactor:touch?2:1,serviceWorkers:'block'});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url();
    if(u.includes('/commits?'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(commits)});
    if(q.method()==='GET')return r.fulfill({status:200,contentType:'application/json',headers:{ETag:'"'+sha+'"'},body:JSON.stringify({sha,content:Buffer.from(JSON.stringify(remote)).toString('base64')})});
    const bd=JSON.parse(q.postData());if(bd.sha!==sha)return r.fulfill({status:409,body:'{}'});
    remote=JSON.parse(Buffer.from(bd.content,'base64').toString());sha='s'+(commits.length+1);commits.unshift({sha,commit:{message:bd.message,committer:{date:new Date().toISOString()}}});
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha}})})});
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>{if(m.type()==='error')p.errs.push('console:'+m.text())});
  await p.goto(URL);await p.waitForFunction(()=>document.body&&!document.body.classList.contains('intro')&&document.querySelector('#tabbar .tab'));await p.waitForTimeout(900);
  return {p,ctx};
};
const ok=p=>p.click('#dlgForm [data-act=ok]');const dlgTitle=p=>p.evaluate(()=>$('#dlg').open?($('#dlgForm b')||{}).textContent:null);
const sts=p=>p.$$eval('.events .ev',x=>x.map(e=>e.querySelector('b').textContent+':'+e.dataset.st+':'+getComputedStyle(e).backgroundColor));
const evByName=(p,n)=>p.evaluateHandle(n=>[...document.querySelectorAll('.events .ev')].find(e=>e.querySelector('b').textContent===n),n);
{const {p}=await mk();
 log('statuses:',await sts(p));
 await p.screenshot({path:'ev_d_light.png'});
 // 登入並進入編輯
 await p.evaluate(()=>localStorage.setItem('workboard:ghtoken','TOK_A_123'));
 await p.click('#editBtn');await p.waitForTimeout(500);log('dlg:',await dlgTitle(p));
 await p.fill('#dlgForm input[name=pw]','0000');await ok(p);await p.waitForTimeout(500);
 await p.fill('#dlgForm input[name=name]','王小明');await p.fill('#dlgForm input[name=p1]','wang-password-1');await p.fill('#dlgForm input[name=p2]','wang-password-1');await ok(p);await p.waitForTimeout(2500);await (async()=>{for(let i=0;i<4;i++){await p.waitForTimeout(500);const t=await p.$eval('#dlg[open] #dlgForm>b',b=>b.textContent).catch(()=>'');if(/共用密碼太短|沒有連上雲端/.test(t))await p.click('#dlgForm [data-act=cancel]').catch(()=>{})}})();   /* 2026-11-05：建立第一個身分後，共用密碼 0000 會請管理員換（team.js 的 sharedPwFix），測試先取消 */
 log('editing:',await p.evaluate(()=>editing),await dlgTitle(p));
 // 展開「停車場公告：」
 let ev=await evByName(p,'停車場公告：');await (await (ev=await evByName(p,'停車場公告：')).$('summary')).click();await p.waitForTimeout(800);
 log('tools:',await ev.$$eval('.ev-tools button',x=>x.map(b=>b.textContent)));
 // 加時間：開會 11/03 14:00 寫進母議題
 await (await (ev=await evByName(p,'停車場公告：')).$('[data-addevtime]')).click();await p.waitForTimeout(400);log('tdlg:',await dlgTitle(p));
 await p.fill('#dlgForm input[name=label]','與總務處開會');await p.fill('#dlgForm input[name=sd]','2026-11-03');await p.fill('#dlgForm input[name=st]','1400');
 await p.fill('#dlgForm input[name=et]','15:30');await p.click('#dlgForm .fld-check');await ok(p);await p.waitForTimeout(600);
 // 無效時刻
 await (await (ev=await evByName(p,'停車場公告：')).$('[data-addevtime]')).click();await p.waitForTimeout(400);
 await p.fill('#dlgForm input[name=label]','壞時間');await p.fill('#dlgForm input[name=st]','25:00');await ok(p);await p.waitForTimeout(500);
 log('invalid -> toast:',await p.textContent('#toast'),'reopened:',await dlgTitle(p),'kept label:',await p.inputValue('#dlgForm input[name=label]'));
 await p.click('#dlgForm [data-act=cancel]');await p.waitForTimeout(400);
 // 期間（只有日期）、過去時間
 await (await (ev=await evByName(p,'停車場公告：')).$('[data-addevtime]')).click();await p.waitForTimeout(400);
 await p.fill('#dlgForm input[name=label]','公告期間');await p.fill('#dlgForm input[name=sd]','2026-11-03');await p.fill('#dlgForm input[name=ed]','2026-11-10');await ok(p);await p.waitForTimeout(600);
 await (await (ev=await evByName(p,'停車場公告：')).$('[data-addevtime]')).click();await p.waitForTimeout(400);
 await p.fill('#dlgForm input[name=label]','移除過期公告');await p.fill('#dlgForm input[name=sd]','2026-10-30');await p.fill('#dlgForm input[name=st]','9:30');await ok(p);await p.waitForTimeout(600);
 ev=await evByName(p,'停車場公告：');log('times:',await ev.$$eval('.ev-times li',x=>x.map(l=>l.innerText.replace(/\s+/g,' '))));
 log('meta:',await ev.$eval('.ev-meta',x=>x.innerText),'st:',await ev.evaluate(e=>e.dataset.st));
 log('parent markers:',await p.evaluate(()=>state.issues.find(i=>i.id==='imvpc3f0dcpi6').markers.filter(m=>m.tmId).map(m=>m.text+'@'+m.date)));
 await p.screenshot({path:'ev_d_edit_open.png'});
 // 完成這一段
 await (await (ev=await evByName(p,'停車場公告：')).$('[data-evround]')).click();await p.waitForTimeout(400);log('rdlg:',await dlgTitle(p));
 await p.fill('#dlgForm textarea[name=done]','已移除過期公告');await p.fill('#dlgForm textarea[name=next]','等總務處回覆新公告內容');
 await p.screenshot({path:'ev_d_round_dlg.png'});await ok(p);await p.waitForTimeout(900);
 log('toast:',await p.textContent('#toast'));
 ev=await evByName(p,'停車場公告：');
 log('after round:',await ev.evaluate(e=>({st:e.dataset.st,meta:e.querySelector('.ev-meta').innerText,desc:e.querySelectorAll('.ev-body>p')[2]?.innerText,times:[...e.querySelectorAll('.ev-times li')].length})));
 log('done list top:',await p.$$eval('#doneList .done-item summary .t',x=>x.slice(0,3).map(t=>t.textContent)));
 log('rec:',await p.evaluate(()=>{const r=state.events.find(e=>e.fromEv);return {round:r.round,times:r.times.map(t=>t.label),issue:r.issueId,desc:r.desc}}));
 log('parent markers after:',await p.evaluate(()=>state.issues.find(i=>i.id==='imvpc3f0dcpi6').markers.filter(m=>m.evId).map(m=>m.text+'@'+m.date+(m.tmId?'(t)':''))));
 log('undo btn on rec:',await p.evaluate(()=>{const r=state.events.find(e=>e.fromEv);return !!document.querySelector(`#doneList [data-ev="${r.id}"] [data-evundo]`)}));
 // 結案另一張
 await (await evByName(p,'狀態測試紅')).asElement().$('summary').then(x=>x.click());await p.waitForTimeout(700);await (await evByName(p,'狀態測試紅')).asElement().$('[data-evdone]').then(x=>x.click());await p.waitForTimeout(800);
 log('closed toast:',await p.textContent('#toast'),'| live count:',await p.$$eval('.events .ev',x=>x.length));
 // 編輯時間（刪除）
 ev=await evByName(p,'停車場公告：');
 const eb=await (ev=await evByName(p,'停車場公告：')).$('[data-evtime]');await eb.click();await p.waitForTimeout(400);log('edit tdlg:',await dlgTitle(p),await p.inputValue('#dlgForm input[name=st]'));await p.click('#dlgForm [data-act=delete]');await p.waitForTimeout(600);
 ev=await evByName(p,'停車場公告：');log('times after delete:',await ev.$$eval('.ev-times li',x=>x.length));
 // 議題卡片裡的小膠囊
 await p.click('#tabbar [data-tab=progress]');await p.waitForTimeout(900);await p.evaluate(()=>{openIds.add('imvpc3f0dcpi6');render()});await p.waitForTimeout(600);log('kid evs:',await p.$$eval('.kid-ev',x=>x.map(k=>k.textContent+':'+k.dataset.st)));
 // 存檔
 await p.click('#saveBtn').catch(()=>{});await p.waitForTimeout(3000);
 log('commit:',commits[0]?commits[0].commit.message:'(none)');
 log('remote v:',remote.schemaVersion,'events:',remote.events.length);
 log('errors:',p.errs);
 await p.click('#tabbar [data-tab=done]').catch(()=>{});await p.waitForTimeout(900);await p.screenshot({path:'ev_d_done.png'});
}
// 深色、手機
{const {p}=await mk({sc:'dark'});await p.screenshot({path:'ev_d_dark.png'});
 let ev=await evByName(p,'停車場公告：');await (await (ev=await evByName(p,'停車場公告：')).$('summary')).click();await p.waitForTimeout(900);await p.screenshot({path:'ev_d_dark_open.png'});log('dark errs',p.errs)}
{const {p}=await mk({w:390,h:844,touch:true});await p.screenshot({path:'ev_m.png'});
 let ev=await evByName(p,'停車場公告：');await (await (ev=await evByName(p,'停車場公告：')).$('summary')).click();await p.waitForTimeout(900);await p.screenshot({path:'ev_m_open.png'});log('mobile errs',p.errs)}
await b.close()})();
