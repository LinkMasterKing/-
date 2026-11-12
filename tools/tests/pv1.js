/* pv1：開通部門（provision.js）與新的登入提示、錯誤視窗。固定 8300 埠。
   網站用 https://linkmasterking.github.io/-/ 這個網址打開（route 轉到本機 8300），這樣沒有資料檔的新部門也會照正式網站的方式連雲端；
   GitHub API 用一個假的檔案庫模擬（GET 回檔案或 404、PUT 檢查 sha）。網站上的 data-*.json 一律當成不存在（各部門的資料只從假的檔案庫讀）。
   2026-11-11 改寫成現在的流程（2026-11-06 起「開通部門」＋初始密碼改成「全會密碼」＋自動開通，登入改從設定頁鎖頭）：
   A：有權杖的後台管理員在權益部登入（個人密碼太短：紅字、不關）→ 網站管理 → 全會密碼（太短：紅字、不關）→ 行銷部新建空白看板、活動部只補上傳權限（身分不動）。
   B：沒有權杖的新裝置打開行銷部 → 全會密碼（錯的有紅字）→ 自動拿到權杖 → 建立身分（第一位管理員）→ 完成畫面 → 身分存上雲端。
   C：另一台新裝置「＋ 新增身分」＋全會密碼（錯的、同名有紅字）→ 自動連上雲端。
   E：管理員更改共用密碼不用輸入舊密碼。
   D：還沒開通的財務部：登入後提醒共用密碼太短、提醒沒有連上雲端，頁首也寫出來；儲存時說明還沒開通、一般成員沒有貼權杖的欄位，不寫進雲端。 */
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();let bad=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m);if(!c)bad++};
const store={'data.json':JSON.parse(fs.readFileSync(__dirname+'/data_test.json','utf8')),'data-events.json':{schemaVersion:9,id:'board-events',title:'活動部工作進度',members:[{id:'mx',name:'法屎',role:'admin',kdf:'a:b',createdAt:''}],issues:[],events:[],weeks:[]}};
delete store['data.json'].sync;
const sha={};let n=0;Object.keys(store).forEach(k=>sha[k]='s'+(n++));const commits=[];
const SITE='https://linkmasterking.github.io/-/';
const mk=async(w)=>{const ctx=await b.newContext({viewport:{width:w,height:900},serviceWorkers:'block'});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route(SITE+'**',async r=>{const u=r.request().url().replace(SITE,'http://127.0.0.1:8300/');const res=await r.fetch({url:u});return r.fulfill({response:res})});
  await ctx.route(/linkmasterking\.github\.io\/-\/data-.*\.json/,r=>r.fulfill({status:404,body:''}));   /* 後註冊的 route 先處理：放在轉到本機那條之後 */
  await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url();if(u.includes('/commits'))return r.fulfill({status:200,contentType:'application/json',body:'[]'});
    const path=decodeURIComponent(u.split('/contents/')[1].split('?')[0]);
    if(q.method()==='GET'){if(!store[path])return r.fulfill({status:404,body:'{}'});return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha:sha[path],content:Buffer.from(JSON.stringify(store[path])).toString('base64')})})}
    const bd=JSON.parse(q.postData());if(store[path]&&bd.sha!==sha[path])return r.fulfill({status:409,body:'{}'});
    store[path]=JSON.parse(Buffer.from(bd.content,'base64').toString());sha[path]='s'+(n++);commits.push(path+' '+bd.message.split('\n')[0]);
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:sha[path]}})})});
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));return p};
const open=async(p,q)=>{await p.goto(SITE+'index.html'+(q||''));await p.waitForFunction(()=>!document.getElementById('splash'),null,{timeout:8000}).catch(()=>{});await p.waitForTimeout(800)};
const dlg=p=>p.$eval('#dlgForm',f=>({t:f.querySelector('b').textContent,err:(e=>e&&!e.hidden?e.textContent:'')(f.querySelector('.dlg-err')),note:(f.querySelector('.dlg-note')||{}).textContent||''})).catch(()=>null);
const okBtn=p=>p.click('#dlgForm [data-act=ok]');const gate=async p=>{await p.click('#setBtn');await p.waitForTimeout(900);await p.click('#setOv .set-gate .primary');await W()};const ALLPW='stust-all-pw-2026';const W=()=>new Promise(r=>setTimeout(r,700));

/* A：後台管理員（有權杖）在權益部設定全會密碼 */
let p=await mk(1300);await p.addInitScript(()=>{localStorage.setItem('workboard:ghtoken','T');localStorage.setItem('workboard:siteadmin','1')});await open(p);
await gate(p);await p.fill('#dlgForm input[name=pw]','0000');await okBtn(p);await W();
await p.fill('#dlgForm input[name=name]','會長');await p.fill('#dlgForm input[name=p1]','short');await p.fill('#dlgForm input[name=p2]','short');await okBtn(p);await W();
let d=await dlg(p);ok(d&&/至少要 12 碼/.test(d.err),'A 個人密碼太短：視窗裡紅字、不關 → '+(d&&d.err||'').slice(0,30));
await p.fill('#dlgForm input[name=p1]','admin-pass-2026');await p.fill('#dlgForm input[name=p2]','admin-pass-2026');await okBtn(p);
for(let i=0;i<8;i++){await p.waitForTimeout(500);d=await dlg(p);if(d&&/太短|沒有連上雲端/.test(d.t)&&await p.$('#dlg[open]')){await p.click('#dlgForm [data-act=cancel]');await W()}}   /* 權益部測試資料的共用密碼是 0000：提醒換，先取消 */
ok(await p.evaluate(()=>loggedIn()&&setOpen),'A 登入後設定頁還開著');
const rightsPw=JSON.stringify([store['data.json'].pwKdf,store['data.json'].pwHash]);   /* 登入時舊的 0000 雜湊會升級成 PBKDF2（auth.js 的 unlockShared），所以在登入後才記下來 */
ok(!!(await p.$('#setOv [data-set=site]')),'A 後台管理員看得到「網站管理」');
await p.click('#setOv [data-set=site]');await W();
ok(!!(await p.$('#setOv .set-hub [data-hub=allpw]')),'A 網站管理裡有「全會密碼」（有權杖的裝置）');
await p.click('#setOv .set-hub [data-hub=allpw]');await W();
d=await dlg(p);ok(d&&d.t==='設定全會密碼','A 全會密碼視窗');
await p.fill('#dlgForm input[name=p1]','1234');await p.fill('#dlgForm input[name=p2]','1234');await okBtn(p);await W();
d=await dlg(p);ok(d&&d.t==='設定全會密碼'&&/至少要 12 碼/.test(d.err),'A 全會密碼四碼：紅字說明、視窗不關');
await p.fill('#dlgForm input[name=p1]',ALLPW);await p.fill('#dlgForm input[name=p2]',ALLPW);await okBtn(p);await p.waitForTimeout(4000);
d=await dlg(p);ok(d&&d.t==='全會密碼已設定'&&/新建立看板：[^\n]*行銷部/.test(d.note)&&/補上上傳權限：[^\n]*活動部/.test(d.note),'A 開通完成：'+(d&&d.note||'').replace(/\n/g,' ').slice(0,60));
await okBtn(p).catch(()=>{});await W();
const mkt=store['data-marketing.json'],ev=store['data-events.json'];
ok(!!mkt&&!!mkt.sync.tokenAll&&mkt.members.length===0&&mkt.title==='行銷部工作進度','A 雲端建立 data-marketing.json（空白看板、全會密碼加密的權杖）');
ok(ev.sync&&ev.sync.tokenAll&&ev.members.length===1&&ev.members[0].name==='法屎','A 活動部只補上傳權限，身分不動');
ok(JSON.stringify([store['data.json'].pwKdf,store['data.json'].pwHash])===rightsPw,'A 權益部的共用密碼不動');
ok(!JSON.stringify(store).includes('"T"'),'A 雲端資料裡看不到明碼權杖');
ok(!p.errs.length,'A 沒有錯誤 '+p.errs.join('|'));await p.context().close();

/* B：行銷部第一個人（沒有權杖的新裝置） */
p=await mk(412);await open(p,'?d=marketing');
await gate(p);
d=await dlg(p);ok(d&&d.t==='加入行銷部（1/2）：輸入學生會給的密碼','B 標題是「加入行銷部（1/2）」');
await p.fill('#dlgForm input[name=pw]','wrong-password');await okBtn(p);await p.waitForTimeout(1500);
d=await dlg(p);ok(d&&/密碼不正確/.test(d.err),'B 密碼錯：紅字');
await p.fill('#dlgForm input[name=pw]',ALLPW);await okBtn(p);await p.waitForTimeout(1500);
ok(await p.evaluate(()=>localStorage.getItem('workboard:ghtoken'))==='T','B 輸入全會密碼後自動拿到權杖');
d=await dlg(p);ok(d&&d.t==='加入行銷部（2/2）：建立你的身分','B 第 2 步：建立身分');
await p.fill('#dlgForm input[name=name]','行銷甲');await p.fill('#dlgForm input[name=p1]','mkt-person-001');await p.fill('#dlgForm input[name=p2]','mkt-person-001');await okBtn(p);await p.waitForTimeout(2500);
d=await dlg(p);ok(d&&d.t==='完成：你已經加入行銷部'&&/管理員/.test(d.note),'B 完成畫面（第一位是管理員）');
await okBtn(p).catch(()=>{});await W();
let m2=store['data-marketing.json'];
ok(m2.members.length===1&&m2.members[0].name==='行銷甲'&&m2.members[0].role==='admin'&&!!m2.members[0].tok,'B 雲端有「行銷甲」（管理員、帶加密權杖）');
ok(!(await p.$('#dlg[open]')),'B 已連上雲端：沒有跳「沒有連上雲端」');
ok(!p.errs.length,'B 沒有錯誤 '+p.errs.join('|'));await p.context().close();

/* C：行銷部第二個人 */
p=await mk(1300);await open(p,'?d=marketing');await gate(p);
d=await dlg(p);ok(d&&d.t==='選擇編輯身分'&&/新增身分/.test(d.note),'C 選身分視窗有使用提示');
await p.click('#dlgForm [data-act=alt]');await W();
await p.fill('#dlgForm input[name=pw]','stust-init-2026');await okBtn(p);await p.waitForTimeout(1500);
d=await dlg(p);ok(d&&/不正確/.test(d.err),'C 密碼錯：紅字');
await p.fill('#dlgForm input[name=pw]',ALLPW);await okBtn(p);await p.waitForTimeout(1500);
await p.fill('#dlgForm input[name=name]','行銷甲');await p.fill('#dlgForm input[name=p1]','mkt-person-002');await p.fill('#dlgForm input[name=p2]','mkt-person-002');await okBtn(p);await W();
d=await dlg(p);ok(d&&/同名/.test(d.err),'C 同名：紅字');
await p.fill('#dlgForm input[name=name]','行銷乙');await okBtn(p);await p.waitForTimeout(2500);
d=await dlg(p);if(d&&/完成/.test(d.t)){await okBtn(p).catch(()=>{});await W()}
ok(store['data-marketing.json'].members.length===2&&await p.evaluate(()=>localStorage.getItem('workboard:ghtoken'))==='T','C 新成員建立身分後自動連上雲端、雲端有兩個身分');
ok(!p.errs.length,'C 沒有錯誤 '+p.errs.join('|'));
/* E：管理員改共用密碼不用舊密碼（用 C 這台，改用 B 的身分「行銷甲」登入；先忘記這台裝置記住的「行銷乙」） */
await p.close();p=await p.context().newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
await p.addInitScript(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('workboard:remember:'))localStorage.removeItem(k)});await open(p,'?d=marketing');
await gate(p);await p.click('#dlgForm .csel-btn');await p.waitForTimeout(200);await p.click('#dlgForm .csel-list [role=option]:nth-child(1)');
await p.fill('#dlgForm input[name=pw]','mkt-person-001');await okBtn(p);await p.waitForTimeout(1500);
ok(await p.evaluate(()=>meName()==='行銷甲'&&isAdmin()),'E 用「行銷甲」（管理員）登入');
await p.click('#setOv [data-set=team]');await W();await p.click('#dlgForm [data-x=sharedpw]');await W();
d=await dlg(p);ok(d&&d.t==='設定新的部門共用密碼'&&!(await p.$('#dlgForm input[name=old]')),'E 管理員改共用密碼不用輸入舊密碼');
ok(!p.errs.length,'E 沒有錯誤 '+p.errs.join('|'));
await p.context().close();

/* D：還沒開通的財務部（A 的自動開通已經建立了，這裡拿掉，模擬還沒開通） */
delete store['data-finance.json'];
p=await mk(412);await open(p,'?d=finance');await gate(p);
d=await dlg(p);ok(d&&d.t==='輸入目前的編輯密碼','D 沒開通的部門：輸入共用密碼（預設 0000） '+JSON.stringify(d));
await p.fill('#dlgForm input[name=pw]','0000');await okBtn(p);await p.waitForTimeout(1500);
await p.fill('#dlgForm input[name=name]','財務甲');await p.fill('#dlgForm input[name=p1]','fin-person-0001');await p.fill('#dlgForm input[name=p2]','fin-person-0001');await okBtn(p);await p.waitForTimeout(2000);
d=await dlg(p);ok(d&&d.t==='部門共用密碼太短','D 共用密碼 0000：請管理員換');
await p.click('#dlgForm [data-act=cancel]');await W();
d=await dlg(p);ok(d&&d.t==='這台裝置沒有連上雲端'&&/通知學生會/.test(d.note),'D 沒有連上雲端：說明資料只在這台裝置、請通知學生會');
await p.click('#dlgForm [data-act=ok]');await W();
ok(/沒有連上雲端/.test(await p.textContent('#saveInfo')),'D 頁首寫出「沒有連上雲端」');
/* 儲存（頁首的「儲存」已拿掉，直接呼叫卡片儲存前的 prepareSave） */
await p.evaluate(()=>{window.__ps=prepareSave()});await W();
d=await dlg(p);ok(d&&d.t==='這台裝置沒有連上雲端'&&/還沒開通雲端/.test(d.note),'D 儲存時說明部門還沒開通');
ok(!(await p.$('#dlgForm input[name=token]')),'D 一般成員沒有貼權杖的欄位');
await p.click('#dlgForm [data-act=delete]');await W();ok(await p.evaluate(async()=>!!(await window.__ps)),'D 按「只存在這台裝置」照樣存在本機');
ok(!store['data-finance.json'],'D 財務部沒有寫進雲端');
ok(!p.errs.length,'D 沒有錯誤 '+p.errs.join('|'));
console.log('commits:',commits.join(' / '));
await b.close();process.exit(bad?1:0)})();
