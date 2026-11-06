/* 核心｜啟動：擷取匯出範本、讀資料、開始同步 */

/* 擷取匯出用的乾淨範本：扣掉執行期由 shell.js / 設定檔加上的東西 */
(function captureTemplate(){
  const root=document.documentElement.cloneNode(true);
  SHELL_IDS.forEach(id=>root.querySelector("#"+id)?.remove());
  root.querySelector("#dept-theme")?.remove();
  root.querySelector("body").removeAttribute("class");
  TEMPLATE="<!doctype html>\n"+root.outerHTML;BODY_SRC=root.querySelector("body").innerHTML;
})();

/* 進場畫面：等 logo 的動畫真的播完（getAnimations 的 finished）、資料與字型也好了才收；最多等 3.5 秒。
   收場：logo 略放大淡出、白底淡出露出看板；收掉後才開始看板本身的進場動畫 */
/* 開場畫面收掉（core/js/splash.js）：開始淡出時看板播進場動畫（body.intro），收掉後工具列重新判斷背後的顏色 */
/* 進場動畫只給這一刻已經在畫面上的元素（標 data-intro，board.css「開頁時的進場動畫」段）；之後重畫出來的新元素不再播，不會閃第二下 */
const INTRO_SEL=".fill,.tk i,.card,.ev,.g-row";
const boardSplashOut=()=>splashOut(()=>{document.querySelectorAll(INTRO_SEL).forEach(e=>e.setAttribute("data-intro",""));document.body.classList.add("intro");
  setTimeout(()=>{document.body.classList.remove("intro");document.querySelectorAll("[data-intro]").forEach(e=>e.removeAttribute("data-intro"))},1400)},()=>tbContrastSoon());
/* 拆檔版：資料放在 data.json（與網頁同一個 repo），開頁時先讀它 */
const dataReady=SEEDED&&location.protocol!=="file:"?fetch(CFG.data.path,{cache:"no-cache"}).then(r=>r.ok?r.json():null).then(d=>{
  netFail=false;
  if(d&&(d.savedAt||"")>=(state.savedAt||"")){const keep=state.sync;state=normalize(d);if(!state.sync&&keep)state.sync=keep;try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}}
}).catch(()=>{netFail=true}):Promise.resolve();
/* 這台裝置記住了身分：開頁就直接登入，卡片上的「編輯」一進來就看得到（2026-11-06 使用者：要進設定再回來才出現）。
   有雲端時等雲端資料讀完才比對（本機舊資料的密碼指紋可能過期，比對失敗會清掉記住的身分） */
const remBoot=async()=>{if(!loggedIn()&&remRead()&&await remLogin())render()};
dataReady.then(()=>{
setBaseline();
render();
if(!cloudOn())remBoot();
/* 學年、開學日、甘特圖預設學期跟著秘書處（state.js 的 termCfg）：讀到秘書處的資料檔就重畫 */
if(!termOwn())fwLoad(TERM_OWNER).then(c=>{if(c&&c.data){termSrc={yearLabel:c.data.yearLabel,termStart:c.data.termStart,semester:c.data.semester};render()}});
if(cloudOn())(async()=>{
  const r=await cloudPull({force:true});
  if(r!=="offline"&&navigator.onLine)netFail=false;
  if(r==="empty"||r==="error"||r==="offline"||r==="limited"){try{const l=JSON.parse(localStorage.getItem(KEY)||"null");if(l&&l.issues&&(l.savedAt||"")>(state.savedAt||"")){state=normalize(l)}}catch(_){}}
  render();remBoot();
  pvAuto(false);   /* 後台管理員的裝置：自動開通各部門（provision.js；最多每 10 分鐘一次，其他人的裝置什麼都不做） */
  setInterval(async()=>{if(document.hidden||editing)return;const r=await cloudPull();if(r==="updated"){render();toast("看板已更新為最新內容")}else renderHeader()},60000);
  document.addEventListener("visibilitychange",async()=>{if(!document.hidden&&!editing){const r=await cloudPull();if(r==="updated"){render();toast("看板已更新為最新內容")}}});
})();
if(HOSTED)(async()=>{
  try{artifactNS=await window.claude.use("artifact")}catch(_){artifactNS=null}
  let u=null;try{u=await window.claude.use("user")}catch(_){}
  try{canWrite=artifactNS?(u?await u.canEdit():true):false}catch(_){canWrite=false}
  render();
})();
boardSplashOut();
if(MIGRATE_NOTE.staffDropped)setTimeout(()=>toast(`專員改成引用帳號：有 ${MIGRATE_NOTE.staffDropped} 筆專員標記找不到同名帳號，已拿掉（儲存後生效）`),4200);
});
