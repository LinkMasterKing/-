/* 今日層收合（2026-11-06 第二版：自己的欠阻尼彈簧，底板收到卡片大小後由卡片接著縮過頭到 .94、彈回、停在 1）
   與「記住這台裝置」開頁就登入（卡片上的編輯鈕一進來就看得到）。固定 8300 埠 */
const c=require('./common');(async()=>{const {b,mk,login}=await c.setup();
for(const [w,h,sc,tc] of [[1300,900,'dark',false],[412,860,'light',true]]){const p=await mk(w,h,sc,tc);
 await p.click('#notiBtn');await p.waitForTimeout(900);
 await p.click('#notiOv .nd-card.today');await p.waitForTimeout(1200);
 console.log(w,'today open',await p.evaluate(()=>todayOpen));
 const t0=Date.now();await p.keyboard.press('Escape');
 const tr=await p.evaluate(()=>new Promise(res=>{const out=[],s=performance.now(),card=$('#notiOv .nd-card.today');(function f(){const t=performance.now()-s;
   const m=getComputedStyle(card).transform,sc=m==='none'?1:+m.match(/matrix\(([^,]+)/)[1];out.push([Math.round(t),+sc.toFixed(3),$('#todayOv').hidden?'card':'ov']);if(t<1300)requestAnimationFrame(f);else res(out)})()}));
 const swap=tr.find(x=>x[2]==='card'),land=tr.filter(x=>x[2]==='card').map(x=>x[1]);
 console.log(w,'swap at',swap&&swap[0],'ms; card scale min',Math.min(...land),'max',Math.max(...land),'end',land[land.length-1]);
 console.log(w,'samples',tr.filter((x,i)=>i%6===0).map(x=>x.join(':')).join(' '));
 console.log(w,'errs',p.errs);await p.close();}
/* 記住這台裝置 → 重新整理 → 不用進設定就有編輯鈕 */
{const p=await mk(412,860,'light',true);
 console.log('before login authed',await p.evaluate(()=>document.body.classList.contains('authed')));
 await login(p);
 await p.evaluate(()=>{const m=meMember();return remSave(m)});
 console.log('remember saved',await p.evaluate(()=>!!remRead()));
 await p.reload();await p.waitForTimeout(2500);
 console.log('after reload loggedIn',await p.evaluate(()=>loggedIn()),'authed',await p.evaluate(()=>document.body.classList.contains('authed')),'setOpen',await p.evaluate(()=>setOpen));
 await p.click('.ev .ev-cap, .ev').catch(()=>{});await p.waitForTimeout(800);
 console.log('edit btn visible',await p.evaluate(()=>[...document.querySelectorAll('.card-edit-btn')].some(b=>b.offsetParent)));
 await p.screenshot({path:'td2_rem.png'});console.log('errs',p.errs);}
await b.close()})();
