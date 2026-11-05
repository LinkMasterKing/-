const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch();
const files={'data.json':JSON.parse(fs.readFileSync('data_v5.json','utf8'))},shas={},commits=[];
const mk=async(q,w=1300,h=900)=>{const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:'dark',serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=new URL(q.url());if(u.pathname.includes('/commits'))return r.fulfill({status:200,contentType:'application/json',body:'[]'});
 const m=u.pathname.match(/\/contents\/(.+)$/);const path=m&&decodeURIComponent(m[1]);
 if(q.method()==='GET'){if(!files[path])return r.fulfill({status:404,body:'{}'});
   if((q.headers()['accept']||'').includes('raw'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(files[path])});
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha:shas[path]||'x',content:Buffer.from(JSON.stringify(files[path])).toString('base64')})})}
 const bd=JSON.parse(q.postData());files[path]=JSON.parse(Buffer.from(bd.content,'base64').toString());shas[path]='s'+Date.now();commits.unshift(path+' :: '+bd.message.split('\n')[0]);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:shas[path]}})})});
const p=await ctx.newPage();p.errs=[];p.on('pageerror',x=>p.errs.push(x.message));
await p.goto('http://127.0.0.1:8300/index.html'+q);await p.waitForTimeout(1800);
await p.evaluate(()=>{localStorage.setItem('workboard:ghtoken','T');if(!state.sync)state.sync={owner:'o',repo:'r',branch:'main',path:CFG.data.path};});
return p};
const login=async p=>{await p.click('#editBtn');await p.waitForTimeout(400);await p.fill('#dlgForm input[name=pw]','0000');await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(400);
 await p.fill('#dlgForm input[name=name]','測試').catch(()=>{});await p.fill('#dlgForm input[name=p1]','password-long-1').catch(()=>{});await p.fill('#dlgForm input[name=p2]','password-long-1').catch(()=>{});await p.click('#dlgForm [data-act=ok]').catch(()=>{});await p.waitForTimeout(1500);await (async()=>{for(let i=0;i<4;i++){await p.waitForTimeout(500);const t=await p.$eval('#dlg[open] #dlgForm>b',b=>b.textContent).catch(()=>'');if(/共用密碼太短|沒有連上雲端/.test(t))await p.click('#dlgForm [data-act=cancel]').catch(()=>{})}})();};   /* 2026-11-05：建立第一個身分後，共用密碼 0000 會請管理員換（team.js 的 sharedPwFix），測試先取消 */
// rights default
let p=await mk('');console.log('rights',await p.evaluate(()=>[CFG.deptId,state.title,!!document.querySelector('.logo-box svg'),$('#liveMD').classList.contains('split'),$('#followPanel').hidden,cloudCfg().path]));
await p.click('#events .ev:nth-child(2) summary');await p.waitForTimeout(500);console.log('click->split',await p.evaluate(()=>[$('#liveMD').classList.contains('split'),selEv]));
await p.screenshot({path:'m2_rights.png'});
await p.click('#events .ev:nth-child(2) summary');await p.waitForTimeout(400);console.log('click again->close',await p.evaluate(()=>$('#liveMD').classList.contains('split')));
console.log('rights errs',p.errs);
// finance blank
p=await mk('?d=finance');console.log('finance',await p.evaluate(()=>[state.title,document.querySelector('.logo-text b')?.textContent,state.events.length,state.issues.length,cloudCfg().path,$('#saveInfo').textContent]));
await p.screenshot({path:'m2_fin.png'});
await login(p);await p.click('#addEvent');await p.waitForTimeout(500);await p.fill('#evDetail [data-evf=name]','預算表彙整');await p.fill('#evDetail [data-evf=desc]','等各部門回傳');await p.click('#saveBtn');await p.waitForTimeout(2500);
console.log('finance saved',commits[0],Object.keys(files));console.log('fin errs',p.errs);
// president
p=await mk('?d=president');console.log('pres',await p.evaluate(()=>[state.title,$('#followPanel').hidden,$('#follows').textContent.slice(0,40)]));
await login(p);await p.click('#addFollow');await p.waitForTimeout(400);
await p.evaluate(()=>{const s=document.querySelector('#dlgForm input[name=dept]');});
await p.click('#dlgForm .csel-btn');await p.waitForTimeout(200);await p.click('#dlgForm .csel.open .csel-opt[data-v=finance]');await p.waitForTimeout(200);
await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(1200);console.log('step2',await p.evaluate(()=>[$('#dlgForm b')?.textContent,[...document.querySelectorAll('#dlgForm .csel-opt')].map(x=>x.textContent)]));
await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(800);
// follow rights issue
await p.click('#addFollow');await p.waitForTimeout(400);await p.click('#dlgForm .csel-btn');await p.click('#dlgForm .csel.open .csel-opt[data-v=rights]');
await p.click('#dlgForm .csel:nth-of-type(2) .csel-btn').catch(()=>{});
const cs=await p.$$('#dlgForm .csel');await (await cs[1].$('.csel-btn')).click();await p.click('#dlgForm .csel.open .csel-opt[data-v=issue]');await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(1200);await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(800);
await p.click('#addFollow');await p.waitForTimeout(400);await p.click('#dlgForm .csel-btn');await p.click('#dlgForm .csel.open .csel-opt[data-v=rights]');const cs2=await p.$$('#dlgForm .csel');await (await cs2[1].$('.csel-btn')).click();await p.click('#dlgForm .csel.open .csel-opt[data-v=week]');await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(1200);await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(800);
console.log('follows',await p.evaluate(()=>[...document.querySelectorAll('#follows .fw')].map(f=>f.querySelector('.fw-top').textContent.replace(/\s+/g,' ')+' | '+f.querySelector('.fw-t').textContent)));
await p.click('#saveBtn');await p.waitForTimeout(2500);console.log('pres saved',commits[0]);
await p.screenshot({path:'m2_pres.png'});console.log('pres errs',p.errs);
await b.close()})();
