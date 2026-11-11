/* 權杖作廢後恢復（auth.js 的 tokenRecover、cloud.js 的 cloudPush）與「tokenEnc 不再寫入」：
   1. 裝置 A（用記住的裝置自動登入）：權杖作廢 → 存檔 401 → 輸入全會密碼＋個人密碼 → 自動重試成功；members[].tok 換成新權杖
   2. 裝置 B（全新瀏覽器）：只用個人密碼登入 → 拿到新權杖 → 存檔一次就成功，沒有恢復視窗
   3. 全會密碼那份還沒換（學生會還沒更新）→ 不重試、提示稍後再試；按取消 → 修改留在本機
   4. 改部門共用密碼、儲存前準備：都不會把權杖寫進 sync.tokenEnc
   測試權杖是假的字串；輸出只印「通過／失敗」，不印任何權杖或密文。GitHub API 用 route 模擬。
   執行：cd tools/tests && node tk1.js（自己開網站，不用另外開 http.server） */
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const http=require('http');const {webcrypto:wc,createHash}=require('crypto');
const ROOT=path.resolve(__dirname,'..','..');const PORT=8302;
const OLD='fake-old-token-for-test-1111',NEW='fake-new-token-for-test-2222';
const ALLPW='all-dept-password-123',MYPW='my-personal-pass-1',SHARED='0000';
const te=new TextEncoder(),b64=u=>Buffer.from(u).toString('base64'),ub=s=>new Uint8Array(Buffer.from(s,'base64'));
const base=pw=>wc.subtle.importKey('raw',te.encode(pw),'PBKDF2',false,['deriveBits','deriveKey']);
const aes=async(pw,salt)=>wc.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:210000},await base(pw),{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
const enc=async(t,pw)=>{const s=wc.getRandomValues(new Uint8Array(16)),i=wc.getRandomValues(new Uint8Array(12));return {s:b64(s),i:b64(i),c:b64(new Uint8Array(await wc.subtle.encrypt({name:'AES-GCM',iv:i},await aes(pw,s),te.encode(t))))}};
const dec=async(o,pw)=>{try{return new TextDecoder().decode(await wc.subtle.decrypt({name:'AES-GCM',iv:ub(o.i)},await aes(pw,ub(o.s)),ub(o.c)))}catch(_){return null}};
const kdf=async pw=>{const s=wc.getRandomValues(new Uint8Array(16));return b64(s)+':'+b64(new Uint8Array(await wc.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:s,iterations:210000},await base(pw),256)))};
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);return r.end()}
  r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r)});
let fails=0;const ok=(c,m)=>{console.log((c?'通過 ':'失敗 ')+m);if(!c)fails++};

(async()=>{
  await new Promise(r=>srv.listen(PORT,'127.0.0.1',r));
  const memKdf=await kdf(MYPW);
  const mk=async(allTok)=>({schemaVersion:13,id:'board-main',title:'權杖測試',savedAt:'2026-11-11 10:00',issues:[],events:[],weeks:[],labels:[],docs:[],minutes:[],follows:[],
    members:[{id:'m1',name:'王',role:'admin',createdAt:'2026-11-01 10:00',kdf:memKdf,tok:await enc(OLD,MYPW)}],pwKdf:await kdf(SHARED),
    sync:{owner:'o',repo:'r',branch:'main',path:'data.json',tokenAll:await enc(allTok,ALLPW),tokenEnc:await enc(OLD,SHARED)}});
  let remote,sha='s0';const log={puts:[],msgs:[]};
  const b=await chromium.launch();
  const open=async(prep)=>{
    const ctx=await b.newContext({viewport:{width:1200,height:850},serviceWorkers:'block'});
    await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
    await ctx.route(`http://127.0.0.1:${PORT}/data.json*`,r=>r.fulfill({contentType:'application/json',body:JSON.stringify(remote)}));
    await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url();
      if(u.includes('/commits'))return r.fulfill({status:200,contentType:'application/json',body:'[]'});
      if(!u.includes('/contents/data.json'))return r.fulfill({status:404,body:'{}'});
      if(q.method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha,content:Buffer.from(JSON.stringify(remote)).toString('base64')})});
      const auth=(q.headers().authorization||'').replace('Bearer ','');
      if(auth!==NEW){log.puts.push(401);return r.fulfill({status:401,contentType:'application/json',body:'{"message":"Bad credentials"}'})}   /* 舊權杖已作廢 */
      const bd=JSON.parse(q.postData());remote=JSON.parse(Buffer.from(bd.content,'base64').toString());sha='s'+Date.now();log.puts.push(200);log.msgs.push(bd.message);
      return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha}})})});
    const p=await ctx.newPage();p.errs=[];p.out=[];
    p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>p.out.push(m.text()));
    await p.addInitScript(prep);
    await p.goto(`http://127.0.0.1:${PORT}/index.html`);await p.waitForTimeout(3000);p.ctx=ctx;return p};
  const leaks=async(p)=>{const html=await p.content();const all=[html,...p.out,...p.errs,...log.msgs].join('\n');return [OLD,NEW,ALLPW,MYPW].filter(x=>all.includes(x)).length};
  const dlg=async(p)=>p.$eval('#dlg[open] #dlgForm>b',x=>x.textContent).catch(()=>'');
  const fp=createHash('sha256').update(memKdf).digest('base64').slice(0,22);

  /* ---------- 1. 裝置 A：記住的裝置自動登入（手上沒有個人密碼），權杖已作廢 ---------- */
  remote=await mk(NEW);const encBefore=JSON.stringify(remote.sync.tokenEnc);
  const A=await open(`localStorage.setItem('workboard:ghtoken',${JSON.stringify(OLD)});localStorage.setItem('workboard:remember:board-main',${JSON.stringify(JSON.stringify({id:'m1',fp}))})`);
  ok(await A.evaluate(()=>meName()==='王'&&!sessionPw),'裝置 A：用記住的裝置自動登入');
  await A.evaluate(()=>{state.title='恢復後的標題';saveFlow()});
  await A.waitForSelector('#dlg[open] input[name=all]',{timeout:8000}).catch(()=>{});
  ok((await dlg(A))==='上傳權限已更新'&&await A.$('#dlg[open] input[name=me]')!==null,'存檔 401 → 跳出恢復視窗，要求全會密碼＋個人密碼');
  ok(await A.evaluate(()=>!localStorage.getItem('workboard:ghtoken')),'舊權杖已從裝置清掉');
  await A.fill('#dlg[open] input[name=all]','wrong-password-xx');await A.fill('#dlg[open] input[name=me]',MYPW);await A.click('#dlg[open] [data-act=ok]');await A.waitForTimeout(2500);
  ok((await dlg(A))==='上傳權限已更新','全會密碼錯：視窗不關、不送出');
  await A.fill('#dlg[open] input[name=all]',ALLPW);await A.fill('#dlg[open] input[name=me]','wrong-personal');await A.click('#dlg[open] [data-act=ok]');await A.waitForTimeout(2500);
  ok((await dlg(A))==='上傳權限已更新','個人密碼錯：視窗不關、不送出');
  await A.fill('#dlg[open] input[name=me]',MYPW);await A.click('#dlg[open] [data-act=ok]');await A.waitForTimeout(3500);
  ok(JSON.stringify(log.puts)==='[401,200]',`作廢的權杖 401 一次，恢復後自動重試成功（${log.puts.join('→')}）`);
  ok(remote.title==='恢復後的標題','這次的修改有存上雲端');
  ok(await dec(remote.members[0].tok,MYPW)===NEW,'members[].tok 已換成用個人密碼加密的新權杖');
  ok(JSON.stringify(remote.sync.tokenEnc)===encBefore,'sync.tokenEnc 沒有被改寫（仍是原本那份舊的）');
  ok(await A.evaluate(t=>localStorage.getItem('workboard:ghtoken')===t,NEW),'裝置 A 現在用的是新權杖');
  ok(!(await leaks(A)),'畫面、console、commit 訊息裡沒有權杖或密碼');
  ok(!A.errs.length,'裝置 A 沒有頁面錯誤 '+A.errs.join(' | '));
  await A.ctx.close();

  /* ---------- 2. 裝置 B：全新瀏覽器，只用個人密碼登入 ---------- */
  log.puts=[];
  const B=await open('');
  await B.click('#setBtn');await B.waitForTimeout(800);await B.click('#setOv .set-gate .primary');await B.waitForTimeout(600);
  await B.fill('#dlg[open] input[name=pw]',MYPW);await B.click('#dlg[open] [data-act=ok]');await B.waitForTimeout(2500);
  for(let i=0;i<3;i++){if(await B.$('#dlg[open]'))await B.click('#dlg[open] [data-act=cancel]').catch(()=>{});await B.waitForTimeout(400)}
  ok(await B.evaluate(t=>meName()==='王'&&localStorage.getItem('workboard:ghtoken')===t,NEW),'裝置 B：個人密碼登入後拿到新權杖');
  await B.evaluate(()=>{if(setOpen)closeSettings(true);state.title='裝置 B 的修改';saveFlow()});await B.waitForTimeout(3500);
  ok(JSON.stringify(log.puts)==='[200]'&&remote.title==='裝置 B 的修改','裝置 B 存檔一次就成功，沒有 401');
  ok(!(await B.$('#dlg[open] input[name=all]')),'裝置 B 沒有跳出恢復視窗');
  /* 4. tokenEnc 不再寫入：改部門共用密碼、儲存前準備 */
  const r4=await B.evaluate(async()=>{await setSharedPw('new-shared-password-123');const a=!!(state.sync&&state.sync.tokenEnc);
    sharedPwSession='short';const p=await prepareSave();return {a,b:!!(state.sync&&state.sync.tokenEnc),weak:p&&p.weak}});
  ok(!r4.a&&!r4.b,'改部門共用密碼後 tokenEnc 被拿掉、不重新加密；儲存前準備也不會寫回');
  ok(r4.weak===true,'共用密碼太短的提醒照舊');
  ok(!(await leaks(B))&&!B.errs.length,'裝置 B 沒有洩漏、沒有頁面錯誤 '+B.errs.join(' | '));
  await B.ctx.close();

  /* ---------- 3. 學生會還沒換（全會密碼那份還是舊權杖）／按取消 ---------- */
  remote=await mk(OLD);log.puts=[];log.msgs=[];
  const C=await open(`localStorage.setItem('workboard:ghtoken',${JSON.stringify(OLD)});localStorage.setItem('workboard:remember:board-main',${JSON.stringify(JSON.stringify({id:'m1',fp}))})`);
  await C.evaluate(()=>{state.title='x';saveFlow()});await C.waitForSelector('#dlg[open] input[name=all]',{timeout:8000}).catch(()=>{});
  await C.fill('#dlg[open] input[name=all]',ALLPW);await C.fill('#dlg[open] input[name=me]',MYPW);await C.click('#dlg[open] [data-act=ok]');await C.waitForTimeout(2500);
  const t3=await C.$eval('#toast',x=>x.textContent).catch(()=>'');
  ok(JSON.stringify(log.puts)==='[401]'&&/還沒換上新的上傳權限/.test(t3),`全會密碼那份還沒換：不重試、提示稍後再試（${log.puts.join('→')}）`);
  ok(await C.evaluate(t=>localStorage.getItem('workboard:ghtoken')===t&&JSON.parse(localStorage.getItem(KEY)).title==='x',OLD),'修改留在這台裝置；下次存檔會再問一次');
  log.puts=[];await C.evaluate(()=>{state.title='y';saveFlow()});await C.waitForSelector('#dlg[open] input[name=all]',{timeout:8000}).catch(()=>{});
  await C.click('#dlg[open] [data-act=cancel]');await C.waitForTimeout(2000);
  const t4=await C.$eval('#toast',x=>x.textContent).catch(()=>'');
  ok(JSON.stringify(log.puts)==='[401]'&&/沒有恢復/.test(t4),'按取消：不重試、修改留在這台裝置');
  ok(!(await leaks(C))&&!C.errs.length,'沒有洩漏、沒有頁面錯誤');
  await C.ctx.close();
  await b.close();srv.close();
  console.log(fails?`失敗 ${fails} 項`:'全部通過');process.exit(fails?1:0);
})().catch(e=>{console.error(String(e&&e.message||e).replaceAll(NEW,'＊').replaceAll(OLD,'＊'));process.exit(1)});
