/* 每週概述改在設定裡（2026-11-06，weekly.js 的 weekPane）：
   登入前：設定清單上的「每週概述」→ 在面板／子頁打開 → 返回回到清單。
   登入後：「報告」合併頁 → 每週概述 → 生成週報的對話框是跳出的（不畫在清單下面）→ 返回回到「報告」→ 再返回回到設定清單。
   手機 412（子頁、系統返回、子頁「返回」）與桌面 1300（右側面板、標題列「返回」、Esc）。固定 8300 埠 */
const c=require('./common');(async()=>{
for(const [w,touch] of [[412,true],[1300,false]]){const {b,mk,login}=await c.setup();
  const p=await mk(w,860,'dark',touch);await p.waitForFunction(()=>!document.getElementById('splash'),null,{timeout:8000}).catch(()=>{});
  const st=()=>p.evaluate(()=>{const ww=$('#weekWrap'),h=document.querySelector('.set-hub');return {set:setOpen,sub:subOpen,pane:paneKey,week:!!weekPaneEnd,wrapIn:ww.parentElement.className||ww.parentElement.tagName,wrapHidden:ww.hidden,hub:h?(h.hidden?'hidden':h.querySelector('.set-hub-t').textContent):null,list:!!document.querySelector('#weekList .week')}});
  /* 登入前 */
  await p.click('#setBtn');await p.waitForTimeout(800);await p.click('#setOv [data-set=week]');await p.waitForTimeout(1000);
  console.log(w,'logged out week',JSON.stringify(await st()));
  if(touch)await p.goBack();else await p.keyboard.press('Escape');await p.waitForTimeout(1000);
  console.log(w,'back ->',JSON.stringify(await st()));
  await p.evaluate(()=>closeSettings(true));await p.waitForTimeout(300);
  /* 登入後 */
  await login(p);await p.click('#setBtn');await p.waitForTimeout(800);
  await p.click('#setOv [data-set=report]');await p.waitForTimeout(900);
  const hubSel=touch?'#setSub':'#setOv';
  await p.click(`${hubSel} [data-hub=week]`);await p.waitForTimeout(1000);
  console.log(w,'week in hub',JSON.stringify(await st()));await p.screenshot({path:`wk2_${w}.png`});
  await p.click('#genWeek');await p.waitForTimeout(700);
  console.log(w,'gen dialog',await p.evaluate(()=>{const d=$('#dlg');return [d.open,d.classList.contains('in-pane'),d.parentElement.tagName]}));
  await p.click('#dlg [data-act=cancel]');await p.waitForTimeout(700);
  console.log(w,'after cancel',JSON.stringify(await st()));
  if(touch)await p.goBack();else await p.click('#backMain');await p.waitForTimeout(1000);
  console.log(w,'back -> hub',JSON.stringify(await st()));
  if(touch)await p.click('#subBack');else await p.keyboard.press('Escape');await p.waitForTimeout(1000);
  console.log(w,'back -> list',JSON.stringify(await st()));
  console.log(w,'errs',JSON.stringify(p.errs));await b.close();
}})();
