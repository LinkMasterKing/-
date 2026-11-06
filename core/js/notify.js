/* 核心｜通知層（頁首鈴鐺）：搜尋＋今日／明日＋近期（智慧堆疊）＋海報月曆（2026-11-05 重新設計，交接說明四十二）
   - 跟設定頁同一類的全畫面層（.set-ov），開關用換頁動畫，返回鍵／手勢、Esc、點下方分頁都會關。
   - 事件只有即時回報上記錄的時間標記（ev.times；未完成的即時回報）。時段（有結束日）算頭到尾的每一天。
     議題的開始／結束日、議題註記不再列進來。不推播，只在看板裡顯示。
   - 本部門／全會切換：全會＝讀各部門的資料檔（跟會長室追蹤同一種讀法 fwLoad，只讀不寫）。
     注意：各部門資料檔放在公開 repo 時，任何人本來就讀得到；這裡沒有多公開任何東西。
   - 版面（由上到下）：範圍切換＋搜尋欄（.noti-bar，sticky，不跟著重畫）→ 今日／明日兩張卡片 → 近期（智慧堆疊）→ 行事曆（事件清單＋海報月曆）。
   - 顏色：本部門＝即時回報的狀態色（綠／黃／紅）；全會＝部門色。 */
let notiOpen=false,notiSeg=null;
const NOTI={scope:"mine",month:null,day:null,all:null,loading:false,q:""};
const DEPT_COLORS=["#e0342a","#0a5baa","#f0bc23","#2f8f84","#a24fc0","#d84f92","#c26a12","#3d7fe0","#6b6b75"];
const deptColor=id=>DEPT_COLORS[Math.max(0,(window.BOARD_DEPTS||[]).findIndex(d=>d.id===id))%DEPT_COLORS.length];
const NOTI_ST={ok:"var(--st-ok)",go:"var(--st-go)",stall:"var(--st-stall)"};
const WD="日一二三四五六";
/* 一份看板資料 → 事件清單 {key,date,end,time,title,place,ev,st,dept}（只有未完成即時回報的時間標記） */
function notiItems(s,dept){
  const out=[];
  s.events.filter(e=>!e.doneAt).forEach(e=>{const st=evStatus(e);(e.times||[]).forEach(t=>{
    const d=t.start.slice(0,10),en=(t.end||"").slice(0,10);
    out.push({key:`${dept}:t:${t.id}`,date:d,end:en&&en>d?en:"",time:t.start.slice(11,16),title:t.label||"（未命名）",place:t.place||"",ev:e.name||"",st,dept})})});
  return out.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}
const notiMine=()=>notiItems(state,CFG.deptId||"rights");
const notiList=()=>NOTI.scope==="all"&&NOTI.all?NOTI.all:notiMine();
/* 某一天有這件事：單日＝那天；時段＝頭到尾每一天 */
const covers=(x,d)=>x.end?d>=x.date&&d<=x.end:x.date===d;
const itemColor=x=>NOTI.scope==="all"?deptColor(x.dept):NOTI_ST[x.st]||"var(--ink)";
const nmd=s=>`${+s.slice(5,7)}/${+s.slice(8,10)}`;
const deptName=id=>{const d=fwDept(id);return d?d.name:id};
/* 出處文字：地點・所屬即時回報（全會再加部門） */
const notiSub=x=>[NOTI.scope==="all"?deptName(x.dept):"",x.place,x.ev].filter(Boolean).join("・");
/* 頁首鈴鐺上的數字：今天＋明天本部門的時間標記（時段算每一天，同一件事只算一次） */
function notiBadge(){
  const b=$("#notiBtn");if(!b)return;
  const t=today(),m=addDays(t,1),n=notiMine().filter(x=>covers(x,t)||covers(x,m)).length;
  const el=b.querySelector(".noti-n");const txt=n?String(n>99?"99+":n):"";
  if(el.textContent!==txt){el.textContent=txt;el.hidden=!n;if(n)Anim.enter(el,"pop")}
  b.setAttribute("aria-label",n?`通知：今明兩天有 ${n} 件事`:"通知");
}

/* ---------- 今日／明日：左右兩張卡片（手機也並排） ---------- */
/* 卡片裡一列的時間欄：當天開始的寫時刻（沒有就「整天」），時段寫「第 k／N 天」 */
function dayWhen(x,d){
  if(!x.end)return x.time||"整天";
  const k=Math.round((pd(d)-pd(x.date))/864e5)+1,n=Math.round((pd(x.end)-pd(x.date))/864e5)+1;
  return k===1&&x.time?x.time:`${k}／${n} 天`;
}
function dayCardHTML(d,lab,cls,list){
  const xs=list.filter(x=>covers(x,d)),MAX=4;
  /* 今日卡片：在「整理」裡右滑（今天處理）的事件不在卡片上列，只寫件數；點今日卡片＝卡片放大成全螢幕的「今日」層（openToday）才列出來 */
  const pk=cls==="today"?triPicked(list):[];
  return `<button type="button" class="nd-card${cls?" "+cls:""}" data-nopen="${d}" aria-label="${lab} ${fmt(d)}，${xs.length} 件事，${cls==="today"?"打開今日":"打開這一天"}">
    <span class="nd-head"><span class="nd-num num">${+d.slice(8)}</span><span class="nd-lab"><b>${lab}<i>・</i>週${WD[pd(d).getDay()]}</b><small class="num">${xs.length?`${xs.length} 件`:nmd(d)}</small></span></span>
    ${xs.length?`<span class="nd-list">${xs.slice(0,MAX).map(x=>`<span class="nd-row" style="--c:${itemColor(x)}"><span class="nd-t num">${dayWhen(x,d)}</span><span class="nd-x"><b>${esc(x.title)}</b>${notiSub(x)?`<small>${esc(notiSub(x))}</small>`:""}</span></span>`).join("")}${xs.length>MAX?`<span class="nd-more">還有 ${xs.length-MAX} 件</span>`:""}</span>`
      :(pk.length?"":`<span class="nd-empty"><i aria-hidden="true"></i>沒有安排</span>`)}
    ${pk.length?`<span class="nd-pick"><i aria-hidden="true"></i><small>今天處理</small><b class="num">${pk.length}</b><small>件</small></span>`:""}
  </button>`;
}

/* ---------- 行事曆：事件清單＋海報月曆 ---------- */
/* 海報月曆：超大月份縮寫＋右上兩行年份；週一開頭；日期是數字（沒有格線）；
   2026-11-05 使用者：月曆上不寫字，看幾條線就知道幾件事——時段＝細線橫跨期間（兩端小圓點）、單天＝日期下一顆小點；
   同一週會撞在一起的往下排一層（每層 9px）。點日期才在月曆上方的「這一天」區塊顯示事件的文字 */
const MON_EN=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function posterHTML(list){
  const m=NOTI.month,first=pd(m+"-01"),y=first.getFullYear(),mi=first.getMonth(),dim=new Date(y,mi+1,0).getDate(),off=(first.getDay()+6)%7;
  const t=today(),ds=n=>`${m}-${pad(n)}`,all=NOTI.scope==="all";
  const weeks=[];for(let n=1-off;n<=dim;n+=7)weeks.push(Array.from({length:7},(_,i)=>n+i));
  const body=weeks.map(w=>{
    const lo=Math.max(1,w[0]),hi=Math.min(dim,w[6]),a=ds(lo),b=ds(hi);
    const nums=w.map(n=>{if(n<1||n>dim)return `<span class="pc-d pc-pad" aria-hidden="true"></span>`;const d=ds(n),c=list.filter(x=>covers(x,d)).length;
      return `<button type="button" class="pc-d${d===t?" is-today":""}${d===NOTI.day?" sel":""}${c?" has":""}" data-cal="${d}" aria-label="${fmt(d)}${c?`，${c} 件事`:""}"${d===NOTI.day?' aria-pressed="true"':""}><span class="pc-n num">${n}</span></button>`}).join("");
    const lanes=[];
    const evs=list.filter(x=>x.date<=b&&(x.end||x.date)>=a).map(x=>{
      const s=x.date<a?lo:+x.date.slice(8),e=(x.end||x.date)>b?hi:+(x.end||x.date).slice(8),i0=w.indexOf(s),i1=w.indexOf(e);
      let ln=lanes.findIndex(z=>z<i0);if(ln<0){ln=lanes.length;lanes.push(-1)}lanes[ln]=i1;
      return `<span class="pc-e${i1>i0?" span":""}" aria-hidden="true" style="--i0:${i0};--i1:${i1};--ln:${ln};--c:${all?deptColor(x.dept):"var(--ink)"}"></span>`}).join("");
    return `<div class="pc-week" style="--lanes:${lanes.length}">${nums}${evs}</div>`}).join("");
  return `<div class="pc-head" aria-label="${y} 年 ${mi+1} 月"><b class="pc-mon"><span class="pc-mn num">${mi+1}</span>${MON_EN[mi]}</b><span class="pc-yr num">${String(y).slice(0,2)}<br>${String(y).slice(2)}</span></div>
    <div class="pc-wk" aria-hidden="true">${["MON","TUE","WED","THU","FRI","SAT","SUN"].map(x=>`<span>${x}</span>`).join("")}</div>
    <div class="pc-body" role="group" aria-label="${y} 年 ${mi+1} 月">${body}</div>
    <p class="pc-foot">${all?"全會":esc(CFG.dept.name||"本部門")}・學生會</p>`;
}
/* 點了某一天：月曆上方「這一天」區塊，列出那天每件事（時刻、名稱、地點・即時回報）；平常不顯示 */
function dayViewHTML(list){
  const d=NOTI.day;if(!d)return "";
  const xs=list.filter(x=>covers(x,d)),tag=x=>`<span class="dv-tag" style="--c:${itemColor(x)}"><i aria-hidden="true"></i><span class="dv-tx"><b>${esc(x.title)}</b><small><span class="num">${x.end?`${nmd(x.date)}–${nmd(x.end)}`:x.time||"整天"}</span>${notiSub(x)?`・${esc(notiSub(x))}`:""}</small></span></span>`;   /* 2026-11-06：膠囊改成清單列（標題一行、時間與所屬放第二行），長標題不會把時間擠成兩行 */
  return `<div class="noti-dayview" id="notiDay"><div class="dv-top"><b class="num">${nmd(d)}</b><span>週${WD[pd(d).getDay()]}・${xs.length?`${xs.length} 件`:"沒有事件"}</span><button type="button" class="icon dv-x" data-nday="" aria-label="收起這一天">${ico("close","solo")}</button></div>
    ${xs.length?`<div class="dv-tags">${xs.map(tag).join("")}</div>`:""}</div>`;
}
function notiInner(){
  const list=notiList(),t=today(),all=NOTI.scope==="all";
  const legend=all
    ?(window.BOARD_DEPTS||[]).map(d=>`<span><i style="--c:${deptColor(d.id)}"></i>${esc(d.name)}</span>`).join("")
    :Object.entries(NOTI_ST).map(([k,c])=>`<span><i style="--c:${c}"></i>${EV_ST[k]}</span>`).join("");
  return `${all?`<p class="sub noti-note">${NOTI.loading?"讀取各部門資料中…":"全會：讀各部門的資料檔，只能看、不能改。"}</p>`:""}
    <div class="noti-days">${dayCardHTML(t,"今日","today",list)}${dayCardHTML(addDays(t,1),"明日","",list)}</div>
    ${triDeck(list).length?`<section class="noti-tri" id="notiTri"><h3 class="noti-h"><b>整理</b><span>右滑今天處理・左滑還不要</span></h3>${deckHTML(list)}</section>`:""}
    <section class="noti-cal">
      <div class="cal-top"><h3 class="noti-h"><b>行事曆</b></h3><button type="button" class="icon" data-nmon="-1" aria-label="上個月">${ico("prev","solo")}</button><button type="button" class="icon" data-nmon="1" aria-label="下個月">${ico("next","solo")}</button><button type="button" class="icon" data-nmon="0">回到本月</button></div>
      ${dayViewHTML(list)}
      <div class="pc" id="notiCal">${posterHTML(list)}</div>
      <div class="cal-legend">${legend}</div>
    </section>`;
}
/* ---------- 整理：交友軟體式左滑右滑（2026-11-05 使用者要求） ----------
   卡片堆＝所有還沒處理的事件（今天起還沒結束、今天還沒滑過的時間標記），一次一張、後面露出兩張。
   右滑＝今天處理（放進「今日」卡片的「今天處理」）；左滑＝還不要（今天不再出現）。也可以按下面的 ✕／✓，「復原」退回上一張。
   全部滑完＝整個「整理」區收起來（高度縮掉、淡出），今天不再出現；隔天結果清空，卡片堆跟著回來（2026-11-06 使用者）。
   結果只存在這台裝置的 localStorage（workboard:triage:部門代號），隔天自動清空；不上傳、別人看不到。
   動畫只動 transform／opacity：跟手指走、依位移傾斜，放開超過 30% 寬或甩得夠快就飛出去，否則彈回。 */
const TRI_KEY=()=>`workboard:triage:${CFG.deptId||"rights"}`;
function triLoad(){try{const o=JSON.parse(localStorage.getItem(TRI_KEY())||"null");if(o&&o.date===today())return o}catch(_){}return {date:today(),yes:[],no:[],last:[]}}
function triSave(o){try{localStorage.setItem(TRI_KEY(),JSON.stringify(o))}catch(_){}}
let TRI=triLoad();
const triFresh=()=>{if(TRI.date!==today())TRI=triLoad();return TRI};
const triPicked=list=>{const y=new Set(triFresh().yes);return list.filter(x=>y.has(x.key))};
const triDeck=list=>{const o=triFresh(),done=new Set([...o.yes,...o.no]),t=today();return list.filter(x=>(x.end||x.date)>=t&&!done.has(x.key))};
function deckCardHTML(x,i){
  return `<div class="dk-card" data-dk="${esc(x.key)}" data-i="${i}" style="--c:${itemColor(x)};--i:${i}"${i?' aria-hidden="true"':""}>
    <span class="dk-yes" aria-hidden="true">今天處理</span><span class="dk-no" aria-hidden="true">還不要</span>
    <span class="dk-date"><b class="num">${+x.date.slice(8)}</b><small>${+x.date.slice(5,7)} 月・週${WD[pd(x.date).getDay()]}${x.end?`<br>到 ${nmd(x.end)}`:""}</small></span>
    <span class="dk-main"><b><i class="dk-dot" aria-hidden="true"></i>${esc(x.title)}</b><small>${esc([x.time,x.place].filter(Boolean).join("・"))}</small><small>${esc([NOTI.scope==="all"?deptName(x.dept):"",x.ev].filter(Boolean).join("・"))}</small></span>
  </div>`;
}
function deckHTML(list){
  const xs=triDeck(list),o=triFresh();
  return `<div class="noti-deck" id="notiDeck">
    <div class="dk-stack">${xs.slice(0,3).map(deckCardHTML).reverse().join("")}</div>
    <div class="dk-ctl"><button type="button" class="dk-btn no" data-dkgo="no" aria-label="還不要">${ico("close","solo")}</button><button type="button" class="icon dk-undo" data-dkundo${o.last.length?"":" disabled"}>復原</button><button type="button" class="dk-btn yes" data-dkgo="yes" aria-label="今天處理">${ico("check","solo")}</button></div>
    <p class="dk-count sub num">還有 ${xs.length} 件</p></div>`;
}
function triCommit(key,dir){
  const o=triFresh();o.yes=o.yes.filter(k=>k!==key);o.no=o.no.filter(k=>k!==key);o[dir].push(key);o.last.push(key);o.last=o.last.slice(-30);triSave(o);
  const sec=$("#notiTri");
  if(sec&&!triDeck(notiList()).length&&!reduceMotion()){triFold(sec).then(renderNoti);return}   /* 滑完最後一張：整區收起來再重畫 */
  renderNoti();
}
/* 「整理」區收起：高度縮到 0、淡出，下面的區塊跟著往上補（連同區塊間距 30px，.noti-inner 的 gap） */
function triFold(sec){
  const h=sec.offsetHeight;sec.style.overflow="hidden";
  return sec.animate([{height:h+"px",opacity:1,marginBottom:"0px"},{height:"0px",opacity:0,marginBottom:"-30px"}],{duration:MO.layout,easing:MO.out,fill:"forwards"}).finished.catch(()=>{});
}
function triUndo(){const o=triFresh(),k=o.last.pop();if(!k)return;o.yes=o.yes.filter(x=>x!==k);o.no=o.no.filter(x=>x!==k);triSave(o);renderNoti()}
/* 讓最上面那張飛出去（dir：yes 往右、no 往左），播完才記下來重畫 */
function dkFly(card,dir,from={x:0,y:0}){
  if(!card||card._gone)return;card._gone=true;
  const W=card.offsetWidth||320,sx=dir==="yes"?1:-1,key=card.dataset.dk;
  card.classList.add(dir==="yes"?"go-yes":"go-no");
  if(reduceMotion()){triCommit(key,dir);return}
  const next=card.parentElement.querySelector(`.dk-card[data-i="1"]`);
  if(next)next.animate([{transform:getComputedStyle(next).transform},{transform:"none"}],{duration:MO.base,easing:MO.out,fill:"forwards"});
  card.animate([{transform:`translate(${from.x}px,${from.y}px) rotate(${from.x/18}deg)`,opacity:1},{transform:`translate(${sx*W*1.4}px,${from.y+40}px) rotate(${sx*28}deg)`,opacity:0}],{duration:360,easing:MO.in,fill:"forwards"}).finished.then(()=>triCommit(key,dir)).catch(()=>{});
}
function dkBind(){
  const st=$("#notiDeck .dk-stack");if(!st||st._dk)return;st._dk=true;
  ["touchstart","touchmove"].forEach(t=>st.addEventListener(t,e=>{if(e.target.closest(".dk-card"))e.stopPropagation()},{passive:true}));
  let d=null;
  st.addEventListener("pointerdown",e=>{
    const c=e.target.closest(".dk-card");if(!c||e.button>0||c.dataset.i!=="0"||c._gone)return;
    d={c,id:e.pointerId,x0:e.clientX,y0:e.clientY,x:0,y:0,axis:"",t:performance.now(),vx:0,lx:e.clientX,lt:performance.now()};
    c.getAnimations().forEach(a=>a.cancel());try{st.setPointerCapture(e.pointerId)}catch(_){}
  });
  st.addEventListener("pointermove",e=>{
    if(!d||e.pointerId!==d.id)return;const dx=e.clientX-d.x0,dy=e.clientY-d.y0;
    if(!d.axis){if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;d.axis=Math.abs(dx)>=Math.abs(dy)?"x":"y";if(d.axis==="y"){d=null;return}}
    const now=performance.now();d.vx=(e.clientX-d.lx)/Math.max(8,now-d.lt);d.lx=e.clientX;d.lt=now;d.x=dx;d.y=dy*.35;
    const W=d.c.offsetWidth||320,k=Math.min(1,Math.abs(dx)/(W*.3));
    d.c.style.transform=`translate(${dx}px,${d.y}px) rotate(${dx/18}deg)`;d.c.style.setProperty("--yes",dx>0?k:0);d.c.style.setProperty("--no",dx<0?k:0);
    const nx=st.querySelector('.dk-card[data-i="1"]');if(nx)nx.style.transform=`translateY(${(1-k)*10}px) scale(${.95+.05*k})`;
  });
  const end=e=>{
    if(!d||(e&&e.pointerId!==d.id))return;const c=d.c,W=c.offsetWidth||320,x=d.x,y=d.y,v=d.vx;d=null;
    if(Math.abs(x)>W*.3||Math.abs(v)>.6&&Math.abs(x)>24){dkFly(c,(x||v)>0?"yes":"no",{x,y});return}
    const from=c.style.transform;c.style.transform="";c.style.setProperty("--yes",0);c.style.setProperty("--no",0);
    const nx=st.querySelector('.dk-card[data-i="1"]');if(nx)nx.style.transform="";
    if(from&&!reduceMotion())c.animate([{transform:from},{transform:"none"}],{duration:MO.slow,easing:MO.spring});
  };
  st.addEventListener("pointerup",end);st.addEventListener("pointercancel",end);
}
/* ---------- 今日（獨立一層，2026-11-06 使用者） ----------
   點「今日」卡片：卡片從原位放大成全螢幕的一層（跟今日卡片同色：文字色底、底色字），單獨看今天「本來就要做」的事與「整理」裡右滑的「今天處理」。
   動畫：底板從卡片的位置與大小放大到全螢幕（transform，略帶回彈），內容淡入、逐列由下往上；關閉時反過來縮回卡片。
   返回鍵／手勢、Esc、右上「關閉」都會關。資料只讀；右滑結果照舊只存這台裝置 */
let todayOpen=false;
function todayRows(xs,d){return xs.map((x,i)=>`<li class="td-row" style="--c:${itemColor(x)};--i:${i}"><span class="td-t num">${d?dayWhen(x,d):x.end?`${nmd(x.date)}–${nmd(x.end)}`:`${nmd(x.date)}${x.time?" "+x.time:""}`}</span><span class="td-x"><b>${esc(x.title)}</b>${notiSub(x)?`<small>${esc(notiSub(x))}</small>`:""}</span></li>`).join("")}
function todayHTML(){
  const list=notiList(),t=today(),pk=triPicked(list),pkSet=new Set(pk.map(x=>x.key)),own=list.filter(x=>covers(x,t)&&!pkSet.has(x.key));
  return `<div class="td-in"><div class="td-top"><span class="td-num num">${+t.slice(8)}</span><span class="td-lab"><b>今日</b><small class="num">${+t.slice(5,7)} 月・週${WD[pd(t).getDay()]}</small></span><button type="button" class="td-x-btn" data-tdclose aria-label="關閉今日">${ico("close")}關閉</button></div>
    <section class="td-sec" style="--s:0"><h3>本來就要做<span class="num">${own.length}</span></h3>${own.length?`<ol class="td-list">${todayRows(own,t)}</ol>`:`<p class="td-none">今天沒有排定的事</p>`}</section>
    <section class="td-sec is-pick" style="--s:1"><h3>今天處理<small>在「整理」右滑的</small><span class="num">${pk.length}</span></h3>${pk.length?`<ol class="td-list">${todayRows(pk)}</ol>`:`<p class="td-none">還沒有右滑的事。到「整理」把今天要處理的往右滑。</p>`}</section></div>`;
}
/* 彈簧曲線取樣（質量 1、阻尼比 z、勁度 k）：回傳 0→1 的進度（會超過 1 再回來＝Q 彈）與總時間，拿來產生 Web Animations 的關鍵影格 */
function springCurve(z,k,tol=.0015){
  const out=[0];let x=0,v=0,t=0;const dt=1/120,c=2*z*Math.sqrt(k);
  while(t<2){for(let i=0;i<2;i++){v+=(-k*(x-1)-c*v)*dt/2;x+=v*dt/2}t+=dt;out.push(x);if(t>.2&&Math.abs(1-x)<tol&&Math.abs(v)<tol*13)break}
  out[out.length-1]=1;return {p:out,dur:Math.round(t*1000)};
}
/* 今日層的展開／收合（2026-11-06 使用者：進入、返回要更 Q 彈流暢）：
   底板（.td-bg，純色）用 clip-path 從卡片的位置與圓角「揭開」到全螢幕（圓角不會被拉歪），裡面的內容同時從卡片的位置彈到定位（transform）；
   兩個都照同一條彈簧曲線走（展開略帶回彈、收合不回彈、尾巴短）。
   2026-11-06 使用者回報返回卡頓：clip-path 只裁純色底板（每格重畫很便宜），內容只動 transform／opacity（合成器）；
   收合（2026-11-06 使用者：返回直接把進入動畫倒著播）：同一組關鍵影格、同一條彈簧，direction:"reverse"；卡片整段藏著，播完才換回卡片 */
function todayMorph(ov,card,reverse){
  const r=card.getBoundingClientRect(),W=innerWidth,H=innerHeight,inner=ov.querySelector(".td-in");
  const ir=inner.getBoundingClientRect(),dx=r.left+14-ir.left,dy=r.top+12-ir.top;   /* 內容的左上（大日期）對齊卡片的大日期 */
  const S=springCurve(.62,190);   /* 回彈約 8%；倒放時先輕輕鼓一下再縮回卡片 */
  if(reverse){   /* 彈簧最後一段幾乎不動（離終點 1.5% 以內），倒放時會變成一開始卡住不動：剪掉這段尾巴 */
    let k=S.p.length-1;while(k>1&&Math.abs(1-S.p[k-1])<.015)k--;S.dur=Math.round(S.dur*k/(S.p.length-1));S.p=S.p.slice(0,k+1);S.p[k]=1}
  const n=S.p.length,o={duration:S.dur,fill:"both",direction:reverse?"reverse":"normal"};
  const clip=p=>{const q=Math.max(0,p);return `inset(${(r.top*(1-q)).toFixed(1)}px ${((W-r.right)*(1-q)).toFixed(1)}px ${((H-r.bottom)*(1-q)).toFixed(1)}px ${(r.left*(1-q)).toFixed(1)}px round ${(26*(1-Math.min(1,q))).toFixed(1)}px)`};
  const kf=[],ki=[];
  S.p.forEach((p,i)=>{const off=i/(n-1);kf.push({offset:off,clipPath:clip(p)});ki.push({offset:off,transform:`translate(${(dx*(1-p)).toFixed(1)}px,${(dy*(1-p)).toFixed(1)}px) scale(${(.92+.08*p).toFixed(4)})`,opacity:Math.max(0,Math.min(1,p*1.5-.1))})});
  inner.style.transformOrigin="0 0";
  ov.querySelector(".td-bg").animate(kf,o);
  return inner.animate(ki,o).finished;
}
/* 卡片藏起來／換回來要「瞬間」：卡片本身的 opacity 有 CSS 過渡，直接改會慢慢淡入，今日層收掉後卡片晚一點才出現＝閃一下（2026-11-06 使用者回報） */
function tdCardShow(card,on){if(!card)return;card.style.transition="none";card.style.opacity=on?"":"0";void card.offsetWidth;card.style.transition=""}
function openToday(card){
  if(todayOpen)return;todayOpen=true;
  let ov=$("#todayOv");if(!ov){document.body.insertAdjacentHTML("beforeend",`<div class="td-ov" id="todayOv" role="dialog" aria-modal="true" aria-label="今日" hidden><div class="td-bg"></div><div class="td-scroll"></div></div>`);ov=$("#todayOv")}
  ov.getAnimations({subtree:true}).forEach(a=>a.cancel());
  ov.querySelector(".td-scroll").innerHTML=todayHTML();ov.querySelector(".td-scroll").scrollTop=0;ov.hidden=false;ov.classList.remove("off");Back.opened("today",i=>closeToday(i));ov._card=card;
  if(reduceMotion()||!card){ov.classList.add("on");return}
  tdCardShow(card,false);ov.classList.add("on");
  todayMorph(ov,card,false).then(()=>ov.getAnimations({subtree:true}).forEach(a=>a.cancel())).catch(()=>{});
}
function closeToday(instant){
  const ov=$("#todayOv");if(!ov||!todayOpen)return;todayOpen=false;Back.closed("today");
  const card=ov._card&&ov._card.isConnected?ov._card:$("#notiOv .nd-card.today"),done=()=>{ov.hidden=true;ov.classList.remove("on","off");ov.getAnimations({subtree:true}).forEach(a=>a.cancel());tdCardShow(card,true)};
  if(instant===true||reduceMotion()||!card){done();return}
  ov.getAnimations({subtree:true}).forEach(a=>a.cancel());ov.querySelector(".td-scroll").scrollTo({top:0});
  tdCardShow(card,false);   /* 倒放期間卡片藏著（底板縮回卡片的位置與圓角，播完換回卡片，看起來就是同一張） */
  todayMorph(ov,card,true).then(done).catch(done);
}
function renderNoti(){
  const el=$("#notiOv .noti-inner");if(!el||!notiOpen)return;
  const snap=Anim.capture();el.innerHTML=notiInner();Anim.play(snap);flowWatch();dkBind();notiSearch();
}

/* ---------- 常駐搜尋欄（毛玻璃膠囊，貼在通知層最上面） ----------
   搜尋事件名稱、地點、所屬即時回報（全會再加部門名）；包含過去的事件。結果即時列在下面，點一筆＝月曆跳到那天閃兩下 */
const hl=(s,q)=>{const t=String(s);if(!q)return esc(t);const i=t.toLowerCase().indexOf(q.toLowerCase());return i<0?esc(t):esc(t.slice(0,i))+`<mark>${esc(t.slice(i,i+q.length))}</mark>`+esc(t.slice(i+q.length))};
function notiSearch(){
  const box=$("#notiRes");if(!box)return;const q=NOTI.q.trim();
  $("#notiOv .noti-search").classList.toggle("has-q",!!NOTI.q);
  if(!q){resBox(false);return}
  const ql=q.toLowerCase(),xs=notiList().filter(x=>[x.title,x.place,x.ev,NOTI.scope==="all"?deptName(x.dept):""].join(" ").toLowerCase().includes(ql)).slice(0,30);
  box.innerHTML=xs.map(x=>`<button type="button" class="nr" data-nd="${x.date}" data-ne="${x.end||""}" style="--c:${itemColor(x)}"><span class="nr-when num">${nmd(x.date)}${x.end?`–${nmd(x.end)}`:""}${x.time?` ${x.time}`:""}</span><span class="nr-main"><b>${hl(x.title,q)}</b>${notiSub(x)?`<small>${hl(notiSub(x),q)}</small>`:""}</span></button>`).join("")||`<p class="nr-none">找不到「${esc(q)}」</p>`;
  resBox(true);
}
/* 結果框的顯示／隱藏（打字很快時不會被還沒播完的隱藏動畫蓋掉） */
function resBox(on){
  const box=$("#notiRes");if(!box||!!box._on===on)return;box._on=on;
  box.getAnimations().forEach(a=>a.cancel());
  if(on){box.hidden=false;Anim.enter(box,"down");return}
  if(reduceMotion()){box.hidden=true;return}
  const a=box.animate([{opacity:1},{opacity:0}],{duration:MO.fast,easing:MO.in,fill:"forwards"});
  a.finished.then(()=>{if(!box._on){box.hidden=true;a.cancel()}}).catch(()=>{});
}
const searchClose=()=>resBox(false);

/* ---------- 開關 ---------- */
function openNoti(){
  let ov=$("#notiOv");
  if(!ov){document.body.insertAdjacentHTML("beforeend",`<div class="set-ov noti-ov" id="notiOv" role="dialog" aria-modal="true" aria-label="通知" hidden>
      <div class="anim-top"><div class="anim-title"><span class="anim-k">NOTICE</span><b>通知與行事曆</b></div><div class="anim-ctl"><button type="button" id="notiClose" aria-label="關閉通知">${ico("close")}關閉</button></div></div>
      <div class="set-body"><div class="set-scroll"><div class="noti-bar"><div class="noti-seg lseg" role="tablist" aria-label="範圍"><span class="lseg-lens" aria-hidden="true"></span>${[["mine",CFG.dept.name||"本部門"],["all","全會"]].map(([k,t])=>`<button type="button" role="tab" data-k="${k}" aria-selected="${NOTI.scope===k}">${esc(t)}</button>`).join("")}</div>
        <div class="noti-find"><label class="noti-search"><svg class="ns-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.6 15.6 4.4 4.4"/></svg><input id="notiQ" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="搜尋事件、地點、即時回報" aria-label="搜尋事件" aria-controls="notiRes"><button type="button" class="nq-clear" aria-label="清除搜尋">${ico("close")}</button></label>
        <div class="noti-res glass" id="notiRes" role="listbox" aria-label="搜尋結果" hidden></div></div></div><div class="noti-inner" data-flow></div></div></div></div>`);ov=$("#notiOv");
    /* 本部門／全會：液態分段切換（anim.js 的 LiquidSeg，跟底部工具列同一套）。放在 .noti-inner 外面，重畫內容時不會被換掉、動畫不會被打斷 */
    notiSeg=new LiquidSeg(ov.querySelector(".noti-seg"),{onPick:k=>{NOTI.scope=k;NOTI.day=null;if(k==="all"&&!NOTI.all)notiLoadAll();else renderNoti()}});
    glassify(ov.querySelector(".noti-search"));
    const q=ov.querySelector("#notiQ");
    q.addEventListener("input",()=>{NOTI.q=q.value;notiSearch()});
    q.addEventListener("focus",()=>{if(NOTI.q.trim())notiSearch()});
    q.addEventListener("keydown",e=>{if(e.key==="Escape"&&q.value){e.preventDefault();e.stopPropagation();q.value=NOTI.q="";notiSearch()}else if(e.key==="Enter"){e.preventDefault();const f=$("#notiRes .nr");if(f)f.click()}});
    ov.querySelector(".nq-clear").addEventListener("click",()=>{q.value=NOTI.q="";notiSearch();q.focus()});
    elastic(ov.querySelector(".set-scroll"),ov.querySelector(".noti-inner"))}
  if(notiOpen)return;
  if(setOpen)closeSettings(true);
  const from=pageUnder(ov);PageFx.settle(ov);
  notiOpen=true;NOTI.month=today().slice(0,7);NOTI.day=null;NOTI.q="";ov.querySelector("#notiQ").value="";$("#notiRes").hidden=true;$("#notiRes")._on=false;
  ov.getAnimations().forEach(a=>a.cancel());ov.hidden=false;Back.layers.noti();document.body.classList.add("set-open");
  renderNoti();requestAnimationFrame(()=>notiSeg.set(NOTI.scope,true));PageFx.swap(from,ov);   /* 換頁動畫 */
  if(NOTI.scope==="all")notiLoadAll();
}
function closeNoti(instant){
  const ov=$("#notiOv");if(!ov||!notiOpen)return;
  if(todayOpen)closeToday(true);notiOpen=false;Back.closed("noti");
  const done=()=>{if(!notiOpen){ov.hidden=true;ov.getAnimations().forEach(a=>a.cancel());if(!setOpen)document.body.classList.remove("set-open")}};
  if(instant){PageFx.settle(ov);return done()}
  PageFx.swap(ov,pageUnder(ov),{done});   /* 換頁動畫：通知往後退、底下那頁從後面浮上來 */
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
/* 打開某一天（今日／明日卡片）：月曆換到那個月、清單只留那天、捲到那天（跟點日期一樣） */
function notiOpenDay(d){
  NOTI.day=d;NOTI.month=d.slice(0,7);renderNoti();
  const v=$("#notiDay");if(v){Anim.enter(v,"down");v.scrollIntoView({block:"start",behavior:reduceMotion()?"auto":"smooth"})}
}
/* 今日／明日卡片的按壓回饋：按下微縮到 .97、放開略帶回彈地彈回（只動 transform） */
function ndPress(el,down){
  if(!el||reduceMotion())return;
  const cur=getComputedStyle(el).transform;el._pa&&el._pa.cancel();
  el._pa=el.animate([{transform:cur==="none"?"scale(1)":cur},{transform:down?"scale(.97)":"scale(1)"}],down?{duration:140,easing:MO.out,fill:"forwards"}:{duration:520,easing:"cubic-bezier(.3,1.6,.5,1)",fill:"forwards"});
  if(!down){const a=el._pa;a.finished.then(()=>{if(el._pa===a){a.cancel();el._pa=null}}).catch(()=>{})}
}
document.addEventListener("pointerdown",e=>{const c=e.target.closest&&e.target.closest(".nd-card");if(!c||e.button>0)return;ndPress(c,true);
  const up=()=>{ndPress(c,false);removeEventListener("pointerup",up);removeEventListener("pointercancel",up)};addEventListener("pointerup",up);addEventListener("pointercancel",up)});
document.addEventListener("click",e=>{
  const t=e.target;if(!t.closest)return;
  if(t.closest("#notiBtn")){notiOpen?closeNoti():openNoti();return}
  if(!notiOpen||!t.closest("#notiOv"))return;
  if(!t.closest(".noti-find"))searchClose();
  if(t.closest("#notiClose")){closeNoti();return}
  const nr=t.closest(".nr");if(nr){searchClose();$("#notiQ").blur();notiFocus(nr.dataset.nd,nr.dataset.ne);return}
  const card=t.closest(".nd-card");if(card){const d=card.dataset.nopen;if(card.classList.contains("today")){setTimeout(()=>{if(notiOpen)openToday(card)},reduceMotion()?0:140);return}setTimeout(()=>{if(notiOpen)notiOpenDay(d)},reduceMotion()?0:200);return}   /* 等回彈跑一段再換內容，按壓動畫不會被重畫打斷 */
  const mo=t.closest("[data-nmon]");if(mo){const k=+mo.dataset.nmon,d=pd(NOTI.month+"-01");if(k)d.setMonth(d.getMonth()+k);const nm=k?ym(d):today().slice(0,7);if(nm===NOTI.month)return;
    NOTI.day=null;notiMonth(nm,k<0?-1:1);return}
  if(t.closest("[data-nday]")){NOTI.day=null;renderNoti();return}
  const cd=t.closest("[data-cal]");if(cd){const d=cd.dataset.cal,was=NOTI.day;NOTI.day=was===d?null:d;renderNoti();const v=$("#notiDay");if(v&&!was)Anim.enter(v,"down");return}   /* 點日期：上方出現「這一天」；再點一次收起 */
  const g=t.closest("[data-dkgo]");if(g){const c=$('#notiDeck .dk-card[data-i="0"]');if(c)dkFly(c,g.dataset.dkgo);return}
  if(t.closest("[data-dkundo]")){triUndo();return}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&notiOpen&&!$("#dlg").open&&!setOpen){e.preventDefault();closeNoti()}});


document.addEventListener("click",e=>{if(e.target.closest&&e.target.closest("[data-tdclose]"))closeToday()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&todayOpen){e.preventDefault();e.stopImmediatePropagation();closeToday()}},true);
