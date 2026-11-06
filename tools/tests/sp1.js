const {chromium}=require('playwright');const fs=require('fs');
const log=(...a)=>console.log(a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '));
(async()=>{const b=await chromium.launch();
let remote=JSON.parse(fs.readFileSync('data_test.json','utf8')),sha='s0',commits=[{sha:'c1',commit:{message:'〔測試〕即時回報｜新增｜A\n\nBoard-Log: 1',committer:{date:'2026-10-30T10:00:00Z'}}}];
const mk=async(w,h,sc,touch)=>{const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:sc,hasTouch:touch,isMobile:touch,deviceScaleFactor:touch?2:1,serviceWorkers:'block'});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url();
    if(u.includes('/commits?'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(commits)});
    if(q.method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha,content:Buffer.from(JSON.stringify(remote)).toString('base64')})});
    const bd=JSON.parse(q.postData());remote=JSON.parse(Buffer.from(bd.content,'base64').toString());sha='s'+Date.now();commits.unshift({sha,commit:{message:bd.message,committer:{date:new Date().toISOString()}}});
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha}})})});
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>{if(m.type()==='error')p.errs.push(m.text())});
  await p.goto('http://127.0.0.1:8300/index.html');await p.waitForTimeout(1800);return {p,ctx}};
const ok=p=>p.click('#dlg [data-act=ok]');
const st=p=>p.evaluate(()=>{const d=document.querySelector('#dlg'),sc=document.querySelector('#setOv .set-scroll'),pn=document.querySelector('#setOv .set-pane');return {paneKey,split:document.querySelector('#setOv .set-body').classList.contains('split'),dlgOpen:d.open,inPane:d.classList.contains('in-pane'),dlgParent:d.parentNode.className||d.parentNode.tagName,title:(d.querySelector('form>b')||{}).textContent,sc:Math.round(sc.getBoundingClientRect().width),pane:pn.hidden?0:Math.round(pn.getBoundingClientRect().width),cur:[...document.querySelectorAll('#setOv .set-row[aria-current]')].map(r=>r.dataset.set)}});
const login=async p=>{await p.click('#setOv .set-gate .primary');await p.waitForTimeout(500);
  log(' login dlg:',await p.evaluate(()=>[document.querySelector('#dlg form>b').textContent,document.querySelector('#dlg').classList.contains('in-pane')]));
  await p.fill('#dlg input[name=pw]','0000');await ok(p);await p.waitForTimeout(600);
  await p.fill('#dlg input[name=name]','王小明');await p.fill('#dlg input[name=p1]','wang-password-1');await p.fill('#dlg input[name=p2]','wang-password-1');await ok(p);await p.waitForTimeout(1500);await (async()=>{for(let i=0;i<4;i++){await p.waitForTimeout(500);const t=await p.$eval('#dlg[open] #dlgForm>b',b=>b.textContent).catch(()=>'');if(/共用密碼太短|沒有連上雲端/.test(t))await p.click('#dlgForm [data-act=cancel]').catch(()=>{})}})();};   /* 2026-11-05：建立第一個身分後，共用密碼 0000 會請管理員換（team.js 的 sharedPwFix），測試先取消 */
{const {p}=await mk(1300,820,'dark',false);
 await p.evaluate(()=>localStorage.setItem('workboard:ghtoken','TOK_A_123'));
 await p.click('#setBtn');await p.waitForTimeout(700);
 log('gate:',await p.evaluate(()=>({gate:!!document.querySelector('#setOv .set-gate-ico'),anims:document.querySelector('#setOv .gate-shackle').getAnimations().length,rows:document.querySelectorAll('#setOv .set-row').length})));
 await p.waitForTimeout(500);await p.screenshot({path:'sp_gate.png'});
 await login(p);log('after login rows:',await p.evaluate(()=>document.querySelectorAll('#setOv .set-row').length));
 await p.screenshot({path:'sp_list.png'});
 await p.click('#setOv [data-set=title]');await p.waitForTimeout(800);log('title:',await st(p));await p.screenshot({path:'sp_title.png'});
 await p.click('#setOv [data-set=log]');await p.waitForTimeout(1000);log('log:',await st(p),await p.evaluate(()=>[document.querySelector('#logOv').classList.contains('in-pane'),document.querySelectorAll('#logList .lg-item').length]));await p.screenshot({path:'sp_log.png'});
 await p.click('#setOv [data-set=team]');await p.waitForTimeout(900);log('team:',await st(p));await p.screenshot({path:'sp_team.png'});
 // 專員名單已拿掉（schemaVersion 8，專員＝身分）：只確認沒有專員名單區
 log('no staff list:',!(await p.$('#newStaff')));
 await p.click('#dlg [data-x=done]');await p.waitForTimeout(1500);log('team done:',await st(p));
 // 標籤（人事時地物）：新增一個「地」標籤
 await p.click('#setOv [data-set=labels]');await p.waitForTimeout(800);await p.fill('#dlg [data-newlbl="地"]','六宿');await p.click('#dlg [data-x=add][data-k="地"]');await p.waitForTimeout(300);
 await p.click('#dlg [data-x=done]');await p.waitForTimeout(2500);log('labels:',await p.evaluate(()=>state.labels.map(l=>l.kind+l.name)),'commit:',commits[0].commit.message.split('\n')[0]);
 await p.screenshot({path:'sp_back.png'});
 // 2026-11-06 設定頁整理：沒有小標題；學年與開學日只有秘書處有（tm1.js）；網站管理只給後台管理員
 log('list:',await p.evaluate(()=>({rows:[...document.querySelectorAll('#setOv .set-inner .set-row')].map(r=>r.dataset.set),heads:document.querySelectorAll('#setOv .set-h').length,logo:!!document.querySelector('#setOv .set-top .logo'),k:!!document.querySelector('#setOv .anim-k')})));
 await p.evaluate(()=>{localStorage.setItem('workboard:siteadmin','1');renderSettings()});await p.waitForTimeout(400);
 log('site row after mark:',await p.evaluate(()=>!!document.querySelector('#setOv [data-set=site]')));
 const hub=()=>p.evaluate(()=>{const h=document.querySelector('#setOv .set-pane .set-hub');return h&&{t:h.querySelector('.set-hub-t').textContent,hidden:h.hidden,rows:[...h.querySelectorAll('[data-hub]')].map(r=>r.dataset.hub)}});
 await p.click('#setOv [data-set=site]');await p.waitForTimeout(800);log('site hub:',await hub(),await st(p));await p.screenshot({path:'sp_site.png'});
 await p.click('#setOv [data-hub=cloud]');await p.waitForTimeout(800);log('cloud in hub:',await hub(),await st(p));
 await p.keyboard.press('Escape');await p.waitForTimeout(800);log('esc1 -> hub:',await hub(),await st(p));
 await p.keyboard.press('Escape');await p.waitForTimeout(800);log('esc2 -> list:',await hub(),await st(p));
 await p.click('#setOv [data-set=report]');await p.waitForTimeout(700);log('report hub:',await hub());
 await p.click('#setOv [data-hub=report]');await p.waitForTimeout(800);log('work report dlg:',await st(p));
 await p.click('#setOv [data-set=backup]');await p.waitForTimeout(900);log('switch to backup:',await hub(),await st(p));
 await p.click('#setOv [data-set=backup]');await p.waitForTimeout(800);log('reclick closes:',await st(p));
 await p.click('#setOv [data-set=device]');await p.waitForTimeout(700);log('device hub:',await hub(),await p.evaluate(()=>!!document.querySelector('#setOv .set-hub .set-p')));
 await p.keyboard.press('Escape');await p.waitForTimeout(700);await p.keyboard.press('Escape');await p.waitForTimeout(700);
 log('settings closed:',await p.evaluate(()=>setOpen));
 // 主頁開對話框應該是跳出的
 await p.click('#editBtn');await p.waitForTimeout(800);await p.click('#addEvent').catch(()=>{});await p.waitForTimeout(500);
 log('main dlg modal:',await p.evaluate(()=>{const d=document.querySelector('#dlg');return [d.open,d.classList.contains('in-pane'),d.parentNode.tagName,getComputedStyle(d).position]}));
 await p.screenshot({path:'sp_main_dlg.png'});
 log('errs',p.errs);}
{const {p}=await mk(1300,820,'light',false);await p.click('#setBtn');await p.waitForTimeout(900);await p.screenshot({path:'sp_gate_light.png'});log('light errs',p.errs)}
remote=JSON.parse(fs.readFileSync('data_test.json','utf8'));   /* 手機重新從舊版看板開始 */
{const {p}=await mk(390,844,'dark',true);
 await p.click('#setBtn');await p.waitForTimeout(800);await p.screenshot({path:'sp_m_gate.png'});
 await login(p);await p.click('#setOv [data-set=title]');await p.waitForTimeout(700);log('mobile title:',await st(p));await p.screenshot({path:'sp_m_title.png'});
 await p.click('#dlg [data-act=cancel]');await p.waitForTimeout(900);
 const sub=()=>p.evaluate(()=>({sub:subOpen,set:setOpen,subHidden:document.querySelector('#setSub').hidden,listHidden:document.querySelector('#setOv').hidden,hub:(()=>{const h=document.querySelector('#setSub .set-hub');return h&&{hidden:h.hidden,rows:[...h.querySelectorAll('[data-hub]')].map(r=>r.dataset.hub)}})(),dlg:document.querySelector('#dlg').open,logo:!!document.querySelector('#setSub .set-top .logo')}));
 await p.click('#setOv [data-set=report]');await p.waitForTimeout(900);log('m report hub:',await sub());await p.screenshot({path:'sp_m_hub.png'});
 await p.click('#setSub [data-hub=report]');await p.waitForTimeout(900);log('m work report:',await sub());
 await p.goBack();await p.waitForTimeout(900);log('m system back -> hub:',await sub());
 await p.click('#subBack');await p.waitForTimeout(900);log('m back -> list:',await sub());
 await p.click('#setOv [data-set=report]');await p.waitForTimeout(900);
 await p.click('#setSub [data-hub=week]');await p.waitForTimeout(1300);log('m week from hub:',await sub(),await p.evaluate(()=>onWeek));
 await p.click('#backMain');await p.waitForTimeout(1300);log('m week back -> settings:',await sub(),await p.evaluate(()=>onWeek));
 log('m errs',p.errs)}
await b.close()})();
