const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
for(const [w,sc,n] of [[1300,'dark','d'],[1300,'light','l'],[390,'dark','m']]){
const ctx=await b.newContext({viewport:{width:w,height:900},colorScheme:sc,isMobile:w<500,hasTouch:w<500,deviceScaleFactor:1});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:`@font-face{font-family:"Jost";src:url(http://127.0.0.1:8311/jost.ttf);font-weight:100 900}@font-face{font-family:"Noto Sans TC";src:url(http://127.0.0.1:8311/nototc.ttf);font-weight:100 900}`}));
const p=await ctx.newPage();const e=[];p.on('pageerror',x=>e.push(x.message));p.on('console',m=>{if(m.type()==='error')e.push(m.text())});
await p.goto('http://127.0.0.1:8311/home.html');await p.waitForTimeout(1800);await p.screenshot({path:`hm_${n}.png`,fullPage:true});
console.log(n,await p.evaluate(()=>[...document.querySelectorAll('.dept')].map(a=>a.getAttribute('href')+' '+a.querySelector('.stat').textContent.replace(/\s+/g,' ').slice(0,60))),e.filter(x=>!x.includes('404')));

await ctx.close()}
await b.close()})();
