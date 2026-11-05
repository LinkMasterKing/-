const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for(const [w,h] of [[1300,860],[1100,800],[412,900]]){
const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8300/index.html');await p.waitForFunction(()=>!document.body.classList.contains('intro'));await p.waitForTimeout(600);
for(const sec of ['live','done']){
 await p.click(`#tabbar [data-tab=${sec}]`);await p.waitForTimeout(900);
 const sel=sec==='live'?'#events .ev summary':'#doneList .done-item summary';
 const n=await p.locator(sel).count();if(!n){console.log(w,sec,'no items');continue}
 await p.locator(sel).first().click();await p.waitForTimeout(900);
 const info=async()=>p.evaluate(s=>({sel:s==='live'?selEv:selDone,split:document.querySelector(s==='live'?'#liveMD':'#doneMD').classList.contains('split'),
   steps:[...document.querySelectorAll(`[data-mdstep=${s}]`)].map(x=>(x.disabled?'x':'o')+(x.offsetParent?'v':'h'))}),sec);
 console.log(w,sec,'open',JSON.stringify(await info()));
 const nx=p.locator(`[data-mdstep=${sec}][data-dir="1"]`);
 if(await nx.count()&&await nx.isVisible()){await nx.click();await p.waitForTimeout(900);console.log(w,sec,'next',JSON.stringify(await info()))}
 await p.keyboard.press('ArrowLeft');await p.waitForTimeout(900);console.log(w,sec,'key<-',JSON.stringify(await info()));
}
console.log(w,'editing?',await p.evaluate(()=>editing),'errs',errs);await ctx.close()}
await b.close()})();
