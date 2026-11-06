/* 核心｜整體重繪＋區塊切換 */
let openWeeks=null,newWeekId=null,prevDone=null,openDone=new Set(),openEv=new Set(),editing=false,dirty=false,snapshot="",keepIds=new Set();

/* ---------- timeline math ---------- */
/* 甘特圖看的範圍（2026-11-05）：「全部」＝設定的時間軸（state.range）；「上學期」＝8 月～隔年 1 月；「下學期」＝2 月～7 月。
   學年從開學日（termCfg().termStart，秘書處統一設定）的年份算，沒填就用今天（8 月起算新學年）。
   預設跟著秘書處設定頁「學年」選的學期（termCfg().semester）；在甘特圖上臨時切換（ganttTerm）只影響畫面、不存，重新整理回到預設。 */
let ganttTerm=null;
const gTermNow=()=>ganttTerm||termCfg().semester||"all";
function termYear(){const s=termCfg().termStart||today(),y=+s.slice(0,4),m=+s.slice(5,7);return m>=8?y:y-1}
function viewRange(){
  const y=termYear();
  const g=gTermNow();
  if(g==="up")return {start:`${y}-08`,end:`${y+1}-01`};
  if(g==="down")return {start:`${y+1}-02`,end:`${y+1}-07`};
  return state.range;
}
function rangeMs(){const r=viewRange(),s=pd(r.start+"-01"),e=pd(r.end+"-01");e.setMonth(e.getMonth()+1);return[s.getTime(),e.getTime()]}
function pos(date){const[s,e]=rangeMs();return clamp((pd(date).getTime()-s)/(e-s)*100)}
function months(){const r=viewRange(),out=[],d=pd(r.start+"-01"),end=pd(r.end+"-01");while(d<=end){out.push(new Date(d));d.setMonth(d.getMonth()+1)}return out}

/* 單卡編輯（2026-11-06 使用者：頁首的大「編輯」拿掉，全部改成卡片自己的小「編輯」鈕；登入狀態才看得到，即時回報要展開才看得到）
   cardEdit＝正在編輯的那一張，一次只能一張：
     "e:id" 即時回報（含完成紀錄裡的）、"i:id" 議題（含結案的）、"s:區名" 整區（follow 會長室追蹤、meetedit 秘書處會議編輯、gantt 甘特圖時間軸）。
   editing＝有一張在編輯。那張卡片（或那一區）加 .sec-edit，裡面的 .edit-only 工具才出現（board.css 開頭），最下面一條「取消｜儲存」（editBarHTML）。
   「儲存」＝saveFlow（存整份資料、寫一筆編輯紀錄），「取消」＝還原到開始編輯前（snapshot）。
   編輯鈕（.card-edit-btn）一律畫出來，登入（body.authed）而且沒有別張在編輯時才顯示（board.css「單卡編輯」段）。 */
let cardEdit="";
const cardEd=(t,id)=>editing&&cardEdit===`${t}:${id}`;
const secEd=k=>editing&&cardEdit==="s:"+k;
const canEdit=()=>loggedIn()&&!readOnly();
const editBtnHTML=key=>state.locked?"":`<button type="button" class="icon card-edit-btn" data-edit="${key}">${ico("edit")}編輯</button>`;
const editBarHTML=()=>`<div class="card-edbar"><button type="button" data-edcancel>取消</button><button type="button" class="primary" data-edsave>${cloudOn()?"儲存並同步":"儲存"}</button></div>`;
/* 開始編輯 key 那一張：then＝開始後馬上要做的事（例如新增一筆空白的、打開名稱欄） */
async function startEdit(key,then){
  if(editing||!(await ensureLogin()))return false;
  morph(()=>{editing=true;cardEdit=key;dirty=false;evFld=null;ifFld=null;snapshot=JSON.stringify(state);keepIds=new Set(state.issues.filter(i=>!i.doneAt).map(i=>i.id));if(then)then();render()});
  const box=document.querySelector(`[data-edbox="${key}"]`);   /* 剛打開的那張，編輯工具淡入（board.css「編輯／檢視切換時的動畫」段的 .sec-anim） */
  if(box&&!reduceMotion()){box.classList.remove("sec-anim");void box.offsetWidth;box.classList.add("sec-anim");clearTimeout(box._sa);box._sa=setTimeout(()=>box.classList.remove("sec-anim"),900)}
  return true;
}
function cancelEdit(){morph(()=>{if(CFG.meeting)mtDiscard();if(dirty)state=normalize(JSON.parse(snapshot));editing=false;cardEdit="";dirty=false;evFld=null;ifFld=null;render()})}
/* 固定在頁面上的整區（追蹤、會議編輯、甘特圖時間軸）：編輯中加 .sec-edit、最下面補上「取消｜儲存」；卡片本身（即時回報、議題、完成紀錄）每次重畫時自己帶 */
function renderSecEdit(){
  document.body.classList.toggle("authed",canEdit());
  document.querySelectorAll("[data-edit]:not(:has(.ico))").forEach(b=>b.insertAdjacentHTML("afterbegin",ico("edit")));   /* 骨架（shell.js）裡的編輯鈕載入時還沒有 icon 可用，第一次畫時補上 */
  document.querySelectorAll("[data-edbox^='s:']").forEach(b=>{const on=editing&&cardEdit===b.dataset.edbox,bar=b.querySelector(":scope>.card-edbar");
    b.classList.toggle("sec-edit",on);if(on&&!bar)b.insertAdjacentHTML("beforeend",editBarHTML());else if(!on&&bar)bar.remove()});
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
    renderHeader();renderTabbar();renderSections();renderSecEdit();renderWeeks();renderGantt();renderEvents();renderCards();renderDone();renderActivity();renderFollows();renderDocs();renderMeet();renderGrant();layoutAll();flowWatch();
  }finally{rendering=false}
  Anim.play(flip);Anim.syncPings();
}

/* ---------- 區塊切換：底部工具列的三個分頁 ----------
   手機：一次只顯示一區（預設即時回報）；桌面：全部顯示，選到的區塊放大移到最上面，其他區塊排在下面 */
const SECS=["live","progress","done","ext"].filter(secTab);
let curSec=(SECS.includes(appStartSec)&&appStartSec)||SECS[0]||"live",secTok=0;   /* appStartSec：app.js 留下的初始區塊（現在都是空的，從第一個區塊開始） */
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
