/* lg2：工具列（桌面細欄深／淺、手機）：靜止、按住鏡片放大、拖到第三個分頁、放開切換、點分頁中途、設定鍵。印出鏡片位置、反白的分頁（lit）。URL=… node lg2.js */
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for(const [w,h,sc,tag] of [[1300,800,'dark','d'],[1300,800,'light','dl'],[412,860,'dark','m']]){
const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:sc,serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await ctx.route('https://api.github.com/**',r=>r.fulfill({status:404,body:'{}'}));
const p=await ctx.newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto((process.env.URL||'http://127.0.0.1:8300/index.html'));await p.waitForTimeout(2600);
const st=()=>p.evaluate(()=>{const l=document.querySelector('#tabbar .tb-lens'),m=document.querySelector('#tabbar .tb-main');return {sec:curSec,lens:l.style.transform,lit:[...document.querySelectorAll('#tabbar .tab')].map(t=>t.classList.contains('lit')?1:0).join(''),main:m.className,scale:m.style.scale,bg:getComputedStyle(l).backgroundColor,icon:getComputedStyle(document.querySelector('#tabbar .tab.lit .tab-ind')||document.body).color}});
console.log(tag,'idle',JSON.stringify(await st()));
const clip=w>900?{x:0,y:250,width:140,height:320}:{x:0,y:h-110,width:w,height:110};
await p.screenshot({path:`tb_${tag}_0.png`,clip});
const t1=await (await p.$('#tabbar .tab:nth-child(1)')).boundingBox(),t3=await (await p.$('#tabbar .tab:nth-child(3)')).boundingBox();
await p.mouse.move(t1.x+t1.width/2,t1.y+t1.height/2);await p.mouse.down();await p.waitForTimeout(250);
console.log(tag,'press',JSON.stringify(await st()));await p.screenshot({path:`tb_${tag}_1press.png`,clip});
for(let i=1;i<=12;i++){await p.mouse.move(t1.x+t1.width/2+(t3.x-t1.x)*i/12,t1.y+t1.height/2+(t3.y-t1.y)*i/12);await p.waitForTimeout(16)}
await p.waitForTimeout(60);console.log(tag,'drag',JSON.stringify(await st()));await p.screenshot({path:`tb_${tag}_2drag.png`,clip});
await p.mouse.up();await p.waitForTimeout(900);console.log(tag,'release',JSON.stringify(await st()));
await p.click('#tabbar .tab:nth-child(2)');await p.waitForTimeout(120);console.log(tag,'clickmid',JSON.stringify(await st()));
await p.waitForTimeout(900);console.log(tag,'clickend',JSON.stringify(await st()));
await p.screenshot({path:`tb_${tag}_3.png`,clip});
await p.click('#setBtn');await p.waitForTimeout(700);console.log(tag,'set',JSON.stringify(await st()),await p.evaluate(()=>getComputedStyle(document.querySelector('#setBtn')).backgroundColor));
await p.screenshot({path:`tb_${tag}_4set.png`,clip});
await p.click('#setBtn');await p.waitForTimeout(500);
console.log(tag,'errs',e);await ctx.close()}
await b.close()})();
