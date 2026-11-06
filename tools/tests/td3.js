/* 全會密碼與自動開通（provision.js，2026-11-06）＋測試部門水果部的加入流程與重置。GitHub API 用 common.js 模擬（所有分頁共用同一份假雲端）。
   1. 後台管理員（有權杖、siteadmin）在權益部登入 → 設定全會密碼 → 每個部門的資料檔都有 sync.tokenAll（沒有檔案的建立空白看板），既有部門的共用密碼不動
   2. 新裝置（沒有權杖、不是後台管理員）打開 ?d=fruit → 設定 → 登入：0000、錯的密碼不行；全會密碼 → 建立身分（預設記住）→ 完成畫面；這台裝置拿到權杖、身分存上雲端
   3. 重新整理：記住的身分直接登入、看得到編輯；儲存時不會出現貼權杖的欄位
   4. 第二個人（另一台新裝置）用「＋ 新增身分」＋全會密碼加入
   5. 後台管理員重置水果部：身分清空、留著 tokenAll、有 resetAt
   固定 8300 埠；本機不是 github.io，水果部的頁面先在瀏覽器放一份只有雲端位置的空白看板（線上會自動判斷） */
const c=require('./common');(async()=>{const {b,mk,login,st,remote}=await c.setup();
const API='https://api.github.com/repos/linkmasterking/-/contents/',ALLPW='fruit-test-password-2026';
const fruitFile=()=>st.puts[API+'data-fruit.json'];
const seedFruit=async p=>{await p.evaluate(()=>{localStorage.setItem('workboard:board-fruit',JSON.stringify({id:'board-fruit',issues:[],events:[],members:[],weeks:[],savedAt:'2000-01-01 00:00',sync:{owner:'linkmasterking',repo:'-',branch:'main',path:'data-fruit.json'}}))});await p.goto('http://127.0.0.1:8300/index.html?d=fruit');await p.waitForTimeout(2500)};
const dlg=p=>p.evaluate(()=>{const d=document.querySelector('#dlg[open]');return d?{t:(d.querySelector('#dlgForm>b')||{}).textContent,err:(d.querySelector('.dlg-err,.err')||{}).textContent||'',fields:[...d.querySelectorAll('input')].map(i=>i.name)}:null});
/* 1 */
const A=await mk(1300,900,'light',false);await A.evaluate(()=>localStorage.setItem('workboard:siteadmin','1'));await login(A);
const before=JSON.stringify({pw:remote().pwKdf||remote().pwHash||null});
A.evaluate(()=>allPwSet());await A.waitForTimeout(600);console.log('1 allpw dialog',await dlg(A));
await A.fill('#dlgForm input[name=p1]',ALLPW);await A.fill('#dlgForm input[name=p2]',ALLPW);await A.click('#dlgForm [data-act=ok]');await A.waitForTimeout(4000);
console.log('1 result',await dlg(A),await A.evaluate(()=>document.querySelector('#dlg[open] .dlg-note,#dlg[open] p')?.textContent));
await A.click('#dlgForm [data-act=ok]').catch(()=>{});await A.waitForTimeout(400);
const files=Object.keys(st.puts).map(k=>k.replace(API,''));
console.log('1 files',files.join(' '),'| every has tokenAll',Object.values(st.puts).every(x=>x.sync&&x.sync.tokenAll),'| rights tokenAll',!!(remote().sync||{}).tokenAll,'| rights pw unchanged',JSON.stringify({pw:remote().pwKdf||remote().pwHash||null})===before);
console.log('1 commits',st.commits.slice(0,3).map(x=>x.split('\n')[0]));
console.log('1 errs',A.errs);
/* 2 */
const N=await mk(412,860,'dark',true);await seedFruit(N);
console.log('2 fruit cloud',await N.evaluate(()=>[cloudOn(),!!(state.sync||{}).tokenAll,state.members.length,ghToken()?'has token':'no token',siteAdmin()]));
await N.click('#setBtn');await N.waitForTimeout(900);await N.click('#setOv .set-gate .primary');await N.waitForTimeout(600);
console.log('2 step1',await dlg(N));
await N.fill('#dlgForm input[name=pw]','0000');await N.click('#dlgForm [data-act=ok]');await N.waitForTimeout(1500);console.log('2 0000 rejected',await dlg(N));
await N.fill('#dlgForm input[name=pw]','wrong-password-123');await N.click('#dlgForm [data-act=ok]');await N.waitForTimeout(1500);console.log('2 wrong rejected',(await dlg(N)).t);
await N.fill('#dlgForm input[name=pw]',ALLPW);await N.click('#dlgForm [data-act=ok]');await N.waitForTimeout(2000);
console.log('2 step2',await dlg(N),'token now',await N.evaluate(()=>ghToken()==='T'),'rem checked',await N.evaluate(()=>document.querySelector('#dlgForm input[name=rem]')?.checked));
await N.screenshot({path:'td3_step2.png'});
await N.fill('#dlgForm input[name=name]','香蕉');await N.fill('#dlgForm input[name=p1]','banana-password-1');await N.fill('#dlgForm input[name=p2]','banana-password-1');await N.click('#dlgForm [data-act=ok]');await N.waitForTimeout(3500);
const done=await dlg(N);console.log('2 done',done&&done.t,await N.evaluate(()=>document.querySelector('#dlg[open] .dlg-note,#dlg[open] p')?.textContent?.slice(0,80)));
await N.screenshot({path:'td3_done.png'});
await N.click('#dlgForm [data-act=ok]').catch(()=>{});await N.waitForTimeout(500);
const ff=fruitFile();console.log('2 cloud fruit members',ff.members.map(m=>m.name+':'+m.role+':'+(m.tok?'tok':'NO')),'pwKdf',!!ff.pwKdf);
console.log('2 errs',N.errs);
/* 3 */
await N.reload();await N.waitForTimeout(3000);
console.log('3 reload loggedIn',await N.evaluate(()=>[loggedIn(),document.body.classList.contains('authed'),meName()]));
const saveDlg=await N.evaluate(async()=>{const p=prepareSave();await new Promise(r=>setTimeout(r,400));const d=document.querySelector('#dlg[open]');if(d){d.close('cancel')}const v=await p;return {dialog:!!d,ok:!!v}});
console.log('3 save needs no token dialog',saveDlg);
/* 4 */
const M=await mk(412,860,'light',true);await seedFruit(M);
await M.click('#setBtn');await M.waitForTimeout(900);await M.click('#setOv .set-gate .primary');await M.waitForTimeout(600);
console.log('4 pick identity',await dlg(M));
await M.click('#dlgForm [data-act=alt]');await M.waitForTimeout(600);console.log('4 step1',(await dlg(M)).t);
await M.fill('#dlgForm input[name=pw]',ALLPW);await M.click('#dlgForm [data-act=ok]');await M.waitForTimeout(2000);console.log('4 step2',(await dlg(M)).t);
await M.fill('#dlgForm input[name=name]','蘋果');await M.fill('#dlgForm input[name=p1]','apple-password-12');await M.fill('#dlgForm input[name=p2]','apple-password-12');await M.click('#dlgForm [data-act=ok]');await M.waitForTimeout(3500);
console.log('4 done',(await dlg(M)||{}).t);await M.click('#dlgForm [data-act=ok]').catch(()=>{});
console.log('4 cloud members',fruitFile().members.map(m=>m.name+':'+m.role+':'+(m.tok?'tok':'NO')),'errs',M.errs);
/* 5 */
A.evaluate(()=>pvReset('fruit'));await A.waitForTimeout(800);console.log('5 confirm',(await dlg(A)).t);
await A.click('#dlgForm [data-act=delete]');await A.waitForTimeout(2500);
const rf=fruitFile();console.log('5 after reset members',rf.members.length,'tokenAll',!!rf.sync.tokenAll,'resetAt',!!rf.sync.resetAt,'commit',st.commits[0].split('\n')[0]);
/* 重置後新裝置：又是第一位成員的流程 */
await N.reload();await N.waitForTimeout(3000);console.log('5 device after reset',await N.evaluate(()=>[state.members.length,loggedIn()]));
await N.click('#setBtn');await N.waitForTimeout(900);await N.click('#setOv .set-gate .primary').catch(()=>{});await N.waitForTimeout(600);console.log('5 first-member flow again',(await dlg(N)||{}).t);
console.log('5 errs',A.errs,N.errs);
await b.close()})();
