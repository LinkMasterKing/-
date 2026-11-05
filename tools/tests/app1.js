/* 安裝成 App：各部門自己的 manifest、App 重開回到上次的部門與區塊（app.js）。固定 8300 埠。
   用 addInitScript 假裝在已安裝的 App 裡（display-mode: fullscreen）；同一個 context 開新分頁＝重開 App（sessionStorage 是新的、localStorage 共用） */
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();let bad=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m);if(!c)bad++};
const ctx=await b.newContext({viewport:{width:412,height:860},serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await ctx.route('https://api.github.com/**',r=>r.fulfill({status:404,body:'{}'}));
await ctx.addInitScript(()=>{const o=window.matchMedia.bind(window);window.matchMedia=q=>/display-mode/.test(q)?{matches:true,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}:o(q)});
const open=async(u)=>{const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await p.goto('http://127.0.0.1:8300/'+u);await p.waitForTimeout(1200);return p};
/* 1. 一般瀏覽器（沒假裝 App）：manifest 換成部門的 */
const ctx2=await b.newContext({serviceWorkers:'block'});await ctx2.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
const q=await ctx2.newPage();await q.goto('http://127.0.0.1:8300/index.html?d=finance');await q.waitForTimeout(800);
ok(await q.$eval('link[rel=manifest]',l=>l.getAttribute('href'))==='dept/app/finance.webmanifest','財務部用自己的 manifest');
const mf=await q.evaluate(async()=>(await fetch(document.querySelector('link[rel=manifest]').href)).json());
ok(mf.start_url==='../../index.html?d=finance'&&mf.background_color==='#ffffff','manifest 開財務部、白底');
await q.goto('http://127.0.0.1:8300/index.html');await q.waitForTimeout(600);
ok(await q.$eval('link[rel=manifest]',l=>l.getAttribute('href'))==='manifest.webmanifest','權益部用根目錄 manifest');
/* 2. 權益部 App：打開 → 在 App 裡換到財務部、切到「完成紀錄」→ 關掉 */
let p=await open('index.html');
ok(!!(await p.$('#splash')),'App 打開有開場動畫');
await p.goto('http://127.0.0.1:8300/index.html?d=finance');await p.waitForTimeout(1200);
await p.evaluate(()=>setSection('done',{instant:true}));await p.waitForTimeout(300);await p.close({runBeforeUnload:true});
/* 3. 重開權益部 App：回到財務部、完成紀錄，開場動畫照放 */
p=await open('index.html');
ok(p.url().endsWith('index.html?d=finance'),'重開回到財務部：'+p.url());
ok(await p.evaluate(()=>curSec)==='done','重開回到完成紀錄');
ok(!!(await p.$('#splash')),'重開仍有開場動畫');
/* 4. 同一次開著時重新整理：不再跳 */
await p.evaluate(()=>setSection('live',{instant:true}));await p.reload();await p.waitForTimeout(1000);
ok(p.url().endsWith('?d=finance')&&await p.evaluate(()=>curSec)==='live','重新整理不會被拉回上次的位置');
await p.close({runBeforeUnload:true});
/* 5. 另一個部門的 App（活動部）各記各的 */
p=await open('index.html?d=events');
ok(p.url().endsWith('?d=events'),'活動部 App 開活動部（不受權益部 App 影響）');
ok(!p.errs.length,'沒有錯誤 '+p.errs.join(' | '));
await b.close();process.exit(bad?1:0)})();
