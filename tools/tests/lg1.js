/* lg1：工具列液態玻璃與按鈕機制（Convx）。手機：按住鏡片、拖曳、放開、點分頁、設定鍵按壓；桌面：左側細欄、設定與動畫讓出空間。URL=… node lg1.js */
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const out={};
async function mk(vw,vh,scheme,mobile){const ctx=await b.newContext({viewport:{width:vw,height:vh},deviceScaleFactor:2,colorScheme:scheme,serviceWorkers:'block',hasTouch:mobile,isMobile:mobile});
 await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
 await ctx.route('https://api.github.com/**',r=>r.fulfill({status:404,body:'{}'}));
 const p=await ctx.newPage();p._e=[];p.on('pageerror',x=>p._e.push(x.message));
 await p.goto((process.env.URL||'http://127.0.0.1:8300/index.html'));await p.waitForTimeout(2600);return [ctx,p]}
// phone, mouse-driven (no touch) for simplicity
for(const scheme of ['dark','light']){
 const [ctx,p]=await mk(420,800,scheme,false);
 const tb=await (await p.$('#tabbar')).boundingBox();const clip={x:0,y:tb.y-30,width:420,height:tb.height+50};
 const L=await p.evaluate(()=>{const l=document.querySelector('#tabbar .tb-lens').getBoundingClientRect();return {x:l.x+l.width/2,y:l.y+l.height/2}});
 const t3=await (await p.$('#tabbar .tab:nth-child(3)')).boundingBox();
 await p.screenshot({path:`lg_m_${scheme}_0rest.png`,clip});
 await p.mouse.move(L.x,L.y);await p.mouse.down();await p.waitForTimeout(250);
 const st=await p.evaluate(()=>{const l=document.querySelector('#tabbar .tb-lens');return [l.style.getPropertyValue('--lp'),l.style.transform,document.querySelector('#tabbar .tb-main').style.scale,document.querySelector('#lg-4 feDisplacementMap')?.getAttribute('scale')]});
 console.log(scheme,'pressed',st);
 await p.screenshot({path:`lg_m_${scheme}_1press.png`,clip});
 for(let i=1;i<=6;i++){await p.mouse.move(L.x+i*12,L.y);await p.waitForTimeout(16)}
 await p.screenshot({path:`lg_m_${scheme}_2drag.png`,clip});
 for(let i=1;i<=10;i++){await p.mouse.move(L.x+72+(t3.x+t3.width/2-L.x-72)*i/10,L.y);await p.waitForTimeout(16)}
 await p.mouse.up();await p.waitForTimeout(1200);
 console.log(scheme,'after drag',await p.evaluate(()=>[curSec,document.querySelector('#tabbar .tb-lens').style.getPropertyValue('--lp'),document.querySelector('#tabbar .tb-lens').style.transform]));
 await p.screenshot({path:`lg_m_${scheme}_3settled.png`,clip});
 // tap tab 1 → animate to value; capture mid
 const t1=await (await p.$('#tabbar .tab:nth-child(1)')).boundingBox();
 await p.mouse.click(t1.x+t1.width/2,t1.y+t1.height/2);await p.waitForTimeout(90);
 await p.screenshot({path:`lg_m_${scheme}_4tapmid.png`,clip});
 await p.waitForTimeout(1200);console.log(scheme,'after tap',await p.evaluate(()=>[curSec,document.querySelector('#tabbar .tb-lens').style.getPropertyValue('--lp')]));
 // gear press+drag
 const g=await (await p.$('#setBtn')).boundingBox();
 await p.mouse.move(g.x+g.width/2,g.y+g.height/2);await p.mouse.down();await p.waitForTimeout(200);await p.mouse.move(g.x+g.width/2+30,g.y+g.height/2-20,{steps:5});await p.waitForTimeout(150);
 console.log(scheme,'gear',await p.evaluate(()=>[document.querySelector('#setBtn').style.transform,document.querySelector('#setBtn').style.scale]));
 await p.screenshot({path:`lg_m_${scheme}_5gear.png`,clip});
 await p.mouse.up();await p.waitForTimeout(900);console.log(scheme,'gear after',await p.evaluate(()=>[setOpen,document.querySelector('#setBtn').style.transform,document.querySelector('#setBtn').style.scale]));
 console.log('errs',p._e);await ctx.close();
}
await b.close()})();
