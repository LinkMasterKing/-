/* 學年、開學日、甘特圖預設學期跟著秘書處（2026-11-06，state.js 的 termCfg）：
   1. 權益部讀到秘書處的資料檔（模擬網站上的 data-secretariat.json）→ termCfg 用秘書處的值、搜尋提示的週次跟著算、甘特圖預設學期跟著。
   2. 秘書處的檔案不存在 → 用權益部自己的值。
   3. 秘書處登入後設定頁有「學年與開學日」，其他部門沒有。固定 8300 埠 */
const c=require('./common');(async()=>{
const sec={schemaVersion:10,id:'secretariat',savedAt:'2099-01-01 00:00',title:'秘書處',yearLabel:'120學年',termStart:'2026-10-05',semester:'down',issues:[],events:[],weeks:[],members:[]};
const {b,mk,login}=await c.setup();
const run=async(have)=>{c.q='';const p=await mk(1300,820,'light',false);
  if(have)await p.route('http://127.0.0.1:8300/data-secretariat.json*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(sec)}));
  else await p.route('http://127.0.0.1:8300/data-secretariat.json*',r=>r.fulfill({status:404,body:''}));
  await p.reload();await p.waitForTimeout(2200);
  console.log(have?'with secretariat:':'without:',JSON.stringify(await p.evaluate(()=>({cfg:termCfg(),own:[state.yearLabel,state.termStart,state.semester],ph:(document.querySelector('.hero-search input')||{}).placeholder,seg:gTermNow()}))));
  if(have){await login(p);await p.click('#setBtn');await p.waitForTimeout(900);   /* 第二次的資料已經有身分了，只看讀值 */
  console.log(' rows:',JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('#setOv .set-inner .set-row')].map(r=>r.dataset.set))))}
  console.log(' errs',JSON.stringify(p.errs));await p.context().close()};
await run(true);await run(false);
c.q='?d=secretariat';{const p=await mk(1300,820,'dark',false);
  /* 秘書處的雲端資料：用上面那份（沒有身分），登入走「共用密碼 0000 → 建立身分」 */
  let secR=sec,sha='x0';await p.route('https://api.github.com/**/data-secretariat.json*',async r=>{const q=r.request();
    if(q.method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha,content:Buffer.from(JSON.stringify(secR)).toString('base64')})});
    secR=JSON.parse(Buffer.from(JSON.parse(q.postData()).content,'base64').toString());sha='x'+Date.now();return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha}})})});
  await p.route('http://127.0.0.1:8300/data-secretariat.json*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(secR)}));
  await p.evaluate(()=>localStorage.setItem('workboard:ghtoken','T'));await p.reload();await p.waitForTimeout(2000);await login(p);await p.click('#setBtn');await p.waitForTimeout(900);
  console.log('secretariat rows:',JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('#setOv .set-inner .set-row')].map(r=>r.dataset.set))));
  await p.click('#setOv [data-set=term]');await p.waitForTimeout(800);
  console.log(' term hub:',JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('#setOv .set-hub [data-hub]')].map(r=>r.textContent))));
  await p.click('#setOv [data-hub=term]');await p.waitForTimeout(700);await p.fill('#dlg input[name=v]','2026-09-14');await p.click('#dlg [data-act=ok]');await p.waitForTimeout(2200);
  console.log(' saved:',JSON.stringify(await p.evaluate(()=>[state.termStart,termCfg().termStart,!!document.querySelector('#setOv .set-hub:not([hidden])')])));   /* 本機測試沒有雲端（127.0.0.1 推不出 repo），只存在瀏覽器 */
  await p.screenshot({path:'tm_sec.png'});console.log(' errs',JSON.stringify(p.errs))}
await b.close()})();
