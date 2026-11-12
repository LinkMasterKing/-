/* lg2：工具列（桌面細欄深／淺、手機）：靜止、按住鏡片放大、拖到第三個分頁、放開切換、點分頁中途、設定鍵。印出鏡片位置、反白的分頁（lit）。URL=… node lg2.js
   2026-11-11：輸出要每次一樣。鏡片是 requestAnimationFrame 跑的彈簧（nav.js 的 tbLoop，dt 用每一格的時間），用真的時間取樣，取到第幾格每次不同。
   所以開頁穩定後改用 Playwright 的假時鐘（page.clock，停住不走）：之後的時間只靠 T(ms) 往前推（rAF、performance.now、setTimeout、requestIdleCallback 都跟著假時鐘），取樣的數值就固定。
   CSS 過渡與 Web Animations（換區塊、顏色、設定頁換頁）不歸假時鐘管，用 CDP 把文件時間軸加速 1000 倍，每次動作後先用真的時間等一下（R）讓它們跑完，
   再推假時鐘；工具列的明暗取樣（nav.js 的 tbContrast）才不會量到換區塊途中的畫面。印出的顏色、on-dark／on-light 都是過渡結束後的。重要的結果另外逐項判斷，壞了以非 0 結束 */
const {chromium}=require('playwright');
const T0=new Date('2026-11-11T10:00:00+08:00').getTime();
const A=(ok,m)=>{if(!ok){console.log('FAIL:',m);process.exitCode=1}};
(async()=>{const b=await chromium.launch();
for(const [w,h,sc,tag] of [[1300,800,'dark','d'],[1300,800,'light','dl'],[412,860,'dark','m']]){
const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:sc,serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await ctx.route('https://api.github.com/**',r=>r.fulfill({status:404,body:'{}'}));
const p=await ctx.newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto((process.env.URL||'http://127.0.0.1:8300/index.html'));await p.waitForTimeout(2600);
await p.waitForFunction(()=>!lens.raf);await p.clock.install({time:T0});await p.clock.pauseAt(T0+1000);   /* 工具列的動畫停下來之後才換成假時鐘；起點固定，rAF 每 16ms 一格的相位才每次一樣 */
const cdp=await ctx.newCDPSession(p);await cdp.send('Animation.enable');await cdp.send('Animation.setPlaybackRate',{playbackRate:1000});
const R=()=>p.waitForTimeout(150),T=async ms=>{await R();await p.clock.runFor(ms)};
const st=()=>p.evaluate(()=>{const l=document.querySelector('#tabbar .tb-lens'),m=document.querySelector('#tabbar .tb-main');return {sec:curSec,lens:l.style.transform,lit:[...document.querySelectorAll('#tabbar .tab')].map(t=>t.classList.contains('lit')?1:0).join(''),main:m.className,scale:m.style.scale,bg:getComputedStyle(l).backgroundColor,icon:getComputedStyle(document.querySelector('#tabbar .tab.lit .tab-ind')||document.body).color}});
const S=async k=>{await R();const s=await st();console.log(tag,k,JSON.stringify(s));return s};
const s0=await S('idle');A(s0.sec==='live'&&s0.lit==='100'&&!s0.scale,tag+' idle');
const clip=w>900?{x:0,y:250,width:140,height:320}:{x:0,y:h-110,width:w,height:110};
await p.screenshot({path:`tb_${tag}_0.png`,clip});
const t1=await (await p.$('#tabbar .tab:nth-child(1)')).boundingBox(),t3=await (await p.$('#tabbar .tab:nth-child(3)')).boundingBox();
await p.mouse.move(t1.x+t1.width/2,t1.y+t1.height/2);await p.mouse.down();await T(250);
const s1=await S('press');A(s1.lit==='100'&&+s1.scale>1.03,tag+' press: lens and bar scale up');await p.screenshot({path:`tb_${tag}_1press.png`,clip});
for(let i=1;i<=12;i++){await p.mouse.move(t1.x+t1.width/2+(t3.x-t1.x)*i/12,t1.y+t1.height/2+(t3.y-t1.y)*i/12);await T(16)}
await T(60);const s2=await S('drag');A(s2.sec==='live'&&s2.lit==='001'&&+s2.scale>1.03,tag+' drag: third tab lit, section not switched yet');await p.screenshot({path:`tb_${tag}_2drag.png`,clip});
await p.mouse.up();await T(900);const s3=await S('release');A(s3.sec==='done'&&s3.lit==='001'&&!s3.scale,tag+' release: switched to done');
await p.click('#tabbar .tab:nth-child(2)');await T(120);const s4=await S('clickmid');A(s4.sec==='progress'&&s4.lit==='010'&&s4.lens!==s3.lens,tag+' click: section switches at once, lens on its way');
await T(900);const s5=await S('clickend');A(s5.sec==='progress'&&s5.lit==='010'&&!s5.scale,tag+' click end: lens settled');
await p.screenshot({path:`tb_${tag}_3.png`,clip});
await p.click('#setBtn');await T(700);await R();const s6=await st(),gb=await p.evaluate(()=>[getComputedStyle(document.querySelector('#setBtn')).backgroundColor,setOpen]);console.log(tag,'set',JSON.stringify(s6),gb[0]);A(gb[1],tag+' settings open');
await p.screenshot({path:`tb_${tag}_4set.png`,clip});
await p.click('#setBtn');await T(500);await R();
console.log(tag,'errs',e);A(!e.length,tag+' errors');await ctx.close()}
await b.close()})();
