/* 核心｜底部工具列、設定頁、拉到底回彈、工具列依背景反轉 */
const IS_IOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
/* ---------- 底部工具列 ---------- */
let setOpen=false;
const TABS=()=>[["live","即時回報","live"],["progress","進度","progress"],["done","完成紀錄","done"]].filter(([k])=>secOn(k));
/* 動畫或設定打開時，三個分頁都不亮；點任一個就關掉並回到那一區 */
const tbActive=()=>animOpen||setOpen?"":curSec;
const lens={x:0,v:0,t:0,s:1,sv:0,st:1,raf:0,drag:false,inited:false};   /* x 位置、s 按下放大的倍率（都是彈簧） */
/* 用版面位置（offset）計算，不受全螢幕／縮放動畫影響 */
function tabCenter(k){const tb=$("#tabbar");const ind=tb&&tb.querySelector(`.tab[data-tab="${k}"] .tab-ind`);if(!ind||!ind.offsetWidth)return null;const box=tb.querySelector(".tb-tabs");return {x:box.offsetLeft+ind.offsetLeft+ind.offsetWidth/2,y:box.offsetTop+ind.offsetTop}}
function nearestTab(x){let best=null,d=1e9;$("#tabbar").querySelectorAll(".tab").forEach(b=>{const c=tabCenter(b.dataset.tab);if(c&&Math.abs(c.x-x)<d){d=Math.abs(c.x-x);best=b.dataset.tab}});return best}
function lensApply(){
  const el=$("#tabbar .tb-lens");if(!el)return;
  const st=lens.drag?0:Math.min(.3,Math.abs(lens.v)/2800),g=lens.drag?1.32:lens.s;
  el.style.transform=`translate(${(lens.x-28).toFixed(2)}px,0) scale(${(g*(1+st)).toFixed(3)},${(g*(1-st*.45)).toFixed(3)})`;
}
/* 按下放大用的彈簧：阻尼比約 .45，放開時會稍微縮過頭再柔和回到 1，不會硬切 */
const SPRING_K=360,SPRING_C=17;
function springStep(o,p,v,t,dt){o[v]+=(-SPRING_K*(o[p]-o[t])-SPRING_C*o[v])*dt;o[p]+=o[v]*dt}
const springDone=(o,p,v,t)=>Math.abs(o[v])<.02&&Math.abs(o[p]-o[t])<.001;
function lensStep(){
  const k=520,c=33,dt=1/60,a=-k*(lens.x-lens.t)-c*lens.v;lens.v+=a*dt;lens.x+=lens.v*dt;
  springStep(lens,"s","sv","st",dt);
  if(Math.abs(lens.v)<4&&Math.abs(lens.x-lens.t)<.3&&springDone(lens,"s","sv","st")){lens.x=lens.t;lens.v=0;lens.s=lens.st;lens.sv=0;lens.raf=0;lensApply();return}
  lensApply();lens.raf=requestAnimationFrame(lensStep);
}
function lensTo(k,instant){
  const el=$("#tabbar .tb-lens");if(!el)return;
  const c=k?tabCenter(k):null;
  el.classList.toggle("off",!c);if(!c)return;
  el.style.top=c.y+"px";lens.t=c.x;
  if(instant||reduceMotion()||!lens.inited){lens.inited=true;lens.x=c.x;lens.v=0;cancelAnimationFrame(lens.raf);lens.raf=0;lensApply();if(!springDone(lens,"s","sv","st"))lens.raf=requestAnimationFrame(lensStep);return}
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
  if(box._sig!==sig){box._sig=sig;box.innerHTML=tabs.map(([k,t,ic])=>`<button type="button" class="tab" role="tab" data-tab="${k}"><span class="tab-ind">${ico(ic,"solo")}</span><span class="tab-l">${t}</span></button>`).join("");lens.inited=false}
  const act=tbActive();
  box.querySelectorAll(".tab").forEach(b=>{const on=b.dataset.tab===act;b.classList.toggle("on",on);b.setAttribute("aria-selected",on)});
  const g=tb.querySelector("#setBtn");g.classList.toggle("on",setOpen);g.setAttribute("aria-expanded",setOpen);
  requestAnimationFrame(()=>lensTo(act));
  tbContrastSoon();
}
function tabGo(k){if(animOpen)closeAnim();if(setOpen)closeSettings();goMain();setSection(k)}
function setupTabbar(tb){
  const main=tb.querySelector(".tb-main");
  glassify(main);glassify(tb.querySelector(".tb-gear"));
  let st=null,suppress=false,lastX=0,lastT=0;
  tb.addEventListener("click",e=>{if(suppress&&e.isTrusted){e.stopPropagation();e.preventDefault()}},true);
  main.addEventListener("pointerdown",e=>{if(e.button>0)return;st={x:e.clientX,lx:lens.x,id:e.pointerId,moved:false};lastX=e.clientX;lastT=performance.now()});
  main.addEventListener("pointermove",e=>{
    if(!st||e.pointerId!==st.id)return;
    if(e.pointerType==="mouse"&&e.buttons===0){end();return}
    const dx=e.clientX-st.x;
    if(!st.moved){if(Math.abs(dx)<7)return;st.moved=true;lens.drag=true;try{main.setPointerCapture(e.pointerId)}catch(_){}tb.classList.add("dragging");lens.s=lens.st=1;lens.sv=0;   /* 拖曳時鏡片本來就放大，取消按下的放大 */cancelAnimationFrame(lens.raf);lens.raf=0;$("#tabbar .tb-lens").classList.remove("off")}
    const xs=[...main.querySelectorAll(".tab")].map(b=>tabCenter(b.dataset.tab).x),lo=Math.min(...xs),hi=Math.max(...xs);
    let x=st.lx+dx,over=0;if(x<lo){over=x-lo;x=lo+over*.3}else if(x>hi){over=x-hi;x=hi+over*.3}
    const now=performance.now();lens.v=(e.clientX-lastX)/Math.max(1,now-lastT)*1000;lastX=e.clientX;lastT=now;
    lens.x=x;lensApply();
    main.style.transformOrigin=over<0?"right center":"left center";main.style.transform=over?`scaleX(${(1+Math.min(.07,Math.abs(over)/700)).toFixed(4)})`:"";
    const near=nearestTab(x);main.querySelectorAll(".tab").forEach(b=>b.classList.toggle("hov",b.dataset.tab===near));
  });
  function end(){
    if(!st)return;const was=st.moved;st=null;main.style.transform="";main.style.transformOrigin="";main.querySelectorAll(".tab.hov").forEach(b=>b.classList.remove("hov"));
    if(!was)return;lens.drag=false;tb.classList.remove("dragging");suppress=true;setTimeout(()=>suppress=false,80);
    const k=nearestTab(lens.x);lensTo(k);if(!lens.raf)lens.raf=requestAnimationFrame(lensStep);
    if(k!==tbActive()){setTimeout(()=>tabGo(k),60);setTimeout(()=>lensTo(tbActive()),420)}else lensTo(tbActive());
  }
  main.addEventListener("pointerup",end);main.addEventListener("pointercancel",end);
  /* 按下的回饋（跟鏡片移動一起當雙重回饋）：
     - 放大的是被按的那顆：分頁＝鏡片（選取膠囊），設定鍵＝設定鍵本身；都用彈簧（鏡片併入鏡片的彈簧迴圈），按太快也至少放大 150ms
     - 整條分頁列不放大，只朝按下的位置線性微晃一下（最多 2.5px，Web Animations、composite:"add" 疊在橡皮筋上） */
  const gear=tb.querySelector(".tb-gear");
  const PRESS={lens:1.16,gear:1.1};
  gear._sp={s:1,sv:0,st:1,raf:0};
  const gearStep=()=>{const o=gear._sp;springStep(o,"s","sv","st",1/60);
    if(springDone(o,"s","sv","st")){o.s=o.st;o.sv=0;o.raf=0;gear.style.scale=o.s===1?"":String(o.s);return}
    gear.style.scale=o.s.toFixed(4);o.raf=requestAnimationFrame(gearStep)};
  let pressAt=0,relT=0;
  const press=which=>{
    if(reduceMotion())return;pressAt=performance.now();clearTimeout(relT);
    if(which==="lens"){lens.st=PRESS.lens;if(!lens.raf)lens.raf=requestAnimationFrame(lensStep)}
    else{gear._sp.st=PRESS.gear;if(!gear._sp.raf)gear._sp.raf=requestAnimationFrame(gearStep)}
  };
  const releaseAll=()=>{
    if(lens.st===1&&gear._sp.st===1)return;
    relT=setTimeout(()=>{
      if(lens.st!==1){lens.st=1;if(!lens.raf&&!lens.drag)lens.raf=requestAnimationFrame(lensStep)}
      if(gear._sp.st!==1){gear._sp.st=1;if(!gear._sp.raf)gear._sp.raf=requestAnimationFrame(gearStep)}
    },Math.max(0,150-(performance.now()-pressAt)));
  };
  const nudge=x=>{
    if(reduceMotion())return;
    const r=main.getBoundingClientRect(),dx=Math.max(-1,Math.min(1,(x-(r.left+r.width/2))/(r.width/2)))*2.5;
    main.animate([{transform:"translateX(0)"},{transform:`translateX(${dx.toFixed(2)}px)`,offset:.3},{transform:`translateX(${(-dx*.35).toFixed(2)}px)`,offset:.7},{transform:"translateX(0)"}],{duration:380,easing:"linear",composite:"add"});
  };
  main.addEventListener("pointerdown",e=>{if(e.button>0||!e.target.closest(".tab"))return;press("lens");nudge(e.clientX)});
  gear.addEventListener("pointerdown",e=>{if(e.button>0)return;press("gear");nudge(e.clientX)});
  addEventListener("pointerup",releaseAll);addEventListener("pointercancel",releaseAll);
  /* 觸控時瀏覽器會先把指標鎖在按下的那顆按鈕；改鎖到整列時，那顆按鈕送出的 lostpointercapture 會冒泡上來，不能當成放開 */
  main.addEventListener("lostpointercapture",e=>{if(e.target===main)end()});
  addEventListener("pointerup",end);addEventListener("pointercancel",end);addEventListener("blur",end);
  addEventListener("resize",()=>lensTo(tbActive(),true));
  document.fonts?.ready.then(()=>lensTo(tbActive(),true));
}
document.addEventListener("click",e=>{
  const t=e.target;if(!t.closest)return;
  /* 用滑鼠／手指點的：先放掉焦點，關掉對話框後才不會在按鈕上留下焦點框 */
  const tbBtn=t.closest("#tabbar button");if(tbBtn&&e.detail>0)tbBtn.blur();
  const tab=t.closest("#tabbar .tab");if(tab){tabGo(tab.dataset.tab);return}
  if(t.closest("#setBtn")){if(animOpen){closeAnim();setTimeout(openSettings,60);return}setOpen?closeSettings():openSettings();return}
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
    setSec("人員與權限",setRow("team","people","身分與專員","編輯身分、管理員、專員名單"))+
    setSec("看板資訊",setRow("title","edit","看板名稱",esc(state.title))+setRow("date","calendar","看板日期",state.boardDate?fmt(state.boardDate):"自動（使用儲存當天）")+
      setRow("year","cap","學年",esc(state.yearLabel||"未設定"))+setRow("term","flag","開學日",state.termStart?fmt(state.termStart):"未設定"))+
    setSec("雲端與分享",setRow("cloud","cloud","雲端同步",cloudOn()?`${esc(c.owner)}/${esc(c.repo)} · ${ghToken()?"這台裝置已連上":"這台裝置還沒有權杖"}`:"尚未設定")+
      setRow("share","share","分享預覽","貼連結到 LINE、IG、FB 時顯示的標題與說明"))+
    setSec("匯出與備份",setRow("exportLocked","download","匯出定型版","唯讀的單一網頁檔，可以直接傳給別人看")+setRow("exportEdit","download","匯出備份","JSON 檔，之後可以再匯入")+
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
function renderSettings(){const el=$("#setOv .set-inner");if(el&&setOpen){el.innerHTML=settingsInner();gateAnim()}}
async function openSettings(){
  let ov=$("#setOv");
  if(!ov){document.body.insertAdjacentHTML("beforeend",`<div class="set-ov" id="setOv" role="dialog" aria-modal="true" aria-label="設定" hidden>${settingsHTML()}</div>`);ov=$("#setOv");
    $("#setClose").onclick=()=>closeSettings();elastic(ov.querySelector(".set-scroll"),ov.querySelector(".set-inner"))}
  if(setOpen)return;
  if(!loggedIn()&&remRead())await remLogin();   /* 這台裝置記住了身分：直接進去，不顯示鎖頭 */
  setOpen=true;ov.hidden=false;document.body.classList.add("set-open");renderSettings();renderTabbar();
  if(!reduceMotion())ov.animate([{transform:"translateX(28px)",opacity:0},{transform:"none",opacity:1}],{duration:380,easing:"cubic-bezier(.2,.9,.25,1)"});
}
function closeSettings(instant){
  const ov=$("#setOv");if(!ov||!setOpen)return;
  if(paneKey){paneSeq++;paneDismiss();paneReset()}
  setOpen=false;renderTabbar();
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
  date:["看板日期",()=>[{name:"v",label:"看板日期（留空＝自動使用儲存當天的日期）",type:"date",value:state.boardDate||""}],v=>{state.boardDate=v||""}],
  year:["學年",()=>[{name:"v",label:"學年（顯示在頁首，例如：115學年）",value:state.yearLabel||""}],v=>{state.yearLabel=v||""}],
  term:["開學日",()=>[{name:"v",label:"開學日（用來算開學第幾週）",type:"date",value:state.termStart||""}],v=>{state.termStart=v||""}],
};
async function editBoardInfo(k){
  const [t,fields,apply]=BOARD_INFO[k];
  const v=await ask(t,fields());if(!v)return;
  const key={title:"title",date:"boardDate",year:"yearLabel",term:"termStart"}[k];
  if((v.v||"")===(state[key]||""))return;
  await settingSave(()=>apply(v.v),`已更新${t}`);
}
function forgetDevice(){remClear();if(!editing){meId="";sessionPw="";sharedPwSession=""}renderSettings();toast("已忘記這台裝置，下次要重新輸入密碼")}
/* 有下一層的項目（桌面版放右側面板）；其他是直接執行的動作 */
const SET_FLOWS={
  log:()=>openLog(setPaneHost()),
  team:()=>teamSettings(),
  title:()=>editBoardInfo("title"),date:()=>editBoardInfo("date"),year:()=>editBoardInfo("year"),term:()=>editBoardInfo("term"),
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
  if(k==="exportLocked"){exportHTML(true);return}
  if(k==="exportEdit"){exportHTML(false);return}
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
