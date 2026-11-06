/* 即時回報膠囊展開、收合時燈號不橫向跳（標題列內距兩種狀態一樣）。手機 412 觸控。固定 8300 埠 */
const c=require('./common');(async()=>{const {b,mk}=await c.setup();const p=await mk(412,860,'dark',true);
await p.waitForFunction(()=>!document.getElementById('splash'),null,{timeout:8000}).catch(()=>{});await p.waitForTimeout(400);
const x=()=>p.evaluate(()=>Math.round(document.querySelector('#events .ev .live-dot').getBoundingClientRect().left-document.querySelector('#events .ev').getBoundingClientRect().left));
const closed=await x();await p.click('#events .ev summary');await p.waitForTimeout(900);const open=await x();
await p.evaluate(()=>{window._xs=[];const t0=performance.now();const f=()=>{const d=document.querySelector('#events .ev .live-dot'),e=document.querySelector('#events .ev');_xs.push(Math.round(d.getBoundingClientRect().left-e.getBoundingClientRect().left));if(performance.now()-t0<900)requestAnimationFrame(f)};requestAnimationFrame(f)});
await p.click('#events .ev summary');await p.waitForTimeout(1000);
console.log('closed',closed,'open',open,'during collapse',[...new Set(await p.evaluate(()=>_xs))],p.errs);await b.close()})();
