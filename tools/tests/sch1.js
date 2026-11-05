const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch();
let remote=JSON.parse(fs.readFileSync('data_test.json','utf8')),sha='s0',commits=[];
const ctx=await b.newContext({viewport:{width:900,height:900},serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url();if(u.includes('/commits?'))return r.fulfill({status:200,contentType:'application/json',body:'[]'});
 if(q.method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha,content:Buffer.from(JSON.stringify(remote)).toString('base64')})});
 const bd=JSON.parse(q.postData());remote=JSON.parse(Buffer.from(bd.content,'base64').toString());sha='s'+Date.now();commits.unshift(bd.message);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha}})})});
const p=await ctx.newPage();const e=[];p.on('pageerror',x=>e.push(x.message));await p.goto('http://127.0.0.1:8300/index.html');await p.waitForTimeout(1500);
await p.evaluate(()=>localStorage.setItem('workboard:ghtoken','T'));
await p.click('#editBtn');await p.waitForTimeout(400);await p.fill('#dlgForm input[name=pw]','0000');await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(400);
await p.fill('#dlgForm input[name=name]','甲');await p.fill('#dlgForm input[name=p1]','password-long-1');await p.fill('#dlgForm input[name=p2]','password-long-1');await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(2000);await (async()=>{for(let i=0;i<4;i++){await p.waitForTimeout(500);const t=await p.$eval('#dlg[open] #dlgForm>b',b=>b.textContent).catch(()=>'');if(/共用密碼太短|沒有連上雲端/.test(t))await p.click('#dlgForm [data-act=cancel]').catch(()=>{})}})();   /* 2026-11-05：建立第一個身分後，共用密碼 0000 會請管理員換（team.js 的 sharedPwFix），測試先取消 */
await p.click('#tabbar [data-tab=progress]');await p.waitForTimeout(900);
const c=await p.$('#cards .card:nth-child(2)');const id=await c.getAttribute('data-issue');
await c.$eval('[data-closeissue]',x=>x.click());await p.waitForTimeout(400);
console.log('after close btn:',await p.evaluate(id=>{const i=state.issues.find(x=>x.id===id);return [i.title,i.doneAt,document.querySelector(`#card-${id} .closed-tag`)?.textContent,document.querySelector(`#card-${id} [data-closeissue]`).textContent]},id));
// marker drag on first card (open it)
await p.evaluate(()=>{const c=document.querySelector('#cards .card');c.querySelector('[data-toggle]').click()});await p.waitForTimeout(800);
const tr=await p.$('#cards .card.open .c-track');await tr.scrollIntoViewIfNeeded();await p.waitForTimeout(400);const bb=await tr.boundingBox();
console.log('hit',await p.evaluate(([x,y])=>{const el=document.elementFromPoint(x,y);return el.className+'|'+el.closest('.card')?.className},[bb.x+bb.width*0.5,bb.y+bb.height/2]),bb);await p.mouse.move(bb.x+bb.width*0.5,bb.y+bb.height/2);await p.mouse.down();await p.mouse.move(bb.x+bb.width*0.6,bb.y+bb.height/2,{steps:4});
console.log('pending label:',await p.textContent('.marker.pending .lbl'));await p.mouse.up();await p.waitForTimeout(500);
console.log('marker dlg:',await p.evaluate(()=>[$('#dlgForm b').textContent,[...document.querySelectorAll('#dlgForm [name]')].map(x=>x.name+'='+x.value)]));
await p.fill('#dlgForm input[name=text]','測試註記');await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(500);
await p.click('#saveBtn');await p.waitForTimeout(2500);
console.log('commit:',commits[0]);console.log('remote closed:',remote.issues.filter(i=>i.doneAt).map(i=>i.title),'progress field?',remote.issues.some(i=>'progress' in i),'v',remote.schemaVersion);
console.log('done list has:',await p.evaluate(id=>!!document.querySelector(`#doneList [data-issue="${id}"]`),id),e);await b.close()})();
