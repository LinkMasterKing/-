const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1500,height:900},colorScheme:'dark',serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));await ctx.route('https://api.github.com/**',r=>r.fulfill({status:404,body:'{}'}));
const p=await ctx.newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('http://127.0.0.1:8300/index.html');await p.waitForTimeout(300);
console.log('splash at 300ms',await p.evaluate(()=>!!document.getElementById('splash')));await p.screenshot({path:'fx_splash.png'});
await p.waitForTimeout(2200);console.log('splash gone',await p.evaluate(()=>!document.getElementById('splash')));
// live flip
await p.click('#events .ev:nth-child(4) summary');await p.waitForTimeout(150);
console.log('mid-flip anims',await p.evaluate(()=>document.querySelectorAll('#events .ev').length+' '+[...document.querySelectorAll('#events .ev')].filter(x=>x.getAnimations().length).length));
await p.screenshot({path:'fx_mid.png'});await p.waitForTimeout(700);await p.screenshot({path:'fx_split.png'});
await p.hover('#evDetail .md-close');await p.waitForTimeout(300);await p.screenshot({path:'fx_close_hover.png',clip:{x:1300,y:150,width:200,height:120}});
await p.click('#evDetail .md-close');await p.waitForTimeout(800);console.log('closed',await p.evaluate(()=>[selEv,$('#liveMD').classList.contains('split')]));
// done
await p.click('#tabbar [data-tab=done]');await p.waitForTimeout(1200);console.log('done split before click',await p.evaluate(()=>$('#doneMD').classList.contains('split')));
await p.click('#doneList .done-item:nth-child(3) summary');await p.waitForTimeout(800);console.log('done after click',await p.evaluate(()=>[$('#doneMD').classList.contains('split'),selDone]));
await p.keyboard.press('Escape');await p.waitForTimeout(700);console.log('done esc',await p.evaluate(()=>$('#doneMD').classList.contains('split')));
// edit button crop
const eb=await (await p.$('#editBtn')).boundingBox();
await p.mouse.move(10,10);await p.screenshot({path:'fx_edit.png',clip:{x:eb.x-4,y:eb.y-4,width:eb.width+8,height:eb.height+8}});
console.log('errs',e);await b.close()})();
