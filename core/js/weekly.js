/* 核心｜左右分頁、即時回報↔議題連結、每週概述產生器 */
/* ---------- pager ---------- */
const pager=$("#pager");
const goWeek=()=>pager.scrollTo({left:pager.scrollWidth,behavior:"smooth"});
let onWeek=false;
function weekEnter(){const pw=$("#pageWeek");pw.classList.remove("enter");void pw.offsetWidth;pw.classList.add("enter");clearTimeout(pw._t);pw._t=setTimeout(()=>pw.classList.remove("enter"),1400)}
/* 進到每週概述＝推一筆瀏覽紀錄（返回鍵／手勢會回主頁）；回到主頁（按返回鈕、滑回來、系統返回）就收掉那筆 */
pager.addEventListener("scroll",()=>{
  const atWeek=pager.scrollLeft>pager.scrollWidth-pager.clientWidth-40,atMain=pager.scrollLeft<40;
  if(atWeek&&!onWeek){onWeek=true;weekEnter();Back.layers.week()}
  else if(atMain&&onWeek){onWeek=false;Back.closed("week")}
},{passive:true});
$("#pageWeek").addEventListener("scroll",e=>{$(".week-top").classList.toggle("scrolled",e.target.scrollTop>4)},{passive:true});
const goMain=()=>pager.scrollTo({left:0,behavior:"smooth"});
$("#weekBtn").onclick=goWeek;$("#backMain").onclick=goMain;

/* ---------- 即時回報：母議題連結、分段、狀態、時間標記 ---------- */
const parentOf=ev=>ev&&ev.issueId?state.issues.find(i=>i.id===ev.issueId):null;
/* 顯示用名稱：分段完成的紀錄標「第 N 段」，分過段的卡片結案時標「第 N 段・結案」 */
const evName=ev=>ev.fromEv?`${ev.name}（第 ${ev.round} 段）`:ev.doneAt&&ev.round>1?`${ev.name}（第 ${ev.round} 段・結案）`:ev.name;
/* 母議題同步：完成時寫一筆處理紀錄；勾了「寫進母議題」的時間標記也各寫一筆 */
function syncLink(ev){
  const keepTm=new Set((ev.times||[]).filter(t=>t.toIssue&&t.start).map(t=>t.id));
  state.issues.forEach(i=>{i.markers=i.markers.filter(m=>m.evId!==ev.id||(i.id===ev.issueId&&(m.tmId?keepTm.has(m.tmId):!!ev.doneAt)))});
  const it=parentOf(ev);if(!it)return;
  const put=(find,make,text,date)=>{let m=it.markers.find(find);if(!m){m={id:uid("m"),evId:ev.id,at:schedPct(it,date)??50,stage:it.tags[it.cur]||"",pos:"up",...make};it.markers.push(m)}m.text=text;m.date=date};
  if(ev.doneAt)put(x=>x.evId===ev.id&&!x.tmId,{},evName(ev),ev.doneAt);
  (ev.times||[]).filter(t=>keepTm.has(t.id)).forEach(t=>put(x=>x.evId===ev.id&&x.tmId===t.id,{tmId:t.id,pos:"down"},`${ev.name.replace(/[：:\s]+$/,"")}：${t.label}`,t.start.slice(0,10)));
}
/* 刪除即時回報時：母議題裡由它寫入的處理紀錄保留下來，只拿掉連結 */
function unlinkEv(ev){state.issues.forEach(i=>i.markers.forEach(m=>{if(m.evId===ev.id){delete m.evId;delete m.tmId}}))}
/* 記一次更新（狀態顏色用）：touched 只留最近幾天的日期，touchedAt 是最後更新的時刻 */
function evTouch(ev){
  const t=nowStr().replace(" ","T"),d=t.slice(0,10);
  ev.touchedAt=t;ev.touched=[...(ev.touched||[]).filter(x=>x!==d),d].slice(-8);
}
/* 狀態：以每週回報期限（CFG.week.cutoff，預設週二）為界
   ok 綠＝期限前有更新、這週沒完成一段；go 黃＝這週完成過一段，或期限過後才補更新；stall 紅＝期限前後都沒更新 */
const EV_ST={ok:"按時更新",go:"持續進行",stall:"沒有進度"};
function evStatus(ev){
  const ref=today(),back=(pd(ref).getDay()-(+CFG.week.cutoff||0)+7)%7;
  const due=addDays(ref,-back),prev=addDays(due,-7);
  const ds=(ev.touched&&ev.touched.length?ev.touched:[ev.createdAt||""]).map(d=>d.slice(0,10));
  if(ev.roundAt&&ev.roundAt.slice(0,10)>prev)return "go";
  if((ev.createdAt||"")>due)return "ok";          /* 期限過後才新增：還沒錯過任何期限 */
  if(ds.some(d=>d>prev&&d<=due))return "ok";
  if(ds.some(d=>d>due))return "go";
  return "stall";
}
/* 時間標記的顯示文字：日期、時刻、期間長度 */
function evTimeText(t){
  const yr=today().slice(0,4);
  const part=s=>{const d=s.slice(0,10),h=s.slice(11,16);return (d.slice(0,4)===yr?fmt(d).slice(5):fmt(d))+(h?" "+h:"")};
  if(!t.end)return {when:part(t.start),span:""};
  const sameDay=t.start.slice(0,10)===t.end.slice(0,10);
  const when=sameDay&&t.end.length>10?`${part(t.start)}–${t.end.slice(11,16)}`:`${part(t.start)} – ${part(t.end)}`;
  let span="";
  if(t.start.length>10&&t.end.length>10){
    const m=Math.round((new Date(t.end)-new Date(t.start))/6e4),d=Math.floor(m/1440),h=Math.floor(m%1440/60),mm=m%60;
    span=[d?d+" 天":"",h?h+" 小時":"",mm?mm+" 分":""].filter(Boolean).join(" ")||"0 分";
  }else span=Math.round((pd(t.end.slice(0,10))-pd(t.start.slice(0,10)))/864e5)+1+" 天";
  return {when,span};
}
const evTimesSorted=ev=>[...(ev.times||[])].sort((a,b)=>a.start.localeCompare(b.start));
/* ---------- weekly report generator ---------- */
const addDays=(s,n)=>{const d=pd(s);d.setDate(d.getDate()+n);return ymd(d)};
function snapshotBase(date){
  const issues={};state.issues.forEach(i=>issues[i.id]={stage:i.tags[i.cur]||"",note:i.note||""});
  state.reportBase={date,issues};
}
/* 每週概述按鈕的紅點：每週五起亮，直到這一週（週一到週日）有一份週報產出為止；
   沒產出就一直亮到產出（下週一到週四仍以上週為準），下個週五再開始新的一輪 */
const WEEK_DUE_DAY=5;
function weekDue(t=today()){
  const d=pd(t),back=(d.getDay()-WEEK_DUE_DAY+7)%7,fri=addDays(t,-back),mon=addDays(fri,-4);
  return !state.weeks.some(w=>w.date&&w.date>=mon);
}
function weekDotSync(){const due=weekDue(),wb=$("#weekBtn");if(!wb)return;wb.classList.toggle("due",due);wb.title=due?"本週週報還沒產出":""}
/* 網頁一直開著跨過週五也要冒出來：每 10 分鐘、回到這個分頁時再檢查一次 */
setInterval(weekDotSync,6e5);document.addEventListener("visibilitychange",()=>{if(!document.hidden)weekDotSync()});
/* 「本週」＝上一份週報之後到今天（生成週報、動畫模式共用） */
function weekRange(){
  const end=today();
  const lastWeek=[...state.weeks].map(w=>w.date).filter(d=>d<end).sort().pop();
  const start=state.reportBase?.date&&state.reportBase.date<end?state.reportBase.date:(lastWeek||addDays(end,-7));
  return {start,end};
}
/* 生成週報（2026-11-05 改）：只列兩區、只寫標題，不寫說明與議題進度
   一、會議報告事項：還沒完成、標了「會議要報告」（ev.report）的即時回報標題（照畫面順序）
   二、本週完成：完成紀錄裡這一整週（今天往前 7 天）完成的項目標題（議題結案、即時回報結案、完成一段都算），由新到舊 */
function buildWeekly(){
  const end=today(),start=addDays(end,-7);   /* 一整週：start 之後到今天（含），共 7 天 */
  const inP=d=>!!d&&d>start&&d<=end;
  const dept=CFG.dept.name||(state.title||"").replace(/(工作)?(看板|進度|進度看板)$/,"").trim()||state.title;
  const L=[`${dept} 本週例行回報`,`日期：【${end.replaceAll("-",".")}】`,""];
  const rep=liveOrder().filter(e=>e.report);
  L.push("一、會議報告事項",...(rep.length?rep.map(e=>`❏ ${e.name}`):["❏ 本週沒有會議報告事項"]),"");
  const done=[...state.issues.filter(i=>inP(i.doneAt)).map(i=>({d:i.doneAt,t:i.title})),...state.events.filter(e=>inP(e.doneAt)).map(e=>({d:e.doneAt,t:evName(e)}))].sort((a,b)=>b.d.localeCompare(a.d));
  L.push("二、本週完成",...(done.length?done.map(x=>`❏ ${x.t}`):["❏ 本週沒有完成項目"]));
  return {start,end,text:L.join("\n")};
}

