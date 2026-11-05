/* 秘書處「會議報告事項」（meeting.js）：列出權益部標了會議要報告的即時回報、編輯這區後逐欄改名、儲存後寫回 data.json，commit 作者是〔秘書處 名字〕。固定 8300 埠 */
const c=require('./common');c.q='?d=secretariat';c.serveRemote=true;(async()=>{const k=await c.setup();const {b,mk,login,st}=k;
k.remote().events.filter(e=>!e.doneAt).slice(0,2).forEach(e=>e.report=true);
const p=await mk(1300,900,'light',false);
console.log('panel',await p.evaluate(()=>[!$('#meetPanel').hidden,document.querySelectorAll('#meetList .mt-ev').length]));
await login(p);
await p.click('[data-secedit=meet]');await p.waitForTimeout(400);
await p.click('#meetList .mt-ev [data-evpen=name]');await p.waitForTimeout(300);
await p.fill('#meetList .evf.open [data-e=name]','秘書處改的名字');await p.keyboard.press('Enter');await p.waitForTimeout(300);
console.log('dirty',await p.evaluate(()=>[...MT.depts.values()].filter(m=>m.dirty).map(m=>m.id)));
await p.screenshot({path:'meet1.png'});
await p.click('#saveBtn');await p.waitForTimeout(800);
for(let i=0;i<3;i++){const t=await p.evaluate(()=>$('#dlg').open?$('#dlgForm b').textContent:null);if(!t)break;
 if(await p.$('#dlgForm [data-act=delete]:visible'))await p.click('#dlgForm [data-act=delete]');else await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(800)}
await p.waitForTimeout(2500);
console.log('written',k.remote().events.filter(e=>e.report).map(e=>e.name),'commit',st.commits.map(m=>m.split('\n')[0]));
console.log('errs',p.errs.filter(x=>!x.includes('404')));await b.close()})();
