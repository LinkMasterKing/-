/* 核心｜安裝成 App：每個部門各一個 App，App 重開時回到上次停的地方。
   這個檔在 dept/config.js 前面載入（要在決定部門之前改網址），所以這裡還不能用 CFG／BOARD_DEPTS。

   1. 每個部門自己的 manifest：權益部（沒有 ?d）用根目錄的 manifest.webmanifest；其他部門用 dept/app/代號.webmanifest
      （start_url＝index.html?d=代號、id 各自不同），所以在哪個部門的看板按「安裝」／「加入主畫面」，裝起來的 App 就開那個部門。
      新增部門時要在 dept/app/ 多放一份 manifest（照現有的改代號與名稱）。
   2. 回到上次的位置：只在已安裝的 App 裡（display-mode fullscreen／standalone，或 iPhone 的 navigator.standalone）。
      - 記：離開或切到背景時記下目前的部門與區塊（localStorage「board-app:last:App 代號」，只存部門代號與區塊名稱，不存資料）。
      - 回：App 剛打開（這次開啟還沒記過 App 代號）時讀出來；部門不同就直接改網址（history.replaceState，不重新載入），
        區塊交給 render.js 的 curSec 初始值（appStartSec）。開場動畫照常播（不是站內換頁）。
      - 「App 代號」＝開啟時的部門，記在 sessionStorage：同一次開著時在 App 裡換到別的部門，下次打開這個 App 就回到那個部門。
      - 總覽頁（home.html）不記：下次打開回到最後看的那個部門看板。 */
const APP_MODE=(()=>{try{return matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches||navigator.standalone===true}catch(_){return false}})();
const APP_LAST="board-app:last:";
let appStartSec="";
(function appResume(){
  if(!APP_MODE)return;
  try{
    const q=new URLSearchParams(location.search),here=q.get("d")||"";
    if(sessionStorage.getItem("board-app:id")!==null)return;   /* 這次開啟已經處理過（站內換頁、重新整理） */
    sessionStorage.setItem("board-app:id",here);
    const last=JSON.parse(localStorage.getItem(APP_LAST+here)||"null");
    if(!last||typeof last.d!=="string"||!/^[a-z]*$/.test(last.d))return;
    if(last.d!==here){if(last.d)q.set("d",last.d);else q.delete("d");const s=q.toString();history.replaceState(history.state,"",location.pathname+(s?"?"+s:"")+location.hash)}
    if(typeof last.sec==="string")appStartSec=last.sec;
  }catch(_){}
})();
function appRemember(){
  if(!APP_MODE)return;
  try{const app=sessionStorage.getItem("board-app:id");if(app===null)return;
    const d=new URLSearchParams(location.search).get("d")||"";
    localStorage.setItem(APP_LAST+app,JSON.stringify({d,sec:typeof curSec==="string"?curSec:""}))}catch(_){}
}
addEventListener("pagehide",appRemember);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")appRemember()});
/* manifest 換成這個部門的（dept/config.js 跑完後才知道代號是不是有效的部門） */
document.addEventListener("DOMContentLoaded",()=>{
  const d=window.BOARD_CONFIG&&BOARD_CONFIG.deptId,first=window.BOARD_DEPTS&&BOARD_DEPTS[0];if(!d||!first)return;
  const link=document.querySelector('link[rel="manifest"]');if(link&&d!==first.id)link.href=`dept/app/${d}.webmanifest`;
  const t=document.querySelector('meta[name="apple-mobile-web-app-title"]'),name=BOARD_CONFIG.dept&&BOARD_CONFIG.dept.name;if(t&&name)t.content=name;
});
