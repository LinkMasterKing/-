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
  return `<button type="button" class="nd-card${cls?" "+cls:""}" data-nopen="${d}" aria-label="${lab} ${fmt(d)}，${xs.length} 件事，打開這一天">
    <span class="nd-head"><span class="nd-num num">${+d.slice(8)}</span><span class="nd-lab"><b>${lab}<i>・</i>週${WD[pd(d).getDay()]}</b><small class="num">${xs.length?`${xs.length} 件`:nmd(d)}</small></span></span>
    ${xs.length?`<span class="nd-list">${xs.slice(0,MAX).map(x=>`<span class="nd-row" style="--c:${itemColor(x)}"><span class="nd-t num">${dayWhen(x,d)}</span><span class="nd-x"><b>${esc(x.title)}</b>${notiSub(x)?`<small>${esc(notiSub(x))}</small>`:""}</span></span>`).join("")}${xs.length>MAX?`<span class="nd-more">還有 ${xs.length-MAX} 件</span>`:""}</span>`
      :`<span class="nd-empty"><i aria-hidden="true"></i>沒有安排</span>`}
  </button>`;
}

/* ---------- 近期：智慧堆疊（今天之後的時間標記，長條卡片） ----------
   一次只完整顯示一張；上下滑跟手指走、放開吸附（兩端橡皮筋），左右滑也能換；換張時目前那張往上（下）移出並縮小變淡、下一張從另一邊進來；
   上下各露出一點點「疊在後面」的卡片邊（.ns-peek）；右邊直立頁碼點，操作或換張時浮出、停 1.5 秒淡掉；
   沒在操作時每 5.6 秒自動換下一張（到最後一張接回第一張），碰到就暫停、放開 4 秒後繼續；減少動態時不輪播、切換沒有位移。
   只動 transform／opacity；彈簧用 nav.js 的 spring／sprStep。 */
const NS={key:null,p:null,wrap:false,n:0,raf:0,last:0,drag:null,auto:0,hold:0,dotsT:0,el:null};
const NS_MAX=10,NS_AUTO=5600,NS_HOLD=4000;
const nsUpcoming=list=>{const t=today();return list.filter(x=>x.date>t).slice(0,NS_MAX)};
function stackHTML(list){
  const up=nsUpcoming(list);
  if(!up.length)return `<div class="nstack is-empty"><p class="ns-empty">接下來還沒有記錄的時間</p></div>`;
  return `<div class="nstack" style="--n:${up.length}" role="group" aria-roledescription="輪播" aria-label="近期事件，共 ${up.length} 件">
    <span class="ns-peek up" aria-hidden="true"></span><span class="ns-peek dn" aria-hidden="true"></span>
    <div class="ns-view">${up.map((x,i)=>`<div class="ns-card" data-i="${i}" data-nk="${esc(x.key)}" data-nd="${x.date}" data-ne="${x.end}" style="--c:${itemColor(x)}" role="button" tabindex="${i?-1:0}" aria-label="${nmd(x.date)} ${esc(x.title)}">
      <span class="ns-date"><b class="num">${+x.date.slice(8)}</b><small>${+x.date.slice(5,7)} 月・週${WD[pd(x.date).getDay()]}</small></span>
      <span class="ns-main"><b><i class="ns-dot" aria-hidden="true"></i>${esc(x.title)}</b><small>${esc([x.time,x.end?`到 ${nmd(x.end)}`:"",notiSub(x)].filter(Boolean).join("・"))}</small></span></div>`).join("")}</div>
    ${up.length>1?`<span class="ns-dots" aria-hidden="true">${up.map(()=>"<i></i>").join("")}</span>`:""}</div>`;
}
const nsCur=()=>NS.n&&NS.p?((Math.round(NS.p.t)%NS.n)+NS.n)%NS.n:0;
/* 重畫後接回新的卡片（保留原本看的那一張） */
function nsMount(){
  if(!NS.p)NS.p=spring(0,.86,260);   /* spring 在 nav.js（比這個檔晚載入），用到時才建立 */
  cancelAnimationFrame(NS.raf);NS.raf=0;
  const st=$("#notiOv .nstack:not(.is-empty)");NS.el=st;
  if(!st){NS.n=0;nsAuto();return}
  const cards=[...st.querySelectorAll(".ns-card")];NS.n=cards.length;
  let i=NS.key?cards.findIndex(c=>c.dataset.nk===NS.key):0;if(i<0)i=Math.min(nsCur(),NS.n-1);
  NS.wrap=false;sprSnap(NS.p,i);nsPaint();nsBind(st);nsAuto();
}
/* 每一張的位置：d＝跟目前位置差幾張（可以有小數）；|d|≥1.5 的不畫 */
function nsPaint(){
  const st=NS.el;if(!st||!st.isConnected)return;
  const cards=st.querySelectorAll(".ns-card"),n=NS.n,p=NS.p.x,rm=reduceMotion();
  cards.forEach((c,i)=>{let d=i-p;if(NS.wrap&&d<-n/2)d+=n;
    const a=Math.min(1.5,Math.abs(d)),y=rm?0:d*104,sc=1-.08*Math.min(1,a),op=rm?(a<.5?1:0):Math.max(0,1-a*.85);
    c.style.transform=`translate3d(0,${y.toFixed(2)}%,0) scale(${sc.toFixed(4)})`;c.style.opacity=op.toFixed(3);c.style.visibility=a>=1.5?"hidden":"";c.style.zIndex=a<.5?2:1});
  const k=nsCur(),dots=st.querySelectorAll(".ns-dots i");dots.forEach((x,j)=>x.classList.toggle("on",j===k));
  st.classList.toggle("has-prev",k>0||n>1&&NS.wrap);st.classList.toggle("has-next",k<n-1);
  const ck=cards[k];if(ck&&NS.key!==ck.dataset.nk){NS.key=ck.dataset.nk;cards.forEach((c,j)=>c.tabIndex=j===k?0:-1)}
}
function nsLoop(now){
  const dt=Math.min(1/30,Math.max(1/240,(now-(NS.last||now))/1000||1/60));NS.last=now;
  if(!NS.drag)sprStep(NS.p,dt);nsPaint();
  if(NS.drag||!sprDone(NS.p,.0008)){NS.raf=requestAnimationFrame(nsLoop);return}
  sprSnap(NS.p,NS.p.t);
  if(NS.wrap||NS.p.x>=NS.n||NS.p.x<0){NS.wrap=false;sprSnap(NS.p,((Math.round(NS.p.x)%NS.n)+NS.n)%NS.n)}   /* 輪播接回第一張：落定後換回 0 */
  nsPaint();NS.raf=0;NS.last=0;
}
const nsKick=()=>{if(!NS.raf){NS.last=0;NS.raf=requestAnimationFrame(nsLoop)}};
function nsGo(to,{wrap=false}={}){
  if(!NS.n)return;NS.wrap=wrap;NS.p.t=to;nsDots();
  if(reduceMotion()){sprSnap(NS.p,to);nsLoop(performance.now());return}
  nsKick();
}
/* 頁碼點：操作或換張時浮出，停下約 1.5 秒後淡掉 */
function nsDots(){const st=NS.el;if(!st)return;st.classList.add("dots-on");clearTimeout(NS.dotsT);NS.dotsT=setTimeout(()=>st.classList.remove("dots-on"),1500)}
/* 自動輪播：通知層開著、分頁在前景、沒在操作、不是減少動態才跑 */
function nsAuto(){
  clearTimeout(NS.auto);
  if(!notiOpen||NS.n<2||reduceMotion())return;
  NS.auto=setTimeout(()=>{
    if(!notiOpen||!NS.el||!NS.el.isConnected)return;
    if(document.hidden||NS.drag||Date.now()<NS.hold||NS.raf){nsAuto();return}
    const k=nsCur();k>=NS.n-1?nsGo(NS.n,{wrap:true}):nsGo(k+1);nsAuto();
  },NS_AUTO);
}
const nsHold=()=>{NS.hold=Date.now()+NS_HOLD;nsAuto()};
/* 兩端的橡皮筋（iOS 的公式：越拉越緊，最多約 0.35 張） */
const nsRub=x=>(1-1/(x*.55/.35+1))*.35;
function nsBind(st){
  if(st._ns)return;st._ns=true;
  const view=st.querySelector(".ns-view");
  /* 外層捲動區的拉到底回彈（nav.js 的 elastic）不要接到這裡的手勢 */
  ["touchstart","touchmove"].forEach(t=>st.addEventListener(t,e=>e.stopPropagation(),{passive:true}));
  st.addEventListener("pointerdown",e=>{
    if(e.button>0||NS.drag||!NS.n)return;
    const H=view.offsetHeight||1,k=nsCur();
    if(NS.wrap){NS.wrap=false;sprSnap(NS.p,k)}else sprSnap(NS.p,NS.p.x);
    NS.drag={id:e.pointerId,x:e.clientX,y:e.clientY,p0:NS.p.x,H,axis:"",v:0,lp:NS.p.x,lt:performance.now(),moved:false};
    try{st.setPointerCapture(e.pointerId)}catch(_){}
    clearTimeout(NS.auto);nsDots();
  });
  st.addEventListener("pointermove",e=>{
    const d=NS.drag;if(!d||e.pointerId!==d.id)return;
    const dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.axis){if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;d.axis=Math.abs(dy)>=Math.abs(dx)?"y":"x";d.moved=true}
    if(d.axis!=="y")return;
    const raw=d.p0-dy/d.H,n=NS.n,p=raw<0?-nsRub(-raw):raw>n-1?n-1+nsRub(raw-(n-1)):raw;
    const now=performance.now(),dt=Math.max(8,now-d.lt)/1000;d.v=(p-d.lp)/dt;d.lp=p;d.lt=now;
    sprSnap(NS.p,p);nsKick();nsDots();
  });
  const end=e=>{
    const d=NS.drag;if(!d||(e&&e.pointerId!==d.id))return;NS.drag=null;
    const k=Math.round(d.p0);let to=k;
    if(d.axis==="y"){to=Math.round(NS.p.x+Math.max(-.6,Math.min(.6,d.v*.12)));to=Math.max(k-1,Math.min(k+1,to))}
    else if(d.axis==="x"){const dx=(e?e.clientX:d.x)-d.x;if(Math.abs(dx)>36)to=k+(dx<0?1:-1)}
    to=Math.max(0,Math.min(NS.n-1,to));NS.p.v=d.axis==="y"?d.v:0;nsGo(to);nsHold();
    if(!d.moved&&e&&e.type==="pointerup"){const c=e.target.closest&&e.target.closest(".ns-card");if(c)notiFocus(c.dataset.nd,c.dataset.ne)}   /* 點一下＝月曆捲到那天閃兩下 */
  };
  st.addEventListener("pointerup",end);st.addEventListener("pointercancel",end);
  st.addEventListener("lostpointercapture",()=>{if(NS.drag)end()});
  st.addEventListener("wheel",e=>{if(Math.abs(e.deltaY)<8||NS.raf)return;e.preventDefault();const k=nsCur(),to=Math.max(0,Math.min(NS.n-1,k+(e.deltaY>0?1:-1)));if(to!==k){nsGo(to);nsHold()}},{passive:false});
  st.addEventListener("keydown",e=>{
    const c=e.target.closest(".ns-card");if(!c)return;
    if(e.key==="Enter"||e.key===" "){e.preventDefault();notiFocus(c.dataset.nd,c.dataset.ne);return}
    const dir={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1}[e.key];if(!dir)return;e.preventDefault();
    const to=Math.max(0,Math.min(NS.n-1,nsCur()+dir));nsGo(to);nsHold();setTimeout(()=>{const x=st.querySelectorAll(".ns-card")[to];x&&x.focus({preventScroll:true})},0);
  });
}

/* ---------- 行事曆：事件清單＋海報月曆 ---------- */
function notiRowHTML(x){
  return `<button type="button" class="ni" data-fk="${esc(x.key)}" data-nd="${x.date}" data-ne="${x.end||""}" style="--c:${itemColor(x)}">
    <span class="ni-bar" aria-hidden="true"></span>
    <span class="ni-when num">${nmd(x.date)}${x.end?`–${nmd(x.end)}`:""}${x.time?`<small>${x.time}</small>`:""}</span>
    <span class="ni-main"><b>${esc(x.title)}</b>${[x.place,x.ev].filter(Boolean).length?`<small>${esc([x.place,x.ev].filter(Boolean).join("・"))}</small>`:""}</span>
    ${NOTI.scope==="all"?`<span class="tag sm ni-dept">${esc(deptName(x.dept))}</span>`:""}</button>`;
}
/* 海報月曆：超大月份縮寫＋右上兩行年份；週一開頭；日期是數字（沒有格線）；
   時段＝細線橫跨期間（兩端小圓點）、名稱與日期寫在線下；單天的寫在日期下；同一週會撞在一起的往下排一層，那一週跟著變高 */
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
      const span=i1>i0,lbl=`${esc(x.title)}<small class="num">${x.end?`${nmd(x.date)}–${nmd(x.end)}`:x.time||""}</small>`;
      return `<button type="button" class="pc-e${span?" span":""}" data-nd="${x.date}" data-ne="${x.end||""}" style="--i0:${i0};--i1:${i1};--ln:${ln};--c:${all?deptColor(x.dept):"var(--ink)"}" aria-label="${esc(x.title)} ${nmd(x.date)}${x.end?`到 ${nmd(x.end)}`:""}">${span?`<span class="pc-line" aria-hidden="true"></span>`:""}<span class="pc-lbl">${lbl}</span></button>`}).join("");
    return `<div class="pc-week" style="--lanes:${lanes.length}">${nums}${evs}</div>`}).join("");
  return `<div class="pc-head" aria-hidden="true"><b class="pc-mon">${MON_EN[mi]}</b><span class="pc-yr num">${String(y).slice(0,2)}<br>${String(y).slice(2)}</span></div>
    <div class="pc-wk" aria-hidden="true">${["MON","TUE","WED","THU","FRI","SAT","SUN"].map(x=>`<span>${x}</span>`).join("")}</div>
    <div class="pc-body" role="group" aria-label="${y} 年 ${mi+1} 月">${body}</div>
    <p class="pc-foot">${all?"全會":esc(CFG.dept.name||"本部門")}・學生會</p>`;
}
function notiInner(){
  const list=notiList(),t=today(),m=NOTI.month,all=NOTI.scope==="all";
  const evs=NOTI.day?list.filter(x=>covers(x,NOTI.day)):list.filter(x=>x.date.slice(0,7)<=m&&(x.end||x.date).slice(0,7)>=m);
  const legend=all
    ?(window.BOARD_DEPTS||[]).map(d=>`<span><i style="--c:${deptColor(d.id)}"></i>${esc(d.name)}</span>`).join("")
    :Object.entries(NOTI_ST).map(([k,c])=>`<span><i style="--c:${c}"></i>${EV_ST[k]}</span>`).join("");
  return `${all?`<p class="sub noti-note">${NOTI.loading?"讀取各部門資料中…":"全會：讀各部門的資料檔，只能看、不能改。"}</p>`:""}
    <div class="noti-days">${dayCardHTML(t,"今日","today",list)}${dayCardHTML(addDays(t,1),"明日","",list)}</div>
    <section class="noti-up"><h3 class="noti-h"><b>近期</b><span>今天之後的時間・上下滑換一張</span></h3>${stackHTML(list)}</section>
    <section class="noti-cal">
      <div class="cal-top"><h3 class="noti-h"><b>行事曆</b></h3><button type="button" class="icon" data-nmon="-1" aria-label="上個月">${ico("prev","solo")}</button><button type="button" class="icon" data-nmon="1" aria-label="下個月">${ico("next","solo")}</button>
        ${NOTI.day?`<button type="button" class="icon" data-nday="">只看 ${nmd(NOTI.day)} · 取消</button>`:`<button type="button" class="icon" data-nmon="0">回到本月</button>`}</div>
      <div class="noti-list" data-flip="list" data-flow>${evs.map(notiRowHTML).join("")||`<p class="sub noti-none">${NOTI.day?"這天沒有事件":"這個月沒有事件"}</p>`}</div>
      <div class="pc" id="notiCal">${posterHTML(list)}</div>
      <div class="cal-legend">${legend}</div>
    </section>`;
}
function renderNoti(){
  const el=$("#notiOv .noti-inner");if(!el||!notiOpen)return;
  const snap=Anim.capture();el.innerHTML=notiInner();Anim.play(snap);flowWatch();nsMount();notiSearch();
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
  notiOpen=false;Back.closed("noti");clearTimeout(NS.auto);
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
  const c=document.querySelector(`#notiCal [data-cal="${d}"]`);if(c)c.scrollIntoView({block:"center",behavior:reduceMotion()?"auto":"smooth"});
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
  const card=t.closest(".nd-card");if(card){const d=card.dataset.nopen;setTimeout(()=>{if(notiOpen)notiOpenDay(d)},reduceMotion()?0:200);return}   /* 等回彈跑一段再換內容，按壓動畫不會被重畫打斷 */
  const mo=t.closest("[data-nmon]");if(mo){const k=+mo.dataset.nmon,d=pd(NOTI.month+"-01");if(k)d.setMonth(d.getMonth()+k);const nm=k?ym(d):today().slice(0,7);if(nm===NOTI.month)return;
    NOTI.day=null;notiMonth(nm,k<0?-1:1);return}
  if(t.closest("[data-nday]")){NOTI.day=null;renderNoti();return}
  const cd=t.closest("[data-cal]");if(cd){const d=cd.dataset.cal;NOTI.day=NOTI.day===d?null:d;renderNoti();return}
  const pe=t.closest(".pc-e");if(pe){notiFocus(pe.dataset.nd,pe.dataset.ne);return}
  const ni=t.closest(".ni");if(ni){notiFocus(ni.dataset.nd,ni.dataset.ne);return}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&notiOpen&&!$("#dlg").open&&!setOpen){e.preventDefault();closeNoti()}});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&notiOpen)nsAuto()});
