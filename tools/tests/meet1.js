/* 秘書處「會議報告事項」（meeting.js）：列出權益部標了會議要報告的即時回報、整區「編輯」（會長室開放時，"s:meetedit"）後逐欄改名、儲存後寫回 data.json，commit 作者是〔秘書處 名字〕。固定 8300 埠
   2026-11-11 改寫成現在的介面：會議分頁（ext）、部門膠囊 #meetPick、#meetEdPanel 的「編輯」／「儲存」（以前是「編輯這區」與頁首的儲存）；
   會長室的開放（data-president.json 的 meetGrant＝今天）與秘書處的本機資料照 mt2.js 的做法模擬 */
const c=require('./common');c.q='?d=secretariat';c.serveRemote=true;(async()=>{const k=await c.setup();const {b,mk,login,st}=k;
const A=(ok,m)=>{if(!ok){console.log('FAIL:',m);process.exitCode=1}};
const API='https://api.github.com/repos/linkmasterking/-/contents/',d0=new Date(),T=`${d0.getFullYear()}-${String(d0.getMonth()+1).padStart(2,'0')}-${String(d0.getDate()).padStart(2,'0')}`;
st.puts[API+'data-president.json']={schemaVersion:11,id:'board-president',members:[],issues:[],events:[],weeks:[],meetGrant:{date:T,by:'小芸',at:T+' 09:00'}};
const rep=k.remote().events.filter(e=>!e.doneAt).slice(0,2);rep.forEach(e=>e.report=true);
const p=await mk(1300,900,'light',false);
/* 網站上其他部門的 data-*.json 當成不存在（權益部 data.json 由 serveRemote 回測試資料）；秘書處先放一份沒有身分的本機資料，登入走「共用密碼 0000 → 建立身分」 */
await p.context().route(/127\.0\.0\.1:8300\/data-.*\.json/,r=>r.fulfill({status:404,body:''}));
await p.evaluate(()=>{localStorage.setItem('workboard:ghtoken','T');localStorage.setItem('workboard:board-secretariat',JSON.stringify({id:'board-secretariat',issues:[],events:[],members:[],weeks:[],savedAt:'2000-01-01 00:00',sync:{owner:'linkmasterking',repo:'-',branch:'main',path:'data-secretariat.json'}}))});
await p.reload();await p.waitForTimeout(3500);
await p.click('#tabbar [data-tab=ext]');await p.waitForTimeout(1200);
await p.click('#meetPick [data-mtpick=rights]').catch(()=>{});await p.waitForTimeout(700);
const pn=await p.evaluate(()=>[!$('#meetEdPanel').hidden,[...document.querySelectorAll('#meetEdList .mt-ev')].map(d=>d.dataset.ev)]);console.log('panel',pn);
A(pn[0]&&pn[1].length===2&&rep.every(e=>pn[1].includes(e.id)),'lists the two report events of rights');
await login(p);await p.waitForTimeout(500);
await p.evaluate(()=>document.getElementById('meetEdPanel').scrollIntoView());
await p.click('#meetEdPanel [data-edit]');await p.waitForTimeout(900);
A(await p.evaluate(()=>editing&&cardEdit==='s:meetedit'),'meeting edit started');
const id=rep[0].id;
await p.click(`#meetEdList .mt-ev[data-ev="${id}"] summary`);await p.waitForTimeout(700);
await p.click(`#meetEdList .mt-ev[data-ev="${id}"] [data-evpen=name]`);await p.waitForTimeout(300);
await p.fill(`#meetEdList .mt-ev[data-ev="${id}"] .evf.open [data-e=name]`,'秘書處改的名字');await p.click(`#meetEdList .mt-ev[data-ev="${id}"] [data-evfx=ok]`);await p.waitForTimeout(400);
const dr=await p.evaluate(()=>[...MT.depts.values()].filter(m=>m.dirty).map(m=>m.id));console.log('dirty',dr);A(dr.join()==='rights','rights marked dirty');
await p.screenshot({path:'meet1.png'});
await p.click('#meetEdPanel [data-edsave]');await p.waitForTimeout(800);
for(let i=0;i<3;i++){const t=await p.evaluate(()=>$('#dlg').open?$('#dlgForm b').textContent:null);if(!t)break;console.log('dialog:',t);
 if(await p.$('#dlgForm [data-act=delete]:visible'))await p.click('#dlgForm [data-act=delete]');else await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(800)}
await p.waitForTimeout(2500);
const names=k.remote().events.filter(e=>e.report).map(e=>e.name),cm=st.commits.map(m=>m.split('\n')[0]);
console.log('written',names,'commit',cm);
A(k.remote().events.find(e=>e.id===id).name==='秘書處改的名字','written back to data.json');A(cm.some(m=>/^〔秘書處 王〕/.test(m)),'commit author 〔秘書處 名字〕');
const er=p.errs.filter(x=>!x.includes('404'));console.log('errs',er);A(!er.length,'errors');await b.close()})();
