/* fx1：開場畫面與左右兩欄開合（桌面 1500）。
   開場：開頁時有 #splash、動畫播完後收掉；即時回報：點膠囊 → 清單 FLIP（有動畫）→ 分成左右兩欄 →「收起」收回；
   完成紀錄：切到這區時還沒分欄，點一筆才分欄，Esc 收回。固定 8300 埠。
   2026-11-05 修：即時回報膠囊格分上下兩區後是 #events .events>.ev；完成紀錄改用跟即時回報同一套膠囊（.done-ev），原本找 .done-item 會卡住；
   原本只印數值，改成逐項判斷、有錯就以代碼 1 結束 */
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();let bad=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m);if(!c)bad++};
const ctx=await b.newContext({viewport:{width:1500,height:900},colorScheme:'dark',serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));await ctx.route('https://api.github.com/**',r=>r.fulfill({status:404,body:'{}'}));
const p=await ctx.newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('http://127.0.0.1:8300/index.html');await p.waitForTimeout(300);
ok(await p.evaluate(()=>!!document.getElementById('splash')),'開頁 300ms 有開場畫面');
ok(await p.waitForFunction(()=>!document.getElementById('splash'),null,{timeout:6000}).then(()=>true,()=>false),'開場畫面播完後收掉');
await p.waitForTimeout(600);
/* 即時回報：點第 4 顆 → 分欄 */
const caps='#events .events>.ev';
ok(await p.$$eval(caps,x=>x.length)>=4,'即時回報至少 4 顆膠囊');
await p.click(`${caps}:nth-child(4) summary`);await p.waitForTimeout(150);
ok(await p.evaluate(s=>[...document.querySelectorAll(s)].some(x=>x.getAnimations().length),caps),'分欄途中清單有動畫');
await p.waitForTimeout(700);
ok(await p.evaluate(()=>!!selEv&&$('#liveMD').classList.contains('split')&&!$('#evDetail').hidden),'即時回報分成左右兩欄');
await p.click('#evDetail .md-close');await p.waitForTimeout(800);
ok(await p.evaluate(()=>!selEv&&!$('#liveMD').classList.contains('split')),'按「收起」收回');
/* 完成紀錄 */
await p.click('#tabbar [data-tab=done]');await p.waitForTimeout(1200);
ok(await p.evaluate(()=>!$('#doneMD').classList.contains('split')),'完成紀錄：還沒點之前不分欄');
await p.click('#doneList .done-ev:nth-child(3) summary');await p.waitForTimeout(800);
ok(await p.evaluate(()=>!!selDone&&$('#doneMD').classList.contains('split')),'完成紀錄：點一筆後分欄');
await p.keyboard.press('Escape');await p.waitForTimeout(700);
ok(await p.evaluate(()=>!$('#doneMD').classList.contains('split')),'完成紀錄：Esc 收回');
ok(!e.length,'沒有錯誤 '+e.join(' | '));
await b.close();process.exit(bad?1:0)})();
