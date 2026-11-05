/* 通知層（notify.js）：鈴鐺數字、今日／明日、月曆、點事件閃兩下、全會切換、換月、點日期篩選、Esc 關閉；桌面 1300 深色、手機 412 淺色。固定 8300 埠 */
const c=require('./common');(async()=>{const {b,mk}=await c.setup();
for(const [w,h,sc,tc] of [[1300,900,'dark',false],[412,860,'light',true]]){const p=await mk(w,h,sc,tc);
 await p.evaluate(()=>{const t=today(),e=state.events.find(x=>!x.doneAt);e.times.push({id:'tA',label:'開會',start:t+'T14:00',end:'',place:'行政大樓'},{id:'tB',label:'問卷期間',start:t,end:addDays(t,4),place:''},{id:'tC',label:'明日回覆',start:addDays(t,1),end:'',place:''});render()});
 console.log(w,'badge',await p.evaluate(()=>$('#notiBtn .noti-n').textContent));
 await p.click('#notiBtn');await p.waitForTimeout(700);
 console.log(w,'open',await p.evaluate(()=>[notiOpen,[...document.querySelectorAll('#notiOv .noti-day')].map(d=>d.querySelectorAll('.ni').length),document.querySelectorAll('#notiCal .cal-d').length]));
 await p.screenshot({path:`nt1_${w}.png`});
 await p.click('#notiOv .noti-list .ni');await p.waitForTimeout(400);console.log(w,'flash',await p.evaluate(()=>document.querySelectorAll('.cal-d.flash').length));
 await p.click('#notiOv [data-nscope=all]');await p.waitForTimeout(1500);console.log(w,'all',await p.evaluate(()=>[!!NOTI.all,NOTI.loading]));
 await p.click('#notiOv [data-nmon="1"]');await p.waitForTimeout(600);console.log(w,'month',await p.evaluate(()=>NOTI.month));
 await p.click('#notiOv .cal-d:not(.out)');await p.waitForTimeout(300);console.log(w,'day',await p.evaluate(()=>NOTI.day));
 await p.keyboard.press('Escape');await p.waitForTimeout(400);console.log(w,'closed',await p.evaluate(()=>[notiOpen,$('#notiOv').hidden]));
 console.log(w,'errs',p.errs.filter(x=>!x.includes('404')))}
await b.close()})();
