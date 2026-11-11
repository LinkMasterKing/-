/* 01B 資料來源開關（core/js/store.js）：
   1. github 模式（預設）跟改動前一樣能讀、能進編輯（現有測試另外跑）
   2. firestore 模式：從 Firestore 模擬器讀回來的內容＝github 模式讀資料檔的內容；整個看板唯讀
   3. frozen 模式：照樣讀資料檔，但唯讀，persist／秘書處寫回／自動開通都不寫
   4. 沒有檢視資格的帳號：讀不到，畫面提示要登入
   執行（會自己開模擬器與網站）：cd backend && npm run test:web
   只連本機 Firestore 模擬器；Firebase SDK 從 backend/node_modules 供應（route 掉 gstatic），不連外。 */
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const http=require('http');
const {createRequire}=require('module');
const ROOT=path.resolve(__dirname,'..','..');const breq=createRequire(path.join(ROOT,'backend','package.json'));
const EMU=process.env.FIRESTORE_EMULATOR_HOST;if(!EMU){console.error('要在模擬器裡跑：cd backend && npm run test:web');process.exit(1)}
const PORT=8301;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);return r.end()}
  r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r)});
let fails=0;const ok=(c,m)=>{console.log((c?'通過 ':'失敗 ')+m);if(!c)fails++};

(async()=>{
  await new Promise(r=>srv.listen(PORT,'127.0.0.1',r));
  /* 1) 用遷移程式把正式資料檔（唯讀）匯入模擬器 */
  const {initializeTestEnvironment}=breq('@firebase/rules-unit-testing');const firebase=breq('firebase/compat/app');breq('firebase/compat/firestore');
  const [h,pt]=EMU.split(':');
  const t=await initializeTestEnvironment({projectId:'demo-stustsa-board',firestore:{host:h,port:+pt,rules:fs.readFileSync(path.join(ROOT,'backend/firestore.rules'),'utf8')}});
  await t.clearFirestore();
  const tok=(uid)=>({sub:uid,user_id:uid,email:uid+'@example.test',email_verified:true,firebase:{sign_in_provider:'google.com',identities:{}}});
  await t.withSecurityRulesDisabled(async c=>{const d=c.firestore();
    await d.doc('roles/su').set({super:true,viewer:false,depts:{},rev:1,lastVia:'manual',lastRef:'bootstrap',updatedBy:'su',updatedAt:firebase.firestore.Timestamp.now()});
    await d.doc('roles/vw').set({super:false,viewer:true,depts:{},rev:1,lastVia:'manual',lastRef:'bootstrap',updatedBy:'su',updatedAt:firebase.firestore.Timestamp.now()})});
  const mig=await import(path.join(ROOT,'backend/migrate/run.js'));
  const sdb=t.authenticatedContext('su',tok('su')).firestore();
  const src=mig.loadSources();
  await mig.runImport(sdb,firebase.firestore.FieldValue,firebase.firestore.Timestamp,src,{batch:'web-test',uid:'su'});

  const b=await chromium.launch();const cfgSrc=fs.readFileSync(path.join(ROOT,'dept/config.js'),'utf8');
  const open=async(dept,source,user)=>{
    const ctx=await b.newContext({viewport:{width:1200,height:850},serviceWorkers:'block'});
    await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
    await ctx.route('https://www.gstatic.com/firebasejs/**',r=>{const f=path.join(ROOT,'backend/node_modules/firebase',r.request().url().split('/').pop());r.fulfill({contentType:'text/javascript',body:fs.readFileSync(f,'utf8')})});
    const puts=[];await ctx.route('https://api.github.com/**',r=>{if(r.request().method()!=='GET')puts.push(r.request().url());r.fulfill({status:404,body:'{}'})});
    await ctx.route(`http://127.0.0.1:${PORT}/dept/config.js*`,r=>{let s=cfgSrc;
      if(source!=='github')s=s.replace(new RegExp(`(\\{ id: "${dept}",[^\\n]*?)( \\},?\\n)`),`$1, source: "${source}"$2`);
      s=s.replace('firebase: { apiKey: "", authDomain: "", projectId: "", appId: "" }',
        `firebase: { apiKey: "demo", authDomain: "", projectId: "demo-stustsa-board", appId: "", emulator: { host: "${h}", port: ${pt}, mockUserToken: ${JSON.stringify(tok(user||'vw'))} } }`);
      r.fulfill({contentType:'text/javascript',body:s})});
    const p=await ctx.newPage();p.errs=[];p.toasts=[];p.puts=puts;p.on('pageerror',e=>p.errs.push(e.message));
    await p.exposeFunction('__toast',m=>p.toasts.push(m));
    await p.addInitScript(()=>{new MutationObserver(()=>{const t=document.querySelector('#toast,.toast');if(t&&t.textContent)window.__toast(t.textContent)}).observe(document,{subtree:true,childList:true,characterData:true})});
    await p.goto(`http://127.0.0.1:${PORT}/index.html?d=${dept}`);
    await p.waitForFunction(()=>typeof state!=='undefined'&&document.querySelector('#events'),null,{timeout:15000});await p.waitForTimeout(2500);
    p.snap=await p.evaluate(()=>({src:storeSource(),locked:boardLocked(),ro:readOnly(),editBtns:[...document.querySelectorAll('.card-edit-btn')].filter(x=>x.offsetParent&&!x.hidden).length+document.querySelectorAll('[data-edit^="e:"],[data-edit^="i:"]').length,canLogin:!!document.querySelector('[data-set-login]'),
      evDom:document.querySelectorAll('#events .ev').length,title:state.title,
      data:JSON.stringify({ev:state.events.map(e=>[e.id,e.name,e.desc,e.doneAt||null,e.issueId||null,(e.times||[]).map(x=>[x.id,x.start,x.end,x.place]),e.staff,e.labels,e.report]),
        is:state.issues.map(i=>[i.id,i.title,i.start,i.end,(i.markers||[]).length]),wk:state.weeks.map(w=>[w.id,w.date,w.text]).sort(),mem:state.members.map(m=>[m.id,m.name]),lb:state.labels})}));
    p.ctx=ctx;return p};

  for(const dept of ['events','rights','president']){
    const g=await open(dept,'github'),f=await open(dept,'firestore');
    ok(g.snap.src==='github'&&!g.snap.locked,`${dept}：github 模式不唯讀`);
    ok(f.snap.src==='firestore'&&f.snap.locked&&f.snap.ro,`${dept}：firestore 模式唯讀`);
    ok(f.snap.editBtns===0,`${dept}：firestore 模式沒有編輯按鈕（${f.snap.editBtns}）`);
    ok(g.snap.data===f.snap.data,`${dept}：兩種模式讀到的內容相同（卡片 ${JSON.parse(g.snap.data).ev.length} 張）`);
    if(g.snap.data!==f.snap.data){fs.writeFileSync(__dirname+'/fs1_g.json',g.snap.data);fs.writeFileSync(__dirname+'/fs1_f.json',f.snap.data)}
    ok(g.snap.evDom===f.snap.evDom&&g.snap.title===f.snap.title,`${dept}：畫面上的即時回報數量與標題相同（${g.snap.evDom}）`);
    ok(!f.errs.length&&!g.errs.length,`${dept}：沒有頁面錯誤 ${[...g.errs,...f.errs].join(' | ')}`);
    ok(f.toasts.some(x=>x.includes('新資料庫')),`${dept}：firestore 模式提示「已搬到新資料庫」`);
    await g.ctx.close();await f.ctx.close();
  }
  /* 凍結：唯讀、任何寫入都擋 */
  const z=await open('secretariat','frozen');
  ok(z.snap.src==='frozen'&&z.snap.locked&&z.snap.ro&&z.snap.editBtns===0,'frozen：唯讀、沒有編輯按鈕');
  const r=await z.evaluate(async()=>{localStorage.setItem('workboard:ghtoken','T');const a=await persist('x');const b=await pvPut(BOARD_DEPTS.find(d=>d.id==='secretariat'),{},null,'x');return {a,b}});
  ok(r.a===false&&/搬家中/.test(r.b)&&z.puts.length===0,`frozen：persist 回傳 ${r.a}、自動開通回傳「${r.b}」、GitHub 寫入 ${z.puts.length} 次`);
  ok(z.toasts.some(x=>x.includes('搬到新資料庫，暫停編輯')),'frozen：提示暫停編輯');
  ok(await z.evaluate(()=>deptSourceOf('rights')==='github'&&deptSourceOf('secretariat')==='frozen'),'frozen：只影響設定的那個部門');
  await z.ctx.close();
  /* 沒有檢視資格的帳號 */
  const n=await open('events','firestore','nobody');
  ok(n.snap.data.includes('"ev":[]')&&n.toasts.some(x=>x.includes('要登入才能看')),'沒有檢視資格：讀不到內容、提示要登入');
  await n.ctx.close();
  await b.close();await t.cleanup();srv.close();
  console.log(fails?`失敗 ${fails} 項`:'全部通過');process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
