/* ad1：編輯中「+ 新增即時回報」在膠囊格裡佔一格、大小跟收合的膠囊一樣；檢視時不顯示；點了照原本行為（桌面直接新增並選到、手機開對話框）。固定 8300 埠 */
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for(const [w,h,sc,tag] of [[1300,860,'dark','d'],[1300,860,'light','dl'],[412,900,'dark','m']]){
const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:sc,serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8300/index.html');await p.waitForFunction(()=>!document.body.classList.contains('intro'));await p.waitForTimeout(600);
const m=()=>p.evaluate(()=>{const a=$('#addEvent'),e=document.querySelector('#events .events>.ev:not([open])'),r=x=>{const q=x.getBoundingClientRect();return [Math.round(q.width),Math.round(q.height)]};
  return {inGrid:a.parentElement.className,shown:a.offsetParent!==null,add:r(a),cap:r(e),lastCell:a.parentElement.lastElementChild===a}});
console.log(tag,'view',JSON.stringify(await m()));
await p.evaluate(()=>{editing=true;secEdit=new Set(['live']);render()});await p.waitForTimeout(800);
console.log(tag,'edit',JSON.stringify(await m()));
await p.locator('#livePanel').screenshot({path:`/home/claude/ad_${tag}.png`});
await p.click('#addEvent');await p.waitForTimeout(500);console.log(tag,'after click',JSON.stringify(await p.evaluate(()=>({dlg:$('#dlg').open,sel:selEv&&(state.events.find(e=>e.id===selEv)||{}).name,split:$('#liveMD').classList.contains('split')}))),'errs',errs);   // 桌面左右兩欄＝直接新增一筆並選到；手機＝開對話框
await ctx.close()}
await b.close()})();
