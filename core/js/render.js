/* 核心｜整體重繪＋區塊切換 */
let openWeeks=null,newWeekId=null,prevDone=null,openDone=new Set(),openEv=new Set(),editing=false,dirty=false,snapshot="",keepIds=new Set();

/* ---------- timeline math ---------- */
function rangeMs(){const s=pd(state.range.start+"-01");const e=pd(state.range.end+"-01");e.setMonth(e.getMonth()+1);return[s.getTime(),e.getTime()]}
function pos(date){const[s,e]=rangeMs();return clamp((pd(date).getTime()-s)/(e-s)*100)}
function months(){const out=[];const d=pd(state.range.start+"-01");const end=pd(state.range.end+"-01");while(d<=end){out.push(new Date(d));d.setMonth(d.getMonth()+1)}return out}

/* 分區編輯：頁首「編輯」只負責登入、進入編輯狀態與最後的儲存／取消；
   會長室的追蹤、秘書處的會議編輯：標題列各有一顆「編輯這區」，按了這區才出現編輯工具，一次只能開一區。
   即時回報、進度、完成紀錄（INLINE_SECS）沒有「編輯這區」，頁首按「編輯」後就是逐欄編輯（點哪一欄改哪一欄，見 views.js 的 evFld／ifFld）。
   secEdit＝目前在編輯的區塊（最多一個，不含 INLINE_SECS）；進入編輯時清空（events.js 的 #editBtn）。週報頁的編輯照舊跟著 editing */
let secEdit=new Set();
const INLINE_SECS=["live","progress","done"];
const secEd=k=>editing&&(INLINE_SECS.includes(k)||secEdit.has(k));
const SEC_EDIT_LBL={on:"收起編輯",off:"編輯這區"};
function renderSecEdit(){
  document.querySelectorAll("[data-secbox]").forEach(b=>b.classList.toggle("sec-edit",secEd(b.dataset.secbox)));
  document.querySelectorAll("[data-secedit]").forEach(b=>{const on=secEd(b.dataset.secedit),t=on?SEC_EDIT_LBL.on:SEC_EDIT_LBL.off;
    b.setAttribute("aria-pressed",on);if(b._t!==t){b._t=t;b.innerHTML=(on?"":ico("edit"))+t}});
}
/* 按「編輯這區」：一次只能改一區——打開這區時，原本開著的那區自動收起；再按一次收起這區。
   剛打開的那區，編輯工具淡入（board.css「編輯／檢視切換時的動畫」段的 .sec-anim） */
function toggleSecEdit(k){
  const on=!secEdit.has(k);secEdit=on?new Set([k]):new Set();render();
  const box=document.querySelector(`[data-secbox="${k}"]`);if(!box||!on||reduceMotion())return;
  box.classList.remove("sec-anim");void box.offsetWidth;box.classList.add("sec-anim");clearTimeout(box._sa);box._sa=setTimeout(()=>box.classList.remove("sec-anim"),900);
}

const activeIssues=()=>state.issues.filter(i=>!i.doneAt||(editing&&keepIds.has(i.id)));
const doneIssues=()=>state.issues.filter(i=>i.doneAt&&!(editing&&keepIds.has(i.id))).sort((a,b)=>(b.doneAt||"").localeCompare(a.doneAt||""));

/* ---------- render ---------- */
let rendering=false;
function render(){
  if(rendering)return;rendering=true;
  const flip=Anim.capture();   /* 動畫規則 2：data-flip 容器裡的項目，render 前後比對位置（anim.js） */
  try{
    document.body.classList.toggle("edit",editing);
    document.body.classList.toggle("locked",!!state.locked);
    renderHeader();renderTabbar();renderSections();renderSecEdit();renderWeeks();renderGantt();renderEvents();renderCards();renderDone();renderFollows();renderMeet();renderGrant();layoutAll();flowWatch();
  }finally{rendering=false}
  Anim.play(flip);Anim.syncPings();
}

/* ---------- 區塊切換：底部工具列的三個分頁 ----------
   手機：一次只顯示一區（預設即時回報）；桌面：全部顯示，選到的區塊放大移到最上面，其他區塊排在下面 */
const SECS=["live","progress","done"].filter(secOn);
let curSec=(SECS.includes(appStartSec)&&appStartSec)||SECS[0]||"live",secTok=0;   /* appStartSec：App 重開時回到上次的區塊（app.js） */
const isPhone=()=>matchMedia("(max-width:640px)").matches;
function renderSections(){document.querySelectorAll(".layout>.sgroup").forEach(g=>g.classList.toggle("cur",g.dataset.sec===curSec));
  /* 切換區塊時，個別進度／完成紀錄要不要改成左右兩欄跟著變 */
  if(mdOn("live")!==mdLast.live)renderEvents();if(mdOn("done")!==mdLast.done)renderDone()}
/* 桌面（1000px 以上）、區塊被選到放大成全寬時：清單在左、詳情在右（即時回報、完成紀錄；進度改成甘特圖／詳情切換，見 views.js 的 progShow） */
const MD_MQ=matchMedia("(min-width:1000px)");
const mdOn=sec=>MD_MQ.matches&&curSec===sec;
let progOpen=null,selDone=null,selEv=null;const mdLast={};
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
    g.animate([{transformOrigin:"0 0",transform:`translate(${dx}px,${dy}px) scale(${s})`},{transformOrigin:"0 0",transform:"none"}],   /* 變暗由 CSS（.sgroup:not(.cur)）漸變 */
      {duration:sel?620:480,easing:sel?"cubic-bezier(.2,.9,.25,1.1)":"cubic-bezier(.2,.9,.25,1)"}).onfinish=()=>{g.style.zIndex=""};
  });
}
