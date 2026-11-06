/* 通知層（notify.js，2026-11-05 重新設計）：鈴鐺數字（只算時間標記）、今日／明日卡片（點了打開那天）、搜尋欄（sticky、結果、點了閃兩下、Esc 清除）、
   近期智慧堆疊（上下拖曳換張、兩端橡皮筋、左右滑、頁碼點）、海報月曆（月份字、時段細線、同週分層）、全會切換、換月、點日期篩選、Esc 關閉；
   桌面 1300 深色、手機 412 淺色。固定 8300 埠；截圖 nt1_*.png */
const c=require('./common');(async()=>{const {b,mk}=await c.setup();
for(const [w,h,sc,tc] of [[1300,900,'dark',false],[412,860,'light',true]]){const p=await mk(w,h,sc,tc);
 await p.evaluate(()=>{const t=today(),e=state.events.find(x=>!x.doneAt);e.times=[
   {id:'tA',label:'開會',start:t+'T14:00',end:'',place:'行政大樓'},{id:'tB',label:'問卷期間',start:t,end:addDays(t,4),place:''},{id:'tC',label:'明日回覆',start:addDays(t,1),end:'',place:''},
   {id:'tD',label:'副校長約談',start:addDays(t,3)+'T15:30',end:'',place:'副校長室'},{id:'tE',label:'提案收件',start:addDays(t,2),end:addDays(t,5),place:'學生會辦公室'},{id:'tF',label:'成果發表',start:addDays(t,9),end:'',place:'演講廳'}];
   state.issues.forEach(i=>{i.start=t;i.end=addDays(t,1)});render()});
 console.log(w,'badge',await p.evaluate(()=>$('#notiBtn .noti-n').textContent),'(want 3: 開會、問卷期間、明日回覆；議題不算)');
 await p.click('#notiBtn');await p.waitForTimeout(900);
 console.log(w,'cards',await p.evaluate(()=>[...document.querySelectorAll('#notiOv .nd-card')].map(c=>c.querySelectorAll('.nd-row').length+':'+c.classList.contains('today'))));
 console.log(w,'no recent stack',await p.evaluate(()=>!document.querySelector('.nstack')),'poster',await p.evaluate(()=>[$('.pc-mon').textContent.replace(/^\d+/,''),document.querySelectorAll('.pc-e.span').length,Math.max(...[...document.querySelectorAll('.pc-week')].map(x=>+x.style.getPropertyValue('--lanes')))]));
 await p.screenshot({path:`nt1_${w}.png`});await p.screenshot({path:`nt1_${w}_full.png`,fullPage:false});
 /* 搜尋 */
 await p.fill('#notiQ','校長');await p.waitForTimeout(400);console.log(w,'search',await p.evaluate(()=>[!$('#notiRes').hidden,document.querySelectorAll('#notiRes .nr').length,$('#notiRes mark')?.textContent]));
 await p.screenshot({path:`nt1_${w}_search.png`});
 await p.click('#notiRes .nr');await p.waitForTimeout(500);console.log(w,'search pick',await p.evaluate(()=>[$('#notiRes').hidden||getComputedStyle($('#notiRes')).opacity,document.querySelectorAll('.pc-d.flash').length]));
 await p.fill('#notiQ','zz');await p.waitForTimeout(300);await p.focus('#notiQ');await p.keyboard.press('Escape');await p.waitForTimeout(400);
 console.log(w,'esc clears',await p.evaluate(()=>[$('#notiQ').value,notiOpen]));
 /* sticky：捲到下面搜尋欄還在 */
 await p.evaluate(()=>$('#notiOv .set-scroll').scrollTop=600);await p.waitForTimeout(300);
 console.log(w,'sticky top',await p.evaluate(()=>Math.round($('#notiOv .noti-search').getBoundingClientRect().top-$('#notiOv .set-scroll').getBoundingClientRect().top)));
 await p.screenshot({path:`nt1_${w}_scrolled.png`});
 /* 卡片：點明日＝打開那一天 */
 await p.evaluate(()=>$('#notiOv .set-scroll').scrollTop=0);await p.click('#notiOv .nd-card:not(.today)');await p.waitForTimeout(700);
 console.log(w,'open day',await p.evaluate(()=>[NOTI.day===addDays(today(),1),document.querySelectorAll('#notiDay .dv-tag').length,!!$('.pc-d.sel')]));
 console.log(w,'day view',await p.evaluate(()=>[!!$('#notiDay'),document.querySelectorAll('#notiDay .dv-tag').length,document.querySelectorAll('#notiCal .pc-lbl').length]));
 await p.click('#notiOv [data-nday]');await p.waitForTimeout(400);console.log(w,'day view closed',await p.evaluate(()=>[!$('#notiDay'),NOTI.day]));
 /* 整理：左滑右滑（只存這台裝置） */
 await p.evaluate(()=>{localStorage.removeItem(TRI_KEY());TRI=triLoad();renderNoti()});await p.waitForTimeout(300);
 const n0=await p.evaluate(()=>document.querySelectorAll('#notiDeck .dk-card').length),k0=await p.evaluate(()=>$('#notiDeck .dk-card[data-i="0"]').dataset.dk);
 await p.evaluate(()=>$('#notiDeck').scrollIntoView({block:'center'}));await p.waitForTimeout(300);
 const db=await (await p.$('#notiDeck .dk-card[data-i="0"]')).boundingBox();
 await p.mouse.move(db.x+db.width/2,db.y+db.height/2);await p.mouse.down();for(let i=1;i<=10;i++){await p.mouse.move(db.x+db.width/2+i*22,db.y+db.height/2+i);await p.waitForTimeout(16)}
 console.log(w,'deck drag stamp',await p.evaluate(()=>getComputedStyle($('#notiDeck .dk-card[data-i="0"] .dk-yes')).opacity));
 await p.screenshot({path:`nt1_${w}_deck.png`});
 await p.mouse.up();await p.waitForTimeout(700);
 console.log(w,'swiped right',await p.evaluate(k=>[TRI.yes.includes(k),document.querySelectorAll('#notiOv .nd-card.today .nd-pick .nd-row').length>=0,JSON.parse(localStorage.getItem(TRI_KEY())).yes.length],k0),'cards',n0);
 await p.click('#notiDeck [data-dkgo=no]');await p.waitForTimeout(700);console.log(w,'button no',await p.evaluate(()=>[TRI.no.length,TRI.last.length]));
 /* 今日卡片：只寫件數；點開（這一天）列出今天本來的＋剛滑過的（今天處理／還不要） */
 console.log(w,'today card count',await p.evaluate(()=>$('#notiOv .nd-card.today .nd-pick b')?.textContent||'(右滑的都是今天本來就有的)'));
 await p.evaluate(()=>notiOpenDay(today()));await p.waitForTimeout(600);
 console.log(w,'today view',await p.evaluate(()=>[document.querySelectorAll('#notiDay .dv-sub').length,[...document.querySelectorAll('#notiDay .dv-sub h4')].map(h=>h.textContent).join('/')]));
 await p.screenshot({path:`nt1_${w}_today.png`});
 await p.evaluate(()=>{NOTI.day=null;renderNoti()});
 await p.click('#notiDeck [data-dkundo]');await p.waitForTimeout(400);console.log(w,'undo',await p.evaluate(()=>[TRI.no.length,TRI.yes.length]));
 await p.evaluate(()=>{localStorage.removeItem(TRI_KEY());TRI=triLoad()});
 await p.click('#notiOv .noti-seg [data-k=all]');await p.waitForTimeout(1500);console.log(w,'all',await p.evaluate(()=>[!!NOTI.all,NOTI.loading,$('.pc-foot').textContent]));
 await p.click('#notiOv [data-nmon="1"]');await p.waitForTimeout(700);console.log(w,'month',await p.evaluate(()=>[NOTI.month,$('.pc-mon').textContent.replace(/^\d+/,'')]));
 await p.click('#notiOv .pc-d:not(.pc-pad)');await p.waitForTimeout(300);console.log(w,'day',await p.evaluate(()=>NOTI.day));
 await p.keyboard.press('Escape');await p.waitForTimeout(700);console.log(w,'closed',await p.evaluate(()=>[notiOpen,$('#notiOv').hidden]));
 console.log(w,'errs',p.errs.filter(x=>!x.includes('404')))}
await b.close()})();
