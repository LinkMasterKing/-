/* 工作報告：一張一張的紙（2026-11-06，report.js 的 rptPaginate）
   1. 打開報告：每章的紙張數、每張紙右外側的「第 N 頁」、總頁數；甘特圖是細刻度；封面 logo 是彩色。
   2. 在「工作檢討」打 70 段 → 紙張變多、斷點那一塊被推到下一張紙的開頭（離紙張頂端剛好 14mm）。
   3. 用瀏覽器真的輸出 PDF，數頁數，跟預覽算的比對。
   4. 加一組卡片 → 按「＋ 卡片」：多久回應、有沒有錯誤；打字時捲動位置不跳。桌面 1300。固定 8300 埠 */
const c=require('./common');(async()=>{const {b,mk,login}=await c.setup();const p=await mk(1300,900,'light',false);
await login(p);
await p.evaluate(()=>openReport(addDays(today(),-90),today()));await p.waitForTimeout(1800);
const st=()=>p.evaluate(()=>({pages:$('#rptPages').textContent,pg:[...document.querySelectorAll('.rpt-pg')].map(x=>x.textContent).join(','),gaps:document.querySelectorAll('.rpt-gap').length,sp:document.querySelectorAll('.rpt-sp').length,measure:!!document.querySelector('.rpt-measure'),tk:!!document.querySelector('.rpt-gantt .tk'),logo:!!document.querySelector('.cv-logo .su-logo-c')}));
console.log('open',JSON.stringify(await st()));
await p.evaluate(()=>{const t=[...document.querySelectorAll('.rpt-ch')].find(c=>c.querySelector('h2').textContent==='工作檢討').querySelector('.rpt-text');
  t.innerHTML=Array.from({length:70},(_,i)=>`<p>第 ${i+1} 段：這是一段很長的工作檢討文字，用來測試報告換頁的位置是不是跟實際存成 PDF 的時候一樣，換行也要一樣。</p>`).join('');t.dispatchEvent(new Event('input',{bubbles:true}))});
await p.waitForTimeout(900);console.log('long text',JSON.stringify(await st()));
console.log('pushed to sheet top (mm)',await p.evaluate(()=>[...document.querySelectorAll('.rpt-sp')].map(sp=>{const sec=sp.closest('.rpt-page'),el=sp.nextElementSibling,y=el.getBoundingClientRect().top-sec.getBoundingClientRect().top,A4=rptPageH.A4+28;return ((y%A4)/rptPageH.top*14).toFixed(1)}).join(' ')));
await p.evaluate(()=>{const s=document.querySelector('.rpt-sp');s&&s.scrollIntoView({block:'center'})});await p.waitForTimeout(300);await p.screenshot({path:'rp2_sheet.png'});
/* PDF */
await p.evaluate(()=>{rptSync(true);rptUnpage()});await p.emulateMedia({media:'print'});
const pdf=await p.pdf({format:'A4',preferCSSPageSize:true});console.log('pdf pages',(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length);
await p.emulateMedia({media:'screen'});await p.evaluate(()=>{rptSync();rptPaginate()});await p.waitForTimeout(400);
/* 卡片 */
const ch=await p.$('.rpt-ch:last-of-type [data-ins=cards]');await ch.scrollIntoViewIfNeeded();await ch.click();await p.waitForTimeout(700);
const t0=Date.now();await p.click('.rpt-ch:last-of-type [data-cadd]',{timeout:5000}).catch(e=>console.log('cadd click fail',e.message.split('\n')[0]));const dt=Date.now()-t0;await p.waitForTimeout(800);
console.log('cadd',dt,'ms cards',await p.evaluate(()=>document.querySelectorAll('.rpt-ch:last-of-type .rpt-card').length),'focus',await p.evaluate(()=>document.activeElement&&document.activeElement.tagName+'.'+document.activeElement.parentElement.className));
const y0=await p.evaluate(()=>$('#rptOv .rpt-scroll').scrollTop);await p.keyboard.type('測試卡片名稱');await p.waitForTimeout(900);console.log('scroll after typing',y0,'->',await p.evaluate(()=>$('#rptOv .rpt-scroll').scrollTop));
await p.screenshot({path:'rp2_cards.png'});
console.log('errs',JSON.stringify(p.errs));await b.close()})();
