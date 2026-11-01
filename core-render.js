/* 核心｜整體重繪＋區塊切換 */
let openWeeks=null,newWeekId=null,prevDone=null,openDone=new Set(),openEv=new Set(),editing=false,dirty=false,snapshot="",keepIds=new Set(),openIds=new Set();

/* ---------- timeline math ---------- */
function rangeMs(){const s=pd(state.range.start+"-01");const e=pd(state.range.end+"-01");e.setMonth(e.getMonth()+1);return[s.getTime(),e.getTime()]}
function pos(date){const[s,e]=rangeMs();return clamp((pd(date).getTime()-s)/(e-s)*100)}
function months(){const out=[];const d=pd(state.range.start+"-01");const end=pd(state.range.end+"-01");while(d<=end){out.push(new Date(d));d.setMonth(d.getMonth()+1)}return out}

const activeIssues=()=>state.issues.filter(i=>!i.doneAt||(editing&&keepIds.has(i.id)));
const doneIssues=()=>state.issues.filter(i=>i.doneAt&&!(editing&&keepIds.has(i.id))).sort((a,b)=>(b.doneAt||"").localeCompare(a.doneAt||""));

/* ---------- render ---------- */
let rendering=false;
function render(){
  if(rendering)return;rendering=true;
  try{
    document.body.classList.toggle("edit",editing);
    document.body.classList.toggle("locked",!!state.locked);
    renderHeader();renderTabbar();renderSections();storySync();renderWeeks();renderGantt();renderEvents();renderCards();renderDone();layoutAll();
  }finally{rendering=false}
}

/* ---------- 區塊切換：底部工具列的三個分頁 ----------
   手機：一次只顯示一區（預設即時回報）；桌面：全部顯示，選到的區塊放大移到最上面，其他區塊排在下面 */
const SECS=["live","progress","done"].filter(secOn);
let curSec=SECS[0]||"live",secTok=0;
const isPhone=()=>matchMedia("(max-width:640px)").matches;
function renderSections(){document.querySelectorAll(".layout>.sgroup").forEach(g=>g.classList.toggle("cur",g.dataset.sec===curSec));
  /* 切換區塊時，個別進度／完成紀錄要不要改成左右兩欄跟著變 */
  if(mdOn("progress")!==mdLast.progress)renderCards();if(mdOn("done")!==mdLast.done)renderDone()}
/* 桌面（1000px 以上）、區塊被選到放大成全寬時：清單在左、詳情在右（個別進度、完成紀錄） */
const MD_MQ=matchMedia("(min-width:1000px)");
const mdOn=sec=>MD_MQ.matches&&curSec===sec;
let selIssue=null,selDone=null;const mdLast={};
MD_MQ.addEventListener("change",()=>render());
function setSection(k,{instant}={}){
  if(!SECS.includes(k)||k===curSec)return;
  const tok=++secTok,prev=curSec,lay=document.querySelector(".layout"),sc=$("#pageMain");
  const groups=[...lay.querySelectorAll(":scope>.sgroup")],out=groups.find(g=>g.dataset.sec===prev),inn=groups.find(g=>g.dataset.sec===k);
  /* 區塊頂端已經捲到畫面外時，捲回來讓新區塊從頭看 */
  const toTop=()=>{const d=lay.getBoundingClientRect().top-sc.getBoundingClientRect().top-12;if(d<0)sc.scrollTop+=d};
  curSec=k;renderTabbar();
  groups.forEach(g=>g.getAnimations().forEach(a=>a.cancel()));
  if(instant||reduceMotion()){renderSections();layoutAll();toTop();return}
  if(isPhone()){
    /* 手機：舊區塊淡出，新區塊由下往上淡入 */
    const show=()=>{if(tok!==secTok)return;renderSections();layoutAll();toTop();inn.animate([{opacity:0,transform:"translateY(14px)"},{opacity:1,transform:"none"}],{duration:340,easing:"cubic-bezier(.2,.9,.25,1)"})};
    if(out&&out.offsetParent){const a=out.animate([{opacity:1,transform:"none"},{opacity:0,transform:"translateY(-8px)"}],{duration:140,easing:"cubic-bezier(.4,0,1,1)",fill:"forwards"});a.onfinish=()=>{show();a.cancel()}}
    else show();
    return;
  }
  /* 桌面：FLIP——選到的區塊從原本的位置放大彈到最上面，其他區塊滑到新位置 */
  const first=new Map(groups.map(g=>[g,g.getBoundingClientRect()]));
  renderSections();layoutAll();toTop();
  groups.forEach(g=>{
    const a=first.get(g),b=g.getBoundingClientRect();if(!a.width||!b.width)return;
    const s=a.width/b.width,dx=a.left-b.left,dy=a.top-b.top;if(Math.abs(dx)<1&&Math.abs(dy)<1&&Math.abs(s-1)<.01)return;
    const sel=g===inn;g.style.zIndex=sel?"2":"1";
    g.animate([{transformOrigin:"0 0",transform:`translate(${dx}px,${dy}px) scale(${s})`,opacity:sel?1:.55},{transformOrigin:"0 0",transform:"none",opacity:1}],
      {duration:sel?620:480,easing:sel?"cubic-bezier(.2,.9,.25,1.1)":"cubic-bezier(.2,.9,.25,1)"}).onfinish=()=>{g.style.zIndex=""};
  });
}
