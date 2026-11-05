// 新介面結構：功能測試（模擬 GitHub）
const {chromium}=require('playwright');const fs=require('fs');
const URL=process.env.URL||'http://127.0.0.1:8300/index.html';
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
 log('D tabs:',await p.$$eval('#tabbar .tab',x=>x.map(b=>b.dataset.tab+(b.classList.contains('on')?'*':''))));
 log('D header:',await p.$$eval('.hero-rule .actions button',x=>x.map(b=>b.id+'@'+Math.round(b.getBoundingClientRect().top))));
 log('D layout live:',await vis(p));await p.screenshot({path:'v2_d_live.png'});
 await p.click('#tabbar [data-tab=progress]');await p.waitForTimeout(250);await p.screenshot({path:'v2_d_mid.png'});await p.waitForTimeout(700);
 log('D layout progress:',await vis(p));await p.screenshot({path:'v2_d_prog.png'});
 await p.click('#tabbar [data-tab=done]');await p.waitForTimeout(1000);log('D layout done:',await vis(p));await p.screenshot({path:'v2_d_done.png'});
 log('D gutter:',await p.evaluate(()=>getComputedStyle($('#pageMain')).scrollbarGutter));
 // 動畫：不自動全螢幕、工具列留在 body
 // 設定頁（未登入）
 await p.click('#setBtn');await p.waitForTimeout(600);await p.screenshot({path:'v2_d_set.png'});
 log('D settings rows:',await p.$$eval('#setOv .set-row',x=>x.map(r=>(r.dataset.set||'log')+(r.getAttribute('aria-disabled')?'(off)':''))));
 log('D gate:',await p.$$eval('#setOv .set-gate-ico',x=>x.length));
 // 登入前只有鎖頭 → 按「登入」→ 舊版看板：先共用密碼、再建立身分
 await p.click('#setOv .set-gate .primary');await p.waitForTimeout(500);log('D dlg1:',await dlgTitle(p));
 await p.fill('#dlgForm input[name=pw]','0000');await ok(p);await p.waitForTimeout(500);log('D dlg2:',await dlgTitle(p));
 await p.fill('#dlgForm input[name=name]','王小明');await p.fill('#dlgForm input[name=p1]','wang-password-1');await p.fill('#dlgForm input[name=p2]','wang-password-1');await ok(p);await p.waitForTimeout(2500);
 await p.click('#setOv [data-set=title]');await p.waitForTimeout(700);
 log('D dlg3:',await dlgTitle(p),'| in pane:',await p.evaluate(()=>$('#dlg').classList.contains('in-pane')));
 await p.fill('#dlgForm input[name=v]','權益部工作進度（測試）');await ok(p);await p.waitForTimeout(2500);
 log('D title saved:',await T(p),'| h1:',await p.textContent('#titleSlot h1'),'| remote:',remote.title,'| commit:',(commits[0]||{commit:{}}).commit.message);
 log('D rows after login:',await p.$$eval('#setOv .set-row',x=>x.length));
 // 看板日期已拿掉（schemaVersion 8）：大日期＝上次儲存日期，設定頁沒有這一列
 log('D no date row:',!(await p.$('#setOv [data-set=date]')),'| bigDate=savedAt:',await p.evaluate(()=>$('#bigDate').firstChild.data===`${+state.savedAt.slice(5,7)}.${state.savedAt.slice(8,10)}`));
 await p.click('#setClose');await p.waitForTimeout(400);
 // 進入編輯：已登入就不再問密碼
 await p.click('#editBtn');await p.waitForTimeout(900);
 log('D editing:',await p.evaluate(()=>({editing,dlg:$('#dlg').open,hdr:[...document.querySelectorAll('.hero-rule .actions button')].map(b=>b.id)})));
 await p.click('#tabbar [data-tab=live]');await p.waitForTimeout(800);
 for(const k of ['progress','done'])await p.click(`[data-secedit=${k}]`);await p.waitForTimeout(600);   // 分區編輯：進度、完成紀錄按「編輯這區」（即時回報是逐欄編輯，沒有這顆）
 log('D delete buttons:',await p.evaluate(()=>({ev:[...document.querySelectorAll('.ev-del')].filter(x=>x.offsetParent).length,issue:[...document.querySelectorAll('.card-tools [data-delissue]')].filter(x=>x.offsetParent).length,done:[...document.querySelectorAll('.done-del')].filter(x=>x.offsetParent).length,inner:document.querySelectorAll('.done-body [data-deldone],.done-body [data-evdel],.edit-block [data-delissue],.week-tools [data-delweek]').length})));
 await p.screenshot({path:'v2_d_edit.png'});
 const ev0=await p.$('.events .ev');await (await ev0.$('.ev-del')).click();await p.waitForTimeout(500);
 log('D ev delete dlg:',await dlgTitle(p),'| opened?',await ev0.evaluate(d=>d.open));
 await p.keyboard.press('Escape');await p.waitForTimeout(500);
 await p.click('#cancelBtn');await p.waitForTimeout(900);log('D after cancel:',await p.evaluate(()=>({editing,hdr:[...document.querySelectorAll('.hero-rule .actions button')].map(b=>b.id)})));
 log('D errs:',p.errs);
 // 重新整理：登入要勾「記住」
 await p.go();await p.click('#editBtn');await p.waitForTimeout(500);log('R dlg:',await dlgTitle(p),await p.$$eval('#dlgForm .fld-check',x=>x.map(e=>e.textContent)));
 await p.screenshot({path:'v2_d_login.png'});
 await p.fill('#dlgForm input[name=pw]','wang-password-1');await p.check('#dlgForm input[name=rem]');await ok(p);await p.waitForTimeout(1500);
 log('R editing:',await p.evaluate(()=>editing),'| remember:',await p.evaluate(()=>localStorage.getItem(REM_KEY)));
 await p.click('#cancelBtn');await p.waitForTimeout(700);
 await p.go();await p.click('#editBtn');await p.waitForTimeout(900);await p.evaluate(()=>{['live','progress','done'].forEach(k=>secEdit.add(k));render()});
 log('R auto login:',await p.evaluate(()=>({editing,dlg:$('#dlg').open})),await T(p));
 await p.click('#cancelBtn');await p.waitForTimeout(700);
 // 密碼在別台裝置改過 → 指紋對不上 → 要重新輸入
 remote.members[0].kdf='xx:yy';sha='s'+(commits.length+10);
 await p.go();await p.click('#editBtn');await p.waitForTimeout(700);await p.evaluate(()=>{['live','progress','done'].forEach(k=>secEdit.add(k));render()});
 log('R after pw change:',await dlgTitle(p),'| remember:',await p.evaluate(()=>localStorage.getItem(REM_KEY)));
 await p.keyboard.press('Escape');await p.waitForTimeout(400);
 log('R errs:',p.errs);
 await ctx.close();}

// ---------- 手機（觸控） ----------
remote=JSON.parse(fs.readFileSync('data_test.json','utf8'));sha='m0';
{const {p,ctx}=await mk({w:412,h:915,sc:'dark',touch:true});
 log('M layout:',await vis(p));
 log('M header row:',await p.$$eval('.hero-rule .actions button',x=>x.map(b=>b.id+'@'+Math.round(b.getBoundingClientRect().top)+'w'+Math.round(b.getBoundingClientRect().width))));
 await p.screenshot({path:'v2_m_live.png'});
 await p.tap('#tabbar [data-tab=progress]');await p.waitForTimeout(800);log('M progress:',await vis(p));await p.screenshot({path:'v2_m_prog.png'});
 // 觸控拖曳：從「進度」拖到「完成紀錄」
 const cdp=await ctx.newCDPSession(p);
 const pt=async k=>p.$eval(`#tabbar .tab[data-tab=${k}] .tab-ind`,e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
 const a=await pt('progress'),z=await pt('done');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x,y:a.y}]});
 for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(z.x-a.x)*i/12,y:a.y}]});await p.waitForTimeout(16)}
 const midDrag=await p.evaluate(()=>({dragging:$('#tabbar').classList.contains('dragging'),lens:Math.round(lens.x)}));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(1000);
 log('M touch drag:',midDrag,'→',await p.evaluate(()=>({cur:curSec,dragging:$('#tabbar').classList.contains('dragging')})),await vis(p));
 await p.screenshot({path:'v2_m_done.png'});
 // icon：按一下只跑一次
 await p.tap('#tabbar [data-tab=live]');await p.waitForTimeout(800);
 await p.dispatchEvent('#editBtn','pointerdown',{pointerType:'touch',isPrimary:true});await p.waitForTimeout(60);
 log('M icon once:',await p.evaluate(()=>{const h=$('#editBtn');return {cls:h.className,iters:h.getAnimations({subtree:true}).map(a=>a.effect.getComputedTiming().iterations)}}));
 await p.waitForTimeout(2200);log('M icon after:',await p.evaluate(()=>$('#editBtn').className));
 await p.tap('#setBtn');await p.waitForTimeout(700);await p.screenshot({path:'v2_m_set.png',fullPage:false});
 await p.tap('#setBtn');await p.waitForTimeout(500);
 await p.tap('#weekBtn');await p.waitForTimeout(1200);await p.tap('#tabbar [data-tab=done]');await p.waitForTimeout(1200);
 log('M from weekly → done:',await p.evaluate(()=>({cur:curSec,scrollLeft:$('#pager').scrollLeft})));
 log('M errs:',p.errs);
 await ctx.close();}
await b.close();fs.writeFileSync('v2_report.txt',out.join('\n'));
})();
