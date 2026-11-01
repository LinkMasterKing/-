/* 核心｜底部工具列、設定頁、拉到底回彈、工具列依背景反轉 */
const IS_IOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
/* ---------- 底部工具列 ---------- */
let setOpen=false;
const TABS=()=>[["home","首頁","home"],...(CFG.sections.animation?[["anim","動畫","play"]]:[]),...(!readOnly()?[["edit","編輯","edit"]]:[])];
const tbActive=()=>animOpen?"anim":setOpen?"":editing?"edit":"home";
const lens={x:0,v:0,t:0,raf:0,drag:false,inited:false};
/* 用版面位置（offset）計算，不受全螢幕／縮放動畫影響 */
function tabCenter(k){const tb=$("#tabbar");const ind=tb&&tb.querySelector(`.tab[data-tab="${k}"] .tab-ind`);if(!ind||!ind.offsetWidth)return null;const box=tb.querySelector(".tb-tabs");return {x:box.offsetLeft+ind.offsetLeft+ind.offsetWidth/2,y:box.offsetTop+ind.offsetTop}}
function nearestTab(x){let best=null,d=1e9;$("#tabbar").querySelectorAll(".tab").forEach(b=>{const c=tabCenter(b.dataset.tab);if(c&&Math.abs(c.x-x)<d){d=Math.abs(c.x-x);best=b.dataset.tab}});return best}
function lensApply(){
  const el=$("#tabbar .tb-lens");if(!el)return;
  const st=lens.drag?0:Math.min(.3,Math.abs(lens.v)/2800),g=lens.drag?1.32:1;
  el.style.transform=`translate(${(lens.x-28).toFixed(2)}px,0) scale(${(g*(1+st)).toFixed(3)},${(g*(1-st*.45)).toFixed(3)})`;
}
function lensStep(){
  const k=520,c=33,dt=1/60,a=-k*(lens.x-lens.t)-c*lens.v;lens.v+=a*dt;lens.x+=lens.v*dt;
  if(Math.abs(lens.v)<4&&Math.abs(lens.x-lens.t)<.3){lens.x=lens.t;lens.v=0;lens.raf=0;lensApply();return}
  lensApply();lens.raf=requestAnimationFrame(lensStep);
}
function lensTo(k,instant){
  const el=$("#tabbar .tb-lens");if(!el)return;
  const c=k?tabCenter(k):null;
  el.classList.toggle("off",!c);if(!c)return;
  el.style.top=c.y+"px";lens.t=c.x;
  if(instant||reduceMotion()||!lens.inited){lens.inited=true;lens.x=c.x;lens.v=0;cancelAnimationFrame(lens.raf);lens.raf=0;lensApply();return}
  if(!lens.raf&&!lens.drag)lens.raf=requestAnimationFrame(lensStep);
}
function renderTabbar(){
  let tb=$("#tabbar");
  if(!tb){
    tb=document.createElement("nav");tb.id="tabbar";tb.className="tabbar";tb.setAttribute("aria-label","主要功能");
    tb.innerHTML=`<div class="tb-main"><span class="tb-lens" aria-hidden="true"></span><div class="tb-tabs" role="tablist"></div></div><button type="button" class="tb-gear" id="setBtn" aria-label="設定" aria-expanded="false">${ico("sliders","solo")}</button>`;
    document.body.append(tb);setupTabbar(tb);
  }
  const tabs=TABS(),box=tb.querySelector(".tb-tabs"),sig=tabs.map(t=>t[0]).join();
  if(box._sig!==sig){box._sig=sig;box.innerHTML=tabs.map(([k,t,ic])=>`<button type="button" class="tab" role="tab" data-tab="${k}"${k==="anim"?' id="animBtn"':k==="edit"?' id="editBtn"':""}><span class="tab-ind">${ico(ic,"solo")}</span><span class="tab-l">${t}</span></button>`).join("");lens.inited=false}
  const act=tbActive();
  box.querySelectorAll(".tab").forEach(b=>{const on=b.dataset.tab===act;b.classList.toggle("on",on);b.setAttribute("aria-selected",on)});
  const g=tb.querySelector("#setBtn");g.classList.toggle("on",setOpen);g.setAttribute("aria-expanded",setOpen);
  requestAnimationFrame(()=>lensTo(act));
  tbContrastSoon();
}
function tabGo(k){
  if(k==="home"){if(animOpen)closeAnim();if(setOpen)closeSettings();goMain();return}
  const b=document.querySelector(`#tabbar .tab[data-tab="${k}"]`);if(b)b.click();
}
function setupTabbar(tb){
  const main=tb.querySelector(".tb-main");
  glassify(main);glassify(tb.querySelector(".tb-gear"));
  let st=null,suppress=false,lastX=0,lastT=0;
  tb.addEventListener("click",e=>{if(suppress&&e.isTrusted){e.stopPropagation();e.preventDefault()}},true);
  main.addEventListener("pointerdown",e=>{if(e.button>0||editing)return;st={x:e.clientX,lx:lens.x,id:e.pointerId,moved:false};lastX=e.clientX;lastT=performance.now()});
  main.addEventListener("pointermove",e=>{
    if(!st||e.pointerId!==st.id)return;
    if(e.pointerType==="mouse"&&e.buttons===0){end();return}
    const dx=e.clientX-st.x;
    if(!st.moved){if(Math.abs(dx)<7)return;st.moved=true;lens.drag=true;try{main.setPointerCapture(e.pointerId)}catch(_){}tb.classList.add("dragging");cancelAnimationFrame(lens.raf);lens.raf=0;$("#tabbar .tb-lens").classList.remove("off")}
    const xs=[...main.querySelectorAll(".tab")].map(b=>tabCenter(b.dataset.tab).x),lo=Math.min(...xs),hi=Math.max(...xs);
    let x=st.lx+dx,over=0;if(x<lo){over=x-lo;x=lo+over*.3}else if(x>hi){over=x-hi;x=hi+over*.3}
    const now=performance.now();lens.v=(e.clientX-lastX)/Math.max(1,now-lastT)*1000;lastX=e.clientX;lastT=now;
    lens.x=x;lensApply();
    main.style.transformOrigin=over<0?"right center":"left center";main.style.transform=over?`scaleX(${(1+Math.min(.07,Math.abs(over)/700)).toFixed(4)})`:"";
    const near=nearestTab(x);main.querySelectorAll(".tab").forEach(b=>b.classList.toggle("hov",b.dataset.tab===near));
  });
  function end(){
    if(!st)return;const was=st.moved;st=null;main.style.transform="";main.querySelectorAll(".tab.hov").forEach(b=>b.classList.remove("hov"));
    if(!was)return;lens.drag=false;tb.classList.remove("dragging");suppress=true;setTimeout(()=>suppress=false,80);
    const k=nearestTab(lens.x);lensTo(k);if(!lens.raf)lens.raf=requestAnimationFrame(lensStep);
    if(k!==tbActive()){setTimeout(()=>tabGo(k),60);setTimeout(()=>lensTo(tbActive()),420)}else lensTo(tbActive());
  }
  main.addEventListener("pointerup",end);main.addEventListener("pointercancel",end);main.addEventListener("lostpointercapture",end);
  addEventListener("pointerup",end);addEventListener("pointercancel",end);addEventListener("blur",end);
  addEventListener("resize",()=>lensTo(tbActive(),true));
  document.fonts?.ready.then(()=>lensTo(tbActive(),true));
}
document.addEventListener("click",e=>{
  const t=e.target;if(!t.closest)return;
  /* 用滑鼠／手指點的：先放掉焦點，關掉對話框後才不會在按鈕上留下焦點框 */
  const tbBtn=t.closest("#tabbar button");if(tbBtn&&e.detail>0)tbBtn.blur();
  if(t.closest('#tabbar .tab[data-tab="home"]')){tabGo("home");return}
  if(t.closest("#setBtn")){if(animOpen){closeAnim();setTimeout(openSettings,60);return}setOpen?closeSettings():openSettings();return}
  if(t.closest('#tabbar .tab[data-tab="edit"]')){if(editing){e.stopPropagation();e.preventDefault();if(animOpen)closeAnim();if(setOpen)closeSettings();goMain();return}if(animOpen)closeAnim()}
},true);

/* ---------- 設定頁 ---------- */
function settingsHTML(){
  return `<div class="anim-top"><div class="anim-title"><span class="anim-k">SETTINGS</span><b>設定</b></div><div class="anim-ctl"><button type="button" id="setClose" aria-label="關閉設定">${ico("close")}關閉</button></div></div>
  <div class="set-scroll"><div class="set-inner">
    ${CFG.sections.simple?`<section class="set-sec"><h3 class="set-h">檢視模式</h3><div class="set-modes" role="radiogroup" aria-label="檢視模式">
      <button type="button" class="set-mode" role="radio" data-view="full"><span class="sm-ico">${ico("full","solo")}</span><span class="sm-t">完整</span><small>所有區塊一次看完</small></button>
      <button type="button" class="set-mode" role="radio" data-view="simple"><span class="sm-ico">${ico("simple","solo")}</span><span class="sm-t">簡化</span><small>三個按鈕，一次只看一區</small></button>
    </div></section>`:""}
    <section class="set-sec"><h3 class="set-h">紀錄</h3>
      <button type="button" class="set-row" data-open-log><span class="sr-ico">${ico("history","solo")}</span><span class="sr-t"><b>編輯紀錄</b><small>誰在什麼時候改了什麼</small></span><span class="sr-chev" aria-hidden="true"><svg viewBox="0 0 8 14" width="7" height="12"><path d="M1.5 1.5 6.5 7l-5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
    </section>
    <section class="set-sec"><h3 class="set-h">安裝成 App</h3><p class="set-p">iPhone：用 Safari 打開 → 分享 → 加入主畫面。<br>Android／電腦：瀏覽器選單裡的「安裝」。</p></section>
  </div></div>`;
}
function renderSettings(){document.querySelectorAll("#setOv [data-view]").forEach(b=>{const on=(b.dataset.view==="simple")===simple;b.classList.toggle("on",on);b.setAttribute("aria-checked",on)})}
function openSettings(){
  let ov=$("#setOv");
  if(!ov){document.body.insertAdjacentHTML("beforeend",`<div class="set-ov" id="setOv" role="dialog" aria-modal="true" aria-label="設定" hidden>${settingsHTML()}</div>`);ov=$("#setOv");
    $("#setClose").onclick=()=>closeSettings();elastic(ov.querySelector(".set-scroll"),ov.querySelector(".set-inner"))}
  if(setOpen)return;setOpen=true;ov.hidden=false;document.body.classList.add("set-open");renderSettings();renderTabbar();
  if(!reduceMotion())ov.animate([{transform:"translateX(28px)",opacity:0},{transform:"none",opacity:1}],{duration:380,easing:"cubic-bezier(.2,.9,.25,1)"});
}
function closeSettings(instant){
  const ov=$("#setOv");if(!ov||!setOpen)return;setOpen=false;renderTabbar();
  const done=()=>{if(!setOpen){ov.hidden=true;document.body.classList.remove("set-open")}};
  if(instant||reduceMotion())return done();
  ov.animate([{transform:"none",opacity:1},{transform:"translateX(28px)",opacity:0}],{duration:220,easing:"cubic-bezier(.4,0,1,1)"}).onfinish=done;
}
document.addEventListener("click",e=>{const v=e.target.closest&&e.target.closest("#setOv [data-view]");if(v)setViewMode(v.dataset.view==="simple")});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&setOpen&&!($("#dlg")||{}).open&&!($("#logOv")&&!$("#logOv").hidden))closeSettings()});

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
function tbContrastSoon(){if(!tbCR)tbCR=requestAnimationFrame(()=>{tbCR=0;tbContrast()})}
/* 主列和設定鈕各自判斷；多點取樣＋遲滯，避免邊界附近來回閃 */
function tbContrast(){
  const tb=$("#tabbar");if(!tb)return;
  tb.querySelectorAll(".tb-main,.tb-gear").forEach(el=>{
    const r=el.getBoundingClientRect();if(!r.width)return;
    const fx=el.classList.contains("tb-gear")?[.3,.5,.7]:[.1,.3,.5,.7,.9],fy=[.3,.5,.7];
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
