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
const splashT0=performance.now();
function splashOut(){
  const sp=$("#splash"),go=()=>{document.body.classList.add("intro");setTimeout(()=>document.body.classList.remove("intro"),1400)};
  if(!sp)return go();
  const wait=Math.max(0,(reduceMotion()?300:600)-(performance.now()-splashT0));
  const played=Promise.all(sp.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));
  Promise.race([Promise.all([document.fonts?document.fonts.ready:0,played,new Promise(r=>setTimeout(r,wait))]),new Promise(r=>setTimeout(r,3500))]).then(()=>{
    go();
    const gone=()=>{sp.remove();tbContrastSoon()};   /* 開場收掉後，工具列重新判斷背後的顏色 */
    if(reduceMotion())return gone();
    sp.animate([{opacity:1},{opacity:0}],{duration:520,easing:"ease-out"}).onfinish=gone;
    sp.querySelector(".sp-logo").animate([{transform:"none"},{transform:"scale(1.06)",opacity:0}],{duration:520,easing:"cubic-bezier(.4,0,1,1)",fill:"forwards"});
  });
}
/* 拆檔版：資料放在 data.json（與網頁同一個 repo），開頁時先讀它 */
const dataReady=SEEDED&&location.protocol!=="file:"?fetch(CFG.data.path,{cache:"no-cache"}).then(r=>r.ok?r.json():null).then(d=>{
  netFail=false;
  if(d&&(d.savedAt||"")>=(state.savedAt||"")){const keep=state.sync;state=normalize(d);if(!state.sync&&keep)state.sync=keep;try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}}
}).catch(()=>{netFail=true}):Promise.resolve();
dataReady.then(()=>{
setBaseline();
render();
if(cloudOn())(async()=>{
  const r=await cloudPull({force:true});
  if(r!=="offline"&&navigator.onLine)netFail=false;
  if(r==="empty"||r==="error"||r==="offline"||r==="limited"){try{const l=JSON.parse(localStorage.getItem(KEY)||"null");if(l&&l.issues&&(l.savedAt||"")>(state.savedAt||"")){state=normalize(l)}}catch(_){}}
  render();
  setInterval(async()=>{if(document.hidden||editing)return;const r=await cloudPull();if(r==="updated"){render();toast("看板已更新為最新內容")}else renderHeader()},60000);
  document.addEventListener("visibilitychange",async()=>{if(!document.hidden&&!editing){const r=await cloudPull();if(r==="updated"){render();toast("看板已更新為最新內容")}}});
})();
if(HOSTED)(async()=>{
  try{artifactNS=await window.claude.use("artifact")}catch(_){artifactNS=null}
  let u=null;try{u=await window.claude.use("user")}catch(_){}
  try{canWrite=artifactNS?(u?await u.canEdit():true):false}catch(_){canWrite=false}
  render();
})();
splashOut();
if(MIGRATE_NOTE.staffDropped)setTimeout(()=>toast(`專員改成引用帳號：有 ${MIGRATE_NOTE.staffDropped} 筆專員標記找不到同名帳號，已拿掉（儲存後生效）`),4200);
});
