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
const MODES=[["full","完整模式","所有區塊一次看完"],["simple","傻瓜模式","四個按鈕，一次只看一區"]];
const simpleBtnHTML=()=>"";
const _oldModeHTML=()=>`${CFG.sections.animation?`<button id="animBtn">▶ 動畫模式</button>`:""}${`<span class="mode-dd"><button type="button" id="modeBtn" aria-haspopup="menu" aria-expanded="false" aria-controls="modeMenu"><span>${CFG.sections.simple?(simple?"傻瓜模式":"完整模式"):"更多"}</span><span class="chev" aria-hidden="true">▾</span></button><div class="mode-menu" id="modeMenu" role="menu" aria-label="檢視方式" hidden>${(CFG.sections.simple?MODES:[]).map(([k,t,d])=>`<button type="button" role="menuitemradio" data-pick-mode="${k}" aria-checked="${(k==="simple")===simple}"><span class="mm-dot" aria-hidden="true"></span><span class="mm-t">${t}</span><small>${d}</small></button>`).join("")}${CFG.sections.simple?'<div class="mm-sep" role="separator"></div>':""}<button type="button" role="menuitem" class="mm-link" data-open-log><span class="mm-ico" aria-hidden="true">↺</span><span class="mm-t">編輯紀錄</span><small>誰在什麼時候改了什麼</small></button></div></span>`}`;
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
  if(t.closest("[data-open-log]")){modeMenu(false);return}
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
/* renderSimple / toggleSimpleGroup → nav.js */
