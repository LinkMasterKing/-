/* 甘特圖「全部／上學期／下學期」切換（render.js 的 ganttTerm／viewRange）：月份軸、今天線、議題位置跟著換；只影響畫面、不存。
   手機 412 深色、桌面 1300 淺色。固定 8300 埠；截圖 gt2_*.png */
const c=require('./common');(async()=>{const {b,mk}=await c.setup();
for(const [w,sc,tc] of [[412,'dark',true],[1300,'light',false]]){const p=await mk(w,860,sc,tc);
 await p.waitForFunction(()=>!document.getElementById('splash'),null,{timeout:8000}).catch(()=>{});
 await p.evaluate(()=>{state.termStart='2026-09-07';setSection('progress')});await p.waitForTimeout(700);
 const axis=()=>p.evaluate(()=>[...document.querySelectorAll('#gantt .g-axis span:not(.today-tag)')].map(s=>s.textContent).join(' '));
 console.log(w,'all',await axis());
 for(const k of ['up','down','all']){await p.click(`#gTerm [data-k=${k}]`);await p.waitForTimeout(700);
   console.log(w,k,await p.evaluate(()=>[ganttTerm,JSON.stringify(viewRange()),!!document.querySelector('#gantt .today-tag')]),await axis());
   if(k!=='all')await p.screenshot({path:`gt2_${w}_${k}.png`})}
 console.log(w,'saved range untouched',await p.evaluate(()=>JSON.stringify(state.range)),'errs',p.errs.filter(x=>!x.includes('404')));await p.context().close()}
await b.close()})();
