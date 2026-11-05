/* pv1：開通部門（provision.js）與新的登入提示、錯誤視窗。固定 8300 埠。
   網站用 https://linkmasterking.github.io/-/ 這個網址打開（route 轉到本機 8300），這樣沒有資料檔的新部門也會照正式網站的方式連雲端；
   GitHub API 用一個假的檔案庫模擬（GET 回檔案或 404、PUT 檢查 sha）。
   A：有權杖的管理員在權益部開通行銷部（新建）與活動部（重設）；初始密碼太短時視窗裡出現紅字、不關。
   B：沒有權杖的新裝置打開行銷部 → 初始密碼（錯的有紅字）→ 建立身分（第一位管理員）→ 自動連上雲端 → 換成部門自己的共用密碼 → 存回雲端。
   C：另一台新裝置用部門共用密碼「＋ 新增身分」→ 自動連上雲端。
   D：還沒開通的財務部：登入後提醒共用密碼太短、提醒沒有連上雲端，頁首也寫出來。
   E：管理員更改共用密碼不用輸入舊密碼。 */
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();let bad=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m);if(!c)bad++};
const store={'data.json':JSON.parse(fs.readFileSync(__dirname+'/data_test.json','utf8')),'data-events.json':{schemaVersion:9,id:'board-events',title:'活動部工作進度',members:[{id:'mx',name:'法屎',role:'admin',kdf:'a:b',createdAt:''}],issues:[],events:[],weeks:[]}};
delete store['data.json'].sync;
const sha={};let n=0;Object.keys(store).forEach(k=>sha[k]='s'+(n++));const commits=[];
const SITE='https://linkmasterking.github.io/-/';
const mk=async(w)=>{const ctx=await b.newContext({viewport:{width:w,height:900},serviceWorkers:'block'});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route(SITE+'**',async r=>{const u=r.request().url().replace(SITE,'http://127.0.0.1:8300/');const res=await r.fetch({url:u});return r.fulfill({response:res})});
  await ctx.route('https://api.github.com/**',async r=>{const q=r.request(),u=q.url();if(u.includes('/commits'))return r.fulfill({status:200,contentType:'application/json',body:'[]'});
    const path=decodeURIComponent(u.split('/contents/')[1].split('?')[0]);
    if(q.method()==='GET'){if(!store[path])return r.fulfill({status:404,body:'{}'});return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha:sha[path],content:Buffer.from(JSON.stringify(store[path])).toString('base64')})})}
    const bd=JSON.parse(q.postData());if(store[path]&&bd.sha!==sha[path])return r.fulfill({status:409,body:'{}'});
    store[path]=JSON.parse(Buffer.from(bd.content,'base64').toString());sha[path]='s'+(n++);commits.push(path+' '+bd.message.split('\n')[0]);
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha:sha[path]}})})});
  const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));return p};
const open=async(p,q)=>{await p.goto(SITE+'index.html'+(q||''));await p.waitForFunction(()=>!document.getElementById('splash'),null,{timeout:8000}).catch(()=>{});await p.waitForTimeout(800)};
const dlg=p=>p.$eval('#dlgForm',f=>({t:f.querySelector('b').textContent,err:(e=>e&&!e.hidden?e.textContent:'')(f.querySelector('.dlg-err')),note:(f.querySelector('.dlg-note')||{}).textContent||''})).catch(()=>null);
const okBtn=p=>p.click('#dlgForm [data-act=ok]');const W=()=>new Promise(r=>setTimeout(r,700));

/* A：管理員（有權杖）在權益部開通 */
let p=await mk(1300);await p.addInitScript(()=>localStorage.setItem('workboard:ghtoken','T'));await open(p);
await p.click('#editBtn');await W();await p.fill('#dlgForm input[name=pw]','0000');await okBtn(p);await W();
await p.fill('#dlgForm input[name=name]','會長');await p.fill('#dlgForm input[name=p1]','short');await p.fill('#dlgForm input[name=p2]','short');await okBtn(p);await W();
let d=await dlg(p);ok(d&&/至少要 12 碼/.test(d.err),'A 個人密碼太短：視窗裡紅字、不關 → '+(d&&d.err||'').slice(0,30));
await p.fill('#dlgForm input[name=p1]','admin-pass-2026');await p.fill('#dlgForm input[name=p2]','admin-pass-2026');await okBtn(p);await p.waitForTimeout(1500);
d=await dlg(p);if(d&&/太短/.test(d.t)){await p.click('#dlgForm [data-act=cancel]');await W()}   /* 權益部測試資料的共用密碼是 0000：提醒換，先取消 */
await p.click('#cancelBtn').catch(()=>{});await W();
await p.evaluate(()=>openSettings());await W();
ok(!!(await p.$('#setOv [data-set=provision]')),'A 有權杖的裝置看得到「開通部門」');
await p.click('#setOv [data-set=provision]');await p.waitForTimeout(1500);
ok(await p.isChecked('#dlgForm input[name=d_marketing]')&&!(await p.isChecked('#dlgForm input[name=d_rights]')),'A 行銷部預設勾選、權益部不勾');
ok(await p.isChecked('#dlgForm input[name=d_events]'),'A 活動部（有檔案、沒權杖）預設勾選');
for(const id of ['president','secretariat','finance','affairs','pr','works'])await p.uncheck(`#dlgForm input[name=d_${id}]`).catch(()=>{});
await p.fill('#dlgForm input[name=p1]','1234');await p.fill('#dlgForm input[name=p2]','1234');await okBtn(p);await W();
d=await dlg(p);ok(d&&d.t.startsWith('開通部門')&&/至少要 12 碼/.test(d.err),'A 初始密碼四碼：紅字說明、視窗不關');
await p.fill('#dlgForm input[name=p1]','stust-init-2026');await p.fill('#dlgForm input[name=p2]','stust-init-2026');await okBtn(p);await W();
d=await dlg(p);ok(d&&/活動部/.test(d.note),'A 重設已有資料的部門前先確認');
await p.click('#dlgForm [data-act=delete]');await p.waitForTimeout(2500);
d=await dlg(p);ok(d&&d.t==='開通完成','A 開通完成：'+(d&&d.note||'').slice(0,40));
const mkt=store['data-marketing.json'],ev=store['data-events.json'];
ok(!!mkt&&mkt.sync.tokenEnc&&mkt.sync.initial&&mkt.pwKdf&&mkt.title==='行銷部工作進度','A 雲端建立 data-marketing.json（加密權杖、初始密碼）');
ok(ev.sync&&ev.sync.tokenEnc&&ev.members.length===1&&ev.members[0].name==='法屎','A 活動部只補權杖與密碼，身分不動');
ok(!JSON.stringify(store).includes('"T"'),'A 雲端資料裡看不到明碼權杖');
ok(!p.errs.length,'A 沒有錯誤 '+p.errs.join('|'));await p.context().close();

/* B：行銷部第一個人（沒有權杖的新裝置） */
p=await mk(412);await open(p,'?d=marketing');
await p.click('#editBtn');await W();
d=await dlg(p);ok(d&&d.t==='第一次使用：輸入初始密碼','B 標題是「第一次使用」');
await p.fill('#dlgForm input[name=pw]','wrong-password');await okBtn(p);await p.waitForTimeout(1500);
d=await dlg(p);ok(d&&/密碼不正確/.test(d.err),'B 初始密碼錯：紅字');
await p.fill('#dlgForm input[name=pw]','stust-init-2026');await okBtn(p);await p.waitForTimeout(1500);
ok(await p.evaluate(()=>localStorage.getItem('workboard:ghtoken'))==='T','B 輸入初始密碼後自動拿到權杖');
await p.fill('#dlgForm input[name=name]','行銷甲');await p.fill('#dlgForm input[name=p1]','mkt-person-001');await p.fill('#dlgForm input[name=p2]','mkt-person-001');await okBtn(p);await p.waitForTimeout(2500);
d=await dlg(p);ok(d&&d.t==='設定部門自己的共用密碼','B 第一位管理員：請他換部門自己的共用密碼');
await p.fill('#dlgForm input[name=n1]','marketing-own-pw');await p.fill('#dlgForm input[name=n2]','marketing-own-pw');await okBtn(p);await p.waitForTimeout(2500);
let m2=store['data-marketing.json'];
ok(m2.members.length===1&&m2.members[0].name==='行銷甲'&&m2.members[0].role==='admin'&&!!m2.members[0].tok,'B 雲端有「行銷甲」（管理員、帶加密權杖）');
ok(!m2.sync.initial&&!!m2.sync.tokenEnc,'B 換共用密碼後拿掉初始標記、權杖用新密碼重新加密');
ok(!(await dlg(p))||!(await p.$('#dlg[open]')),'B 已連上雲端：沒有跳「沒有連上雲端」');
ok(!p.errs.length,'B 沒有錯誤 '+p.errs.join('|'));await p.context().close();

/* C：行銷部第二個人 */
p=await mk(1300);await open(p,'?d=marketing');await p.click('#editBtn');await W();
d=await dlg(p);ok(d&&/新增身分/.test(d.note),'C 選身分視窗有使用提示');
await p.click('#dlgForm [data-act=alt]');await W();
await p.fill('#dlgForm input[name=pw]','stust-init-2026');await okBtn(p);await p.waitForTimeout(1500);
d=await dlg(p);ok(d&&/不正確/.test(d.err),'C 初始密碼已被換掉：紅字');
await p.fill('#dlgForm input[name=pw]','marketing-own-pw');await okBtn(p);await p.waitForTimeout(1500);
await p.fill('#dlgForm input[name=name]','行銷甲');await p.fill('#dlgForm input[name=p1]','mkt-person-002');await p.fill('#dlgForm input[name=p2]','mkt-person-002');await okBtn(p);await W();
d=await dlg(p);ok(d&&/同名/.test(d.err),'C 同名：紅字');
await p.fill('#dlgForm input[name=name]','行銷乙');await okBtn(p);await p.waitForTimeout(2500);
ok(store['data-marketing.json'].members.length===2&&await p.evaluate(()=>localStorage.getItem('workboard:ghtoken'))==='T','C 新成員建立身分後自動連上雲端、雲端有兩個身分');
ok(!p.errs.length,'C 沒有錯誤 '+p.errs.join('|'));
/* E：管理員改共用密碼不用舊密碼（用 C 這台：先把行銷乙設成管理員不方便，改用 B 的身分登入） */
await p.close();p=await p.context().newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await open(p,'?d=marketing');
await p.click('#editBtn');await W();await p.click('#dlgForm .csel-btn');await p.waitForTimeout(200);await p.click('#dlgForm .csel-list [role=option]:nth-child(1)');
await p.fill('#dlgForm input[name=pw]','mkt-person-001');await okBtn(p);await p.waitForTimeout(1500);
await p.evaluate(()=>openSettings());await W();await p.click('#setOv [data-set=team]');await W();await p.click('#dlgForm [data-x=sharedpw]');await W();
d=await dlg(p);ok(d&&d.t==='設定新的部門共用密碼'&&!(await p.$('#dlgForm input[name=old]')),'E 管理員改共用密碼不用輸入舊密碼');
await p.context().close();

/* D：還沒開通的財務部 */
p=await mk(412);await open(p,'?d=finance');await p.click('#editBtn');await W();
await p.fill('#dlgForm input[name=pw]','0000');await okBtn(p);await p.waitForTimeout(1500);
await p.fill('#dlgForm input[name=name]','財務甲');await p.fill('#dlgForm input[name=p1]','fin-person-0001');await p.fill('#dlgForm input[name=p2]','fin-person-0001');await okBtn(p);await p.waitForTimeout(2000);
d=await dlg(p);ok(d&&d.t==='部門共用密碼太短','D 共用密碼 0000：請管理員換');
await p.click('#dlgForm [data-act=cancel]');await W();
d=await dlg(p);ok(d&&d.t==='這台裝置沒有連上雲端'&&/開通部門/.test(d.note),'D 沒有連上雲端：說明資料只在這台裝置');
await p.click('#dlgForm [data-act=ok]');await W();
ok(/沒有連上雲端/.test(await p.textContent('#saveInfo')),'D 頁首寫出「這台裝置沒有連上雲端」');
await p.click('#saveBtn');await W();d=await dlg(p);ok(d&&/還沒開通雲端/.test(d.note),'D 儲存時說明部門還沒開通');
await okBtn(p);await W();d=await dlg(p);ok(d&&/只存在這台裝置/.test(d.err),'D 沒貼權杖按確定：紅字提示');
ok(!store['data-finance.json'],'D 財務部沒有寫進雲端');
ok(!p.errs.length,'D 沒有錯誤 '+p.errs.join('|'));
console.log('commits:',commits.join(' / '));
await b.close();process.exit(bad?1:0)})();
