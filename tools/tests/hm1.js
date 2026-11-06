/* 各部門總覽（home.html，2026-11-06）：上方會長室、秘書處兩張大卡片；中間標誌按下就打開部門圈（2026-11-06 起不用長按），手指周圍發亮，手指移到某個方向放開＝打開那個部門；
   只點一下＝收起並提示；電腦按住後滾輪換部門、放開打開；鍵盤 Enter／方向鍵／Esc。手機 412 觸控、桌面 1300。固定 8300 埠；截圖 hm1_*.png */
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
const mk=async(w,h,sc,touch)=>{const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:sc,hasTouch:touch,isMobile:touch,serviceWorkers:'block'});
 await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
 const p=await ctx.newPage();p.errs=[];p.on('pageerror',x=>p.errs.push(x.message));await p.goto('http://127.0.0.1:8300/home.html');await p.waitForTimeout(800);return p};
/* 手機 */
let p=await mk(412,860,'dark',true);
console.log('leads',await p.evaluate(()=>[...document.querySelectorAll('.lead b')].map(x=>x.textContent).join()),'sr links',await p.evaluate(()=>document.querySelectorAll('#srList a').length));
await p.screenshot({path:'hm1_412.png'});
const cdp=await p.context().newCDPSession(p);const t=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
const c=await p.evaluate(()=>{const r=$=document.getElementById('hm').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});
await t('touchStart',c[0],c[1]);await p.waitForTimeout(150);await t('touchEnd');await p.waitForTimeout(700);
console.log('tap: ring closes again',await p.evaluate(()=>document.getElementById('ring').hidden),'hint bump',await p.evaluate(()=>document.getElementById('hint').classList.contains('bump')));
await t('touchStart',c[0],c[1]);await p.waitForTimeout(80);
console.log('press: ring on at once',await p.evaluate(()=>document.getElementById('ring').classList.contains('on')),'glow',await p.evaluate(()=>document.getElementById('ring').classList.contains('touch')));
for(let i=1;i<=8;i++){await t('touchMove',c[0]+i*14,c[1]-i*4);await p.waitForTimeout(20)}
await p.waitForTimeout(600);
console.log('selected',await p.evaluate(()=>document.querySelector('.rl.on b')?.textContent));
await p.screenshot({path:'hm1_412_ring.png'});
await t('touchEnd');await p.waitForURL(/index\.html/,{timeout:4000}).catch(()=>{});console.log('went',p.url());
console.log('errs',p.errs);await p.context().close();
/* 桌面：按住、滾輪、放開 */
p=await mk(1300,860,'light',false);
const d=await p.evaluate(()=>{const r=document.getElementById('hm').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});
await p.mouse.move(d[0],d[1]);await p.mouse.down();await p.waitForTimeout(150);
await p.mouse.wheel(0,120);await p.waitForTimeout(150);await p.mouse.wheel(0,120);await p.waitForTimeout(300);
console.log('wheel sel',await p.evaluate(()=>document.querySelector('.rl.on b')?.textContent));await p.screenshot({path:'hm1_1300_ring.png'});
await p.mouse.up();await p.waitForURL(/index\.html/,{timeout:4000}).catch(()=>{});console.log('went',p.url());
await p.goto('http://127.0.0.1:8300/home.html');await p.waitForTimeout(600);
await p.focus('#hm');await p.keyboard.press('Enter');await p.waitForTimeout(500);await p.keyboard.press('ArrowRight');await p.keyboard.press('Escape');await p.waitForTimeout(600);
console.log('kbd esc closes',await p.evaluate(()=>document.getElementById('ring').hidden),'errs',p.errs);
await b.close()})();
