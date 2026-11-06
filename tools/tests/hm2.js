/* 總覽卡片列（home.html 第四版，2026-11-06 手機拖曳變順）：手機 412 觸控、桌面 1300。拖曳中每格的時間、放開後吸附到卡片開頭、箭頭、拖完不算點擊、
   拖曳中不讀版面（沒有強制重排）。固定 8300 埠 */
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for(const [w,h,sc,tc] of [[412,860,'dark',true],[1300,900,'light',false]]){
 const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:sc,hasTouch:tc,isMobile:tc,serviceWorkers:'block'});
 await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://127.0.0.1:8300/home.html');await p.waitForTimeout(4500);
 const vb=await (await p.$('#view')).boundingBox();const y=vb.y+vb.height/2,x0=vb.x+vb.width*.7;
 await p.evaluate(()=>{window._ft=[];let l=performance.now();(function f(n){window._ft.push(n-l);l=n;if(window._ft.length<400)requestAnimationFrame(f)})(l)});
 await p.mouse.move(x0,y);await p.mouse.down();for(let i=1;i<=24;i++){await p.mouse.move(x0-i*14,y+1);await p.waitForTimeout(8)}
 const mid=await p.evaluate(()=>[getComputedStyle($('belt')).transform,$('belt').style.getPropertyValue('--sk')]).catch(()=>p.evaluate(()=>[getComputedStyle(document.getElementById('belt')).transform,document.getElementById('belt').style.getPropertyValue('--sk')]));
 await p.mouse.up();await p.waitForTimeout(1600);
 const r=await p.evaluate(()=>{const belt=document.getElementById('belt'),m=new DOMMatrix(getComputedStyle(belt).transform),c=[...belt.children],w=c[0].getBoundingClientRect().width+14;
   const ft=window._ft.slice(2).sort((a,b)=>a-b);return {x:m.m41,w,ratio:+(m.m41/w).toFixed(3),med:+ft[ft.length>>1].toFixed(1),p95:+ft[Math.floor(ft.length*.95)].toFixed(1),prog:document.getElementById('prog').style.getPropertyValue('--px'),prev:document.getElementById('prev').disabled}});
 console.log(w,'mid drag',mid,'after',r);
 await p.click('#next');await p.waitForTimeout(1500);
 console.log(w,'next',await p.evaluate(()=>{const m=new DOMMatrix(getComputedStyle(document.getElementById('belt')).transform),w=document.querySelector('.card').getBoundingClientRect().width+14;return +(m.m41/w).toFixed(3)}),'url',p.url().split('/').pop());
 await p.screenshot({path:`hm2_${w}.png`});
 console.log(w,'errs',errs);await ctx.close()}
await b.close()})();
