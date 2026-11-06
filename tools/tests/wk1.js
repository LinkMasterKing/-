/* 每週概述從設定進去、返回回到設定（2026-11-06）：返回鈕、系統返回兩種；回到設定後底下已經是主頁，再返回／關設定看到主頁；
   沒從設定進來（程式直接 goWeek）返回照舊回主頁。手機 412 觸控。固定 8300 埠 */
const c=require('./common');(async()=>{const {b,mk}=await c.setup();const p=await mk(412,860,'dark',true);
await p.waitForFunction(()=>!document.getElementById('splash'),null,{timeout:8000}).catch(()=>{});await p.waitForTimeout(300);
const st=()=>p.evaluate(()=>({set:setOpen,week:onWeek,main:pager.scrollLeft<40,h:history.state&&history.state.bl,len:history.length}));
for(const how of ['button','system']){
  await p.click('#setBtn');await p.waitForTimeout(800);await p.click('#setOv [data-set=week]');await p.waitForTimeout(1200);console.log(how,'on week',JSON.stringify(await st()));
  if(how==='button')await p.click('#backMain');else await p.goBack();
  await p.waitForTimeout(1200);console.log(how,'back ->',JSON.stringify(await st()));
  await p.goBack();await p.waitForTimeout(1000);console.log(how,'back again ->',JSON.stringify(await st()));
}
await p.evaluate(()=>goWeek());await p.waitForTimeout(1200);await p.click('#backMain');await p.waitForTimeout(1200);console.log('direct week back ->',JSON.stringify(await st()));
console.log('errs',p.errs);await b.close()})();
