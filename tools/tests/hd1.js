/* 頁首精簡（logo 置中、玻璃搜尋欄、只留週次）、頁首搜尋、設定頁「每週概述」、秘書處「各部門週報」調閱。
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
 /* 設定 → 每週概述 */
 await p.click('#setBtn');await p.waitForTimeout(800);
 console.log(w,'set week row',await p.evaluate(()=>!!$('#setOv [data-set=week]')));
 await p.click('#setOv [data-set=week]');await p.waitForTimeout(1200);
 console.log(w,'on week',await p.evaluate(()=>[onWeek,setOpen,$('#setOv').hidden,!$('#weekSecLink').hidden]));
 await p.click('#backMain');await p.waitForTimeout(900);console.log(w,'back',await p.evaluate(()=>onWeek));
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
