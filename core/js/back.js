/* 核心｜返回：系統返回鍵／返回手勢
   - 打開一層（每週概述、設定、通知、編輯紀錄、工作報告）時推一筆瀏覽紀錄：按返回／系統返回手勢先關掉最上面那層，不會直接離開網站。
   - 關的時候播的是各層自己的關閉動畫（換頁動畫 core/js/pagefx.js：這一層往後退、底下那層從後面浮上來）。
   - 瀏覽器自己做了返回動畫（iOS Safari 邊緣滑動等，popstate 的 hasUAVisualTransition）就直接關，不再播一次。
   - 2026-11-05 使用者決定拿掉「預測返回」（手指往右拖、這一層縮小右移）與它的收尾動畫，程式已刪除。 */
const Back=(()=>{
  const stack=[];let skip=0;
  if(history.state&&history.state.bl)history.replaceState(null,"");   /* 重新整理後殘留的紀錄 */
  function opened(name,close){
    if(stack.some(x=>x.name===name))return;
    stack.push({name,close});history.pushState({bl:name},"");
  }
  function closed(name){
    const i=stack.findIndex(x=>x.name===name);if(i<0)return;
    stack.splice(i,1);if(history.state&&history.state.bl){skip++;history.back()}   /* 最上面是我們推的紀錄就退一筆 */
  }
  /* 把某一層的紀錄直接換成另一層（不用先退一筆再推一筆，避免兩個非同步的瀏覽紀錄操作打架）：每週概述 → 返回設定時用 */
  function replace(name,next,close){
    const i=stack.findIndex(x=>x.name===name);if(i<0)return;
    stack[i]={name:next,close};if(history.state&&history.state.bl===name)history.replaceState({bl:next},"");
  }
  addEventListener("popstate",e=>{
    if(skip){skip--;return}
    const top=stack.pop();if(!top)return;
    top.close(!!e.hasUAVisualTransition);   /* true＝不要動畫（瀏覽器已經播過） */
  });
  /* 看板 → 各部門總覽：從總覽點進來的就用瀏覽器返回（保留總覽的捲動位置），否則直接開總覽（都有換頁動畫） */
  function home(){
    let fromHome=false;try{fromHome=!!document.referrer&&new URL(document.referrer).pathname.endsWith("/home.html")}catch(_){}
    if(fromHome&&history.length>1&&!stack.length)history.back();else PageFx.leave("home.html");
  }
  return {opened,closed,replace,home};
})();
/* 換頁動畫（pagefx.js）的「底下那一頁」：最上面還開著的全畫面層（skip 以外），沒有就是看板本身（#pager，含每週概述） */
function pageUnder(skip){for(const s of ["#rptOv","#logOv:not(.in-pane)","#setOv","#notiOv"]){const el=document.querySelector(s);if(el&&el!==skip&&!el.hidden)return el}return $("#pager")}
/* 各層打開時登記：close(instant) 關掉那一層 */
Back.layers={
  settings:()=>Back.opened("settings",i=>closeSettings(i)),
  noti:()=>Back.opened("noti",i=>closeNoti(i)),
  log:()=>Back.opened("log",i=>closeLog(i===true)),
  report:()=>Back.opened("report",i=>closeReport(i)),
};
