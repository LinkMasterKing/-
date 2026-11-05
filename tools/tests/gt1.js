/* 手機（412、觸控）：進度區頁面很短（頂端＝底端）時，手指左右滑甘特圖要能橫向捲動（nav.js 的 elastic 不能擋）；上下拉仍有回彈。固定 8300 埠 */
const c=require('./common');(async()=>{const {b,mk}=await c.setup();const p=await mk(412,860,'dark',true);
await p.waitForFunction(()=>!document.getElementById("splash"),null,{timeout:8000}).catch(()=>{});await p.evaluate(()=>{setSection("progress")});await p.waitForTimeout(800);
const g=await p.$('#gantt');const bb=await g.boundingBox();const cdp=await p.context().newCDPSession(p);
const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
const y=bb.y+bb.height*0.6,x=bb.x+bb.width*0.8;
console.log('scrollW',await p.evaluate(()=>[$('#gantt').scrollWidth,$('#gantt').clientWidth]),'page short',await p.evaluate(()=>{const s=$('#pageMain');return s.scrollHeight<=s.clientHeight+1}));
await touch('touchStart',x,y);for(let i=1;i<=12;i++){await touch('touchMove',x-i*18,y+i*2);await p.waitForTimeout(16)}await touch('touchEnd');await p.waitForTimeout(500);
console.log('gantt scrollLeft after swipe',await p.evaluate(()=>$('#gantt').scrollLeft),'(want > 0)');
await touch('touchStart',x,y-200);for(let i=1;i<=10;i++){await touch('touchMove',x,y-200+i*15);await p.waitForTimeout(16)}
console.log('vertical pull transform',await p.evaluate(()=>document.querySelector('#pageMain .wrap').style.transform),'(want translate)');await touch('touchEnd');
console.log('errs',p.errs.filter(x=>!x.includes('404')));await b.close()})();
