const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch();
let remote=JSON.parse(fs.readFileSync('data_v5.json','utf8')),sha='s0',commits=[];
const mk=async(w,h,sc,touch)=>{const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:sc,hasTouch:touch,isMobile:touch,serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:`@font-face{font-family:"Jost";src:url(http://127.0.0.1:8300/jost.ttf);font-weight:100 900}@font-face{font-family:"Noto Sans TC";src:url(http://127.0.0.1:8300/nototc.ttf);font-weight:100 900}`}));
await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url();if(u.includes('/commits?'))return r.fulfill({status:200,contentType:'application/json',body:'[]'});
 if(q.method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha,content:Buffer.from(JSON.stringify(remote)).toString('base64')})});
 const bd=JSON.parse(q.postData());remote=JSON.parse(Buffer.from(bd.content,'base64').toString());sha='s'+Date.now();commits.unshift(bd.message);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha}})})});
const p=await ctx.newPage();p.errs=[];p.on('pageerror',x=>p.errs.push(x.message));await p.goto('http://127.0.0.1:8300/index.html');await p.waitForTimeout(1800);return p};
const p=await mk(1300,900,'dark',false);
console.log('before click split?',await p.evaluate(()=>$('#liveMD').classList.contains('split')));
await p.click('#events .ev:nth-child(1) summary');await p.waitForTimeout(500);
console.log('split view',await p.evaluate(()=>[$('#liveMD').classList.contains('split'),selEv,$('#evDetail .evd-head b').textContent,!!$('#evDetail .evd.editing')]));
await p.screenshot({path:'lv_view.png'});
await p.click('#events .ev:nth-child(3) summary');await p.waitForTimeout(400);console.log('select3',await p.evaluate(()=>[$('#evDetail .evd-head b').textContent,document.querySelector('#events .ev:nth-child(3)').open]));
// edit mode
await p.evaluate(()=>localStorage.setItem('workboard:ghtoken','T'));
await p.click('#editBtn');await p.waitForTimeout(400);
const t=await p.evaluate(()=>$('#dlgForm b')?.textContent);console.log('login',t);
if(t&&t.includes('身分')){await p.evaluate(()=>{});} 
await p.fill('#dlgForm input[name=pw]','0000').catch(()=>{});await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(500);
await p.fill('#dlgForm input[name=name]','王').catch(()=>{});await p.fill('#dlgForm input[name=p1]','password-long-1').catch(()=>{});await p.fill('#dlgForm input[name=p2]','password-long-1').catch(()=>{});await p.click('#dlgForm [data-act=ok]').catch(()=>{});await p.waitForTimeout(1800);await (async()=>{for(let i=0;i<4;i++){await p.waitForTimeout(500);const t=await p.$eval('#dlg[open] #dlgForm>b',b=>b.textContent).catch(()=>'');if(/共用密碼太短|沒有連上雲端/.test(t))await p.click('#dlgForm [data-act=cancel]').catch(()=>{})}})();   /* 2026-11-05：建立第一個身分後，共用密碼 0000 會請管理員換（team.js 的 sharedPwFix），測試先取消 */
console.log('editing（即時回報逐欄編輯，沒有「編輯這區」）',await p.evaluate(()=>[editing,!!$('#evDetail .evd.editing'),!!document.querySelector('[data-secedit=live]')]));
await p.screenshot({path:'lv_edit.png'});
const fld=async(k,fn)=>{await p.click(`#evDetail [data-evpen="${k}"]`);await p.waitForTimeout(300);await fn('#evDetail .evf.open ');await p.click('#evDetail .evf.open [data-evfx=ok]');await p.waitForTimeout(300)};
await fld('name',async b=>p.fill(b+'[data-e=name]','改名測試'));
await fld('desc',async b=>p.fill(b+'[data-e=desc]','新的說明'));
console.log('live name in list',await p.evaluate(()=>document.querySelector('#events .ev.sel b').textContent));
// 一次只開一欄：開說明時名稱關著
await p.click('#evDetail [data-evpen=name]');await p.waitForTimeout(200);await p.click('#evDetail [data-evpen=desc]');await p.waitForTimeout(200);
console.log('one field at a time',await p.evaluate(()=>[...document.querySelectorAll('#evDetail .evf.open')].map(x=>x.dataset.evfk).join()));await p.click('#evDetail .evf.open [data-evfx=cancel]');await p.waitForTimeout(200);
await fld('issue',async b=>{await p.click(b+'.csel-btn');await p.waitForTimeout(200);await p.click(b+'.csel-opt:nth-child(2)')});
await fld('t:+',async b=>{await p.fill(b+'[data-e=label]','開會');await p.fill(b+'[data-e=st]','1400');await p.fill(b+'[data-e=et]','1530')});
await fld('l:+',async b=>{await p.fill(b+'[data-e=name]','公文');await p.fill(b+'[data-e=url]','https://example.com')});
await p.click('#events .ev:nth-child(1) summary');await p.waitForTimeout(500);
const sel=await p.evaluate(()=>{const e=state.events.find(x=>x.name==='改名測試');return e&&{desc:e.desc,issue:e.issueId,times:e.times.map(t=>t.label+' '+t.start+'~'+t.end),links:e.links.map(l=>l.name+' '+l.url)}});console.log('saved data',JSON.stringify(sel));
// round
await p.click('#evDetail [data-evd=round]');await p.waitForTimeout(300);await p.fill('#evDetail [data-rf=next]','下一段');await p.click('#evDetail [data-evd=roundok]');await p.waitForTimeout(600);
console.log('after round',await p.evaluate(()=>{const e=state.events.find(x=>x.id===selEv);return [e.round,e.desc,state.events.filter(x=>x.fromEv===e.id).length]}));
await p.screenshot({path:'lv_edit2.png'});
await p.click('#saveBtn');await p.waitForTimeout(2500);console.log('commit',commits[0]&&commits[0].split('\n').slice(0,6).join(' | '));
console.log('errs',p.errs);
const m=await mk(390,844,'dark',true);console.log('mobile split',await m.evaluate(()=>$('#liveMD').classList.contains('split')),m.errs);
await b.close()})();
