/* 核心｜底部工具列、設定頁、拉到底回彈、工具列依背景反轉 */
const IS_IOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
/* ---------- 底部工具列（手機）／左側細欄（桌面 900px 以上） ----------
   材質：毛玻璃 .glass（util.js 的 glassify，跟對話框同一套）；選取鏡片是實心膠囊（文字色），鏡片底下的圖示反白。
   按鈕機制照 Convx（Kyant backdrop catalog 的 LiquidBottomTabs／DampedDragAnimation／InteractiveHighlight／LiquidButton），手機與桌面同一套，
   差別只在方向（手機水平、桌面直立）：
     - 只有按在鏡片那一格才能拖；拖的時候位置跟著指標（不加彈簧），整條列跟著偏最多 4px；放開吸到最近的分頁
     - 按下時鏡片放大到 78/56（主軸彈簧 .6／250、側軸 .7／250），移動時依速度沿主軸拉伸；整條列沿長邊放大 16px、分頁內容放大 1.2；
       鏡片位置一圈白光（彈簧 .5／300）
     - 點分頁＝「按下 → 鏡片移過去（彈簧 1／1000）→ 接近目標或 400ms 後放開」
   設定鍵：按下放大 4px、白光跟著指標、被指標拖著微微偏移與拉伸（tanh 阻尼），放開彈回 */
let setOpen=false;
const TABS=()=>[["live","即時回報","live"],["progress","進度","progress"],["done","完成紀錄","done"]].filter(([k])=>secOn(k));
/* 設定打開時，三個分頁都不亮；點任一個就關掉並回到那一區 */
const tbActive=()=>setOpen?"":curSec;
const RAIL_MQ=matchMedia("(min-width:900px)");
const isRail=()=>RAIL_MQ.matches;
/* 彈簧（跟 Compose 的 spring(dampingRatio, stiffness) 一樣，質量 1） */
const spring=(x,z,k)=>({x,v:0,t:x,z,k});
function sprStep(s,dt){const c=2*s.z*Math.sqrt(s.k),n=4,h=dt/n;for(let i=0;i<n;i++){s.v+=(-s.k*(s.x-s.t)-c*s.v)*h;s.x+=s.v*h}}
const sprDone=(s,e)=>Math.abs(s.x-s.t)<e&&Math.abs(s.v)<e*20;
const sprSnap=(s,x)=>{s.x=s.t=x;s.v=0};
const PRESSED=78/56;
const lens={
  val:spring(0,1,1000),     /* 鏡片位置（第幾個分頁，可以有小數） */
  press:spring(0,1,1000),   /* 按下的程度 0–1：鏡片放大、整列放大、分頁內容放大 */
  sx:spring(1,.6,250),sy:spring(1,.7,250),
  vel:spring(0,.5,300),     /* 速度（每秒幾個分頁 ÷ 分頁間距數），放開時回到 0 */
  off:spring(0,1,300),      /* 整條列跟著拖曳的累積位移（px），顯示時壓成最多 4px */
  hl:spring(0,.5,300),      /* 整條列的白光 */
  drag:null,releaseAt:0,releasing:false,raf:0,last:0,shown:false,
};
const gearSt={p:spring(0,.5,300),ox:spring(0,.5,300),oy:spring(0,.5,300),sx0:0,sy0:0,down:false};
function tabEls(){return [...$("#tabbar").querySelectorAll(".tab")]}
/* 用版面位置（offset）計算，不受全螢幕／縮放動畫影響 */
function tabCenters(){
  /* 相對於 .tb-main（鏡片的定位容器）。分頁有 scale（--ts）時會變成圖示的 offsetParent，所以要看圖示的 offset 是相對誰 */
  const box=$("#tabbar").querySelector(".tb-tabs");
  return tabEls().map(b=>{const ind=b.querySelector(".tab-ind"),inB=ind.offsetParent===b,ix=(inB?b.offsetLeft:0)+ind.offsetLeft,iy=(inB?b.offsetTop:0)+ind.offsetTop;
    return {k:b.dataset.tab,x:box.offsetLeft+ix+ind.offsetWidth/2,y:box.offsetTop+b.offsetTop+b.offsetHeight/2,top:box.offsetTop+iy}});
}
const tabIndex=k=>tabEls().findIndex(b=>b.dataset.tab===k);
function interp(cs,v,key){if(!cs.length)return 0;const i=Math.max(0,Math.min(cs.length-1,Math.floor(v))),j=Math.min(cs.length-1,i+1),f=v-i;return cs[i][key]+(cs[j][key]-cs[i][key])*f}
const clampV=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function tbFrame(){
  const tb=$("#tabbar");if(!tb)return;
  const main=tb.querySelector(".tb-main"),el=tb.querySelector(".tb-lens"),gear=tb.querySelector(".tb-gear");
  const cs=tabCenters();if(!cs.length||!cs[0].x&&!cs[0].y)return;
  /* 手機沿 x、桌面沿 y；其他都一樣 */
  const rail=isRail(),ax=rail?"y":"x",n=cs.length,p=lens.press.x,pos=interp(cs,lens.val.x,ax),len=(rail?main.offsetHeight:main.offsetWidth)||1;
  const v=lens.vel.x/10,ma=lens.sx.x/(1-clampV(v*.75,-.2,.2)),cr=lens.sy.x*(1-clampV(v*.25,-.2,.2));   /* 主軸、側軸的縮放 */
  if(rail){el.style.top="";el.style.transform=`translate(0,${(pos-el.offsetHeight/2).toFixed(2)}px) scale(${cr.toFixed(4)},${ma.toFixed(4)})`}
  else{el.style.top=cs[0].top+"px";el.style.transform=`translate(${(pos-el.offsetWidth/2).toFixed(2)}px,0) scale(${ma.toFixed(4)},${cr.toFixed(4)})`}
  /* 鏡片底下那一格的圖示反白（跟著鏡片走，不是跟著選取狀態） */
  const lit=el.classList.contains("off")?-1:Math.round(clampV(lens.val.x,0,n-1));
  tabEls().forEach((b,i)=>b.classList.toggle("lit",i===lit));
  /* 整條列：拖曳時跟著偏最多 4px（EaseOut），按下時沿長邊放大 16px */
  const fr=clampV(lens.off.x/len,-1,1),ease=1-Math.pow(1-Math.abs(fr),2),po=4*Math.sign(fr)*ease;
  main.style.transform=po?`translate${rail?"Y":"X"}(${po.toFixed(2)}px)`:"";main.style.scale=p>.0005?(1+16/len*p).toFixed(4):"";
  tb.querySelector(".tb-tabs").style.setProperty("--ts",(1+.2*p).toFixed(4));
  main.style.setProperty("--hp",lens.hl.x.toFixed(4));
  main.style.setProperty("--hx",rail?"50%":(pos+po).toFixed(1)+"px");main.style.setProperty("--hy",rail?(pos+po).toFixed(1)+"px":"50%");
  /* 設定鍵（手機、桌面同一套） */
  const g=gearSt,gh=gear.offsetHeight||1,gw=gear.offsetWidth||1,md=Math.min(gw,gh),mx=Math.max(gw,gh),ox=g.ox.x,oy=g.oy.x;
  const gs=1+4/gh*g.p.x,ang=Math.atan2(oy,ox),mds=4/gh;
  const tx=md*Math.tanh(.05*ox/md),ty=md*Math.tanh(.05*oy/md);
  const gsx=gs+mds*Math.abs(Math.cos(ang)*ox/mx)*Math.min(gw/gh,1),gsy=gs+mds*Math.abs(Math.sin(ang)*oy/mx)*Math.min(gh/gw,1);
  gear.style.transform=(tx||ty)?`translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px)`:"";
  gear.style.scale=g.p.x>.0005||tx||ty?`${gsx.toFixed(4)} ${gsy.toFixed(4)}`:"";
  gear.style.setProperty("--hp",g.p.x.toFixed(4));gear.style.setProperty("--hx",(g.sx0+ox).toFixed(1)+"px");gear.style.setProperty("--hy",(g.sy0+oy).toFixed(1)+"px");
}
const TB_SPRINGS=()=>[lens.val,lens.press,lens.sx,lens.sy,lens.vel,lens.off,lens.hl,gearSt.p,gearSt.ox,gearSt.oy];
function tbLoop(now){
  const dt=Math.min(1/30,Math.max(1/240,(now-(lens.last||now))/1000||1/60));lens.last=now;
  if(!lens.drag)TB_SPRINGS().forEach(s=>sprStep(s,dt));
  else{[lens.press,lens.sx,lens.sy,lens.hl,gearSt.p,gearSt.ox,gearSt.oy].forEach(s=>sprStep(s,dt));
    if(now-lens.drag.t>80)sprSnap(lens.vel,0)}   /* 手指停住：速度歸零（Convx 的速度追蹤器也是看最近的移動） */
  /* 放開：等鏡片接近目標（間距的 2.5%）或最多 400ms，才讓按下的形變消失 */
  if(lens.releasing){const n=Math.max(1,tabEls().length-1);if(Math.abs(lens.val.x-lens.val.t)<n*.025||now-lens.releaseAt>400){lens.releasing=false;lens.vel.t=0;lens.press.t=0;lens.sx.t=1;lens.sy.t=1}}
  tbFrame();
  if(lens.drag||lens.releasing||gearSt.down||!TB_SPRINGS().every(s=>sprDone(s,.0008))){lens.raf=requestAnimationFrame(tbLoop);return}
  TB_SPRINGS().forEach(s=>sprSnap(s,s.t));tbFrame();lens.raf=0;lens.last=0;
}
const tbKick=()=>{if(!lens.raf){lens.last=0;lens.raf=requestAnimationFrame(tbLoop)}};
function lensPress(){if(reduceMotion())return;lens.press.t=1;lens.sx.t=PRESSED;lens.sy.t=PRESSED;lens.releasing=false}
function lensRelease(){lens.releasing=true;lens.releaseAt=performance.now()}
/* 移到某個分頁：照 animateToValue（按下 → 移過去 → 放開），手機、桌面一樣 */
function lensTo(k,instant){
  const tb=$("#tabbar");if(!tb)return;const el=tb.querySelector(".tb-lens");
  const i=k?tabIndex(k):-1;el.classList.toggle("off",i<0);
  if(i<0){lens.shown=false;tabEls().forEach(b=>b.classList.remove("lit"));return}
  if(instant||reduceMotion()||!lens.shown){lens.shown=true;sprSnap(lens.val,i);tbFrame();return}
  if(lens.val.t!==i&&!lens.drag){lens.val.t=i;lensPress();lensRelease()}   /* 點分頁：按下 → 移過去 → 放開 */
  tbKick();
}
function renderTabbar(){
  let tb=$("#tabbar");
  if(!tb){
    tb=document.createElement("nav");tb.id="tabbar";tb.className="tabbar";tb.setAttribute("aria-label","主要功能");
    tb.innerHTML=`<div class="tb-main"><span class="tb-lens" aria-hidden="true"></span><div class="tb-tabs" role="tablist"></div></div><button type="button" class="tb-gear" id="setBtn" aria-label="設定" aria-expanded="false">${ico("sliders","solo")}</button>`;
    document.body.append(tb);setupTabbar(tb);
  }
  const tabs=TABS(),box=tb.querySelector(".tb-tabs"),sig=tabs.map(t=>t[0]).join();
  if(box._sig!==sig){box._sig=sig;box.innerHTML=tabs.map(([k,t,ic])=>`<button type="button" class="tab" role="tab" data-tab="${k}" aria-label="${t}"><span class="tab-ind">${ico(ic,"solo")}</span><span class="tab-l">${t}</span></button>`).join("");lens.shown=false}
  const act=tbActive();
  box.querySelectorAll(".tab").forEach(b=>{const on=b.dataset.tab===act;b.classList.toggle("on",on);b.setAttribute("aria-selected",on)});
  const g=tb.querySelector("#setBtn");g.classList.toggle("on",setOpen);g.setAttribute("aria-expanded",setOpen);
  requestAnimationFrame(()=>lensTo(act));
  tbContrastSoon();
}
function tabGo(k){if(setOpen)closeSettings();if(notiOpen)closeNoti();goMain();setSection(k)}
function setupTabbar(tb){
  const main=tb.querySelector(".tb-main"),gear=tb.querySelector(".tb-gear"),lensEl=tb.querySelector(".tb-lens");
  /* 毛玻璃：分頁列、設定鍵各一塊（桌面也一樣，分頁列直立） */
  glassify(main);glassify(gear);
  let suppress=false,lastX=0,lastT=0,lastV=0;
  const at=e=>isRail()?e.clientY:e.clientX;   /* 指標在主軸上的位置 */
  tb.addEventListener("click",e=>{if(suppress&&e.isTrusted){e.stopPropagation();e.preventDefault()}},true);
  /* 只有按在鏡片那一格才拖；按下立刻放大（手機、桌面一樣） */
  main.addEventListener("pointerdown",e=>{
    if(e.button>0||lens.drag||!e.target.closest(".tab"))return;
    const cs=tabCenters();if(!cs.length||lens.press.t===0&&$("#tabbar .tb-lens").classList.contains("off"))return;
    const rail=isRail(),ax=rail?"y":"x",r=main.getBoundingClientRect();
    const slot=cs.length>1?Math.abs(cs[1][ax]-cs[0][ax]):(rail?main.offsetHeight:main.offsetWidth);
    const lp=interp(cs,lens.val.x,ax);if(Math.abs(at(e)-(rail?r.top:r.left)-lp)>slot/2)return;
    lens.drag={id:e.pointerId,x:at(e),moved:false,slot,n:cs.length,t:performance.now()};lastX=at(e);lastT=performance.now();lastV=lens.val.x;
    try{main.setPointerCapture(e.pointerId)}catch(_){}
    tb.classList.add("dragging");lensPress();lens.hl.t=reduceMotion()?0:1;tbKick();
  });
  main.addEventListener("pointermove",e=>{
    const d=lens.drag;if(!d||e.pointerId!==d.id)return;
    if(e.pointerType==="mouse"&&e.buttons===0){dragEnd();return}
    const c=at(e),dx=c-d.x;d.x=c;if(!dx)return;if(Math.abs(c-lastX)>2||d.moved)d.moved=true;
    sprSnap(lens.val,clampV(lens.val.x+dx/d.slot,0,d.n-1));sprSnap(lens.off,lens.off.x+dx);
    const now=performance.now(),dt=Math.max(8,now-lastT)/1000;sprSnap(lens.vel,(lens.val.x-lastV)/dt/Math.max(1,d.n-1));lastV=lens.val.x;lastT=now;d.t=now;lastX=c;
    const near=Math.round(lens.val.x);tabEls().forEach((b,i)=>b.classList.toggle("hov",i===near));
    tbKick();
  });
  function dragEnd(){
    const d=lens.drag;if(!d)return;lens.drag=null;tb.classList.remove("dragging");tabEls().forEach(b=>b.classList.remove("hov"));
    if(d.moved){suppress=true;setTimeout(()=>suppress=false,80)}
    const i=Math.round(clampV(lens.val.x,0,d.n-1)),k=tabEls()[i]&&tabEls()[i].dataset.tab;
    lens.vel.t=lens.vel.x;lens.off.t=0;lens.hl.t=0;lens.val.t=i;lensRelease();tbKick();
    if(d.moved&&k&&k!==tbActive())setTimeout(()=>tabGo(k),60);
  }
  main.addEventListener("pointerup",dragEnd);main.addEventListener("pointercancel",dragEnd);
  /* 觸控時瀏覽器會先把指標鎖在按下的那顆按鈕；改鎖到整列時，那顆按鈕送出的 lostpointercapture 會冒泡上來，不能當成放開 */
  main.addEventListener("lostpointercapture",e=>{if(e.target===main)dragEnd()});
  addEventListener("pointerup",dragEnd);addEventListener("pointercancel",dragEnd);addEventListener("blur",dragEnd);
  /* 設定鍵：LiquidButton */
  gear.addEventListener("pointerdown",e=>{
    if(e.button>0||reduceMotion())return;const r=gear.getBoundingClientRect(),g=gearSt;
    g.down=e.pointerId;g.sx0=e.clientX-r.left;g.sy0=e.clientY-r.top;g.x0=e.clientX;g.y0=e.clientY;sprSnap(g.ox,0);sprSnap(g.oy,0);g.p.t=1;
    try{gear.setPointerCapture(e.pointerId)}catch(_){}tbKick();
  });
  gear.addEventListener("pointermove",e=>{const g=gearSt;if(g.down!==e.pointerId)return;sprSnap(g.ox,e.clientX-g.x0);sprSnap(g.oy,e.clientY-g.y0);tbKick()});
  const gearUp=e=>{const g=gearSt;if(g.down===false||e&&e.pointerId!==undefined&&e.pointerId!==g.down)return;g.down=false;g.p.t=0;g.ox.t=0;g.oy.t=0;tbKick()};
  gear.addEventListener("pointerup",gearUp);gear.addEventListener("pointercancel",gearUp);addEventListener("pointerup",gearUp);addEventListener("blur",()=>gearUp());
  const relayout=()=>{lensTo(tbActive(),true);tbContrastSoon()};
  RAIL_MQ.addEventListener("change",()=>{TB_SPRINGS().forEach(s=>sprSnap(s,s===lens.val?s.x:(s===lens.sx||s===lens.sy?1:0)));lens.drag=null;lens.releasing=false;[main,gear].forEach(n=>n.classList.remove("on-light","on-dark"));requestAnimationFrame(relayout)});
  addEventListener("resize",()=>lensTo(tbActive(),true));
  document.fonts?.ready.then(()=>lensTo(tbActive(),true));
}
document.addEventListener("click",e=>{
  const t=e.target;if(!t.closest)return;
  /* 用滑鼠／手指點的：先放掉焦點，關掉對話框後才不會在按鈕上留下焦點框 */
  const tbBtn=t.closest("#tabbar button");if(tbBtn&&e.detail>0)tbBtn.blur();
  const tab=t.closest("#tabbar .tab");if(tab){tabGo(tab.dataset.tab);return}
  if(t.closest("#setBtn")){if(notiOpen)closeNoti(true);setOpen?closeSettings():openSettings();return}
},true);

/* ---------- 設定頁 ---------- */
/* 登入前整頁只顯示鎖頭；桌面（900px 以上）點了有下一層的項目，清單往左滑、右側面板顯示內容；手機照舊跳出對話框 */
const SR_CHEV='<span class="sr-chev" aria-hidden="true"><svg viewBox="0 0 8 14" width="7" height="12"><path d="M1.5 1.5 6.5 7l-5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
const setRow=(k,ic,t,sub,off)=>`<button type="button" class="set-row" data-set="${k}"${off?' aria-disabled="true"':""}${k===paneKey?' aria-current="true"':""}><span class="sr-ico">${ico(ic,"solo")}</span><span class="sr-t"><b>${t}</b>${sub?`<small>${sub}</small>`:""}</span>${off?"":SR_CHEV}</button>`;
const setSec=(h,rows)=>`<section class="set-sec"><h3 class="set-h">${h}</h3><div class="set-list">${rows}</div></section>`;
const GATE_LOCK='<svg viewBox="0 0 64 64" width="104" height="104" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="gate-shackle" d="M22 29v-8a10 10 0 0 1 20 0v8"/><g class="gate-body"><rect x="14" y="29" width="36" height="26" rx="7"/><circle cx="32" cy="39.5" r="2.6"/><path d="M32 42v5"/></g></svg>';
function settingsInner(){
  if(!loggedIn())return state.locked
    ?`<div class="set-gate"><b>這是唯讀版</b><p class="sub">定型版沒有設定可以調整。</p></div>`
    :`<div class="set-gate"><button type="button" class="set-gate-ico" data-set-login aria-label="登入">${GATE_LOCK}</button><b>登入後才能使用設定</b><p class="sub">選擇身分、輸入個人密碼</p><button type="button" class="primary" data-set-login>登入</button></div>`;
  const c=cloudCfg(),rem=remRead(),remName=rem&&(state.members.find(m=>m.id===rem.id)||{}).name;
  return setSec("紀錄",setRow("log","history","編輯紀錄","誰在什麼時候改了什麼"))+
    (readOnly()?"":
    setSec("人員與權限",setRow("team","people","身分與專員","編輯身分、管理員（卡片上的專員就是這些身分）")+setRow("labels","tag","標籤",state.labels.length?`人事時地物 ${state.labels.length} 個`:"人事時地物，還沒有建立"))+
    setSec("看板資訊",setRow("title","edit","看板名稱",esc(state.title))+
      setRow("year","cap","學年",esc(state.yearLabel||"未設定"))+setRow("term","flag","開學日",state.termStart?fmt(state.termStart):"未設定"))+
    setSec("雲端與分享",setRow("cloud","cloud","雲端同步",cloudOn()?`${esc(c.owner)}/${esc(c.repo)} · ${ghToken()?"這台裝置已連上":"這台裝置還沒有權杖"}`:"尚未設定")+
      setRow("share","share","分享預覽","貼連結到 LINE、IG、FB 時顯示的標題與說明"))+
    setSec("匯出與備份",setRow("exportEdit","download","匯出備份","JSON 檔，之後可以再匯入")+
      setRow("import","upload","匯入備份","用備份檔取代目前的看板內容")+setRow("report","doc","匯出工作報告","選期間、補寫內容，再存成 PDF"))+
    setSec("這台裝置",setRow("forget","device","忘記這台裝置",remName?`目前記住：${esc(remName)}（登入時勾選「在這個裝置上記住密碼」）`:"這台裝置沒有記住任何身分",!remName)))+
    `<section class="set-sec"><h3 class="set-h">安裝成 App</h3><p class="set-p">iPhone：用 Safari 打開 → 分享 → 加入主畫面。<br>Android／電腦：瀏覽器選單裡的「安裝」。</p></section>`;
}
function settingsHTML(){
  return `<div class="anim-top"><div class="anim-title"><span class="anim-k">SETTINGS</span><b>設定</b></div><div class="anim-ctl"><button type="button" id="setClose" aria-label="關閉設定">${ico("close")}關閉</button></div></div>
  <div class="set-body"><div class="set-scroll"><div class="set-inner"></div></div><div class="set-pane" hidden></div></div>`;
}
/* 鎖頭：鎖扣反覆打開、落下，落下時鎖身輕輕一震 */
function gateAnim(){
  const sh=$("#setOv .gate-shackle"),bd=$("#setOv .gate-body");if(!sh||reduceMotion())return;
  const o={duration:2600,iterations:Infinity};
  sh.animate([{transform:"none",offset:0,easing:"cubic-bezier(.3,0,.2,1)"},{transform:"translateY(-8px)",offset:.24},{transform:"translateY(-8px)",offset:.56,easing:"cubic-bezier(.5,0,.8,.4)"},{transform:"translateY(1px)",offset:.68},{transform:"none",offset:.76},{transform:"none",offset:1}],o);
  bd.animate([{transform:"none",offset:0},{transform:"none",offset:.67},{transform:"translateY(1.5px)",offset:.71},{transform:"none",offset:.8},{transform:"none",offset:1}],o);
}
function renderSettings(){const el=$("#setOv .set-inner");if(el&&setOpen){el.innerHTML=settingsInner();gateAnim();flowWatch()}}
async function openSettings(){
  let ov=$("#setOv");
  if(!ov){document.body.insertAdjacentHTML("beforeend",`<div class="set-ov" id="setOv" role="dialog" aria-modal="true" aria-label="設定" hidden>${settingsHTML()}</div>`);ov=$("#setOv");
    $("#setClose").onclick=()=>closeSettings();elastic(ov.querySelector(".set-scroll"),ov.querySelector(".set-inner"))}
  if(setOpen)return;
  if(!loggedIn()&&remRead())await remLogin();   /* 這台裝置記住了身分：直接進去，不顯示鎖頭 */
  setOpen=true;ov.hidden=false;Back.layers.settings();document.body.classList.add("set-open");renderSettings();renderTabbar();
  if(!reduceMotion())ov.animate([{transform:"translateX(28px)",opacity:0},{transform:"none",opacity:1}],{duration:380,easing:"cubic-bezier(.2,.9,.25,1)"});
}
function closeSettings(instant){
  const ov=$("#setOv");if(!ov||!setOpen)return;
  if(paneKey){paneSeq++;paneDismiss();paneReset()}
  setOpen=false;renderTabbar();Back.closed("settings");
  const done=()=>{if(!setOpen){ov.hidden=true;document.body.classList.remove("set-open")}};
  if(instant||reduceMotion())return done();
  ov.animate([{transform:"none",opacity:1},{transform:"translateX(28px)",opacity:0}],{duration:220,easing:"cubic-bezier(.4,0,1,1)"}).onfinish=done;
}

/* ---------- 設定頁：桌面版右側面板 ----------
   paneKey＝目前選到的項目；paneJob＝正在右側進行的流程（對話框或編輯紀錄），流程結束就收起面板。
   換選另一項時先把目前的流程當成「取消」結束，再開新的。 */
let paneKey="",paneSeq=0,paneJob=null;
const PANE_MQ=matchMedia("(min-width:900px)");
const setEls=()=>{const b=$("#setOv .set-body");return b&&{body:b,sc:b.querySelector(".set-scroll"),pane:b.querySelector(".set-pane")}};
function setPaneHost(){const e=setEls();return setOpen&&paneKey&&e&&!e.pane.hidden?e.pane:null}
function paneMark(){document.querySelectorAll("#setOv .set-row").forEach(r=>r.dataset.set===paneKey?r.setAttribute("aria-current","true"):r.removeAttribute("aria-current"))}
function paneShow(k){
  const e=setEls();paneKey=k;paneMark();if(e.body.classList.contains("split"))return;
  const w0=e.sc.getBoundingClientRect().width;e.body.classList.add("split");e.pane.hidden=false;const w1=e.sc.getBoundingClientRect().width;
  if(reduceMotion())return;
  e.sc.animate([{flexBasis:w0+"px"},{flexBasis:w1+"px"}],{duration:480,easing:"cubic-bezier(.2,.9,.25,1)"});
  e.pane.animate([{opacity:0,transform:"translateX(40px)"},{opacity:1,transform:"none"}],{duration:420,delay:120,easing:"cubic-bezier(.2,.9,.25,1)",fill:"backwards"});
}
function paneHide(){
  const e=setEls();paneKey="";paneMark();if(!e||!e.body.classList.contains("split"))return;
  const back=()=>{if(paneKey)return;const w0=e.sc.getBoundingClientRect().width;paneReset();const w1=e.sc.getBoundingClientRect().width;
    if(!reduceMotion())e.sc.animate([{flexBasis:w0+"px"},{flexBasis:w1+"px"}],{duration:480,easing:"cubic-bezier(.2,.9,.25,1)"})};
  if(reduceMotion())return back();
  e.pane.animate([{opacity:1},{opacity:0,transform:"translateX(24px)"}],{duration:180,easing:"ease-in"}).onfinish=back;
}
function paneReset(){const e=setEls();paneKey="";if(!e)return;e.body.classList.remove("split");e.pane.hidden=true;paneMark()}
/* 把右側正在進行的流程當成取消：編輯紀錄就關掉，對話框就送出 cancel（身分與專員會照「完成」處理） */
function paneDismiss(){
  const d=$("#dlg"),lg=$("#logOv");
  if(lg&&!lg.hidden&&lg.classList.contains("in-pane"))closeLog();
  else if(d.open&&d.classList.contains("in-pane")){const ev=new Event("cancel",{cancelable:true});d.dispatchEvent(ev);if(!ev.defaultPrevented)d.close()}
  return paneJob||Promise.resolve();
}
async function paneRun(k,fn){
  const my=++paneSeq;
  if(paneJob)await paneDismiss();
  if(my!==paneSeq)return;
  paneShow(k);
  const job=paneJob=Promise.resolve().then(fn).catch(err=>console.error(err));
  await job;
  if(paneJob===job)paneJob=null;
  renderSettings();
  if(my===paneSeq)paneHide();
}
async function paneClose(){paneSeq++;await paneDismiss();paneHide()}
PANE_MQ.addEventListener("change",()=>{if(!PANE_MQ.matches&&paneKey){paneSeq++;paneDismiss();paneReset()}});

/* 看板資訊：每一項單獨修改（原本在編輯模式的頁首） */
const BOARD_INFO={
  title:["看板名稱",()=>[{name:"v",label:"看板名稱",value:state.title}],v=>{if(!v){toast("看板名稱不能空白");return false}state.title=v}],
  year:["學年",()=>[{name:"v",label:"學年（顯示在頁首，例如：115學年）",value:state.yearLabel||""}],v=>{state.yearLabel=v||""}],
  term:["開學日",()=>[{name:"v",label:"開學日（用來算開學第幾週）",type:"date",value:state.termStart||""}],v=>{state.termStart=v||""}],
};
async function editBoardInfo(k){
  const [t,fields,apply]=BOARD_INFO[k];
  const v=await ask(t,fields());if(!v)return;
  const key={title:"title",year:"yearLabel",term:"termStart"}[k];
  if((v.v||"")===(state[key]||""))return;
  await settingSave(()=>apply(v.v),`已更新${t}`);
}
function forgetDevice(){remClear();if(!editing){meId="";sessionPw="";sharedPwSession=""}renderSettings();toast("已忘記這台裝置，下次要重新輸入密碼")}
/* 有下一層的項目（桌面版放右側面板）；其他是直接執行的動作 */
const SET_FLOWS={
  log:()=>openLog(setPaneHost()),
  team:()=>teamSettings(),
  labels:()=>labelSettings(),
  title:()=>editBoardInfo("title"),year:()=>editBoardInfo("year"),term:()=>editBoardInfo("term"),
  cloud:async()=>{const before=JSON.stringify(state);const ok=await cloudSettings();if(ok&&!editing&&JSON.stringify(state)!==before)await settingSave(()=>{},"雲端設定已更新");else render()},
  share:()=>shareSettings(),
  report:()=>reportDialog(),
};
document.addEventListener("click",async e=>{
  if(!e.target.closest)return;
  if(e.target.closest("#setOv [data-set-login]")){if(await ensureLogin())renderSettings();return}
  const r=e.target.closest("#setOv [data-set]");if(!r)return;
  const k=r.dataset.set;
  if(r.getAttribute("aria-disabled")==="true"||!loggedIn())return;
  if(SET_FLOWS[k]){
    if(!PANE_MQ.matches){await SET_FLOWS[k]();renderSettings();return}
    if(k===paneKey){await paneClose();return}   /* 再點一次選到的項目＝收起 */
    await paneRun(k,SET_FLOWS[k]);return;
  }
  if(k==="forget"){forgetDevice();return}
  if(k==="exportEdit"){exportBackup();return}
  if(k==="import"){$("#importFile").click();return}
});
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape"||!setOpen)return;
  const d=$("#dlg"),lg=$("#logOv");
  if(d.open&&!d.classList.contains("in-pane"))return;   /* 跳出的對話框自己處理 */
  if(lg&&!lg.hidden)return;                              /* 編輯紀錄自己處理（team.js） */
  if(paneKey){paneClose();return}
  closeSettings();
});

/* ---------- 拉到底的回彈（iPhone 本來就有，就不重複） ---------- */
function elastic(sc,inner){
  if(IS_IOS||!sc||!inner||sc._elastic)return;sc._elastic=true;
  let off=0,acc=0,tm=0,y0=null,base=0,anim=null;
  const set=v=>{off=v;inner.style.transform=v?`translate3d(0,${v.toFixed(1)}px,0)`:""};
  const rub=d=>Math.sign(d)*Math.min(120,Math.pow(Math.abs(d),.8)*1.15);
  const back=()=>{if(!off)return;const from=off;set(0);if(reduceMotion())return;anim&&anim.cancel();anim=inner.animate([{transform:`translate3d(0,${from}px,0)`},{transform:"translate3d(0,0,0)"}],{duration:620,easing:"cubic-bezier(.16,1.35,.4,1)"})};
  const atTop=()=>sc.scrollTop<=0,atBot=()=>sc.scrollTop+sc.clientHeight>=sc.scrollHeight-1;
  sc.addEventListener("wheel",e=>{
    if(e.ctrlKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
    if((e.deltaY<0&&atTop())||(e.deltaY>0&&atBot())){anim&&anim.cancel();acc=Math.max(-260,Math.min(260,acc-e.deltaY*.45));set(rub(acc));clearTimeout(tm);tm=setTimeout(()=>{acc=0;back()},120)}
  },{passive:true});
  sc.addEventListener("touchstart",e=>{if(e.touches.length!==1)return;y0=e.touches[0].clientY;base=null},{passive:true});
  sc.addEventListener("touchmove",e=>{
    if(y0===null)return;const y=e.touches[0].clientY,dy=y-y0;
    if((dy>0&&atTop())||(dy<0&&atBot())){if(base===null)base=dy;if(e.cancelable)e.preventDefault();anim&&anim.cancel();set(rub(dy-base))}
    else if(off){set(0)}
  },{passive:false});
  const up=()=>{y0=null;base=null;back()};
  sc.addEventListener("touchend",up);sc.addEventListener("touchcancel",up);
}
elastic($("#pageMain"),document.querySelector("#pageMain .wrap"));
elastic($("#pageWeek"),document.querySelector("#pageWeek .week-wrap"));

/* ---------- 工具列文字依背後顏色自動反轉 ---------- */
function lumUnder(x,y){
  for(const el of document.elementsFromPoint(x,y)){
    if(el.closest("#tabbar")||el.classList.contains("dlg-ghost-bd"))continue;
    for(let n=el;n&&n.nodeType===1;n=n.parentElement){
      const m=(getComputedStyle(n).backgroundColor.match(/[\d.]+/g)||[]).map(Number);
      if(m.length>=3&&(m.length<4||m[3]>.45))return (0.2126*m[0]+0.7152*m[1]+0.0722*m[2])/255;
    }
    break;
  }
  const m=(getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g)||[0,0,0]).map(Number);return (0.2126*m[0]+0.7152*m[1]+0.0722*m[2])/255;
}
let tbCR=0;
/* 取樣要量版面（elementsFromPoint＋getComputedStyle），放在展開收合動畫進行中會讓動畫卡一下：
   等畫面上沒有展開收合動畫、瀏覽器閒下來再做 */
const idle=window.requestIdleCallback||(f=>setTimeout(f,60));
function tbContrastSoon(){
  if(tbCR)return;
  tbCR=1;const go=()=>{if(document.querySelector(".animating"))return setTimeout(go,120);idle(()=>{tbCR=0;tbContrast()},{timeout:300})};
  requestAnimationFrame(go);
}
/* 主列和設定鈕各自判斷（桌面主列是直的，取樣點改成上下排）；多點取樣＋遲滯，避免邊界附近來回閃 */
function tbContrast(){
  const tb=$("#tabbar");if(!tb)return;const rail=isRail();
  tb.querySelectorAll(".tb-main,.tb-gear").forEach(el=>{
    const r=el.getBoundingClientRect();if(!r.width)return;
    const g=el.classList.contains("tb-gear"),fx=g||rail?[.3,.5,.7]:[.1,.3,.5,.7,.9],fy=rail&&!g?[.1,.3,.5,.7,.9]:[.3,.5,.7];
    const ls=[];fx.forEach(a=>fy.forEach(b=>ls.push(lumUnder(r.left+r.width*a,r.top+r.height*b))));
    const light=ls.filter(v=>v>.6).length/ls.length,dark=ls.filter(v=>v<.4).length/ls.length;
    if(light>=.7){el.classList.add("on-light");el.classList.remove("on-dark")}
    else if(dark>=.6){el.classList.add("on-dark");el.classList.remove("on-light")}
  });
}
document.addEventListener("scroll",tbContrastSoon,{capture:true,passive:true});
addEventListener("resize",tbContrastSoon);
document.addEventListener("toggle",tbContrastSoon,true);
document.addEventListener("click",()=>setTimeout(tbContrastSoon,450),true);
