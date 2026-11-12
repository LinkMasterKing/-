/* rd1：舊網址轉址頁（tools/redirect-page/，之後放到 linkmasterking.github.io repo）。不用本機伺服器。
   用 route 模擬 GitHub Pages：https://linkmasterking.github.io/ 照 tools/redirect-page/ 的檔案回應（資料夾回 index.html、找不到回根目錄 404.html＋404 狀態），
   https://stustsa.github.io/council/ 回一個空白頁。檢查：
   - 四個網址 /-/、/-/home.html、/-/index.html?d=events、/-/?d=fruit#join=測試 帶到新網址同一個位置（路徑後段、查詢字串、# 片段都保留）
   - 不存在的 /-/xxx（由 404.html 接）也照樣帶過去；/-（沒有斜線）帶到新首頁；不是 /-/ 底下的網址不自動轉
   - 關掉 JavaScript 時用 meta refresh 帶到新首頁
   - 清除用 sw.js：舊看板的 Service Worker 更新成這一份後，自己解除註冊、刪掉 board-cache 快取（用真的 Service Worker，本機 8301 埠） */
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','redirect-page'),OLD='https://linkmasterking.github.io',NEW='https://stustsa.github.io/council';
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json'};
(async()=>{const b=await chromium.launch();let bad=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m);if(!c)bad++};
const mk=async(opt={})=>{const ctx=await b.newContext({serviceWorkers:'block',javaScriptEnabled:opt.js!==false});
  await ctx.route(OLD+'/**',r=>{let p=decodeURIComponent(new URL(r.request().url()).pathname);if(p.endsWith('/'))p+='index.html';
    const f=path.join(ROOT,p);if(f.startsWith(ROOT)&&fs.existsSync(f)&&fs.statSync(f).isFile())return r.fulfill({status:200,contentType:TYPES[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});
    return r.fulfill({status:404,contentType:TYPES['.html'],body:fs.readFileSync(path.join(ROOT,'404.html'))})});
  await ctx.route(NEW+'/**',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><title>新網址</title><p>new'}));
  return ctx};
const land=async(ctx,u)=>{const p=await ctx.newPage();await p.goto(u);await p.waitForURL(x=>x.href.startsWith(NEW),{timeout:4000}).catch(()=>{});await p.waitForTimeout(200);const h=p.url();await p.close();return h};
const dec=u=>{try{return decodeURI(u)}catch(_){return u}};
let ctx=await mk();
for(const [from,to] of [['/-/','/'],['/-/home.html','/home.html'],['/-/index.html?d=events','/index.html?d=events'],['/-/?d=fruit#join=測試','/?d=fruit#join=測試'],
  ['/-/abc/def.html?x=1#y','/abc/def.html?x=1#y'],['/-','/']]){
  const got=await land(ctx,OLD+from);ok(dec(got)===NEW+to,`${from} → ${dec(got)}`);
}
{const p=await ctx.newPage();await p.goto(OLD+'/other-project/');await p.waitForTimeout(600);ok(p.url()===OLD+'/other-project/'&&/找不到/.test(await p.title()),'不是 /-/ 底下的網址：不轉，顯示找不到');
 ok(await p.getAttribute('#go','href')===NEW+'/','  按鈕指到新首頁');await p.close()}
{const p=await ctx.newPage();await p.goto(OLD+'/-/tools/redirect-page/-/index.html');await p.waitForTimeout(600);ok(p.url().startsWith(OLD),'放在看板 repo 的 tools/redirect-page/ 裡時不動作');await p.close()}
await ctx.close();
ctx=await mk({js:false});
{const got=await land(ctx,OLD+'/-/index.html?d=events');ok(got===NEW+'/','關掉 JavaScript：meta refresh 帶到新首頁 → '+got)}
await ctx.close();
/* 清除用 sw.js：先在 /-/ 裝一個舊看板式的 Service Worker 與快取，再換成轉址頁的 sw.js。
   Service Worker 的更新請求不經過 Playwright 的 route，這一段改用測試自己開的本機伺服器（127.0.0.1:8301，localhost 可以用 Service Worker） */
{const oldSW="self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open('board-cache-v1').then(c=>c.put('/x',new Response('x'))))});self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',()=>{});";
 let sw=oldSW;const srv=require('http').createServer((q,r)=>{const u=q.url.split('?')[0];
   if(u==='/-/sw.js'){r.writeHead(200,{'Content-Type':TYPES['.js'],'Cache-Control':'no-store'});return r.end(sw)}
   if(u==='/-/old.html'){r.writeHead(200,{'Content-Type':TYPES['.html']});return r.end('<!doctype html><title>old</title>')}
   r.writeHead(404);r.end()});await new Promise(r=>srv.listen(8301,'127.0.0.1',r));
 ctx=await b.newContext({serviceWorkers:'allow'});const p=await ctx.newPage();await p.goto('http://127.0.0.1:8301/-/old.html');
 await p.evaluate(async()=>{await navigator.serviceWorker.register('sw.js',{scope:'./'});await navigator.serviceWorker.ready;await new Promise(r=>setTimeout(r,500))});
 const before=await p.evaluate(async()=>[(await navigator.serviceWorker.getRegistrations()).length,(await caches.keys()).join(',')]);
 ok(before[0]===1&&before[1]==='board-cache-v1','  （準備）舊看板 Service Worker 與快取已裝好：'+before.join(' / '));
 sw=fs.readFileSync(path.join(ROOT,'-','sw.js'),'utf8');
 await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()}).catch(()=>{});await p.waitForTimeout(1500);await p.waitForLoadState('load').catch(()=>{});
 const after=await p.evaluate(async()=>[(await navigator.serviceWorker.getRegistrations()).length,(await caches.keys()).join(',')]).catch(()=>null);
 ok(after&&after[0]===0&&after[1]==='','清除用 sw.js：Service Worker 解除註冊、board-cache 刪掉 → '+JSON.stringify(after));
 srv.close();
}
await ctx.close();await b.close();process.exit(bad?1:0)})();
