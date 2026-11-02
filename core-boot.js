/* 核心｜啟動：擷取匯出範本、讀資料、開始同步 */

/* 擷取匯出用的乾淨範本：扣掉執行期由 shell.js / 設定檔加上的東西 */
(function captureTemplate(){
  const root=document.documentElement.cloneNode(true);
  SHELL_IDS.forEach(id=>root.querySelector("#"+id)?.remove());
  root.querySelector("#dept-theme")?.remove();
  root.querySelector("body").removeAttribute("class");
  TEMPLATE="<!doctype html>\n"+root.outerHTML;BODY_SRC=root.querySelector("body").innerHTML;
})();
if(TEMPLATE.includes("data-bundle")&&location.protocol!=="file:")setTimeout(()=>bundleTemplate().catch(()=>{}),1500);

/* 進場畫面：至少放 1.1 秒（讓動畫跑完），資料與字型準備好就收；最多等 3.5 秒。收掉後才開始看板本身的進場動畫 */
const splashT0=performance.now();
function splashOut(){
  const sp=$("#splash"),go=()=>{document.body.classList.add("intro");setTimeout(()=>document.body.classList.remove("intro"),1400)};
  if(!sp)return go();
  const wait=Math.max(0,(reduceMotion()?300:1100)-(performance.now()-splashT0));
  Promise.race([Promise.all([document.fonts?document.fonts.ready:0,new Promise(r=>setTimeout(r,wait))]),new Promise(r=>setTimeout(r,3500))]).then(()=>{
    go();
    if(reduceMotion())return sp.remove();
    sp.animate([{opacity:1},{opacity:0}],{duration:520,easing:"ease-out"}).onfinish=()=>sp.remove();
    sp.querySelector(".sp-mark").animate([{transform:"none"},{transform:"scale(1.06)",opacity:0}],{duration:520,easing:"cubic-bezier(.4,0,1,1)",fill:"forwards"});
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
});
