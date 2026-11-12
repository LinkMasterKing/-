// 新介面結構：功能測試（模擬 GitHub）
const {chromium}=require('playwright');const fs=require('fs');
const URL=process.env.URL||'http://127.0.0.1:8300/index.html';
const A=(ok,m)=>{if(!ok){console.log('FAIL:',m);process.exitCode=1}};   /* 2026-11-11：關鍵結果逐項判斷，壞了以非 0 結束 */
const out=[];const log=(...a)=>{const s=a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ');out.push(s);console.log(s)};
(async()=>{const b=await chromium.launch();
let remote=JSON.parse(fs.readFileSync('data_test.json','utf8')),sha='s0',commits=[];
const mk=async({w=1300,h=860,sc='light',touch=false}={})=>{
  const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:sc,hasTouch:touch,isMobile:touch,deviceScaleFactor:touch?2:1,serviceWorkers:'block'});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url();
    if(u.includes('/commits?'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(commits)});
    if(q.method()==='GET')return r.fulfill({status:200,contentType:'application/json',headers:{ETag:'"'+sha+'"'},body:JSON.stringify({sha,content:Buffer.from(JSON.stringify(remote)).toString('base64')})});
    const bd=JSON.parse(q.postData());if(bd.sha!==sha)return r.fulfill({status:409,body:'{}'});
    remote=JSON.parse(Buffer.from(bd.content,'base64').toString());sha='s'+(commits.length+1);commits.unshift({sha,commit:{message:bd.message,committer:{date:new Date().toISOString()}}});
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha}})})});
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
  p.go=async()=>{await p.goto(URL);await p.waitForFunction(()=>document.body&&!document.body.classList.contains('intro')&&document.querySelector('#tabbar .tab'));await p.waitForTimeout(900)};
  await p.go();return {p,ctx};
};
const ok=p=>p.click('#dlgForm [data-act=ok]');const T=p=>p.textContent('#toast');const dlgTitle=p=>p.evaluate(()=>$('#dlg').open?($('#dlgForm b')||{}).textContent:null);
const vis=p=>p.evaluate(()=>[...document.querySelectorAll('.layout>.sgroup')].map(g=>g.dataset.sec+(g.classList.contains('cur')?'*':'')+':'+(g.offsetParent?Math.round(g.getBoundingClientRect().width)+'x'+Math.round(g.getBoundingClientRect().top):'hidden')).join(' '));

// ---------- 桌面 ----------
{const {p,ctx}=await mk();
 await p.evaluate(()=>localStorage.setItem('workboard:ghtoken','TOK_A_123'));
 const tabs=await p.$$eval('#tabbar .tab',x=>x.map(b=>b.dataset.tab+(b.classList.contains('on')?'*':'')));log('D tabs:',tabs);A(tabs.join()==='live*,progress,done','tabs');
 log('D header:',await p.$$eval('.hero-rule .actions button',x=>x.map(b=>b.id+'@'+Math.round(b.getBoundingClientRect().top))));
 const lv=await vis(p);log('D layout live:',lv);A(/^live\*:\d+x/.test(lv),'live first');await p.screenshot({path:'v2_d_live.png'});
 await p.click('#tabbar [data-tab=progress]');await p.waitForTimeout(250);await p.screenshot({path:'v2_d_mid.png'});await p.waitForTimeout(700);
 const lp=await vis(p);log('D layout progress:',lp);A(/progress\*:/.test(lp),'progress selected');await p.screenshot({path:'v2_d_prog.png'});
 await p.click('#tabbar [data-tab=done]');await p.waitForTimeout(1000);const ld=await vis(p);log('D layout done:',ld);A(/done\*:/.test(ld),'done selected');await p.screenshot({path:'v2_d_done.png'});
 log('D gutter:',await p.evaluate(()=>getComputedStyle($('#pageMain')).scrollbarGutter));
 // 動畫：不自動全螢幕、工具列留在 body
 // 設定頁（未登入）
 await p.click('#setBtn');await p.waitForTimeout(600);await p.screenshot({path:'v2_d_set.png'});
 const sr0=await p.$$eval('#setOv .set-row',x=>x.map(r=>(r.dataset.set||'log')+(r.getAttribute('aria-disabled')?'(off)':'')));log('D settings rows:',sr0);A(sr0.join()==='week','only weekly row before login');
 const gt=await p.$$eval('#setOv .set-gate-ico',x=>x.length);log('D gate:',gt);A(gt===1,'lock gate');
 // 登入前只有鎖頭 → 按「登入」→ 舊版看板：先共用密碼、再建立身分
 await p.click('#setOv .set-gate .primary');await p.waitForTimeout(500);const g1=await dlgTitle(p);log('D dlg1:',g1);A(g1==='輸入目前的編輯密碼','dlg1');
 await p.fill('#dlgForm input[name=pw]','0000');await ok(p);await p.waitForTimeout(500);const g2=await dlgTitle(p);log('D dlg2:',g2);A(/建立你的編輯身分/.test(g2||''),'dlg2');
 await p.fill('#dlgForm input[name=name]','王小明');await p.fill('#dlgForm input[name=p1]','wang-password-1');await p.fill('#dlgForm input[name=p2]','wang-password-1');await ok(p);await p.waitForTimeout(2500);await (async()=>{for(let i=0;i<4;i++){await p.waitForTimeout(500);const t=await p.$eval('#dlg[open] #dlgForm>b',b=>b.textContent).catch(()=>'');if(/共用密碼太短|沒有連上雲端/.test(t))await p.click('#dlgForm [data-act=cancel]').catch(()=>{})}})();   /* 2026-11-05：建立第一個身分後，共用密碼 0000 會請管理員換（team.js 的 sharedPwFix），測試先取消 */
 await p.click('#setOv [data-set=title]');await p.waitForTimeout(700);
 const g3=await dlgTitle(p),inp=await p.evaluate(()=>$('#dlg').classList.contains('in-pane'));log('D dlg3:',g3,'| in pane:',inp);A(g3==='看板名稱'&&inp,'title dialog in pane');
 await p.fill('#dlgForm input[name=v]','權益部工作進度（測試）');await ok(p);await p.waitForTimeout(2500);
 A(remote.title==='權益部工作進度（測試）'&&/看板名稱/.test((commits[0]||{commit:{}}).commit.message||''),'title saved to remote');
 log('D title saved:',await T(p),'| document.title:',await p.evaluate(()=>document.title),'| remote:',remote.title,'| commit:',(commits[0]||{commit:{}}).commit.message);
 const nr=await p.$$eval('#setOv .set-row',x=>x.length);log('D rows after login:',nr);A(nr>1,'rows after login');
 // 看板日期已拿掉（schemaVersion 8）：大日期＝上次儲存日期，設定頁沒有這一列
 log('D no date row:',!(await p.$('#setOv [data-set=date]')),'| 頁首沒有大日期（2026-11-05 精簡）:',await p.evaluate(()=>!$('#bigDate')));
 await p.click('#setClose');await p.waitForTimeout(400);
// 2026-11-06 單卡編輯：頁首沒有「編輯」，登入後卡片自己的「編輯」出現（body.authed）；一次只編一張（render.js 的 cardEdit）
 const au=await p.evaluate(()=>({editBtn:!!$('#editBtn'),authed:document.body.classList.contains('authed'),loggedIn:loggedIn(),editing,dlg:$('#dlg').open,cardBtns:document.querySelectorAll('.card-edit-btn').length}));
 log('D logged in:',au);A(!au.editBtn&&au.authed&&au.loggedIn&&!au.editing&&!au.dlg&&au.cardBtns>0,'logged in, no header edit, card edit buttons');
 await p.click('#tabbar [data-tab=live]');await p.waitForTimeout(800);
 const delVis=()=>p.evaluate(()=>{const V=x=>x.checkVisibility({visibilityProperty:true});return {ev:[...document.querySelectorAll('[data-evdel]')].filter(V).length,issue:[...document.querySelectorAll('[data-delissue]')].filter(V).length,inner:document.querySelectorAll('.done-body [data-deldone],.done-body [data-evdel],.edit-block [data-delissue],.week-tools [data-delweek]').length}});   /* 桌面左右兩欄時被選到的膠囊只是空位（visibility:hidden），刪除鈕在右側詳情 */
 const d0=await delVis();log('D delete buttons (not editing):',d0);A(!d0.ev&&!d0.issue&&!d0.inner,'no delete buttons before editing');
 const eid=await p.evaluate(()=>liveOrder()[0].id);
 await p.click(`.ev[data-ev="${eid}"]>summary`);await p.waitForTimeout(900);await p.click('#evDetail .card-edit-btn');await p.waitForTimeout(900);
 const ed=await p.evaluate(()=>({editing,cardEdit}));const d1=await delVis();log('D editing one card:',ed,'| delete buttons:',d1);
 A(ed.editing&&ed.cardEdit==='e:'+eid,'card edit started');A(d1.ev===1&&!d1.inner,'only the edited card has a delete button');
 await p.screenshot({path:'v2_d_edit.png'});
 const ev0=await p.$(`.ev[data-ev="${eid}"]`);const op0=await ev0.evaluate(d=>d.open);await p.click('#evDetail [data-evdel]');await p.waitForTimeout(500);
 const dt=await dlgTitle(p),op1=await ev0.evaluate(d=>d.open);log('D ev delete dlg:',dt,'| opened?',op0,'→',op1);A(/^刪除「/.test(dt||'')&&op0===op1,'delete asks first, capsule not toggled');
 await p.keyboard.press('Escape');await p.waitForTimeout(500);
 await p.click('#evDetail [data-edcancel]');await p.waitForTimeout(900);
 const ac=await p.evaluate(i=>({editing,cardEdit,still:!!state.events.find(e=>e.id===i)}),eid);log('D after cancel:',ac);A(!ac.editing&&!ac.cardEdit&&ac.still,'cancel ends editing, event kept');
 log('D errs:',p.errs);A(!p.errs.length,'desktop errors');
 // 重新整理：第一個身分建立時預設記住這台裝置 → 重新整理後自動登入（boot.js 的 remBoot）
 await p.go();await p.waitForTimeout(600);
 const r0=await p.evaluate(()=>({loggedIn:loggedIn(),dlg:$('#dlg').open,rem:!!localStorage.getItem(REM_KEY)}));log('R auto login (remembered at creation):',r0);A(r0.loggedIn&&!r0.dlg&&r0.rem,'auto login after reload');
 // 忘記這台裝置 → 從設定頁鎖頭登入，要勾「記住」
 await p.evaluate(()=>localStorage.removeItem(REM_KEY));await p.go();
 await p.click('#setBtn');await p.waitForTimeout(700);await p.click('#setOv .set-gate .primary');await p.waitForTimeout(600);
 const rd=await dlgTitle(p),rc=await p.$$eval('#dlgForm .fld-check',x=>x.map(e=>e.textContent));log('R dlg:',rd,rc);A(rd==='選擇編輯身分'&&rc.some(t=>/記住/.test(t)),'login dialog with remember');
 await p.screenshot({path:'v2_d_login.png'});
 await p.fill('#dlgForm input[name=pw]','wang-password-1');await p.check('#dlgForm input[name=rem]');await ok(p);await p.waitForTimeout(1500);
 for(let i=0;i<3;i++){const t=await p.$eval('#dlg[open] #dlgForm>b',b=>b.textContent).catch(()=>'');if(/共用密碼太短|沒有連上雲端/.test(t))await p.click('#dlgForm [data-act=cancel]').catch(()=>{});await p.waitForTimeout(400)}
 const r1=await p.evaluate(()=>({loggedIn:loggedIn(),remember:localStorage.getItem(REM_KEY)}));log('R logged in:',r1);A(r1.loggedIn&&r1.remember,'login with remember');
 await p.evaluate(()=>{if(setOpen)closeSettings(true)});await p.waitForTimeout(300);
 await p.go();await p.waitForTimeout(600);
 const r2=await p.evaluate(()=>({loggedIn:loggedIn(),authed:document.body.classList.contains('authed'),dlg:$('#dlg').open}));log('R auto login:',r2,await T(p));A(r2.loggedIn&&r2.authed&&!r2.dlg,'auto login with remembered device');
 // 密碼在別台裝置改過 → 指紋對不上 → 要重新輸入
 remote.members[0].kdf='xx:yy';sha='s'+(commits.length+10);
 await p.go();await p.waitForTimeout(600);
 const r3=await p.evaluate(()=>({loggedIn:loggedIn(),remember:localStorage.getItem(REM_KEY)}));
 await p.click('#setBtn');await p.waitForTimeout(700);await p.click('#setOv .set-gate .primary');await p.waitForTimeout(600);
 const r3d=await dlgTitle(p);log('R after pw change:',r3d,'|',r3);A(!r3.loggedIn&&!r3.remember&&r3d==='選擇編輯身分','fingerprint mismatch asks again');
 await p.keyboard.press('Escape');await p.waitForTimeout(400);
 log('R errs:',p.errs);A(!p.errs.length,'reload errors');
 await ctx.close();}

// ---------- 手機（觸控） ----------
remote=JSON.parse(fs.readFileSync('data_test.json','utf8'));sha='m0';
{const {p,ctx}=await mk({w:412,h:915,sc:'dark',touch:true});
 log('M layout:',await vis(p));
 const mh=await p.evaluate(()=>({editBtn:!!$('#editBtn'),noti:(r=>Math.round(r.width))($('#notiBtn').getBoundingClientRect())}));log('M header:',mh);A(!mh.editBtn&&mh.noti===44,'mobile header: no edit, 44px bell');   /* 2026-11-06 頁首按鈕列拿掉，通知鈕在搜尋欄右邊 */
 await p.screenshot({path:'v2_m_live.png'});
 await p.tap('#tabbar [data-tab=progress]');await p.waitForTimeout(800);const mp=await vis(p);log('M progress:',mp);A(/progress\*:\d+x/.test(mp)&&/live:hidden/.test(mp),'mobile shows one section');await p.screenshot({path:'v2_m_prog.png'});
 // 觸控拖曳：從「進度」拖到「完成紀錄」
 const cdp=await ctx.newCDPSession(p);
 const pt=async k=>p.$eval(`#tabbar .tab[data-tab=${k}] .tab-ind`,e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
 const a=await pt('progress'),z=await pt('done');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x,y:a.y}]});
 for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(z.x-a.x)*i/12,y:a.y}]});await p.waitForTimeout(16)}
 const midDrag=await p.evaluate(()=>({dragging:$('#tabbar').classList.contains('dragging'),lens:Math.round(lens.x)}));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(1000);
 const md=await p.evaluate(()=>({cur:curSec,dragging:$('#tabbar').classList.contains('dragging')}));log('M touch drag:',midDrag,'→',md,await vis(p));A(midDrag.dragging&&md.cur==='done'&&!md.dragging,'touch drag to done');
 await p.screenshot({path:'v2_m_done.png'});
 // icon：按一下只跑一次（頁首「編輯」已拿掉，改用通知鈕）
 await p.tap('#tabbar [data-tab=live]');await p.waitForTimeout(800);
 await p.dispatchEvent('#notiBtn','pointerdown',{pointerType:'touch',isPrimary:true});await p.waitForTimeout(60);
 const io=await p.evaluate(()=>{const h=$('#notiBtn');return {cls:h.className,iters:h.getAnimations({subtree:true}).filter(a=>/^ico/.test(a.animationName||'')).map(a=>a.effect.getComputedTiming().iterations)}});log('M icon once:',io);
 A(/ico-once/.test(io.cls)&&io.iters.length&&io.iters.every(n=>n===1),'icon plays once');
 await p.waitForTimeout(2200);const ia=await p.evaluate(()=>$('#notiBtn').className);log('M icon after:',ia);A(!/ico-on/.test(ia),'icon stops');
 await p.tap('#setBtn');await p.waitForTimeout(700);await p.screenshot({path:'v2_m_set.png',fullPage:false});
 await p.tap('#setBtn');await p.waitForTimeout(500);
 // 每週概述改成設定裡的子頁（2026-11-06，weekly.js 的 weekPane）：打開後直接點分頁 → 設定收起、到那一區
 await p.tap('#setBtn');await p.waitForTimeout(700);await p.tap('#setOv [data-set=week]');await p.waitForTimeout(1200);
 const wk=await p.evaluate(()=>({open:!!weekPaneEnd,sub:subOpen}));
 await p.tap('#tabbar [data-tab=done]');await p.waitForTimeout(1200);
 const wd=await p.evaluate(()=>({cur:curSec,setOpen,week:!!weekPaneEnd,scrollLeft:$('#pager').scrollLeft}));log('M from weekly → done:',wk,'→',wd);
 A(wk.open&&wk.sub&&wd.cur==='done'&&!wd.setOpen&&!wd.week&&wd.scrollLeft===0,'weekly → done tab');
 log('M errs:',p.errs);A(!p.errs.length,'mobile errors');
 await ctx.close();}
await b.close();fs.writeFileSync('v2_report.txt',out.join('\n'));
})();
