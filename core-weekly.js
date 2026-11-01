/* 核心｜左右分頁、即時回報↔議題連結、每週概述產生器 */
/* ---------- pager ---------- */
const pager=$("#pager");
const goWeek=()=>pager.scrollTo({left:pager.scrollWidth,behavior:"smooth"});
let onWeek=false;
function weekEnter(){const pw=$("#pageWeek");pw.classList.remove("enter");void pw.offsetWidth;pw.classList.add("enter");clearTimeout(pw._t);pw._t=setTimeout(()=>pw.classList.remove("enter"),1400)}
pager.addEventListener("scroll",()=>{const now=pager.scrollLeft>pager.scrollWidth-pager.clientWidth-40;if(now&&!onWeek)weekEnter();onWeek=now},{passive:true});
$("#pageWeek").addEventListener("scroll",e=>{$(".week-top").classList.toggle("scrolled",e.target.scrollTop>4)},{passive:true});
const goMain=()=>pager.scrollTo({left:0,behavior:"smooth"});
$("#weekBtn").onclick=goWeek;$("#backMain").onclick=goMain;

/* ---------- live report ↔ parent issue ---------- */
const parentOf=ev=>ev&&ev.issueId?state.issues.find(i=>i.id===ev.issueId):null;
function syncLink(ev){
  state.issues.forEach(i=>{ if(i.id!==ev.issueId||!ev.doneAt) i.markers=i.markers.filter(m=>m.evId!==ev.id) });
  const it=parentOf(ev);if(!it||!ev.doneAt)return;
  let m=it.markers.find(x=>x.evId===ev.id);
  if(!m){m={id:uid("m"),evId:ev.id,at:it.progress,stage:it.tags[it.cur]||"",pos:"up"};it.markers.push(m)}
  m.text=ev.name;m.date=ev.doneAt;
}
/* ---------- weekly report generator ---------- */
const addDays=(s,n)=>{const d=pd(s);d.setDate(d.getDate()+n);return ymd(d)};
function snapshotBase(date){
  const issues={};state.issues.forEach(i=>issues[i.id]={progress:i.progress,stage:i.tags[i.cur]||"",note:i.note||""});
  state.reportBase={date,issues};
}
/* 「本週」＝上一份週報之後到今天（生成週報、動畫模式共用） */
function weekRange(){
  const end=state.boardDate||today();
  const lastWeek=[...state.weeks].map(w=>w.date).filter(d=>d<end).sort().pop();
  const start=state.reportBase?.date&&state.reportBase.date<end?state.reportBase.date:(lastWeek||addDays(end,-7));
  return {start,end};
}
function buildWeekly(){
  const {start,end}=weekRange();
  const inP=d=>!!d&&d>start&&d<=end;
  const base=state.reportBase?.issues||{};
  const clean=t=>String(t||"").split(/\n+/).map(x=>x.replace(/^\s*[・•\-❏*．·]\s*/,"").trim().replace(/[。；，,.]+$/,"")).filter(Boolean).join("；").replace(/[。；]+$/,"");
  const L=[];const dept=CFG.dept.name||(state.title||"").replace(/(工作)?(看板|進度|進度看板)$/,"").trim()||state.title;
  L.push(`${dept} 本週例行回報`,`日期：【${end.replaceAll("-",".")}】`,"");
  // 一、即時回報：未完成的 + 本期間新增的（尚未完成）
  const evOpen=state.events.filter(e=>!e.doneAt);
  L.push("一、即時回報");
  if(evOpen.length)evOpen.forEach(e=>{const d=clean(e.desc);L.push(`❏ ${e.name}${parentOf(e)?`（${parentOf(e).title}）`:""}${inP(e.createdAt)?"（本週新增）":""}${d?"："+d:""}`)});else L.push("❏ 本週無即時回報");
  L.push("");
  // 二 / 四：議題
  const active=state.issues.filter(i=>i.progress<100);
  const upd=[],idle=[];
  active.forEach(i=>{
    const b=base[i.id],stage=i.tags[i.cur]||"";
    const mk=sortedMarkers(i).filter(m=>inP(m.date));
    const pc=b&&b.progress!==i.progress, sc=b&&b.stage!==stage, nc=b&&(b.note||"")!==(i.note||"");
    const isNew=!b&&!!state.reportBase;
    const changed=mk.length||pc||sc||nc||isNew;
    const head=`❏ ${i.title}（${sc?`${b.stage} → ${stage}`:stage}${stage?"，":""}${pc?`${b.progress}% → ${i.progress}%`:i.progress+"%"}）`;
    const parts=[];
    if(isNew)parts.push("本週新增議題");
    mk.forEach(m=>parts.push(`${fmt(m.date).slice(5)} ${m.text}`));
    if(i.note)parts.push(clean(i.note));
    if(changed||!state.reportBase)upd.push(head+(parts.length?"："+parts.join("；"):""));
    else idle.push(head+"："+(i.note?clean(i.note)+"（本週無新進度）":"本週無新進度"));
  });
  L.push("二、議題追蹤");
  if(upd.length)L.push(...upd);else L.push("❏ 本週議題無新進度");
  L.push("");
  // 三、本週完成
  const doneI=state.issues.filter(i=>i.progress>=100&&inP(i.doneAt));
  const doneE=state.events.filter(e=>inP(e.doneAt)&&!parentOf(e));
  L.push("三、本週完成");
  if(doneI.length+doneE.length){
    doneI.forEach(i=>L.push(`❏ ${i.title}${i.note?"："+clean(i.note):"：已完成"}`));
    doneE.forEach(e=>{const d=clean(e.desc);L.push(`❏ ${e.name}${d?"："+d:"：已處理"}`)});
  }else L.push("❏ 本週無完成項目");
  // 四、待處理事項
  if(idle.length){L.push("","四、待處理事項",...idle)}
  return {start,end,text:L.join("\n")};
}

