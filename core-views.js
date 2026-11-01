/* 核心｜各區塊畫面：頁首、週報、甘特圖、議題卡片、即時回報、完成紀錄 */
function renderHeader(){
  {const ts=$("#titleSlot"),h=`<h1>${esc(state.title)}</h1>`;if(ts._h!==h){ts._h=h;ts.innerHTML=h}}
  document.title=state.title;renderHero();
  $("#saveInfo").textContent=readOnly()?`更新於 ${fmt(state.savedAt)||"—"}`
    :(state.savedAt?`上次儲存 ${state.savedAt}${state.savedBy?`（${state.savedBy}）`:""}`:"尚未儲存")+(cloudOn()?` · ${({ok:"雲端已同步",empty:"雲端尚無資料，儲存後建立",offline:"離線中",limited:"GitHub 讀取次數暫時用完",error:"雲端讀取失敗"})[cloud.status]||"連線雲端中…"}${cloudOn()&&!ghToken()&&editing?"（此裝置未設定權杖，無法上傳）":""}`:"")+(localOK?"":" · 這個瀏覽器無法本機保存，請用「匯出備份」");
  offlinePill();
  {const bb=document.querySelector(".banner b");if(bb)bb.textContent=editing&&meName()?`編輯中 · ${meName()}`:"編輯中"}
  /* 頁首按鈕：平常是「動畫、編輯」，編輯中換成「取消、儲存」；內容沒變就不重畫（icon 動畫才不會被打斷） */
  const A=$("#actions"),h=editing
    ?`<button type="button" id="cancelBtn">取消</button><button type="button" class="primary" id="saveBtn">${cloudOn()?"儲存並同步":"儲存並定型"}</button>`
    :(CFG.sections.animation?`<button type="button" id="animBtn">${ico("play")}總結</button>`:"")+(readOnly()?"":`<button type="button" id="editBtn">${ico("edit")}編輯</button>`);
  if(A._h!==h){A._h=h;A.innerHTML=h}
}

function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y)/864e5+1)/7)}
function termWeek(d){if(!state.termStart)return 0;const diff=Math.floor((pd(ymd(d))-pd(state.termStart))/864e5);return diff<0?0:Math.floor(diff/7)+1}
/* 星期幾對齊大日期的「字形墨跡」中心，而不是文字框中心：數字左右留白不同（「1」左邊空很多），只靠框置中會偏 */
const _dowCtx=document.createElement("canvas").getContext("2d");
function alignDow(){
  const el=$("#bigDate"),r=el&&el.closest(".hero-r");if(!r||!el.textContent)return;
  const cs=getComputedStyle(el);
  _dowCtx.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;_dowCtx.letterSpacing=cs.letterSpacing;
  const m=_dowCtx.measureText(el.textContent),box=el.getBoundingClientRect().width;
  r.style.setProperty("--dow-dx",((m.actualBoundingBoxRight-m.actualBoundingBoxLeft)/2-box/2).toFixed(2)+"px");
}
if(document.fonts)document.fonts.ready.then(alignDow);
addEventListener("resize",()=>requestAnimationFrame(alignDow),{passive:true});

function renderHero(){
  const d=state.boardDate?pd(state.boardDate):state.savedAt?pd(state.savedAt.slice(0,10)):new Date();
  $("#yearTxt").textContent=state.yearLabel||"";
  const tw=termWeek(d);
  $("#weekPill").textContent=tw>0?"W"+pad(tw):"PRE";$("#weekZh").textContent=tw>0?`開學第${tw}週`:"開學前";
  $("#bigDate").textContent=`${d.getMonth()+1}.${pad(d.getDate())}`;
  $("#dowEn").textContent=["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()];
  $("#dowZh").textContent="日一二三四五六"[d.getDay()];
  alignDow();
  weekDotSync();

}

function renderWeeks(){
  const ws=[...state.weeks].sort((a,b)=>b.date.localeCompare(a.date));
  if(!openWeeks&&ws.length)openWeeks=new Set([ws[0].id]);
  const lines=t=>String(t||"").split("\n").map(l=>`<span class="wl">${l.trim()?esc(l):"&nbsp;"}</span>`).join("");
  $("#weekList").innerHTML=ws.map((w,k)=>`<details class="week ${w.id===newWeekId?"new":""}" data-week="${w.id}" ${openWeeks&&openWeeks.has(w.id)?"open":""}>
      <summary><span class="num">${fmt(w.date)}</span>${k===0?'<span class="badge">最新</span>':""}<button type="button" class="icon danger edit-only week-del" data-delweek aria-label="刪除 ${fmt(w.date)} 的週報">刪除</button></summary>
      <div class="week-tools"><button type="button" class="icon" data-copyweek>複製文字</button><button type="button" class="icon edit-only" data-editweek>${ico("edit")}編輯</button></div>
      <div class="week-text">${lines(w.text)}</div></details>`).join("")
    ||`<p class="empty">還沒有週報。${state.locked?"":"按「編輯」→「+ 新增週報」貼上本週文字。"}</p>`;
}

function renderGantt(){
  $("#rStart").value=state.range.start;$("#rEnd").value=state.range.end;
  const ms=months(),tp=pos(today()),[s0,e0]=rangeMs(),inRange=Date.now()>s0&&Date.now()<e0;
  const list=activeIssues().filter(hasDates);
  const narrow=innerWidth<640,nameW=narrow?104:170;const width=Math.max(narrow?360:640,ms.length*(narrow?84:130));
  /* 已經過去的時間：從時間軸起點到今天線整段淡淡打亮（今天在範圍之後＝整段，之前＝沒有） */
  const pastW=Date.now()>=e0?100:inRange?tp:0,past=pastW?`<span class="g-past" style="width:${pastW}%" aria-hidden="true"></span>`:"";
  const grid=past+ms.map(m=>`<span class="vgrid" style="left:${pos(ymd(m))}%"></span>`).join("")+(inRange?`<span class="today" style="left:${tp}%" title="今天"></span>`:"");
  let h=`<div style="min-width:${width+nameW}px"><div class="g-row"><div class="g-name sub" style="font-weight:400">議題</div><div class="g-axis">${past}${inRange?`<span class="today-tag" style="left:${tp}%"><i class="live-dot" aria-hidden="true"></i>今天 ${fmt(today()).slice(5)}</span>`:""}${ms.map((m,k)=>`<span style="left:${pos(ymd(m))}%">${k===0||m.getMonth()===0?m.getFullYear()+"/":""}${m.getMonth()+1}月</span>`).join("")}</div></div>`;
  h+=list.map(it=>{
    let s=it.start,e=it.end;if(e<s)[s,e]=[e,s];
    const l=pos(s),w=Math.max(.8,pos(e)-l);
    const gL=latestMarkerId(it.markers.filter(m=>m.date));const mk=it.markers.filter(m=>m.date).map(m=>{const p=pos(m.date);return `<span class="g-mk ${p<6?"edgeL":p>94?"edgeR":""} ${m.id!==gL?"quiet":""}" style="left:${p}%;--mc:${esc(m.color||MARK_COLORS[0])}" title="${esc(fmt(m.date))} ${m.stage?"【"+esc(m.stage)+"】":""}${esc(m.text)}"><span class="stem"></span><span class="dot"></span><span class="lbl">${esc(m.text)}</span></span>`}).join("");
    const sp=schedPct(it);
    return `<div class="g-row g-issue" data-jump="${it.id}" title="點一下跳到「${esc(it.title)}」"><div class="g-name"><a href="#card-${it.id}" data-jump="${it.id}">${esc(it.title)}</a><span class="sub" style="font-size:11.5px">${fmt(s).slice(5)} – ${fmt(e).slice(5)}</span></div>
      <div class="g-track">${grid}<div class="g-bar" style="left:${l}%;width:${w}%"><div class="fill" style="width:${sp}%"></div></div><span class="g-pct num" style="left:${l+w}%">${sp}%</span>${mk}</div></div>`;
  }).join("");
  h+="</div>";
  if(!list.length)h+=`<p class="empty">還沒有排定時間的議題。${state.locked?"":"在下方個別進度裡填入開始日與結束日，就會出現在這裡。"}</p>`;
  $("#gantt").innerHTML=h;
}

function tagsHTML(it){
  return it.tags.map((g,k)=>{
    const cls=k===it.cur?"cur":k<it.cur?"past":"";
    return editing
      ?`<button type="button" class="tag ${cls}" data-tag="${k}" title="點選設為目前階段，雙擊改名">${esc(g)}<span class="tag-x" data-deltag="${k}" aria-label="刪除標籤 ${esc(g)}">×</span></button>`
      :`<span class="tag ${cls}">${esc(g)}</span>`;
  }).join("")+(editing?'<button type="button" class="tag" data-addtag>+ 標籤</button>':"");
}
function linkHTML(l,iid){
  return editing
    ?`<a href="#" class="link" style="background:${esc(l.color)}" data-editlink="${l.id}" data-iid="${iid}">${esc(l.name)}${ico("edit","sm")}</a>`
    :`<a class="link" style="background:${esc(l.color)}" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.name)}</a>`;
}
function latestMarkerId(list){
  const dated=list.filter(m=>m.date).sort((a,b)=>a.date.localeCompare(b.date)||a.at-b.at);
  const pick=dated.length?dated[dated.length-1]:[...list].sort((a,b)=>a.at-b.at).pop();
  return pick&&pick.id;
}
function markerHTML(m,latest,it){
  const at=mkAt(it,m),edge=at<18?"edgeL":at>82?"edgeR":"";
  return `<div class="marker ${m.pos==="down"?"down":"up"} ${edge} ${latest&&m.id!==latest?"quiet":""}" style="left:${at}%;--mc:${esc(m.color||MARK_COLORS[0])}" data-marker="${m.id}" title="${m.date?esc(fmt(m.date))+" ":""}${esc(m.text)}"><span class="stem"></span><span class="dot"></span><span class="lbl">${m.date?`<span class="num">${fmt(m.date).slice(5)}</span> `:""}${esc(m.text)}</span></div>`;
}

const sortedMarkers=it=>[...it.markers].sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999")||a.at-b.at);
function logHTML(it){
  const ms=sortedMarkers(it);if(!ms.length)return "";
  return `<details class="log" open><summary>處理紀錄<span class="count">${ms.length}</span></summary><ol>${ms.map(m=>`<li><span class="log-dot" style="background:${esc(m.color||MARK_COLORS[0])}"></span><span class="num log-d">${m.date?fmt(m.date):"—"}</span>${m.stage?`<span class="tag cur sm">${esc(m.stage)}</span>`:""}<span>${esc(m.text)}</span>${m.evId?`<span class="sub" title="來自即時回報">（即時回報）</span>`:""}${editing?`<button type="button" class="icon" data-logmk="${m.id}" aria-label="編輯這筆註記">${ico("edit","solo")}</button>`:""}</li>`).join("")}</ol></details>`;
}

/* stack marker labels into lanes so many markers never overlap */
const LH=22;
function layoutTrack(tr){
  const isG=tr.classList.contains("g-track"),W=tr.clientWidth;if(!W)return;
  const barH=isG?14:16,dotH=isG?8:10;
  const lanes={up:[],down:[]},info=[];
  [...tr.querySelectorAll(isG?".g-mk":".marker")].sort((a,b)=>parseFloat(a.style.left)-parseFloat(b.style.left)).forEach(m=>{
    const side=!isG&&m.classList.contains("down")?"down":"up";
    const lbl=m.querySelector(".lbl"),w=lbl.offsetWidth,x=parseFloat(m.style.left)/100*W;
    const s=m.classList.contains("edgeL")?x-(isG?8:10):m.classList.contains("edgeR")?x-w+(isG?8:10):x-w/2;
    if(m.classList.contains("quiet")){info.push({m,lbl,side,k:0,quiet:true});return}
    const L=lanes[side];let k=L.findIndex(end=>end+6<=s);if(k<0){k=L.length;L.push(0)}L[k]=s+w;
    info.push({m,lbl,side,k});
  });
  const nUp=lanes.up.length,nDown=lanes.down.length;
  const barTop=(isG?6:8)+nUp*LH+(nUp?6:(isG?14:18));
  const below=barTop+barH+(isG?6:20);
  tr.querySelector(isG?".g-bar":".c-bar").style.top=barTop+"px";
  tr.querySelectorAll(".tick").forEach(t=>t.style.top=(barTop+barH+3)+"px");
  const pct=tr.querySelector(".g-pct");if(pct)pct.style.top=(barTop-3)+"px";
  info.forEach(({m,lbl,side,k})=>{
    const dot=m.querySelector(".dot"),stem=m.querySelector(".stem");
    dot.style.top=(barTop+barH/2-dotH/2)+"px";
    if(side==="up"){const top=barTop-6-(k+1)*LH+2;lbl.style.top=top+"px";stem.style.top=(top+18)+"px";stem.style.height=Math.max(0,barTop-top-18)+"px"}
    else{const top=below+k*LH;lbl.style.top=top+"px";stem.style.top=(barTop+barH)+"px";stem.style.height=Math.max(0,top-barTop-barH)+"px"}
  });
  tr.style.height=(nDown?below+nDown*LH+4:below+(isG?0:4))+"px";
}
const layoutAll=()=>document.querySelectorAll(".c-track,.g-track").forEach(layoutTrack);
let _rz;window.addEventListener("resize",()=>{clearTimeout(_rz);_rz=setTimeout(layoutAll,120)});
document.fonts?.ready.then(layoutAll);

/* 一張議題卡片；open＝展開內容，sel＝左右兩欄時清單裡選到的那列，pane＝畫在右側詳情（不帶 id，避免重複） */
function cardHTML(it,open,pane,sel){
  return `<article class="card ${it.doneAt?"closed":""} ${open?"open":""} ${sel?"sel":""} ${pane?"in-pane":""}" ${pane?"":`id="card-${it.id}"`} data-issue="${it.id}"${sel?' aria-current="true"':""}>
    <div class="card-top">
      <button type="button" class="card-toggle" data-toggle aria-expanded="${open}"><span class="card-title">${esc(it.title)}</span>${it.tags[it.cur]?`<span class="tag cur sm">${esc(it.tags[it.cur])}</span>`:""}${it.doneAt?'<span class="tag sm closed-tag">已結案</span>':""}<span class="hpct num${schedPct(it)==null?" none":""}" data-hpct title="時程：設定的期間已經過的比例">${schedPct(it)==null?"未排程":`<small>時程</small>${schedPct(it)}%`}</span><span class="chev-btn">${open?"收合":"展開"}<span class="chev" aria-hidden="true">▾</span></span></button>
      <div class="card-tools"><button type="button" class="icon" data-closeissue>${it.doneAt?"取消結案":"結案"}</button><button type="button" class="icon" data-move="-1" aria-label="往前移">↑</button><button type="button" class="icon" data-move="1" aria-label="往後移">↓</button><button type="button" class="icon danger" data-delissue aria-label="刪除議題「${esc(it.title)}」">刪除</button></div>
    </div>
    ${open?`
    ${editing?`<label class="sub" style="display:grid;gap:3px">議題名稱<input data-f="title" value="${esc(it.title)}"></label>`:""}
    <div class="meta"><span class="sub">${hasDates(it)?`${fmt(it.start)} – ${fmt(it.end)}`:"未排入甘特圖"}</span></div>
    <div class="tags">${tagsHTML(it)}</div>
    ${staffHTML(it.staff)}
    ${!editing&&it.note?`<p class="note"><span class="note-h">目前進度</span>${esc(it.note)}</p>`:""}
    <div class="c-track" data-track>
      <div class="c-bar"><div class="fill" style="width:${schedPct(it)||0}%"></div></div>
      ${hasDates(it)?issueSpan(it).map((d,k)=>`<span class="tick ${k?"tick-e":"tick-s"}" style="left:${k*100}%">${fmt(d).slice(5)}</span>`).join(""):`<span class="tick tick-hint" style="left:0">未排程：填開始日與結束日後，時程條才會照時間填色</span>`}
      ${(()=>{const L=latestMarkerId(it.markers);return it.markers.map(m=>markerHTML(m,L,it)).join("")})()}
    </div>
    <div class="edit-block">
      <label class="full">目前進度說明<textarea data-f="note" rows="3" placeholder="例如：已和總務處確認，等待書面回覆">${esc(it.note||"")}</textarea></label>
      <label>開始日<input type="date" data-f="start" value="${it.start}"></label>
      <label>結束日<input type="date" data-f="end" value="${it.end}"></label>
      <span class="hint full">兩個日期都填才會顯示在甘特圖；清空即從甘特圖移除。</span>
      <div class="full" style="display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap"><button type="button" data-addlink="${it.id}">+ 超連結按鈕</button><button type="button" class="ghost" data-editstaff>專員</button><button type="button" class="ghost" data-addmarker>+ 註記</button></div>
    </div>
    ${(()=>{const kids=state.events.filter(e=>!e.doneAt&&e.issueId===it.id);return kids.length?`<div class="kid-evs"><div class="att-h">進行中的即時回報</div><div class="kid-list">${kids.map(e=>`<span class="kid-ev" data-st="${evStatus(e)}"><span class="live-dot" aria-hidden="true"></span>${esc(e.name)}</span>`).join("")}</div></div>`:""})()}
    ${logHTML(it)}
    <div class="att"${!it.links.length?' hidden':""}>
      <div class="att-h">相關連結${editing?"（點按鈕可修改或刪除）":""}</div>
      <div class="links">${it.links.map(x=>linkHTML(x,it.id)).join("")}</div>
    </div>`:`<div class="mini-bar" data-toggle title="點一下展開"><div class="fill" style="width:${schedPct(it)||0}%"></div></div>`}
  </article>`;
}
/* 個別進度：一般是清單＋就地展開；桌面放大成全寬時（mdOn）改成左側清單、右側詳情 */
function renderCards(){
  const list=activeIssues(),md=mdOn("progress")&&list.length>0,pane=$("#cardDetail");mdLast.progress=mdOn("progress");
  $("#cardsMD").classList.toggle("split",md);
  if(md){
    if(!list.some(i=>i.id===selIssue))selIssue=list[0].id;
    $("#cards").innerHTML=list.map(it=>cardHTML(it,false,false,it.id===selIssue)).join("");
    pane.innerHTML=cardHTML(list.find(i=>i.id===selIssue),true,true,false);pane.hidden=false;
  }else{
    $("#cards").innerHTML=list.map(it=>cardHTML(it,openIds.has(it.id),false,false)).join("")
      ||`<p class="empty">${state.locked?"目前沒有進行中的議題。":"還沒有議題，按「編輯」→「+ 新增議題」開始。"}</p>`;
    pane.innerHTML="";pane.hidden=true;
  }
}

/* 即時回報的時間標記清單（即時回報區、完成紀錄共用）；edit＝顯示編輯鈕 */
function evTimesHTML(ev,edit){
  const par=parentOf(ev),ts=evTimesSorted(ev);if(!ts.length)return "";
  return `<ol class="ev-times">${ts.map(t=>{const x=evTimeText(t);return `<li><span class="num ev-t-when">${x.when}</span><span class="ev-t-label">${esc(t.label)}</span>${x.span?`<span class="sub num">${x.span}</span>`:""}${t.toIssue&&par?`<span class="sub" title="這筆也寫進母議題的處理紀錄">（母議題）</span>`:""}${edit?`<button type="button" class="icon" data-evtime="${t.id}" aria-label="編輯「${esc(t.label)}」">${ico("edit","solo")}</button>`:""}</li>`}).join("")}</ol>`;
}
/* 即時回報右側詳情（桌面、即時回報被選到時）：檢視時只看內容；編輯中所有功能都直接在這裡改，不另外跳視窗 */
function evDetailHTML(ev){
  const st=evStatus(ev),par=parentOf(ev),inp=(k,v,ph,type)=>`<input ${type?`type="${type}"`:""} data-tmf="${k}" value="${esc(v||"")}" ${ph?`placeholder="${esc(ph)}"`:""}>`;
  const head=`<div class="evd-head"><span class="live-dot" aria-hidden="true"></span><b>${esc(ev.name)}</b></div>
    <p class="ev-meta"><span class="ev-st">${EV_ST[st]}</span>${ev.round>1?`<span>第 ${ev.round} 段</span>`:""}${ev.touchedAt?`<span>最後更新 <span class="num">${fmt(ev.touchedAt).slice(5)} ${ev.touchedAt.slice(11,16)}</span></span>`:""}</p>`;
  if(!editing)return `<div class="evd" data-ev="${ev.id}" data-st="${st}">${head}
    ${par?`<p class="sub evd-par">母議題：${esc(par.title)}</p>`:""}
    ${ev.desc?`<p class="evd-desc">${esc(ev.desc)}</p>`:`<p class="sub">（沒有說明）</p>`}
    ${evTimesHTML(ev,false)}${staffHTML(ev.staff)}
    ${ev.links.length?`<div class="links ev-links">${ev.links.map(l=>`<a class="link" style="background:${esc(l.color)}" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join("")}</div>`:""}
    <p class="sub evd-hint">按「編輯」後可以直接在這裡修改。</p></div>`;
  const sp=x=>[(x||"").slice(0,10),(x||"").slice(11,16)];
  const opts=[["","（不連結）"],...state.issues.map(i=>[i.id,i.title+(i.doneAt?"（已結案）":"")])];
  return `<div class="evd editing" data-ev="${ev.id}" data-st="${st}">${head}
    <label class="evd-f">名稱<input data-evf="name" value="${esc(ev.name)}"></label>
    <label class="evd-f">說明<textarea data-evf="desc" rows="4" placeholder="簡短說明">${esc(ev.desc||"")}</textarea></label>
    ${fieldHTML({name:"evIssue",label:"母議題（完成時會自動寫進該議題的處理紀錄）",type:"select",value:ev.issueId||"",options:opts})}
    ${staffField(ev.staff).map(fieldHTML).join("")}
    <section class="evd-sec"><div class="att-h">時間標記<span class="sub">（只填日期＝一個日子；加時刻＝具體時間；填結束＝一段期間）</span></div>
      ${evTimesSorted(ev).map(t=>{const [sd,st2]=sp(t.start),[ed,et]=sp(t.end),x=evTimeText(t);return `<div class="evd-row" data-tm="${t.id}">
        ${inp("label",t.label,"這個時間是什麼")}<span class="evd-when">${inp("sd",sd,"","date")}${inp("st",st2,"時刻")}<span class="sub">～</span>${inp("ed",ed,"","date")}${inp("et",et,"時刻")}</span>
        <span class="sub num evd-span">${x.span}</span>${par?`<label class="fld-check"><input type="checkbox" data-tmf="toIssue" ${t.toIssue?"checked":""}><span>寫進母議題</span></label>`:""}
        <button type="button" class="icon danger" data-evd="deltime" aria-label="刪除「${esc(t.label)}」">刪除</button></div>`}).join("")}
      <button type="button" class="ghost evd-add" data-evd="addtime">${ico("calendar")}+ 時間</button></section>
    <section class="evd-sec"><div class="att-h">超連結</div>
      ${ev.links.map(l=>`<div class="evd-row evd-link" data-lk="${l.id}"><button type="button" class="evd-sw" style="background:${esc(l.color)}" data-evd="linkcolor" aria-label="換顏色"></button><input data-lkf="name" value="${esc(l.name)}" placeholder="按鈕名稱"><input data-lkf="url" value="${esc(l.url)}" placeholder="https://" inputmode="url"><button type="button" class="icon danger" data-evd="dellink" aria-label="刪除「${esc(l.name)}」">刪除</button></div>`).join("")}
      <button type="button" class="ghost evd-add" data-evd="addlink">+ 超連結</button></section>
    <section class="evd-sec evd-acts">
      <div class="evd-round" hidden><label class="evd-f">這一段完成了什麼（存進完成紀錄）<textarea data-rf="done" rows="3">${esc(ev.desc||"")}</textarea></label>
        <label class="evd-f">下一段要追蹤什麼（取代說明；留空就沿用）<textarea data-rf="next" rows="2" placeholder="例如：等總務處回覆維修時程"></textarea></label>
        <div class="evd-btns"><button type="button" class="ghost" data-evd="roundcancel">取消</button><button type="button" class="primary" data-evd="roundok">完成第 ${ev.round} 段</button></div></div>
      <div class="evd-btns evd-main"><button type="button" class="icon danger" data-evdel>刪除</button><span class="evd-gap"></span><button type="button" class="icon" data-evd="round">${ico("progress")}完成這一段</button><button type="button" class="icon" data-evdone>${ico("check")}結案</button></div>
    </section></div>`;
}
function renderEvents(){
  const live=state.events.filter(ev=>!ev.doneAt),md=mdOn("live")&&live.length>0,pane=$("#evDetail");mdLast.live=mdOn("live");
  $("#liveMD").classList.toggle("split",md);
  if(md&&!live.some(e=>e.id===selEv))selEv=live[0].id;
  $("#events").innerHTML=live.map(ev=>{const st=evStatus(ev),par=parentOf(ev);
    return `<details class="ev ${md&&ev.id===selEv?"sel":""}" data-ev="${ev.id}" data-st="${st}" ${!md&&openEv.has(ev.id)?"open":""}${md&&ev.id===selEv?' aria-current="true"':""}>
      <summary><span class="live-dot" aria-hidden="true"></span><b>${esc(ev.name)}</b>${par?`<span class="ev-parent">→ ${esc(par.title)}</span>`:""}<button type="button" class="ev-del edit-only" data-evdel aria-label="刪除「${esc(ev.name)}」">${ico("close","solo")}</button><span class="ev-chev" aria-hidden="true">▾</span></summary>
      <div class="ev-body">${par?`<p class="ev-parent-full">母議題：${esc(par.title)}</p>`:""}<p class="ev-meta"><span class="ev-st">${EV_ST[st]}</span>${ev.round>1?`<span>第 ${ev.round} 段</span>`:""}${ev.touchedAt?`<span>最後更新 <span class="num">${fmt(ev.touchedAt).slice(5)} ${ev.touchedAt.slice(11,16)}</span></span>`:""}</p>${ev.desc?`<p>${esc(ev.desc)}</p>`:`<p class="sub">（沒有說明）</p>`}
        ${evTimesHTML(ev,editing)}${staffHTML(ev.staff)}
        ${ev.links.length?`<div class="links ev-links">${ev.links.map(l=>editing?`<a href="#" class="link" style="background:${esc(l.color)}" data-editevlink="${l.id}">${esc(l.name)}${ico("edit","sm")}</a>`:`<a class="link" style="background:${esc(l.color)}" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join("")}</div>`:""}
        ${editing?`<span class="ev-tools"><button type="button" class="icon" data-evlinkissue>${par?"更改母議題":"與議題連結"}</button><button type="button" class="icon" data-addevlink>+ 超連結</button><button type="button" class="icon" data-addevtime>${ico("calendar")}+ 時間</button><button type="button" class="icon" data-editev>${ico("edit")}編輯</button><button type="button" class="icon" data-evround>${ico("progress")}完成這一段</button><button type="button" class="icon" data-evdone>${ico("check")}結案</button></span>`:""}</div>
    </details>`}).join("")
    ||`<p class="empty">${state.locked?"目前沒有即時回報。":"需要即時回報的事項放這裡，只要名稱和說明。按「編輯」→「+ 新增即時回報」。"}</p>`;
  if(md){pane.innerHTML=evDetailHTML(live.find(e=>e.id===selEv));pane.hidden=false}else{pane.innerHTML="";pane.hidden=true}
}

/* 完成紀錄：一般是可展開的清單；桌面放大成全寬時（mdOn）改成左側清單、右側詳情 */
function renderDone(){
  const ds=doneIssues();
  const de=state.events.filter(ev=>ev.doneAt);
  const ids=new Set([...ds.map(i=>i.id),...de.map(e=>e.id)]);
  const dnew=id=>prevDone&&!prevDone.has(id)?"new":"";
  const link=l=>`<a class="link" style="background:${esc(l.color)}" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.name)}</a>`;
  const dateBtn=d=>editing?`<button type="button" class="inline-date" data-donedate aria-label="修改完成日期">${fmt(d)||"—"}${ico("edit","sm")}</button>`:fmt(d)||"—";
  /* 每一筆拆成：屬性、標題、副標、內容，讓兩種版面共用 */
  const items=ds.map(it=>({id:it.id,d:it.doneAt||"",attr:`data-issue="${it.id}"`,title:esc(it.title),sub:`${dateBtn(it.doneAt)} · 議題`,del:`data-deldone aria-label="刪除「${esc(it.title)}」"`,
    body:`${hasDates(it)?`<div class="sub">期間 ${fmt(it.start)} – ${fmt(it.end)}</div>`:""}
        ${it.note?`<p style="margin:0;white-space:pre-wrap">${esc(it.note)}</p>`:""}
        ${it.tags.length?`<div class="tags">${it.tags.map((g,k)=>`<span class="tag ${k===it.cur?"cur":k<it.cur?"past":""}">${esc(g)}</span>`).join("")}</div>`:""}
        ${it.markers.length?`<ul>${sortedMarkers(it).map(m=>`<li>${m.date?`<span class="num">${fmt(m.date)}</span> `:""}${m.stage?`【${esc(m.stage)}】`:""}${esc(m.text)}</li>`).join("")}</ul>`:""}
        ${it.links.length?`<div class="links">${it.links.map(link).join("")}</div>`:""}
        <span class="edit-only" style="gap:6px"><button type="button" class="icon" data-restore>取消結案</button></span>`}))
  .concat(de.map(ev=>({id:ev.id,d:ev.doneAt,attr:`data-ev="${ev.id}"`,title:esc(evName(ev)),sub:`${dateBtn(ev.doneAt)} · 即時回報${parentOf(ev)?` → ${esc(parentOf(ev).title)}`:""}`,del:`data-evdel aria-label="刪除「${esc(ev.name)}」"`,
    body:`${ev.desc?`<p style="margin:0;white-space:pre-wrap">${esc(ev.desc)}</p>`:""}${(ev.links||[]).length?`<div class="links">${ev.links.map(link).join("")}</div>`:""}
        ${evTimesHTML(ev,false)}
        <span class="edit-only" style="gap:6px"><button type="button" class="icon" data-evlinkissue>${parentOf(ev)?"更改母議題":"與議題連結"}</button>${ev.fromEv?"":`<button type="button" class="icon" data-evundo>移回即時回報</button>`}</span>`})))
  .sort((a,b)=>b.d.localeCompare(a.d));
  const sum=x=>`<summary><span class="t"><span class="ok-dot" aria-hidden="true"></span>${x.title}</span><span class="sub">${x.sub}</span><button type="button" class="icon danger edit-only done-del" ${x.del}>刪除</button></summary>`;
  const md=mdOn("done")&&items.length>0,pane=$("#doneDetail");mdLast.done=mdOn("done");
  $("#doneMD").classList.toggle("split",md);
  $("#doneCount").textContent=items.length;
  if(md){
    if(!items.some(x=>x.id===selDone))selDone=items[0].id;
    $("#doneList").innerHTML=items.map(x=>`<details class="done-item ${dnew(x.id)} ${x.id===selDone?"sel":""}" ${x.attr}${x.id===selDone?' aria-current="true"':""}>${sum(x)}</details>`).join("");
    const x=items.find(y=>y.id===selDone);
    pane.innerHTML=`<div class="done-detail" ${x.attr}><h3 class="done-dt"><span class="ok-dot" aria-hidden="true"></span>${x.title}</h3><p class="sub done-ds">${x.sub}</p><div class="done-body">${x.body}</div></div>`;pane.hidden=false;
  }else{
    $("#doneList").innerHTML=items.map(x=>`<details class="done-item ${dnew(x.id)}" ${x.attr} ${openDone.has(x.id)?"open":""}>${sum(x)}<div class="done-body">${x.body}</div></details>`).join("")
      ||`<p class="empty">結案的議題和完成的即時回報會收進這裡。</p>`;
    pane.innerHTML="";pane.hidden=true;
  }
  prevDone=ids;
}
/* 左右兩欄時換選一筆：右側內容淡入（完成紀錄與個別進度共用） */
function mdPaneIn(el){if(el&&!reduceMotion())el.animate([{opacity:0,transform:"translateX(14px)"},{opacity:1,transform:"none"}],{duration:280,easing:"cubic-bezier(.2,.9,.25,1)"})}

