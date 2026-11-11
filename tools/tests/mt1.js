/* mt1：權益部預設（即時回報點了才分欄）、財務部空白看板新增即時回報並存到 data-finance.json、會長室追蹤三種項目並儲存。固定 8300 埠
   2026-11-11 改寫：登入改從設定頁鎖頭（頁首「編輯」已拿掉）；新增即時回報＝開始編輯一筆空白的（桌面左右兩欄），卡片的「儲存」；
   追蹤是整區「編輯」（"s:follow"）＋區塊的「儲存」；網站上的 data-*.json 一律當成不存在（真的資料檔有身分、全會密碼，會改變登入流程） */
const {chromium}=require('playwright');const fs=require('fs');const A=(ok,m)=>{if(!ok){console.log('FAIL:',m);process.exitCode=1}};(async()=>{const b=await chromium.launch();
const files={'data.json':JSON.parse(fs.readFileSync('data_v5.json','utf8'))},shas={},commits=[];
const mk=async(q,w=1300,h=900)=>{const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:'dark',serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=new URL(q.url());if(u.pathname.includes('/commits'))return r.fulfill({status:200,contentType:'application/json',body:'[]'});
 const m=u.pathname.match(/\/contents\/(.+)$/);const path=m&&decodeURIComponent(m[1]);
 if(q.method()==='GET'){if(!files[path])return r.fulfill({status:404,body:'{}'});
   if((q.headers()['accept']||'').includes('raw'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(files[path])});
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha:shas[path]||'x',content:Buffer.from(JSON.stringify(files[path])).toString('base64')})})}
 const bd=JSON.parse(q.postData());files[path]=JSON.parse(Buffer.from(bd.content,'base64').toString());shas[path]='s'+Date.now();commits.unshift(path+' :: '+bd.message.split('\n')[0]);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:shas[path]}})})});
await ctx.route(/127\.0\.0\.1:8300\/data-.*\.json/,r=>r.fulfill({status:404,body:''}));
const p=await ctx.newPage();p.errs=[];p.on('pageerror',x=>p.errs.push(x.message));
await p.goto('http://127.0.0.1:8300/index.html'+q);await p.waitForTimeout(1800);
await p.evaluate(()=>{localStorage.setItem('workboard:ghtoken','T');if(!state.sync)state.sync={owner:'o',repo:'r',branch:'main',path:CFG.data.path};});
return p};
const login=async p=>{await p.click('#setBtn');await p.waitForTimeout(800);await p.click('#setOv .set-gate .primary');await p.waitForTimeout(400);await p.fill('#dlgForm input[name=pw]','0000');await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(400);
 await p.fill('#dlgForm input[name=name]','測試').catch(()=>{});await p.fill('#dlgForm input[name=p1]','password-long-1').catch(()=>{});await p.fill('#dlgForm input[name=p2]','password-long-1').catch(()=>{});await p.click('#dlgForm [data-act=ok]').catch(()=>{});await p.waitForTimeout(1500);await (async()=>{for(let i=0;i<4;i++){await p.waitForTimeout(500);const t=await p.$eval('#dlg[open] #dlgForm>b',b=>b.textContent).catch(()=>'');if(/共用密碼太短|沒有連上雲端/.test(t))await p.click('#dlgForm [data-act=cancel]').catch(()=>{})}})();await p.evaluate(()=>{if(setOpen)closeSettings(true)});await p.waitForTimeout(300);A(await p.evaluate(()=>loggedIn()),'logged in');};   /* 2026-11-05：建立第一個身分後，共用密碼 0000 會請管理員換（team.js 的 sharedPwFix），測試先取消 */
// rights default
let p=await mk('');const r0=await p.evaluate(()=>[CFG.deptId,state.title,!!document.querySelector('.logo-box svg'),$('#liveMD').classList.contains('split'),$('#followPanel').hidden,cloudCfg().path]);console.log('rights',r0);
A(r0[0]==='rights'&&r0[2]&&!r0[3]&&r0[4]&&r0[5]==='data.json','rights default: not split, no follow panel');
/* 膠囊格分上下兩區後是 #events .events>.ev；左右兩欄時被選到的那顆只是空位（點不到），收起用右側的「收起」 */
const e2=await p.evaluate(()=>document.querySelector('#events .events>.ev:nth-child(2)').dataset.ev);
await p.click('#events .events>.ev:nth-child(2) summary');await p.waitForTimeout(500);const sp=await p.evaluate(()=>[$('#liveMD').classList.contains('split'),selEv]);console.log('click->split',sp);A(sp[0]&&sp[1]===e2,'click splits');
await p.screenshot({path:'m2_rights.png'});
await p.click('#evDetail [data-mdclose=live]');await p.waitForTimeout(600);const cl=await p.evaluate(()=>$('#liveMD').classList.contains('split'));console.log('close->not split',!cl);A(!cl,'close unsplits');
console.log('rights errs',p.errs);A(!p.errs.length,'rights errors');
// finance blank
p=await mk('?d=finance');const f0=await p.evaluate(()=>[state.title,document.querySelector('.logo-text b')?.textContent,state.events.length,state.issues.length,cloudCfg().path,$('#saveInfo').textContent]);console.log('finance',f0);
A(f0[2]===0&&f0[3]===0&&f0[4]==='data-finance.json','finance blank board');
await p.screenshot({path:'m2_fin.png'});
await login(p);await p.click('#addEvent');await p.waitForTimeout(800);
await p.fill('#evDetail .evf.open [data-e=name]','預算表彙整');await p.click('#evDetail [data-evpen=desc]');await p.waitForTimeout(300);await p.fill('#evDetail .evf.open [data-e=desc]','等各部門回傳');await p.click('#evDetail .evf.open [data-evfx=ok]');await p.waitForTimeout(300);
await p.click('#evDetail [data-edsave]');await p.waitForTimeout(2500);
console.log('finance saved',commits[0],Object.keys(files));console.log('fin errs',p.errs);
A(/^data-finance\.json :: /.test(commits[0]||'')&&files['data-finance.json']&&files['data-finance.json'].events.some(e=>e.name==='預算表彙整'&&e.desc==='等各部門回傳'),'finance event saved to data-finance.json');A(!p.errs.length,'finance errors');
// president
p=await mk('?d=president');const p0=await p.evaluate(()=>[state.title,$('#followPanel').hidden,$('#follows').textContent.slice(0,40)]);console.log('pres',p0);A(!p0[1],'president has follow panel');
await login(p);await p.evaluate(()=>setSection('ext',{instant:true}));await p.waitForTimeout(400);await p.click('#followPanel [data-edit]');await p.waitForTimeout(600);A(await p.evaluate(()=>secEd('follow')),'follow edit started');
await p.click('#addFollow');await p.waitForTimeout(400);
await p.evaluate(()=>{const s=document.querySelector('#dlgForm input[name=dept]');});
await p.click('#dlgForm .csel-btn');await p.waitForTimeout(200);await p.click('#dlgForm .csel.open .csel-opt[data-v=finance]');await p.waitForTimeout(200);
await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(1200);console.log('step2',await p.evaluate(()=>[$('#dlgForm b')?.textContent,[...document.querySelectorAll('#dlgForm .csel-opt')].map(x=>x.textContent)]));
await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(800);
// follow rights issue
await p.click('#addFollow');await p.waitForTimeout(400);await p.click('#dlgForm .csel-btn');await p.click('#dlgForm .csel.open .csel-opt[data-v=rights]');
await p.click('#dlgForm .csel:nth-of-type(2) .csel-btn').catch(()=>{});
const cs=await p.$$('#dlgForm .csel');await (await cs[1].$('.csel-btn')).click();await p.click('#dlgForm .csel.open .csel-opt[data-v=issue]');await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(1200);await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(800);
await p.click('#addFollow');await p.waitForTimeout(400);await p.click('#dlgForm .csel-btn');await p.click('#dlgForm .csel.open .csel-opt[data-v=rights]');const cs2=await p.$$('#dlgForm .csel');await (await cs2[1].$('.csel-btn')).click();await p.click('#dlgForm .csel.open .csel-opt[data-v=week]');await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(1200);await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(800);
const fl=await p.evaluate(()=>[...document.querySelectorAll('#follows .fw')].map(f=>f.querySelector('.fw-top').textContent.replace(/\s+/g,' ')+' | '+f.querySelector('.fw-t').textContent));console.log('follows',fl);
await p.click('#followPanel [data-edsave]');await p.waitForTimeout(2500);console.log('pres saved',commits[0]);
const pf=(files['data-president.json']||{}).follows||[];A(fl.length===3&&pf.length===3&&['finance:live','rights:issue','rights:week'].every(k=>pf.some(f=>f.dept+':'+f.kind===k))&&/^data-president\.json :: /.test(commits[0]||''),'president follows three kinds and saves');
await p.screenshot({path:'m2_pres.png'});console.log('pres errs',p.errs);A(!p.errs.length,'president errors');
await b.close()})();
