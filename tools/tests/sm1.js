/* sm1：手機版設定的下一層（nav.js 的 subRun）、學年上下按鈕（dialog.js 的 stepper）、手機版膠囊格不會被長標題撐出畫面。固定 8300 埠。
   手機 412（權益部）：人員 → 子頁 →「返回」回清單；看板名稱 → 系統返回鍵回清單；再返回關掉設定；完成紀錄放一筆很長的標題，膠囊右緣不超出區塊。
   手機 412（秘書處）：學年與開學日（合併頁，在子頁裡）→ 學年 → 表單在子頁裡 → 按＋兩次、−一次 → 確定 → 回到合併頁、學年＋1 →「返回」回設定清單；
   桌面 1300（秘書處）：學年仍在右側面板。
   2026-11-11 改寫：學年從 2026-11-06 起只在秘書處（state.js 的 termCfg，nav.js 的 SET_HUBS.term）；秘書處用下面這份測試資料（沒有身分、共用密碼 0000），
   因為網站上真的 data-secretariat.json 有全會密碼（sync.tokenAll），登入流程不一樣 */
const C=require('./common.js');
const SEC={schemaVersion:10,id:'secretariat',savedAt:'2099-01-01 00:00',title:'秘書處',yearLabel:'115學年',termStart:'2026-09-07',semester:'',issues:[],events:[],weeks:[],members:[]};
/* 秘書處的資料檔（網站上的、GitHub 上的）都換成 SEC；先清掉 mk() 第一次開頁時存下的本機資料再重新整理 */
const secPage=async(mk,w,touch)=>{C.q='?d=secretariat';const p=await mk(w,860,'dark',touch);C.q='';let secR=JSON.parse(JSON.stringify(SEC)),sha='x0';
  await p.route('https://api.github.com/**/data-secretariat.json*',async r=>{const q=r.request();
    if(q.method()==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha,content:Buffer.from(JSON.stringify(secR)).toString('base64')})});
    secR=JSON.parse(Buffer.from(JSON.parse(q.postData()).content,'base64').toString());sha='x'+Date.now();return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:{sha}})})});
  await p.route('http://127.0.0.1:8300/data-secretariat.json*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(secR)}));
  await p.evaluate(()=>{localStorage.clear();localStorage.setItem('workboard:ghtoken','T')});await p.reload();await p.waitForTimeout(2000);return p};
(async()=>{const {b,mk,login}=await C.setup();let bad=0;const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m);if(!c)bad++};
const p=await mk(412,860,'dark',true);await login(p);await p.waitForTimeout(800);
await p.evaluate(()=>openSettings());await p.waitForTimeout(900);
ok(await p.evaluate(()=>!$('#setOv [data-set=term]')&&!$('#setOv [data-set=year]')),'權益部設定清單沒有學年（跟著秘書處）');
await p.click('#setOv [data-set=team]');await p.waitForTimeout(900);
ok(await p.evaluate(()=>!$('#setSub').hidden&&subOpen),'人員進到子頁');
await p.click('#subBack');await p.waitForTimeout(1500);
ok(await p.evaluate(()=>$('#setSub').hidden&&setOpen),'「返回」回到設定清單');
await p.click('#setOv [data-set=title]');await p.waitForTimeout(900);
ok(await p.evaluate(()=>!$('#setSub').hidden&&!!$('#setSub .set-sub-body #dlg[open]')),'看板名稱的表單在子頁裡');
await p.goBack();await p.waitForTimeout(1500);
ok(await p.evaluate(()=>$('#setSub').hidden&&setOpen),'系統返回鍵回到設定清單（設定還開著）');
await p.goBack();await p.waitForTimeout(1200);
ok(await p.evaluate(()=>!setOpen),'再按一次返回關掉設定');
/* 長標題不撐出畫面 */
await p.evaluate(()=>{const e=state.events.find(x=>x.doneAt);e.name='上傳NAS與常會資料以及提案單追蹤以及其他非常長的名稱';render();setSection('done',{instant:true})});await p.waitForTimeout(700);
const r=await p.evaluate(()=>({panel:$('#donePanel').getBoundingClientRect().right,cap:Math.max(...[...document.querySelectorAll('#doneList .ev')].map(e=>e.getBoundingClientRect().right))}));
ok(r.cap>0&&r.cap<=r.panel,'完成紀錄膠囊不超出區塊 '+JSON.stringify(r));
ok(!p.errs.length,'手機（權益部）沒有錯誤 '+p.errs.join('|'));
/* 秘書處 手機：學年在「學年與開學日」合併頁裡 */
const s=await secPage(mk,412,true);await login(s);
const y0=await s.evaluate(()=>state.yearLabel);const n0=+(y0.match(/\d+/)||[0])[0];
await s.evaluate(()=>openSettings());await s.waitForTimeout(900);
await s.click('#setOv [data-set=term]');await s.waitForTimeout(1000);
ok(await s.evaluate(()=>!$('#setSub').hidden&&!!$('#setSub .set-hub [data-hub=year]')),'手機：學年與開學日進到全畫面子頁（合併頁）');
await s.click('#setSub [data-hub=year]');await s.waitForTimeout(900);
ok(await s.evaluate(()=>!!$('#setSub .set-sub-body #dlg[open]')),'學年的表單在子頁裡');
ok(await s.evaluate(()=>!document.querySelector('#dlgForm input:not([type=hidden])')),'學年沒有要打字的輸入框');
await s.click('#dlgForm [data-step="1"]');await s.click('#dlgForm [data-step="1"]');await s.click('#dlgForm [data-step="-1"]');await s.waitForTimeout(300);
ok(await s.textContent('#dlgForm .stepper-n')===String(n0+1),'＋兩次、−一次：'+(n0+1));
await s.click('#dlgForm [data-act=ok]');await s.waitForTimeout(2200);
ok(await s.evaluate(()=>state.yearLabel)===`${n0+1}學年`,'學年存成「'+(n0+1)+'學年」');
ok(await s.evaluate(()=>subOpen&&!$('#setSub').hidden&&!!$('#setSub .set-hub:not([hidden]) [data-hub=year]')),'確定後回到合併頁');
await s.click('#subBack');await s.waitForTimeout(1500);
ok(await s.evaluate(()=>$('#setSub').hidden&&!subOpen&&setOpen),'「返回」回到設定清單');
ok(!s.errs.length,'手機（秘書處）沒有錯誤 '+s.errs.join('|'));
/* 桌面：仍是右側面板 */
const D=await C.setup();const d=await secPage(D.mk,1300,false);await D.login(d);
await d.evaluate(()=>openSettings());await d.waitForTimeout(900);await d.click('#setOv [data-set=term]');await d.waitForTimeout(900);await d.click('#setOv [data-hub=year]');await d.waitForTimeout(900);
ok(await d.evaluate(()=>!!$('#setOv .set-pane #dlg[open]')&&!(document.getElementById('setSub')&&!$('#setSub').hidden)),'桌面：學年仍在右側面板');
ok(!d.errs.length,'桌面沒有錯誤 '+d.errs.join('|'));
await D.b.close();await b.close();process.exit(bad?1:0)})();
