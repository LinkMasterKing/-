/* mv1：repo 移轉準備（2026-11-12）。cloudCfg() 在 *.github.io 上一律以網址判斷帳號與 repo，資料檔裡寫死的 sync.owner／sync.repo 不再影響。
   同一份 data_test.json（sync 寫 linkmasterking/-）用三個網址打開，檢查讀取（GET）與存檔（PUT）打到的 GitHub API 位置：
   - https://linkmasterking.github.io/-/      → linkmasterking/-
   - https://stustsa.github.io/council/       → stustsa/council（資料檔裡的 linkmasterking 被忽略）
   - http://127.0.0.1:8300/（不是 github.io） → 資料檔的 sync（linkmasterking/-）
   每個網址：權益部（data.json）讀取＋存檔、雲端同步設定視窗的「帳號」「Repo 名稱」兩欄（github.io 上隱藏、本機顯示）、水果部（?d=fruit，data-fruit.json）讀取、總覽頁沒有錯誤。github.io 網址用 route 轉到本機 8300。固定 8300 埠 */
const c=require('./common');
(async()=>{let bad=0;const ok=(v,m)=>{console.log((v?'OK  ':'FAIL')+' '+m);if(!v)bad++};
const local=c.API.split('/repos/')[1].split('/').slice(0,2).join('/');
for(const [site,want] of [['https://linkmasterking.github.io/-/','linkmasterking/-'],['https://stustsa.github.io/council/','stustsa/council'],['http://127.0.0.1:8300/',local]]){
  c.site=site;c.q='';const {b,mk,st}=await c.setup();const base='https://api.github.com/repos/'+want+'/contents/';
  /* 權益部：讀取 */
  let p=await mk(1300,900,'light',false);
  await p.evaluate(()=>localStorage.setItem('workboard:ghtoken','T'));await p.reload();await p.waitForTimeout(2500);
  ok(await p.evaluate(()=>{const x=cloudCfg();return x.owner+'/'+x.repo})===want,`${site} cloudCfg() → ${want}`);
  ok(st.api.some(a=>a==='GET '+base+'data.json'),`${site} 權益部讀取打到 ${want}/data.json`);
  /* 權益部：存檔 */
  st.api.length=0;
  await p.evaluate(()=>{state.issues[0].title+='（移轉測試）';save()});await p.waitForTimeout(2500);
  const puts=st.api.filter(a=>a.startsWith('PUT '));
  ok(puts.length===1&&puts[0]==='PUT '+base+'data.json',`${site} 存檔 PUT 打到 ${want}/data.json → ${puts.join(',')||'沒有 PUT'}`);
  ok(st.api.every(a=>a.includes('/repos/'+want+'/')),`${site} 沒有打到其他 repo`);
  /* 雲端同步設定視窗：github.io 上帳號與 repo 依網址判斷，兩欄不顯示；其他網域照常顯示 */
  await p.evaluate(()=>{cloudSettings()});await p.waitForTimeout(500);
  const f=await p.evaluate(()=>[...document.querySelectorAll('#dlg[open] #dlgForm [name]')].map(i=>i.name));
  const gh=site.includes('.github.io'),has=n=>f.includes(n);
  ok(gh?!has('owner')&&!has('repo'):has('owner')&&has('repo'),`${site} 雲端同步設定：帳號／Repo 兩欄${gh?'隱藏':'顯示'} → ${f.join(',')}`);
  ok(has('branch')&&has('path')&&!(await p.$('#dlg[open] .dlg-note')),`${site} 雲端同步設定：分支、資料檔路徑照常顯示，沒有說明文字`);
  await p.click('#dlgForm [data-act=cancel]');await p.waitForTimeout(300);
  ok(!p.errs.filter(x=>!/404/.test(x)).length,`${site} 權益部沒有錯誤 `+p.errs.filter(x=>!/404/.test(x)).join('|'));
  await p.context().close();
  /* 水果部：讀取（本機網址沒有 github.io 可判斷，先放一份只有雲端位置的空白看板，跟 td3.js 相同） */
  st.api.length=0;c.q='?d=fruit';p=await mk(412,860,'dark',true);
  await p.evaluate(([o,r])=>{localStorage.setItem('workboard:ghtoken','T');if(location.hostname==='127.0.0.1')localStorage.setItem('workboard:board-fruit',JSON.stringify({id:'board-fruit',issues:[],events:[],members:[],weeks:[],savedAt:'2000-01-01 00:00',sync:{owner:o,repo:r,branch:'main',path:'data-fruit.json'}}))},local.split('/'));
  await p.reload();await p.waitForTimeout(2500);
  ok(st.api.some(a=>a==='GET '+base+'data-fruit.json'),`${site} 水果部讀取打到 ${want}/data-fruit.json`);
  ok(st.api.every(a=>a.includes('/repos/'+want+'/')),`${site} 水果部沒有打到其他 repo `+st.api.filter(a=>!a.includes('/repos/'+want+'/')).join(','));
  await p.context().close();
  /* 總覽頁 */
  p=await mk(412,860,'light',true);const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(site+'home.html');await p.waitForTimeout(2000);
  ok(!errs.length&&(await p.title()).length>0,`${site} 總覽頁正常打開 `+errs.join('|'));
  await p.context().close();await b.close();
}
process.exit(bad?1:0)})();
