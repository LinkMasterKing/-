/* 核心｜通知層（頁首鈴鐺）：今日／明日要處理的事＋行事曆（2026-11-05）
   - 跟設定頁同一類的全畫面層（.set-ov），開關有動畫，返回鍵／手勢、Esc、點下方分頁都會關。
   - 資料：即時回報的時間標記（ev.times，時段算頭尾兩天）、議題的開始日與結束日、有日期的議題註記（markers[].date）。
     已完成的即時回報、已結案的議題不算。不推播，只在看板裡顯示。
   - 本部門／全會切換：全會＝讀各部門的資料檔（跟會長室追蹤同一種讀法 fwLoad，只讀不寫）。
     注意：各部門資料檔放在公開 repo 時，任何人本來就讀得到；這裡沒有多公開任何東西。
   - 行事曆：事件清單在月曆上方；每天的格子只畫顏色條（不寫字，全會時顏色依部門、本部門時依類別）；
     點清單裡的一件事＝月曆換到那個月、捲到那天，那天（或整個時段）閃兩下；點某一天＝清單只留那天的事，再點一次取消。 */
let notiOpen=false,notiSeg=null;
const NOTI={scope:"mine",month:null,day:null,all:null,loading:false};
const NOTI_KIND={time:{t:"即時回報",c:"var(--ink)"},start:{t:"議題開始",c:"var(--prog-hi)"},end:{t:"議題結束",c:"var(--red)"},marker:{t:"註記",c:"var(--su-blue)"}};
const DEPT_COLORS=["#e0342a","#0a5baa","#f0bc23","#2f8f84","#a24fc0","#d84f92","#c26a12","#3d7fe0","#6b6b75"];
const deptColor=id=>DEPT_COLORS[Math.max(0,(window.BOARD_DEPTS||[]).findIndex(d=>d.id===id))%DEPT_COLORS.length];
/* 一份看板資料 → 事件清單 {key,date,end,time,title,sub,kind,dept} */
function notiItems(s,dept){
  const out=[];
  s.events.filter(e=>!e.doneAt).forEach(e=>(e.times||[]).forEach(t=>{
    const d=t.start.slice(0,10),en=(t.end||"").slice(0,10);
    out.push({key:`${dept}:t:${t.id}`,date:d,end:en&&en!==d?en:"",time:t.start.slice(11,16),title:t.label,sub:[e.name,t.place].filter(Boolean).join(" · "),kind:"time",dept})}));
  s.issues.filter(i=>!i.doneAt).forEach(i=>{
    if(i.start)out.push({key:`${dept}:s:${i.id}`,date:i.start,end:"",time:"",title:`${i.title}　開始`,sub:"議題",kind:"start",dept});
    if(i.end)out.push({key:`${dept}:e:${i.id}`,date:i.end,end:"",time:"",title:`${i.title}　結束`,sub:"議題",kind:"end",dept});
    (i.markers||[]).filter(m=>m.date).forEach(m=>out.push({key:`${dept}:m:${m.id}`,date:m.date,end:"",time:"",title:m.text,sub:i.title,kind:"marker",dept}));
  });
  return out.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}
const notiMine=()=>notiItems(state,CFG.deptId||"rights");
const notiList=()=>NOTI.scope==="all"&&NOTI.all?NOTI.all:notiMine();
/* 某一天要處理的：那天開始，或時段在那天結束 */
const onDay=(x,d)=>x.date===d||x.end===d;
/* 月曆格子用：時段整段都畫 */
const covers=(x,d)=>x.end?d>=x.date&&d<=x.end:x.date===d;
const itemColor=x=>NOTI.scope==="all"?deptColor(x.dept):NOTI_KIND[x.kind].c;
/* 頁首鈴鐺上的數字：今天＋明天本部門的事 */
function notiBadge(){
  const b=$("#notiBtn");if(!b)return;
  const t=today(),m=addDays(t,1),n=notiMine().filter(x=>onDay(x,t)||onDay(x,m)).length;
  const el=b.querySelector(".noti-n");const txt=n?String(n>99?"99+":n):"";
  if(el.textContent!==txt){el.textContent=txt;el.hidden=!n;if(n)Anim.enter(el,"pop")}
  b.setAttribute("aria-label",n?`通知：今明兩天有 ${n} 件事`:"通知");
}
/* ---------- 畫面 ---------- */
function notiRowHTML(x,showDate){
  const dp=fwDept(x.dept);
  return `<button type="button" class="ni" data-fk="${esc(x.key)}" data-nd="${x.date}" data-ne="${x.end||""}" style="--c:${itemColor(x)}">
    <span class="ni-bar" aria-hidden="true"></span>
    <span class="ni-when num">${showDate?`${fmt(x.date).slice(5)}${x.end?`–${fmt(x.end).slice(5)}`:""} `:""}${x.time||(showDate?"":"整天")}</span>
    <span class="ni-main"><b>${esc(x.title)}</b>${x.sub?`<small>${esc(x.sub)}</small>`:""}</span>
    ${NOTI.scope==="all"?`<span class="tag sm ni-dept">${esc(dp?dp.name:x.dept)}</span>`:`<span class="ni-k">${NOTI_KIND[x.kind].t}</span>`}</button>`;
}
function notiDayHTML(label,d,list){
  const xs=list.filter(x=>onDay(x,d));
  return `<section class="noti-day"><h3>${label}<span class="num">${fmt(d).slice(5)} ${"日一二三四五六"[pd(d).getDay()]}</span><span class="count">${xs.length}</span></h3>
    <div class="noti-items" data-flip="${label}">${xs.map(x=>notiRowHTML(x,false)).join("")||`<p class="sub noti-none">沒有要處理的事</p>`}</div></section>`;
}
function calHTML(list){
  const m=NOTI.month,first=pd(m+"-01"),start=new Date(first);start.setDate(1-((first.getDay()+6)%7));   /* 週一開頭 */
  const t=today();let h="";
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const s=ymd(d);
    if(i===35&&s.slice(0,7)!==m)break;   /* 只需要五週就不畫第六週 */
    const xs=list.filter(x=>covers(x,s));
    h+=`<button type="button" class="cal-d${s.slice(0,7)!==m?" out":""}${s===t?" is-today":""}${s===NOTI.day?" sel":""}" data-cal="${s}" aria-label="${fmt(s)}，${xs.length} 件事"${s===NOTI.day?' aria-pressed="true"':""}>
      <span class="cal-n num">${d.getDate()}</span><span class="cal-bars">${xs.slice(0,5).map(x=>`<i style="--c:${itemColor(x)}"></i>`).join("")}${xs.length>5?`<em class="num">+${xs.length-5}</em>`:""}</span></button>`}
  return `<div class="cal-head" aria-hidden="true">${"一二三四五六日".split("").map(c=>`<span>${c}</span>`).join("")}</div><div class="cal-grid">${h}</div>`;
}
function notiInner(){
  const list=notiList(),t=today(),m=NOTI.month;
  const evs=NOTI.day?list.filter(x=>covers(x,NOTI.day)):list.filter(x=>x.date.slice(0,7)===m||(x.end&&x.end.slice(0,7)===m)||(x.end&&x.date<m&&x.end>m));
  const legend=NOTI.scope==="all"
    ?(window.BOARD_DEPTS||[]).map(d=>`<span><i style="--c:${deptColor(d.id)}"></i>${esc(d.name)}</span>`).join("")
    :Object.values(NOTI_KIND).map(k=>`<span><i style="--c:${k.c}"></i>${k.t}</span>`).join("");
  return `    ${NOTI.scope==="all"?`<p class="sub noti-note">${NOTI.loading?"讀取各部門資料中…":"全會：讀各部門的資料檔，只能看、不能改。"}</p>`:""}
    <div class="noti-days">${notiDayHTML("今日",t,list)}${notiDayHTML("明日",addDays(t,1),list)}</div>
    <section class="noti-cal">
      <div class="cal-top"><button type="button" class="icon" data-nmon="-1" aria-label="上個月">${ico("prev","solo")}</button><b class="num">${m.slice(0,4)} 年 ${+m.slice(5)} 月</b><button type="button" class="icon" data-nmon="1" aria-label="下個月">${ico("next","solo")}</button>
        ${NOTI.day?`<button type="button" class="icon" data-nday="">只看 ${fmt(NOTI.day).slice(5)} · 取消</button>`:`<button type="button" class="icon" data-nmon="0">回到本月</button>`}</div>
      <div class="noti-list" data-flip="list" data-flow>${evs.map(x=>notiRowHTML(x,true)).join("")||`<p class="sub noti-none">${NOTI.day?"這天沒有事件":"這個月沒有事件"}</p>`}</div>
      <div class="cal" id="notiCal">${calHTML(list)}</div>
      <div class="cal-legend">${legend}</div>
    </section>`;
}
function renderNoti(){
  const el=$("#notiOv .noti-inner");if(!el||!notiOpen)return;
  const snap=Anim.capture();el.innerHTML=notiInner();Anim.play(snap);flowWatch();
}
/* ---------- 開關 ---------- */
function openNoti(){
  let ov=$("#notiOv");
  if(!ov){document.body.insertAdjacentHTML("beforeend",`<div class="set-ov noti-ov" id="notiOv" role="dialog" aria-modal="true" aria-label="通知" hidden>
      <div class="anim-top"><div class="anim-title"><span class="anim-k">NOTICE</span><b>通知與行事曆</b></div><div class="anim-ctl"><button type="button" id="notiClose" aria-label="關閉通知">${ico("close")}關閉</button></div></div>
      <div class="set-body"><div class="set-scroll"><div class="noti-bar"><div class="noti-seg lseg" role="tablist" aria-label="範圍"><span class="lseg-lens" aria-hidden="true"></span>${[["mine",CFG.dept.name||"本部門"],["all","全會"]].map(([k,t])=>`<button type="button" role="tab" data-k="${k}" aria-selected="${NOTI.scope===k}">${esc(t)}</button>`).join("")}</div></div><div class="noti-inner" data-flow></div></div></div></div>`);ov=$("#notiOv");
    /* 本部門／全會：液態分段切換（anim.js 的 LiquidSeg，跟底部工具列同一套）。放在 .noti-inner 外面，重畫內容時不會被換掉、動畫不會被打斷 */
    notiSeg=new LiquidSeg(ov.querySelector(".noti-seg"),{onPick:k=>{NOTI.scope=k;NOTI.day=null;if(k==="all"&&!NOTI.all)notiLoadAll();else renderNoti()}});
    elastic(ov.querySelector(".set-scroll"),ov.querySelector(".noti-inner"))}
  if(notiOpen)return;
  if(setOpen)closeSettings(true);
  const from=pageUnder(ov);PageFx.settle(ov);
  notiOpen=true;NOTI.month=today().slice(0,7);NOTI.day=null;ov.getAnimations().forEach(a=>a.cancel());ov.hidden=false;Back.layers.noti();document.body.classList.add("set-open");
  renderNoti();requestAnimationFrame(()=>notiSeg.set(NOTI.scope,true));PageFx.swap(from,ov);   /* 換頁動畫 */
  if(NOTI.scope==="all")notiLoadAll();
}
function closeNoti(instant){
  const ov=$("#notiOv");if(!ov||!notiOpen)return;
  notiOpen=false;Back.closed("noti");
  const done=()=>{if(!notiOpen){ov.hidden=true;ov.getAnimations().forEach(a=>a.cancel());if(!setOpen)document.body.classList.remove("set-open")}};
  if(instant){PageFx.settle(ov);return done()}
  PageFx.swap(ov,pageUnder(ov),{done});   /* 換頁動畫：通知往下沉、底下那頁從下方升上來 */
}
async function notiLoadAll(){
  NOTI.loading=true;renderNoti();
  const ds=window.BOARD_DEPTS||[];
  const res=await Promise.all(ds.map(d=>d.id===(CFG.deptId||"rights")?{data:state}:fwLoad(d.id)));
  NOTI.all=res.flatMap((r,i)=>r&&r.data?notiItems(r.data,ds[i].id):[]).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  NOTI.loading=false;renderNoti();
}
/* 換月份：舊月曆淡出、新月曆從翻頁方向滑入（dir：1＝往後、-1＝往前） */
async function notiMonth(m,dir=1){
  const old=$("#notiCal");if(old)await Anim.leave(old,"fade",{duration:120});
  NOTI.month=m;renderNoti();const cal=$("#notiCal");
  if(cal&&!reduceMotion())await cal.animate([{opacity:0,transform:`translateX(${dir*18}px)`},{opacity:1,transform:"none"}],{duration:MO.base,easing:MO.out}).finished.catch(()=>{});
}
/* 點一件事：月曆換到那個月、捲到那天，那天（或整個時段）閃兩下 */
function notiFocus(d,e){
  const go=()=>{const cells=[...document.querySelectorAll("#notiCal [data-cal]")].filter(c=>e?c.dataset.cal>=d&&c.dataset.cal<=e:c.dataset.cal===d);
    if(!cells.length)return;cells[0].scrollIntoView({block:"center",behavior:reduceMotion()?"auto":"smooth"});
    cells.forEach(c=>{c.classList.remove("flash");void c.offsetWidth;c.classList.add("flash")});setTimeout(()=>cells.forEach(c=>c.classList.remove("flash")),1500)};
  if(d.slice(0,7)!==NOTI.month)notiMonth(d.slice(0,7)).then(go);else go();
}
document.addEventListener("click",e=>{
  const t=e.target;if(!t.closest)return;
  if(t.closest("#notiBtn")){notiOpen?closeNoti():openNoti();return}
  if(!notiOpen||!t.closest("#notiOv"))return;
  if(t.closest("#notiClose")){closeNoti();return}
  const mo=t.closest("[data-nmon]");if(mo){const k=+mo.dataset.nmon,d=pd(NOTI.month+"-01");if(k)d.setMonth(d.getMonth()+k);const nm=k?ym(d):today().slice(0,7);if(nm===NOTI.month)return;
    NOTI.day=null;notiMonth(nm,k<0?-1:1);return}
  if(t.closest("[data-nday]")){NOTI.day=null;renderNoti();return}
  const cd=t.closest("[data-cal]");if(cd){const d=cd.dataset.cal;NOTI.day=NOTI.day===d?null:d;if(d.slice(0,7)!==NOTI.month)NOTI.month=d.slice(0,7);renderNoti();return}
  const ni=t.closest(".ni");if(ni){notiFocus(ni.dataset.nd,ni.dataset.ne);return}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&notiOpen&&!$("#dlg").open&&!setOpen){e.preventDefault();closeNoti()}});
