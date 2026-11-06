const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,colorScheme:'dark',serviceWorkers:'block'});
await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));await ctx.route('https://api.github.com/**',r=>r.fulfill({status:404,body:'{}'}));
const p=await ctx.newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto('http://127.0.0.1:8300/home.html');await p.waitForTimeout(1200);
await p.evaluate(()=>document.querySelector('#srList a[href="index.html"]').click());   /* 2026-11-06：總覽頁的部門改成長按標誌選（hm1.js 測），這裡直接點隱藏的部門連結 */await p.waitForTimeout(2000);console.log('on board',p.url());
const st=()=>p.evaluate(()=>({len:history.length,state:history.state,set:setOpen,week:document.querySelector('#pager').scrollLeft>40}));
await p.click('#setBtn');await p.waitForTimeout(700);console.log('settings open',await st());
await p.goBack();await p.waitForTimeout(700);console.log('after back',await st(),p.url());
await p.click('#setBtn');await p.waitForTimeout(800);await p.click('#setOv [data-set=week]');await p.waitForTimeout(1300);   /* 2026-11-05：每週概述從設定頁進去（頁首按鈕已拿掉） */console.log('week',await st());
await p.goBack();await p.waitForTimeout(1200);console.log('after back week',await st());
await p.goBack();await p.waitForTimeout(1000);console.log('after back again（從設定進每週概述：返回先回設定、再返回才關掉）',await st());
// 拖曳返回手勢已停用（back.js 的 GESTURE=false）：拖了設定頁要還開著、沒有形變
await p.click('#setBtn');await p.waitForTimeout(700);
const cdp=await ctx.newCDPSession(p);
const tp=async(type,x)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y:400}]});
await tp('touchStart',5);for(let x=20;x<=260;x+=20){await tp('touchMove',x);await p.waitForTimeout(16)}
console.log('mid-drag transform',await p.evaluate(()=>$('#setOv').style.transform));
await tp('touchEnd',260);await p.waitForTimeout(900);console.log('after gesture（停用，set 應為 true）',await st(),await p.evaluate(()=>$('#setOv').style.transform));
// cancel gesture short（設定還開著，不用再打開）
await tp('touchStart',5);for(let x=20;x<=60;x+=20){await tp('touchMove',x);await p.waitForTimeout(40)}await p.waitForTimeout(200);await tp('touchEnd',60);await p.waitForTimeout(700);console.log('short drag keeps',await st());
await p.click('#setClose');await p.waitForTimeout(600);
// gesture on main（停用，應該留在 index.html）
await tp('touchStart',5);for(let x=20;x<=300;x+=20){await tp('touchMove',x);await p.waitForTimeout(16)}await tp('touchEnd',300);await p.waitForTimeout(2000);console.log('main gesture ->',p.url());
// logo link
await p.goto('http://127.0.0.1:8300/index.html?d=finance');await p.waitForTimeout(1500);await p.click('.logo-box');await p.waitForTimeout(1500);console.log('logo ->',p.url());
console.log('errs',e.filter(x=>!x.includes('404')));await b.close()})();
