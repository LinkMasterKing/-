/* 頁首精簡（logo 置中、玻璃搜尋欄、只留週次）、頁首搜尋、底部工具列「每週概述」分頁、秘書處「各部門週報」調閱。
   桌面 1300 深色、手機 412 淺色。固定 8300 埠；截圖 hd1_*.png */
const c=require('./common');c.serveRemote=true;
(async()=>{const {b,mk}=await c.setup();
for(const [w,h,sc,tc] of [[1300,900,'dark',false],[412,860,'light',true]]){c.q='';const p=await mk(w,h,sc,tc);
 await p.waitForFunction(()=>!document.getElementById('splash'),null,{timeout:8000}).catch(()=>{});await p.waitForTimeout(300);
 console.log(w,'header',await p.evaluate(()=>{const l=$('.logo-box').getBoundingClientRect();return [Math.round(l.left+l.width/2-innerWidth/2),$('#boardQ').placeholder,$('#weekPill').textContent,!!$('#weekBtn'),!!$('#bigDate'),!!$('#titleSlot'),getComputedStyle($('#saveInfo')).width]}));
 await p.screenshot({path:`hd1_${w}.png`,clip:{x:0,y:0,width:w,height:300}});
 /* 搜尋 */
 const t=await p.evaluate(()=>state.events.find(e=>!e.doneAt).name);const q=t.slice(0,2);
 await p.fill('#boardQ',q);await p.waitForTimeout(400);
 console.log(w,'search',q,await p.evaluate(()=>[!$('#boardRes').hidden,document.querySelectorAll('#boardRes .hr-item').length,$('#boardRes mark')?.textContent]));
 await p.screenshot({path:`hd1_${w}_search.png`});
 await p.keyboard.press('Enter');await p.waitForTimeout(900);
 console.log(w,'go',await p.evaluate(()=>[curSec,$('#boardRes').hidden||getComputedStyle($('#boardRes')).opacity,!!document.querySelector('#events details.ev[open], #events .ev.sel, #evDetail .evd')]));
 /* 底部工具列「每週概述」分頁 */
 console.log(w,'tabs',await p.evaluate(()=>[...document.querySelectorAll('#tabbar .tab')].map(t=>t.dataset.tab).join()));
 await p.click('#tabbar [data-tab=week]');await p.waitForTimeout(1200);
 console.log(w,'on week',await p.evaluate(()=>[onWeek,$('#tabbar [data-tab=week]').classList.contains('on'),!$('#weekSecLink').hidden,!!$('#setOv [data-set=week]')]));
 await p.screenshot({path:`hd1_${w}_week.png`});
 await p.click('#tabbar [data-tab=progress]');await p.waitForTimeout(1200);console.log(w,'back to progress',await p.evaluate(()=>[onWeek,curSec,$('#tabbar [data-tab=progress]').classList.contains('on')]));
 await p.evaluate(()=>{state.weeks=[];weekDotSync()});await p.waitForTimeout(300);console.log(w,'due dot',await p.evaluate(()=>[weekDue(),$('#tabbar [data-tab=week]').classList.contains('due')]));
 console.log(w,'errs',p.errs.filter(x=>!x.includes('404')));await p.context().close()}
/* 秘書處 */
c.q='?d=secretariat';const p=await mk(1300,900,'dark',false);
await p.waitForFunction(()=>!document.getElementById('splash'),null,{timeout:8000}).catch(()=>{});await p.waitForTimeout(1500);
console.log('sec panel',await p.evaluate(()=>[!$('#wkPanel').hidden,document.querySelectorAll('#wkDepts .wk-d').length,document.querySelectorAll('#wkBody .wk-doc').length]));
await p.click('#wkDepts [data-wkd=rights]');await p.waitForTimeout(400);
console.log('rights',await p.evaluate(()=>[document.querySelectorAll('#wkBody .wk-w').length,$('#wkBody .wk-text')?.textContent.slice(0,20)]));
await p.evaluate(()=>$('#wkPanel').scrollIntoView());await p.screenshot({path:'hd1_sec.png'});
console.log('sec errs',p.errs.filter(x=>!x.includes('404')));
await b.close()})();
