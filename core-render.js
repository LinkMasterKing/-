/* 核心｜整體重繪＋簡化模式 */
let openWeeks=null,newWeekId=null,prevDone=null,openDone=new Set(),openEv=new Set(),editing=false,dirty=false,snapshot="",keepIds=new Set(),openIds=new Set();

/* ---------- timeline math ---------- */
function rangeMs(){const s=pd(state.range.start+"-01");const e=pd(state.range.end+"-01");e.setMonth(e.getMonth()+1);return[s.getTime(),e.getTime()]}
function pos(date){const[s,e]=rangeMs();return clamp((pd(date).getTime()-s)/(e-s)*100)}
function months(){const out=[];const d=pd(state.range.start+"-01");const end=pd(state.range.end+"-01");while(d<=end){out.push(new Date(d));d.setMonth(d.getMonth()+1)}return out}

const activeIssues=()=>state.issues.filter(i=>i.progress<100||(editing&&keepIds.has(i.id)));
const doneIssues=()=>state.issues.filter(i=>i.progress>=100&&!(editing&&keepIds.has(i.id))).sort((a,b)=>(b.doneAt||"").localeCompare(a.doneAt||""));

/* ---------- render ---------- */
let rendering=false;
function render(){
  if(rendering)return;rendering=true;
  try{
    document.body.classList.toggle("edit",editing);
    document.body.classList.toggle("locked",!!state.locked);
    renderHeader();renderTabbar();renderSimple();storySync();renderWeeks();renderGantt();renderEvents();renderCards();renderDone();layoutAll();
  }finally{rendering=false}
}

const SIMPLE_KEY="workboard:simple";
let simple=false;try{simple=CFG.sections.simple&&localStorage.getItem(SIMPLE_KEY)==="1"}catch(_){}
const simpleOpen=new Set();

/* ---------- 簡化模式：三顆按鈕不重畫；區塊交叉淡入（不動高度） ---------- */
function syncPills(){document.querySelectorAll("#simpleBar .spill").forEach(b=>{const on=simpleOpen.has(b.dataset.simple);b.classList.toggle("on",on);b.setAttribute("aria-expanded",on)})}
function renderSimple(){
  document.body.classList.toggle("simple",simple);
  document.querySelectorAll(".sgroup").forEach(g=>g.classList.toggle("sopen",simpleOpen.has(g.dataset.sec)));
  if(!simple)return;
  const act=state.issues.filter(i=>i.progress<100).length,live=state.events.filter(e=>!e.doneAt).length;
  const done=state.issues.filter(i=>i.progress>=100).length+state.events.filter(e=>e.doneAt).length;
  const pills=[["live","即時回報",live,"red"],["progress","進度",act,""],["done","完成紀錄",done,"green"]].filter(([k])=>secOn(k));
  const bar=$("#simpleBar"),sig=pills.map(p=>p.join(":")).join("|");
  if(bar._sig!==sig){bar._sig=sig;bar.innerHTML=pills.map(([k,t,n,c])=>`<button type="button" class="spill ${c}" data-simple="${k}" aria-expanded="false"><span class="sdot" aria-hidden="true"></span><span class="st">${t}</span><span class="sn">${n}</span><span class="schev" aria-hidden="true"><svg viewBox="0 0 12 8" width="11" height="7"><path d="M1.5 1.5 6 6l4.5-4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>`).join("")}
  syncPills();
}
let sgTok=0;
function toggleSimpleGroup(k){
  const cur=[...simpleOpen][0]||null,next=cur===k?null:k,tok=++sgTok;
  const out=cur&&document.querySelector(`.sgroup[data-sec="${cur}"]`),inn=next&&document.querySelector(`.sgroup[data-sec="${next}"]`);
  simpleOpen.clear();if(next)simpleOpen.add(next);syncPills();
  const show=()=>{
    if(tok!==sgTok)return;
    document.querySelectorAll(".sgroup").forEach(g=>g.classList.toggle("sopen",simpleOpen.has(g.dataset.sec)));
    if(inn){layoutAll();if(!reduceMotion())inn.animate([{opacity:0,transform:"translateY(14px)"},{opacity:1,transform:"none"}],{duration:340,easing:"cubic-bezier(.2,.9,.25,1)"})}
  };
  if(out&&out.classList.contains("sopen")&&!reduceMotion()){
    const a=out.animate([{opacity:1,transform:"none"},{opacity:0,transform:"translateY(-8px)"}],{duration:140,easing:"cubic-bezier(.4,0,1,1)",fill:"forwards"});
    a.onfinish=()=>{show();a.cancel()};
  }else show();
}

/* ---------- 完整／簡化切換：淡出 → 換版面 → 淡入 ---------- */
function setViewMode(want){
  if(want===simple)return;
  const L=document.querySelector(".layout");
  const go=()=>{
    simple=want;try{localStorage.setItem(SIMPLE_KEY,simple?"1":"0")}catch(_){}
    simpleOpen.clear();document.body.classList.add("simple-enter");render();if(!simple)layoutAll();renderSettings();
    if(!reduceMotion()&&!setOpen)[L,$("#simpleBar")].forEach(el=>el&&el.animate([{opacity:0,transform:"translateY(10px)"},{opacity:1,transform:"none"}],{duration:360,easing:"cubic-bezier(.2,.9,.25,1)"}));
    setTimeout(()=>document.body.classList.remove("simple-enter"),900);
  };
  renderSettings();
  if(setOpen)return setTimeout(go,280);   /* 在設定頁裡切換：先讓卡片的過渡跑完，背後的版面再換 */
  if(reduceMotion()||!L)return go();
  const a=L.animate([{opacity:1,transform:"none"},{opacity:0,transform:"translateY(-6px)"}],{duration:150,easing:"cubic-bezier(.4,0,1,1)",fill:"forwards"});
  a.onfinish=()=>{go();a.cancel()};
}
