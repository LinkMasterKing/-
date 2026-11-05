/* 核心｜返回：系統返回鍵／返回手勢、邊緣滑動的預測返回動畫
   - 打開一層（每週概述、設定、編輯紀錄、工作報告）時推一筆瀏覽紀錄：按返回／系統返回手勢先關掉最上面那層，不會直接離開網站
   - 觸控往右拖：最上面那層跟著手指縮小、右移、圓角變大（預測返回），底下的上一層露出來當預覽；放開過門檻就關掉，不到就彈回。
     有一層開著時，從畫面左半邊任何地方開始都可以（安卓手勢導航會把最邊緣留給系統）；沒有任何一層時只認左邊緣，在看板上這樣拖＝回各部門總覽（home.html）
   - 系統返回鍵／系統返回手勢：網頁拿不到系統手勢的進度，所以放開後補播同一個收尾動畫（縮小、右移、淡出，露出上一層）再關
   - 瀏覽器自己做了返回動畫（iOS Safari 邊緣滑動等，popstate 的 hasUAVisualTransition），就直接關、不再播一次 */
const Back=(()=>{
  const stack=[];let skip=0,gestured=null;
  if(history.state&&history.state.bl)history.replaceState(null,"");   /* 重新整理後殘留的紀錄 */
  function opened(name,close,el){
    if(stack.some(x=>x.name===name))return;
    stack.push({name,close,el});history.pushState({bl:name},"");
  }
  function closed(name){
    const i=stack.findIndex(x=>x.name===name);if(i<0)return;
    stack.splice(i,1);if(history.state&&history.state.bl){skip++;history.back()}   /* 最上面是我們推的紀錄就退一筆 */
  }
  addEventListener("popstate",e=>{
    if(skip){skip--;return}
    const top=stack.pop();if(!top)return;
    const g2=gestured&&gestured.top===top?gestured:null;gestured=null;
    /* 系統返回鍵／系統返回手勢（沒有經過我們的拖曳、瀏覽器也沒自己做動畫）：補播一次預測返回的收尾——
       這一層縮小、右移、圓角變大、淡出，底下的上一層（就是返回後的畫面）跟著露出來，再真的關掉 */
    if(!g2&&!e.hasUAVisualTransition&&top.name!=="week"&&!RM()){const el=top.el();
      if(el&&!el.hidden){Anim.backOut(el,()=>top.close(true));return}}
    top.close(!!e.hasUAVisualTransition||!!g2);
    if(g2){g2.anim.cancel();reset(g2.el)}   /* 已經用手勢動畫收掉了：關完再把樣式復原 */
  });
  /* ---------- 邊緣滑動 ---------- */
  const EDGE=28,RM=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pose=(el,p)=>{el.style.transformOrigin="100% 50%";el.style.transform=`translateX(${(p*14).toFixed(2)}vw) scale(${(1-.1*p).toFixed(4)})`;el.style.borderRadius=`${Math.round(p*32)}px`;el.style.overflow="hidden"};
  const reset=el=>{el.style.transform=el.style.transformOrigin=el.style.borderRadius=el.style.overflow=""};
  /* 這些地方按下去不當成返回手勢：輸入、下拉、切換鈕、可編輯的文字、可以左右捲動的區塊 */
  const noBack=t=>{if(!t.closest||t.closest("input,textarea,select,[contenteditable],.csel,.lseg,.tabbar"))return true;
    for(let n=t;n&&n.nodeType===1;n=n.parentElement){if(n.scrollWidth>n.clientWidth+2){const o=getComputedStyle(n).overflowX;if(o==="auto"||o==="scroll")return true}}return false};
  /* 用 touch 事件：要在 touchmove 裡 preventDefault，才擋得住頁面本身的左右捲動（主頁本來可以滑到每週概述） */
  let g=null;
  const pt=e=>e.changedTouches[0];
  addEventListener("touchstart",e=>{
    g=null;if(e.touches.length!==1||RM())return;const t=e.touches[0];
    const top=stack[stack.length-1];
    /* 安卓手勢導航會把螢幕最邊緣留給系統（網頁收不到），所以有一層開著時，從畫面左半邊任何地方往右拖都可以；
       在輸入框、可以左右捲的區塊、切換鈕上按下的不算，免得搶走原本的操作 */
    const wide=top&&top.name!=="week"&&t.clientX<innerWidth*.6&&!noBack(e.target);
    if(t.clientX>EDGE&&!wide)return;
    if(top&&top.name==="week")return;                       /* 每週概述本來就能左右滑 */
    if(document.querySelector("dialog[open]"))return;
    if(!top&&(editing||setOpen||notiOpen))return;            /* 編輯中不要一滑就離開看板 */
    const el=top?top.el():$("#pageMain");if(!el)return;
    g={x:t.clientX,y:t.clientY,top,el,on:false,v:0,lx:t.clientX,lt:e.timeStamp,edge:t.clientX<=EDGE};
  },{passive:true,capture:true});
  addEventListener("touchmove",e=>{
    if(!g)return;const t=pt(e),dx=t.clientX-g.x,dy=t.clientY-g.y;
    if(!g.on){if(Math.abs(dy)>12&&Math.abs(dy)>dx){g=null;return}if(dx<10)return;
      if(!g.edge&&dx<Math.abs(dy)*2){g=null;return}   /* 不是從邊緣開始的：要明顯往右才算返回，斜斜的捲動照常捲 */
      g.on=true;g.el.getAnimations().forEach(a=>a.cancel())}
    e.preventDefault();
    pose(g.el,Math.max(0,Math.min(1,dx/innerWidth)));
    const dt=e.timeStamp-g.lt;if(dt>0)g.v=(t.clientX-g.lx)/dt;g.lx=t.clientX;g.lt=e.timeStamp;
  },{passive:false,capture:true});
  const end=e=>{
    if(!g)return;const s=g;g=null;if(!s.on)return;
    const p=Math.max(0,Math.min(1,(pt(e).clientX-s.x)/innerWidth)),go=e.type!=="touchcancel"&&(p>.28||(s.v>.5&&p>.06));
    const from={transform:s.el.style.transform,borderRadius:s.el.style.borderRadius};
    if(!go){const a=s.el.animate([from,{transform:"none",borderRadius:"0px"}],{duration:360,easing:"cubic-bezier(.2,.9,.3,1.15)"});a.onfinish=()=>reset(s.el);reset(s.el);return}
    const a=s.el.animate([{...from,opacity:1},{transform:"translateX(22vw) scale(.86)",borderRadius:"32px",opacity:0}],{duration:220,easing:"cubic-bezier(.4,0,1,1)",fill:"forwards"});
    a.onfinish=()=>{
      if(s.top){gestured={top:s.top,anim:a,el:s.el};history.back()}
      else Back.home();
    };
  };
  addEventListener("touchend",end,{capture:true});addEventListener("touchcancel",end,{capture:true});
  /* 看板 → 各部門總覽：從總覽點進來的就用瀏覽器返回（保留總覽的捲動位置），否則直接開總覽 */
  function home(){
    let fromHome=false;try{fromHome=!!document.referrer&&new URL(document.referrer).pathname.endsWith("/home.html")}catch(_){}
    if(fromHome&&history.length>1&&!stack.length)history.back();else location.href="home.html";
  }
  return {opened,closed,home};
})();
/* 各層打開時登記（el 回傳拖動時要縮放的那個畫面） */
Back.layers={
  settings:()=>Back.opened("settings",i=>closeSettings(i),()=>$("#setOv")),
  noti:()=>Back.opened("noti",i=>closeNoti(i),()=>$("#notiOv")),
  log:()=>Back.opened("log",i=>closeLog(i===true),()=>$("#logOv")),
  report:()=>Back.opened("report",i=>closeReport(i),()=>$("#rptOv")),
  week:()=>Back.opened("week",i=>pager.scrollTo({left:0,behavior:i?"instant":"smooth"}),()=>$("#pageWeek")),
};

/* ---------- 跨頁（總覽 ↔ 看板）的頁面切換動畫 ----------
   往下一層（總覽→看板）：新頁從右邊推進來；往上一層或瀏覽器返回：舊頁縮小、右移、淡出（跟預測返回同一個樣子） */
(()=>{
  const lvl=u=>{try{return new URL(u,location.href).pathname.endsWith("/home.html")?0:1}catch(_){return 1}};
  const isBack=(from,to,act)=>lvl(to)<lvl(from)||!!(act&&act.navigationType==="traverse"&&act.entry&&act.from&&act.entry.index<act.from.index);
  addEventListener("pagereveal",e=>{if(!e.viewTransition)return;const act=window.navigation&&navigation.activation;
    const from=(act&&act.from&&act.from.url)||document.referrer;if(from&&isBack(from,location.href,act))e.viewTransition.types.add("back")});
  addEventListener("pageswap",e=>{if(!e.viewTransition||!e.activation)return;
    if(isBack(location.href,e.activation.entry.url,e.activation))e.viewTransition.types.add("back")});
})();
