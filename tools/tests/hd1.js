/* 頁首精簡（logo 置中、玻璃搜尋欄、只留週次）、頁首搜尋、設定頁「每週概述」、秘書處「各部門週報」調閱。
   桌面 1300 深色、手機 412 淺色。固定 8300 埠；截圖 hd1_*.png */
const c=require('./common');c.serveRemote=true;
const A=(ok,m)=>{if(!ok){console.log('FAIL:',m);process.exitCode=1}};   /* 2026-11-11：只印數值改成逐項判斷，壞了就以非 0 結束 */
(async()=>{const {b,mk}=await c.setup();
for(const [w,h,sc,tc] of [[1300,900,'dark',false],[412,860,'light',true]]){c.q='';const p=await mk(w,h,sc,tc);
 await p.waitForFunction(()=>!document.getElementById('splash'),null,{timeout:8000}).catch(()=>{});await p.waitForTimeout(300);
 const hd=await p.evaluate(()=>{const l=$('.logo-box').getBoundingClientRect();return [Math.round(l.left+l.width/2-innerWidth/2),$('#boardQ').placeholder,(()=>{const b=$('#notiBtn').getBoundingClientRect(),s=$('.hero-search').getBoundingClientRect();return 'bell right of search:'+(b.left>s.right&&Math.abs((b.top+b.height/2)-(s.top+s.height/2))<2)})(),!!$('#weekBtn'),!!$('#bigDate'),!!$('#titleSlot'),getComputedStyle($('#saveInfo')).width]});console.log(w,'header',hd);
 A(/^搜尋 \S+ (第\d+週|開學前)/.test(hd[1]),'placeholder');A(hd[2]==='bell right of search:true','bell');A(!hd[3]&&!hd[4]&&!hd[5],'header leftovers');
 await p.screenshot({path:`hd1_${w}.png`,clip:{x:0,y:0,width:w,height:300}});
 /* 搜尋 */
 const t=await p.evaluate(()=>state.events.find(e=>!e.doneAt).name);const q=t.slice(0,2);
 await p.fill('#boardQ',q);await p.waitForTimeout(400);
 const sr=await p.evaluate(()=>[!$('#boardRes').hidden,document.querySelectorAll('#boardRes .hr-item').length,$('#boardRes mark')?.textContent]);console.log(w,'search',q,sr);A(sr[0]&&sr[1]>0&&sr[2]===q,'search results');
 await p.screenshot({path:`hd1_${w}_search.png`});
 await p.keyboard.press('Enter');await p.waitForTimeout(900);
 const go=await p.evaluate(()=>[curSec,$('#boardRes').hidden||getComputedStyle($('#boardRes')).opacity,!!document.querySelector('#events details.ev[open], #events .ev.sel, #evDetail .evd')]);console.log(w,'go',go);A(go[0]==='live'&&(go[1]===true||go[1]==='0')&&go[2],'enter opens event');
 /* 設定 → 每週概述 */
 await p.click('#setBtn');await p.waitForTimeout(800);
 const wr=await p.evaluate(()=>!!$('#setOv [data-set=week]'));console.log(w,'set week row',wr);A(wr,'week row');
 await p.click('#setOv [data-set=week]');await p.waitForTimeout(1200);
 const ow=await p.evaluate(()=>[!!weekPaneEnd,setOpen,$('#setOv').hidden,!$('#weekSecLink').hidden,!$('#weekWrap').hidden&&!!$('#weekWrap').closest('#setOv,#setSub')]);console.log(w,'on week',ow);   /* 2026-11-06 每週概述改成設定裡的面板（weekly.js 的 weekPane；weekPaneEnd 有值＝開著），onWeek 已拿掉 */
 A(ow[0]&&ow[1]&&ow[4],'week pane open in settings');
 await p.click(w<900?'#subBack':'#backMain');await p.waitForTimeout(900);const bk=await p.evaluate(()=>[!!weekPaneEnd,setOpen,$('#weekWrap').hidden]);console.log(w,'back',bk);A(!bk[0]&&bk[1]&&bk[2],'back to settings list');   /* 手機在子頁，用子頁上方的「返回」 */
 const er=p.errs.filter(x=>!x.includes('404'));console.log(w,'errs',er);A(!er.length,'errors');await p.context().close()}
/* 秘書處 */
c.q='?d=secretariat';const p=await mk(1300,900,'dark',false);
await p.waitForFunction(()=>!document.getElementById('splash'),null,{timeout:8000}).catch(()=>{});await p.waitForTimeout(1500);
const sp=await p.evaluate(()=>[!$('#wkPanel').hidden,document.querySelectorAll('#wkDepts .wk-d').length,document.querySelectorAll('#wkBody .wk-doc').length]);console.log('sec panel',sp);A(sp[0]&&sp[1]>0,'sec weekly panel');
await p.click('#wkDepts [data-wkd=rights]');await p.waitForTimeout(400);
const rr=await p.evaluate(()=>[document.querySelectorAll('#wkBody .wk-w').length,$('#wkBody .wk-text')?.textContent.slice(0,20)]);console.log('rights',rr);A(rr[0]>0,'rights weekly reports');
await p.evaluate(()=>$('#wkPanel').scrollIntoView());await p.screenshot({path:'hd1_sec.png'});
const se=p.errs.filter(x=>!x.includes('404'));console.log('sec errs',se);A(!se.length,'sec errors');
await b.close()})();
