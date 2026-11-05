/* se1：分區編輯。頁首「編輯」登入後，各區只出現「編輯這區」，編輯工具都還沒出現；
   按了哪一區只有那一區出現編輯工具（即時回報：刪除鈕、新增格、展開後工具列、拖曳；進度：時間軸範圍、新增議題、卡片工具；完成紀錄：刪除鈕）；
   一次只能開一區（開進度時即時回報自動收起）；再按一次收起；取消後全部回檢視、再進編輯時各區都是關的。桌面 1300 與手機 412。固定 8300 埠 */
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
console.log(tag,'view',JSON.stringify(await st()));
await p.click('#editBtn');await p.waitForTimeout(400);
await p.fill('#dlgForm input[name=pw]','0000').catch(()=>{});await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(500);
await p.fill('#dlgForm input[name=name]','王').catch(()=>{});await p.fill('#dlgForm input[name=p1]','password-long-1').catch(()=>{});await p.fill('#dlgForm input[name=p2]','password-long-1').catch(()=>{});await p.click('#dlgForm [data-act=ok]').catch(()=>{});await p.waitForTimeout(1500);
console.log(tag,'edit, no section',JSON.stringify(await st()));
// 檢視中的連結在編輯狀態（這區沒開）仍是真連結
console.log(tag,'drag handle off?',await p.evaluate(()=>getComputedStyle(document.querySelector('#events .ev>summary')).cursor));
await p.click('[data-secedit=done]').catch(()=>{});await p.waitForTimeout(700);
console.log(tag,'done on（即時回報一直是逐欄編輯）',JSON.stringify(await st()),'cursor',await p.evaluate(()=>getComputedStyle(document.querySelector('#events .ev>summary')).cursor));
await p.locator('#livePanel').screenshot({path:`se_${tag}_live.png`});
if(tag==='m'){await p.click('#tabbar [data-tab=progress]').catch(()=>{});await p.waitForTimeout(700)}
await p.click('[data-secedit=progress]');await p.waitForTimeout(700);
console.log(tag,'progress (done should close)',JSON.stringify(await st()));
await p.click('[data-secedit=progress]');await p.waitForTimeout(500);
console.log(tag,'progress again (should close)',JSON.stringify(await st()));
await p.click('#cancelBtn');await p.waitForTimeout(800);
console.log(tag,'cancelled',JSON.stringify(await st()));
await p.click('#editBtn');await p.waitForTimeout(800);if(await p.$('#dlg[open]')){await p.fill('#dlgForm input[type=password]','password-long-1').catch(()=>{});await p.click('#dlgForm [data-act=ok]').catch(()=>{});await p.waitForTimeout(900)}
console.log(tag,'re-enter',JSON.stringify(await st()));
await p.screenshot({path:`se_${tag}_reenter.png`});
console.log(tag,'errs',errs);await ctx.close()}
await b.close()})();
