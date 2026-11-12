/* 學年、開學日、甘特圖預設學期跟著秘書處（2026-11-06，state.js 的 termCfg）：
   1. 權益部讀到秘書處的資料檔（模擬網站上的 data-secretariat.json）→ termCfg 用秘書處的值、搜尋提示的週次跟著算、甘特圖預設學期跟著。
   2. 秘書處的檔案不存在 → 用權益部自己的值。
   3. 秘書處登入後設定頁有「學年與開學日」，其他部門沒有。固定 8300 埠 */
const c=require('./common');const A=(ok,m)=>{if(!ok){console.log('FAIL:',m);process.exitCode=1}};   /* 2026-11-11：逐項判斷 */
(async()=>{
const sec={schemaVersion:10,id:'secretariat',savedAt:'2099-01-01 00:00',title:'秘書處',yearLabel:'120學年',termStart:'2026-10-05',semester:'down',issues:[],events:[],weeks:[],members:[]};
const {b,mk,login}=await c.setup();
const run=async(have)=>{c.q='';const p=await mk(1300,820,'light',false);
  if(have)await p.route('http://127.0.0.1:8300/data-secretariat.json*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(sec)}));
  else await p.route('http://127.0.0.1:8300/data-secretariat.json*',r=>r.fulfill({status:404,body:''}));
  await p.reload();await p.waitForTimeout(2200);
  const v=await p.evaluate(()=>({cfg:termCfg(),own:[state.yearLabel,state.termStart,state.semester],ph:(document.querySelector('.hero-search input')||{}).placeholder,seg:gTermNow(),wk:(()=>{const d=(Date.parse(today())-Date.parse(termCfg().termStart))/864e5;return d<0?'開學前':'第'+(Math.floor(d/7)+1)+'週'})()}));console.log(have?'with secretariat:':'without:',JSON.stringify(v));
  if(have)A(v.cfg.yearLabel==='120學年'&&v.cfg.termStart==='2026-10-05'&&v.seg==='down','termCfg follows secretariat');else A(v.cfg.yearLabel===v.own[0]&&v.cfg.termStart===v.own[1]&&v.seg===(v.own[2]||'all'),'termCfg falls back to own values');
  A(v.ph.endsWith(v.wk),'search placeholder week follows termCfg ('+v.wk+')');
  if(have){await login(p);await p.click('#setBtn');await p.waitForTimeout(900);   /* 第二次的資料已經有身分了，只看讀值 */
  const rw=await p.evaluate(()=>[...document.querySelectorAll('#setOv .set-inner .set-row')].map(r=>r.dataset.set));console.log(' rows:',JSON.stringify(rw));A(rw.length>1&&!rw.includes('term'),'rights has no term row')}
  const er=p.errs.filter(x=>have||!/status of 404/.test(x));console.log(' errs',JSON.stringify(p.errs));A(!er.length,'errors');   /* 沒有秘書處檔案那次是故意回 404 */await p.context().close()};
await run(true);await run(false);
c.q='?d=secretariat';{const p=await mk(1300,820,'dark',false);
  /* 秘書處的雲端資料：用上面那份（沒有身分），登入走「共用密碼 0000 → 建立身分」 */
  let secR=sec,sha='x0';await p.route('https://api.github.com/**/data-secretariat.json*',async r=>{const q=r.request();
    if(q.method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha,content:Buffer.from(JSON.stringify(secR)).toString('base64')})});
    secR=JSON.parse(Buffer.from(JSON.parse(q.postData()).content,'base64').toString());sha='x'+Date.now();return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha}})})});
  await p.route('http://127.0.0.1:8300/data-secretariat.json*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(secR)}));
  await p.evaluate(()=>{localStorage.clear();localStorage.setItem('workboard:ghtoken','T')});await p.reload();   /* 2026-11-11：先清掉 mk() 第一次開頁時存下的網站真的 data-secretariat.json（有全會密碼 sync.tokenAll，登入流程會變成「加入秘書處」） */await p.waitForTimeout(2000);await login(p);await p.click('#setBtn');await p.waitForTimeout(900);
  const sr=await p.evaluate(()=>[...document.querySelectorAll('#setOv .set-inner .set-row')].map(r=>r.dataset.set));console.log('secretariat rows:',JSON.stringify(sr));A(sr.includes('term'),'secretariat has term row');
  await p.click('#setOv [data-set=term]');await p.waitForTimeout(800);
  const th=await p.evaluate(()=>[...document.querySelectorAll('#setOv .set-hub [data-hub]')].map(r=>r.textContent));console.log(' term hub:',JSON.stringify(th));A(th.length===2&&/學年/.test(th[0])&&/開學日/.test(th[1]),'term hub rows');
  await p.click('#setOv [data-hub=term]');await p.waitForTimeout(700);await p.fill('#dlg input[name=v]','2026-09-14');await p.click('#dlg [data-act=ok]');await p.waitForTimeout(2200);
  const sv=await p.evaluate(()=>[state.termStart,termCfg().termStart,!!document.querySelector('#setOv .set-hub:not([hidden])')]);console.log(' saved:',JSON.stringify(sv));A(sv[0]==='2026-09-14'&&sv[1]==='2026-09-14'&&sv[2],'term start saved, back to hub');   /* 本機測試沒有雲端（127.0.0.1 推不出 repo），只存在瀏覽器 */
  await p.screenshot({path:'tm_sec.png'});console.log(' errs',JSON.stringify(p.errs));A(!p.errs.length,'secretariat errors')}
await b.close()})();
