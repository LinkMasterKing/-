/* 核心｜整體重繪＋傻瓜模式 */
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
    renderHeader();renderSimple();storySync();renderWeeks();renderGantt();renderEvents();renderCards();renderDone();layoutAll();
  }finally{rendering=false}
}

const SIMPLE_KEY="workboard:simple";
let simple=false;try{simple=CFG.sections.simple&&localStorage.getItem(SIMPLE_KEY)==="1"}catch(_){}
const simpleOpen=new Set();
const MODES=[["full","完整模式","所有區塊一次看完"],["simple","傻瓜模式","四個按鈕，一次只看一區"]];
const simpleBtnHTML=()=>`${CFG.sections.animation?`<button id="animBtn">▶ 動畫模式</button>`:""}${CFG.sections.simple?`<span class="mode-dd"><button type="button" id="modeBtn" aria-haspopup="menu" aria-expanded="false" aria-controls="modeMenu"><span>${simple?"傻瓜模式":"完整模式"}</span><span class="chev" aria-hidden="true">▾</span></button><div class="mode-menu" id="modeMenu" role="menu" aria-label="檢視方式" hidden>${MODES.map(([k,t,d])=>`<button type="button" role="menuitemradio" data-pick-mode="${k}" aria-checked="${(k==="simple")===simple}"><span class="mm-dot" aria-hidden="true"></span><span class="mm-t">${t}</span><small>${d}</small></button>`).join("")}</div></span>`:""}`;
/* 檢視模式下拉選單：由按鈕往下展開 */
function modeMenu(open){
  const btn=document.getElementById("modeBtn"),m=document.getElementById("modeMenu");if(!btn||!m)return;
  if(open===undefined)open=m.hidden;
  if(m._a)m._a.cancel();
  if(open){
    m.hidden=false;btn.setAttribute("aria-expanded","true");
    m.style.left="";m.style.right="";
    const r=m.getBoundingClientRect();
    if(r.left<12||r.right>innerWidth-12){const d=m.parentElement.getBoundingClientRect();
      const L=Math.min(Math.max(d.left+d.width/2-r.width/2,12),innerWidth-12-r.width);m.style.left=(L-d.left)+"px";m.style.right="auto"}
    if(!reduceMotion())m._a=m.animate([{opacity:0,transform:"translateY(-10px) scaleY(.9)"},{opacity:1,transform:"none"}],{duration:300,easing:"cubic-bezier(.2,.9,.25,1)"});
    (m.querySelector('[aria-checked="true"]')||m.querySelector("button")).focus({preventScroll:true});
  }else{
    btn.setAttribute("aria-expanded","false");
    const done=()=>{m.hidden=true;m._a=null};
    if(reduceMotion()){done();return}
    m._a=m.animate([{opacity:1,transform:"none"},{opacity:0,transform:"translateY(-8px) scaleY(.94)"}],{duration:170,easing:"cubic-bezier(.4,0,.2,1)"});m._a.onfinish=done;
  }
}
document.addEventListener("click",e=>{
  const t=e.target;if(!t.closest)return;
  if(t.closest("#modeBtn")){modeMenu();return}
  const pick=t.closest("[data-pick-mode]");
  if(pick){const want=pick.dataset.pickMode==="simple";modeMenu(false);
    if(want===simple)return;
    setTimeout(()=>{simple=want;try{localStorage.setItem(SIMPLE_KEY,simple?"1":"0")}catch(_){}render();if(!simple)layoutAll()},reduceMotion()?0:140);return}
  const m=document.getElementById("modeMenu");if(m&&!m.hidden&&!t.closest(".mode-dd"))modeMenu(false);
});
document.addEventListener("keydown",e=>{
  const m=document.getElementById("modeMenu");if(!m||m.hidden)return;
  if(e.key==="Escape"){e.stopPropagation();modeMenu(false);document.getElementById("modeBtn")?.focus();return}
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();const bs=[...m.querySelectorAll("button")],i=bs.indexOf(document.activeElement);bs[(i+(e.key==="ArrowDown"?1:bs.length-1))%bs.length].focus()}
},true);
function renderSimple(){
  document.body.classList.toggle("simple",simple);
  document.querySelectorAll(".sgroup").forEach(g=>g.classList.toggle("sopen",simpleOpen.has(g.dataset.sec)));
  if(!simple)return;
  const act=state.issues.filter(i=>i.progress<100).length;
  const live=state.events.filter(e=>!e.doneAt).length;
  const done=state.issues.filter(i=>i.progress>=100).length+state.events.filter(e=>e.doneAt).length;
  const lastW=[...state.weeks].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const pills=[["live","即時回報",live,"red"],["progress","進度",act,""],["done","完成紀錄",done,"green"],["weekly","每週概述",lastW?fmt(lastW.date).slice(5):"—",""]].filter(([k])=>k!=="weekly"&&secOn(k));
  $("#simpleBar").innerHTML=pills.map(([k,t,n,c])=>`<button type="button" class="spill ${c} ${simpleOpen.has(k)?"on":""}" data-simple="${k}" aria-expanded="${simpleOpen.has(k)}"><span class="sdot" aria-hidden="true"></span><span class="st">${t}</span><span class="sn">${n}</span><span class="schev" aria-hidden="true">▾</span></button>`).join("");
  const w=lastW;
  $("#simpleWeek").innerHTML=w?`<div class="sub" style="margin-bottom:8px">${fmt(w.date)}</div><div class="week-text">${esc(w.text)}</div><div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button type="button" data-copylast>複製文字</button><button type="button" data-goweek>全部週報 →</button></div>`:`<p class="empty">還沒有週報。</p>`;
}
function toggleSimpleGroup(k){
  const g=document.querySelector(`.sgroup[data-sec="${k}"]`);if(!g)return;
  const opening=!simpleOpen.has(k);
  (g._a||[]).forEach(a=>a.cancel());
  if(opening){[...simpleOpen].filter(x=>x!==k).forEach(x=>toggleSimpleGroup(x));simpleOpen.add(k);renderSimple();layoutAll();
    if(reduceMotion())return;
    const h=g.scrollHeight;g.style.overflow="hidden";
    g._a=[g.animate([{height:"0px",opacity:0,transform:"translateY(-8px)"},{height:h+"px",opacity:1,transform:"none"}],EXPAND)];
    g._a[0].onfinish=()=>{g.style.overflow="";g._a=[]};
  }else{
    const finish=()=>{simpleOpen.delete(k);renderSimple();g.style.overflow="";g._a=[]};
    if(reduceMotion()){finish();return}
    const h=g.offsetHeight;g.style.overflow="hidden";
    document.querySelector(`.spill[data-simple="${k}"]`)?.classList.remove("on");
    const a=g.animate([{height:h+"px",opacity:1},{height:"0px",opacity:0}],{duration:380,easing:"cubic-bezier(.4,0,.2,1)",fill:"forwards"});
    g._a=[a];a.onfinish=()=>{a.cancel();finish()};
  }
}
