/* 測試共用：開 Chromium、模擬 Google Fonts 與 GitHub API（GET 回 remote、PUT 更新 sha 並記下 commit 訊息）、登入（共用密碼 0000 → 建立身分「王」）。
   nt1.js、meet1.js 用；舊的測試各自寫在檔案裡 */
const {chromium}=require('playwright');const fs=require('fs');
exports.setup=async(dataFile)=>{const b=await chromium.launch();
let remote=JSON.parse(fs.readFileSync(dataFile||__dirname+'/data_test.json','utf8')),sha='s0';const st={commits:[],puts:{}};
const mk=async(w,h,sc,touch)=>{const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:sc,hasTouch:touch,isMobile:touch,serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url();if(u.includes('/commits?'))return r.fulfill({status:200,contentType:'application/json',body:'[]'});
 if(q.method()==='GET'){if(!u.includes('data.json')&&!st.puts[u.split('?')[0]])return r.fulfill({status:404,body:'{}'});const body=st.puts[u.split('?')[0]]||remote;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha,content:Buffer.from(JSON.stringify(body)).toString('base64')})})}
 const bd=JSON.parse(q.postData());const j=JSON.parse(Buffer.from(bd.content,'base64').toString());if(u.includes('data.json'))remote=j;else st.puts[u.split('?')[0]]=j;sha='s'+Date.now();st.commits.unshift(bd.message);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha}})})});
if(exports.serveRemote)await ctx.route('http://127.0.0.1:8300/data.json*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(remote)}));   /* 網站上的 data.json 也回測試資料（別的部門讀權益部時用） */
const p=await ctx.newPage();p.errs=[];p.on('pageerror',x=>p.errs.push(x.message));p.on('console',m=>{if(m.type()==='error')p.errs.push('console:'+m.text())});await p.goto('http://127.0.0.1:8300/index.html'+(exports.q||''));await p.waitForTimeout(1800);return p};
const login=async p=>{await p.evaluate(()=>localStorage.setItem('workboard:ghtoken','T'));await p.click('#setBtn');await p.waitForTimeout(800);await p.click('#setOv .set-gate .primary');await p.waitForTimeout(400);   /* 2026-11-06：頁首「編輯」拿掉，從設定頁的鎖頭登入 */
await p.fill('#dlgForm input[name=pw]','0000').catch(()=>{});await p.click('#dlgForm [data-act=ok]').catch(()=>{});await p.waitForTimeout(500);
await p.fill('#dlgForm input[name=name]','王').catch(()=>{});await p.fill('#dlgForm input[name=p1]','password-long-1').catch(()=>{});await p.fill('#dlgForm input[name=p2]','password-long-1').catch(()=>{});await p.click('#dlgForm [data-act=ok]').catch(()=>{});await p.waitForTimeout(1500);await (async()=>{for(let i=0;i<4;i++){await p.waitForTimeout(500);const t=await p.$eval('#dlg[open] #dlgForm>b',b=>b.textContent).catch(()=>'');if(/共用密碼太短|沒有連上雲端/.test(t))await p.click('#dlgForm [data-act=cancel]').catch(()=>{})}})();await p.evaluate(()=>{if(setOpen)closeSettings(true)});await p.waitForTimeout(300);};   /* 2026-11-05：建立第一個身分後，共用密碼 0000 會請管理員換（team.js 的 sharedPwFix），測試先取消 */
return {b,mk,login,st,remote:()=>remote}};
