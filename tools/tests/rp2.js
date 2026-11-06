/* 工作報告的實際斷頁（2026-11-06，report.js 的 rptPaginate）：打開報告 → 每張紙右上角有「第 N 頁」、總頁數；
   在「工作檢討」打很多行字 → 出現紅色虛線「第 N 頁從這裡開始」，總頁數變多；量測用的 .rpt-measure 沒有留在畫面上。
   再用瀏覽器真的輸出 PDF 數頁數，跟預覽算的比對。桌面 1300。固定 8300 埠 */
const c=require('./common');(async()=>{const {b,mk,login}=await c.setup();const p=await mk(1300,900,'light',false);
await login(p);
await p.evaluate(()=>openReport(addDays(today(),-90),today()));await p.waitForTimeout(1500);
const st=()=>p.evaluate(()=>({pages:$('#rptPages').textContent,tops:[...document.querySelectorAll('.rpt-pb-top')].map(x=>x.textContent),breaks:[...document.querySelectorAll('.rpt-pb:not(.rpt-pb-top)')].map(x=>x.textContent+'@'+Math.round(parseFloat(x.style.top))),measure:!!document.querySelector('.rpt-measure'),paperW:Math.round($('.rpt-paper').getBoundingClientRect().width)}));
console.log('open',JSON.stringify(await st()));
await p.evaluate(()=>{const t=[...document.querySelectorAll('.rpt-ch')].find(c=>c.querySelector('h2').textContent==='工作檢討').querySelector('.rpt-text');
  t.innerHTML=Array.from({length:70},(_,i)=>`<p>第 ${i+1} 段：這是一段很長的工作檢討文字，用來測試報告換頁的位置是不是跟實際存成 PDF 的時候一樣，換行也要一樣。</p>`).join('');t.dispatchEvent(new Event('input',{bubbles:true}))});
await p.waitForTimeout(800);
const s=await st();console.log('long text',JSON.stringify(s));
await p.evaluate(()=>{const m=document.querySelector('.rpt-pb:not(.rpt-pb-top)');m&&m.scrollIntoView({block:'center'})});await p.waitForTimeout(300);await p.screenshot({path:'rp2_break.png'});
/* 真的印成 PDF，數頁數 */
await p.evaluate(()=>rptSync(true));await p.emulateMedia({media:'print'});
const pdf=await p.pdf({format:'A4',preferCSSPageSize:true});const n=(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
console.log('pdf pages',n);
console.log('errs',JSON.stringify(p.errs));await b.close()})();
