/* sm1：手機版設定的下一層（nav.js 的 subRun）、學年上下按鈕（dialog.js 的 stepper）、手機版膠囊格不會被長標題撐出畫面。固定 8300 埠。
   手機 412：設定 → 學年 → 進到全畫面子頁（表單不是跳出的視窗）→ 按＋兩次、−一次 → 確定 → 回到設定清單、學年＋1；
   身分與專員 → 子頁 →「返回」回清單；看板名稱 → 系統返回鍵回清單；桌面 1300 仍是右側面板。完成紀錄放一筆很長的標題，膠囊右緣不超出區塊。 */
const C=require('./common.js');
(async()=>{const {b,mk,login}=await C.setup();let bad=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m);if(!c)bad++};
const p=await mk(412,860,'dark',true);await login(p);await p.click('#cancelBtn').catch(()=>{});await p.waitForTimeout(800);
const y0=await p.evaluate(()=>state.yearLabel);const n0=+(y0.match(/\d+/)||[0])[0];
await p.evaluate(()=>openSettings());await p.waitForTimeout(900);
await p.click('#setOv [data-set=year]');await p.waitForTimeout(900);
ok(await p.evaluate(()=>!$('#setSub').hidden&&!!$('#setSub .set-sub-body #dlg[open]')),'手機：學年進到全畫面子頁，表單在子頁裡');
ok(await p.evaluate(()=>!document.querySelector('#dlgForm input:not([type=hidden])')),'學年沒有要打字的輸入框');
await p.click('#dlgForm [data-step="1"]');await p.click('#dlgForm [data-step="1"]');await p.click('#dlgForm [data-step="-1"]');await p.waitForTimeout(300);
ok(await p.textContent('#dlgForm .stepper-n')===String(n0+1),'＋兩次、−一次：'+(n0+1));
await p.click('#dlgForm [data-act=ok]');await p.waitForTimeout(2200);
ok(await p.evaluate(()=>state.yearLabel)===`${n0+1}學年`,'學年存成「'+(n0+1)+'學年」');
ok(await p.evaluate(()=>$('#setSub').hidden&&!subOpen),'確定後回到設定清單');
await p.click('#setOv [data-set=team]');await p.waitForTimeout(900);
ok(await p.evaluate(()=>!$('#setSub').hidden),'身分與專員進到子頁');
await p.click('#subBack');await p.waitForTimeout(1500);
ok(await p.evaluate(()=>$('#setSub').hidden&&setOpen),'「返回」回到設定清單');
await p.click('#setOv [data-set=title]');await p.waitForTimeout(900);
await p.goBack();await p.waitForTimeout(1500);
ok(await p.evaluate(()=>$('#setSub').hidden&&setOpen),'系統返回鍵回到設定清單（設定還開著）');
await p.goBack();await p.waitForTimeout(1200);
ok(await p.evaluate(()=>!setOpen),'再按一次返回關掉設定');
/* 長標題不撐出畫面 */
await p.evaluate(()=>{const e=state.events.find(x=>x.doneAt);e.name='上傳NAS與常會資料以及提案單追蹤以及其他非常長的名稱';render();setSection('done',{instant:true})});await p.waitForTimeout(700);
const r=await p.evaluate(()=>({panel:$('#donePanel').getBoundingClientRect().right,cap:Math.max(...[...document.querySelectorAll('#doneList .ev')].map(e=>e.getBoundingClientRect().right))}));
ok(r.cap<=r.panel,'完成紀錄膠囊不超出區塊 '+JSON.stringify(r));
ok(!p.errs.length,'手機沒有錯誤 '+p.errs.join('|'));
/* 桌面：仍是右側面板 */
const D=await C.setup();const d=await D.mk(1300,900,'dark',false);await D.login(d);   /* 另外一份原始資料（手機那段已經建立過身分） */await d.click('#cancelBtn').catch(()=>{});await d.waitForTimeout(800);
await d.evaluate(()=>openSettings());await d.waitForTimeout(900);await d.click('#setOv [data-set=year]');await d.waitForTimeout(900);
ok(await d.evaluate(()=>!!$('#setOv .set-pane #dlg[open]')&&!(document.getElementById('setSub')&&!$('#setSub').hidden)),'桌面：學年仍在右側面板');
ok(!d.errs.length,'桌面沒有錯誤 '+d.errs.join('|'));
await D.b.close();await b.close();process.exit(bad?1:0)})();
