/* se1：編輯的分區規則（2026-11-05 改）。權益部看板：即時回報、進度、完成紀錄都是「點欄位直接改」，頁首「編輯」後三區的編輯工具一起出現，
   看板上沒有任何「編輯這區」；取消後全部回檢視、再進編輯時又一起出現。（會長室「追蹤」的「編輯這區」由 mt1.js 涵蓋）
   桌面 1300 與手機 412。固定 8300 埠 */
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();
let remote=JSON.parse(fs.readFileSync('data_v5.json','utf8')),sha='s0';
for(const [w,h,tag] of [[1300,900,'d'],[412,900,'m']]){
remote=JSON.parse(fs.readFileSync('data_v5.json','utf8'));sha='s0';
const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:'dark',serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url();if(u.includes('/commits?'))return r.fulfill({status:200,contentType:'application/json',body:'[]'});
 if(q.method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha,content:Buffer.from(JSON.stringify(remote)).toString('base64')})});
 const bd=JSON.parse(q.postData());remote=JSON.parse(Buffer.from(bd.content,'base64').toString());sha='s'+Date.now();return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha}})})});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8300/index.html');await p.waitForTimeout(1800);
await p.evaluate(()=>localStorage.setItem('workboard:ghtoken','T'));
const st=()=>p.evaluate(()=>{const vis=s=>[...document.querySelectorAll(s)].filter(x=>x.offsetParent!==null).length;
  return {editing,secs:[...secEdit].join(','),btns:vis('[data-secedit]'),btnTxt:[...document.querySelectorAll('[data-secedit]')].map(x=>x.dataset.secedit+':'+x.textContent+':'+x.getAttribute('aria-pressed')).join(' '),
   evDel:vis('#events .ev-del'),pens:document.querySelectorAll('#events [data-evpen]').length,addEv:vis('#addEvent'),evTools:document.querySelectorAll('#events .ev-tools').length,range:vis('.range'),addIssue:vis('#addIssue'),doneDel:vis('#doneList .ev-del')}});
let bad=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+tag+' '+m);if(!c)bad++};
const tools=s=>s.evDel>0&&s.pens>0&&s.range>0&&s.addIssue>0;
let s0=await st();ok(!s0.editing&&s0.evDel===0&&s0.pens===0&&s0.addIssue===0,'檢視中沒有編輯工具');
await p.click('#editBtn');await p.waitForTimeout(400);
await p.fill('#dlgForm input[name=pw]','0000').catch(()=>{});await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(500);
await p.fill('#dlgForm input[name=name]','王').catch(()=>{});await p.fill('#dlgForm input[name=p1]','password-long-1').catch(()=>{});await p.fill('#dlgForm input[name=p2]','password-long-1').catch(()=>{});await p.click('#dlgForm [data-act=ok]').catch(()=>{});await p.waitForTimeout(1500);
/* 手機一次只顯示一區：range、addIssue 在進度區，先各看一次 */
const all=async()=>{const a=await st();if(tag!=='m')return a;await p.evaluate(()=>setSection('progress',{instant:true}));await p.waitForTimeout(400);const b2=await st();
  await p.evaluate(()=>setSection('done',{instant:true}));await p.waitForTimeout(400);const c=await st();await p.evaluate(()=>setSection('live',{instant:true}));await p.waitForTimeout(400);
  return {...a,range:b2.range,addIssue:b2.addIssue,doneDel:c.doneDel}};
let s1=await all();
ok(s1.editing&&tools(s1)&&s1.doneDel>0,'按「編輯」後三區的編輯工具一起出現 '+JSON.stringify(s1));
ok(s1.btns===0,'權益部看板沒有「編輯這區」');
await p.click('#cancelBtn');await p.waitForTimeout(800);
let s2=await st();ok(!s2.editing&&s2.evDel===0&&s2.pens===0,'取消後回檢視');
await p.click('#editBtn');await p.waitForTimeout(800);if(await p.$('#dlg[open]')){await p.fill('#dlgForm input[type=password]','password-long-1').catch(()=>{});await p.click('#dlgForm [data-act=ok]').catch(()=>{});await p.waitForTimeout(900)}
let s3=await all();ok(s3.editing&&tools(s3),'再進編輯時又一起出現');
ok(!errs.length,'沒有錯誤 '+errs.join(' | '));
if(bad)process.exitCode=1;
await ctx.close()}
await b.close()})();
