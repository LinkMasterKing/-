/* 核心｜各區塊畫面：頁首、週報、甘特圖、議題卡片、即時回報、完成紀錄 */
function renderHeader(){
  $("#titleSlot").innerHTML=editing?`<input id="titleIn" class="title-in" value="${esc(state.title)}" aria-label="看板名稱">`:`<h1>${esc(state.title)}</h1>`;
  document.title=state.title;renderHero();
  $("#saveInfo").textContent=readOnly()?`更新於 ${fmt(state.savedAt)||"—"}`
    :(state.savedAt?`上次儲存 ${state.savedAt}`:"尚未儲存")+(cloudOn()?` · ${({ok:"雲端已同步",empty:"雲端尚無資料，儲存後建立",offline:"離線中",limited:"GitHub 讀取次數暫時用完",error:"雲端讀取失敗"})[cloud.status]||"連線雲端中…"}${cloudOn()&&!ghToken()&&editing?"（此裝置未設定權杖，無法上傳）":""}`:"")+(localOK?"":" · 這個瀏覽器無法本機保存，請用「匯出備份」");
  offlinePill();
  $("#actions").innerHTML=readOnly()?simpleBtnHTML():editing
    ?`<button id="exportLocked">匯出定型版</button><button class="ghost" id="exportEdit">匯出備份</button><button class="ghost" id="importBtn">匯入備份</button><button id="cancelBtn">取消</button><button class="primary" id="saveBtn">${cloudOn()?"儲存並同步":"儲存並定型"}</button>`
    :`${simpleBtnHTML()}<button class="primary" id="editBtn">✎ 編輯</button>`;
}

function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y)/864e5+1)/7)}
function termWeek(d){if(!state.termStart)return 0;const diff=Math.floor((pd(ymd(d))-pd(state.termStart))/864e5);return diff<0?0:Math.floor(diff/7)+1}
function renderHero(){
  const d=state.boardDate?pd(state.boardDate):state.savedAt?pd(state.savedAt.slice(0,10)):new Date();
  $("#dateIn").value=state.boardDate||"";
  $("#yearTxt").textContent=state.yearLabel||"";$("#yearIn").value=state.yearLabel||"";
  const tw=termWeek(d);
  $("#weekPill").textContent=tw>0?"W"+pad(tw):"PRE";$("#weekZh").textContent=tw>0?`開學第${tw}週`:"開學前";
  $("#termIn").value=state.termStart||"";
  $("#bigDate").textContent=`${d.getMonth()+1}.${pad(d.getDate())}`;
  $("#dowEn").textContent=["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()];
  $("#dowZh").textContent="日一二三四五六"[d.getDay()];

}

function renderWeeks(){
  const ws=[...state.weeks].sort((a,b)=>b.date.localeCompare(a.date));
  if(!openWeeks&&ws.length)openWeeks=new Set([ws[0].id]);
  const lines=t=>String(t||"").split("\n").map(l=>`<span class="wl">${l.trim()?esc(l):"&nbsp;"}</span>`).join("");
  $("#weekList").innerHTML=ws.map((w,k)=>`<details class="week ${w.id===newWeekId?"new":""}" data-week="${w.id}" ${openWeeks&&openWeeks.has(w.id)?"open":""}>
      <summary><span class="num">${fmt(w.date)}</span>${k===0?'<span class="badge">最新</span>':""}</summary>
      <div class="week-tools"><button type="button" class="icon" data-copyweek>複製文字</button><button type="button" class="icon edit-only" data-editweek>✎ 編輯</button><button type="button" class="icon danger edit-only" data-delweek>刪除</button></div>
      <div class="week-text">${lines(w.text)}</div></details>`).join("")
    ||`<p class="empty">還沒有週報。${state.locked?"":"按「編輯」→「+ 新增週報」貼上本週文字。"}</p>`;
}

function renderGantt(){
  $("#rStart").value=state.range.start;$("#rEnd").value=state.range.end;
  const ms=months(),tp=pos(today()),[s0,e0]=rangeMs(),inRange=Date.now()>s0&&Date.now()<e0;
  const list=activeIssues().filter(hasDates);
  const narrow=innerWidth<640,nameW=narrow?104:170;const width=Math.max(narrow?360:640,ms.length*(narrow?84:130));
  const grid=ms.map(m=>`<span class="vgrid" style="left:${pos(ymd(m))}%"></span>`).join("")+(inRange?`<span class="today" style="left:${tp}%" title="今天"></span>`:"");
  let h=`<div style="min-width:${width+nameW}px"><div class="g-row"><div class="g-name sub" style="font-weight:400">議題</div><div class="g-axis">${inRange?`<span class="today-tag" style="left:${tp}%">今天 ${fmt(today()).slice(5)}</span>`:""}${ms.map((m,k)=>`<span style="left:${pos(ymd(m))}%">${k===0||m.getMonth()===0?m.getFullYear()+"/":""}${m.getMonth()+1}月</span>`).join("")}</div></div>`;
  h+=list.map(it=>{
    let s=it.start,e=it.end;if(e<s)[s,e]=[e,s];
    const l=pos(s),w=Math.max(.8,pos(e)-l);
    const gL=latestMarkerId(it.markers.filter(m=>m.date));const mk=it.markers.filter(m=>m.date).map(m=>{const p=pos(m.date);return `<span class="g-mk ${p<6?"edgeL":p>94?"edgeR":""} ${m.id!==gL?"quiet":""}" style="left:${p}%;--mc:${esc(m.color||MARK_COLORS[0])}" title="${esc(fmt(m.date))} ${m.stage?"【"+esc(m.stage)+"】":""}${esc(m.text)}"><span class="stem"></span><span class="dot"></span><span class="lbl">${esc(m.text)}</span></span>`}).join("");
    return `<div class="g-row g-issue" data-jump="${it.id}" title="點一下跳到「${esc(it.title)}」" style="--acc:var(--${it.progress>=50?"green":"red"})"><div class="g-name"><a href="#card-${it.id}" data-jump="${it.id}">${esc(it.title)}</a><span class="sub" style="font-size:11.5px">${fmt(s).slice(5)} – ${fmt(e).slice(5)}</span></div>
      <div class="g-track">${grid}<div class="g-bar" style="left:${l}%;width:${w}%"><div class="fill" style="width:${it.progress}%"></div></div><span class="g-pct num" style="left:${l+w}%">${it.progress}%</span>${mk}</div></div>`;
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
    ?`<a href="#" class="link" style="background:${esc(l.color)}" data-editlink="${l.id}" data-iid="${iid}">${esc(l.name)} ✎</a>`
    :`<a class="link" style="background:${esc(l.color)}" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.name)}</a>`;
}
function latestMarkerId(list){
  const dated=list.filter(m=>m.date).sort((a,b)=>a.date.localeCompare(b.date)||a.at-b.at);
  const pick=dated.length?dated[dated.length-1]:[...list].sort((a,b)=>a.at-b.at).pop();
  return pick&&pick.id;
}
function markerHTML(m,latest){
  const edge=m.at<18?"edgeL":m.at>82?"edgeR":"";
  return `<div class="marker ${m.pos==="down"?"down":"up"} ${edge} ${latest&&m.id!==latest?"quiet":""}" style="left:${m.at}%;--mc:${esc(m.color||MARK_COLORS[0])}" data-marker="${m.id}" title="${m.date?esc(fmt(m.date))+" ":""}${esc(m.text)}"><span class="stem"></span><span class="dot"></span><span class="lbl">${m.date?`<span class="num">${fmt(m.date).slice(5)}</span> `:""}${esc(m.text)}</span></div>`;
}

const sortedMarkers=it=>[...it.markers].sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999")||a.at-b.at);
function logHTML(it){
  const ms=sortedMarkers(it);if(!ms.length)return "";
  return `<details class="log" open><summary>處理紀錄<span class="count">${ms.length}</span></summary><ol>${ms.map(m=>`<li><span class="log-dot" style="background:${esc(m.color||MARK_COLORS[0])}"></span><span class="num log-d">${m.date?fmt(m.date):"—"}</span>${m.stage?`<span class="tag cur sm">${esc(m.stage)}</span>`:""}<span>${esc(m.text)}</span>${m.evId?`<span class="sub" title="來自即時回報">（即時回報）</span>`:""}<span class="sub log-p">${m.at}%</span>${editing?`<button type="button" class="icon" data-logmk="${m.id}" aria-label="編輯這筆註記">✎</button>`:""}</li>`).join("")}</ol></details>`;
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

function renderCards(){
  const list=activeIssues();
  $("#cards").innerHTML=list.map(it=>`<article class="card ${it.progress>=100?"done-card":""} ${openIds.has(it.id)?"open":""}" id="card-${it.id}" data-issue="${it.id}" style="--acc:var(--${it.progress>=50?"green":"red"})">
    <div class="card-top">
      <button type="button" class="card-toggle" data-toggle aria-expanded="${openIds.has(it.id)}"><span class="card-title">${esc(it.title)}</span>${it.tags[it.cur]?`<span class="tag cur sm">${esc(it.tags[it.cur])}</span>`:""}<span class="hpct num" data-hpct>${it.progress}%</span><span class="chev-btn">${openIds.has(it.id)?"收合":"展開"}<span class="chev" aria-hidden="true">▾</span></span></button>
      <div class="card-tools"><button type="button" class="icon" data-move="-1" aria-label="往前移">↑</button><button type="button" class="icon" data-move="1" aria-label="往後移">↓</button></div>
    </div>
    ${openIds.has(it.id)?`
    ${editing?`<label class="sub" style="display:grid;gap:3px">議題名稱<input data-f="title" value="${esc(it.title)}"></label>`:""}
    <div class="meta"><span class="sub">${hasDates(it)?`${fmt(it.start)} – ${fmt(it.end)}`:"未排入甘特圖"}</span></div>
    <div class="tags">${tagsHTML(it)}</div>
    ${!editing&&it.note?`<p class="note"><span class="note-h">目前進度</span>${esc(it.note)}</p>`:""}
    <div class="c-track" data-track>
      <div class="c-bar"><div class="fill" style="width:${it.progress}%"></div></div>
      ${[0,25,50,75,100].map(v=>`<span class="tick" style="left:${v}%">${v}</span>`).join("")}
      ${(()=>{const L=latestMarkerId(it.markers);return it.markers.map(m=>markerHTML(m,L)).join("")})()}
    </div>
    <div class="edit-block">
      <label class="full">完成度（100% 儲存後移到左側完成紀錄）<span class="prog"><input type="range" min="0" max="100" step="5" data-f="progress" value="${it.progress}" style="--p:${it.progress}%" aria-label="完成度滑桿"><input type="number" min="0" max="100" data-f="progress" value="${it.progress}" aria-label="完成度數值"></span></label>
      <label class="full">目前進度說明<textarea data-f="note" rows="3" placeholder="例如：已和總務處確認，等待書面回覆">${esc(it.note||"")}</textarea></label>
      <label>開始日<input type="date" data-f="start" value="${it.start}"></label>
      <label>結束日<input type="date" data-f="end" value="${it.end}"></label>
      <span class="hint full">兩個日期都填才會顯示在甘特圖；清空即從甘特圖移除。</span>
      <div class="full" style="display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap"><button type="button" data-addlink="${it.id}">+ 超連結按鈕</button><button type="button" class="ghost" data-addmarker>+ 註記</button><button type="button" class="danger" data-delissue>刪除議題</button></div>
    </div>
    ${(()=>{const kids=state.events.filter(e=>!e.doneAt&&e.issueId===it.id);return kids.length?`<div class="kid-evs"><div class="att-h">進行中的即時回報</div><div class="kid-list">${kids.map(e=>`<span class="kid-ev"><span class="live-dot" aria-hidden="true"></span>${esc(e.name)}</span>`).join("")}</div></div>`:""})()}
    ${logHTML(it)}
    <div class="att"${!it.links.length?' hidden':""}>
      <div class="att-h">相關連結${editing?"（點按鈕可修改或刪除）":""}</div>
      <div class="links">${it.links.map(x=>linkHTML(x,it.id)).join("")}</div>
    </div>`:`<div class="mini-bar" data-toggle title="點一下展開"><div class="fill" style="width:${it.progress}%"></div></div>`}
  </article>`).join("")
  ||`<p class="empty">${state.locked?"目前沒有進行中的議題。":"還沒有議題，按「編輯」→「+ 新增議題」開始。"}</p>`;
}

function renderEvents(){
  $("#events").innerHTML=state.events.filter(ev=>!ev.doneAt).map(ev=>`<details class="ev" data-ev="${ev.id}" ${openEv.has(ev.id)?"open":""}>
      <summary><span class="live-dot" aria-hidden="true"></span><b>${esc(ev.name)}</b>${parentOf(ev)?`<span class="ev-parent">→ ${esc(parentOf(ev).title)}</span>`:""}<span class="ev-chev" aria-hidden="true">▾</span></summary>
      <div class="ev-body">${parentOf(ev)?`<p class="ev-parent-full">母議題：${esc(parentOf(ev).title)}</p>`:""}${ev.desc?`<p>${esc(ev.desc)}</p>`:`<p class="sub">（沒有說明）</p>`}
        ${(ev.links||[]).length?`<div class="links ev-links">${ev.links.map(l=>editing?`<a href="#" class="link" style="background:${esc(l.color)}" data-editevlink="${l.id}">${esc(l.name)} ✎</a>`:`<a class="link" style="background:${esc(l.color)}" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join("")}</div>`:""}
        ${editing?`<span class="ev-tools"><button type="button" class="icon" data-evlinkissue>${parentOf(ev)?"更改母議題":"與議題連結"}</button><button type="button" class="icon" data-addevlink>+ 超連結</button><button type="button" class="icon" data-evdone>✓ 完成</button><button type="button" class="icon" data-editev>✎ 編輯</button></span>`:""}</div>
    </details>`).join("")
    ||`<p class="empty">${state.locked?"目前沒有即時回報。":"需要即時回報的事項放這裡，只要名稱和說明。按「編輯」→「+ 新增即時回報」。"}</p>`;
}

function renderDone(){
  const ds=doneIssues();
  const de=state.events.filter(ev=>ev.doneAt);
  const ids=new Set([...ds.map(i=>i.id),...de.map(e=>e.id)]);
  const dnew=id=>prevDone&&!prevDone.has(id)?"new":"";
  $("#doneCount").textContent=ds.length+de.length;
  $("#doneList").innerHTML=ds.map(it=>{
    const mk=[...it.markers].sort((a,b)=>a.at-b.at);
    return `<details class="done-item ${dnew(it.id)}" data-issue="${it.id}" ${openDone.has(it.id)?"open":""}>
      <summary><span class="t"><span class="ok-dot" aria-hidden="true"></span>${esc(it.title)}</span><span class="sub">${editing?`<button type="button" class="inline-date" data-donedate aria-label="修改完成日期">${fmt(it.doneAt)||"—"} ✎</button>`:fmt(it.doneAt)||"—"} · 議題</span></summary>
      <div class="done-body">
        ${hasDates(it)?`<div class="sub">期間 ${fmt(it.start)} – ${fmt(it.end)}</div>`:""}
        ${it.note?`<p style="margin:0;white-space:pre-wrap">${esc(it.note)}</p>`:""}
        ${it.tags.length?`<div class="tags">${it.tags.map((g,k)=>`<span class="tag ${k===it.cur?"cur":k<it.cur?"past":""}">${esc(g)}</span>`).join("")}</div>`:""}
        ${mk.length?`<ul>${sortedMarkers(it).map(m=>`<li>${m.date?`<span class="num">${fmt(m.date)}</span> `:""}${m.stage?`【${esc(m.stage)}】`:""}${esc(m.text)}</li>`).join("")}</ul>`:""}
        ${it.links.length?`<div class="links">${it.links.map(l=>`<a class="link" style="background:${esc(l.color)}" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join("")}</div>`:""}
<span class="edit-only" style="gap:6px"><button type="button" class="icon" data-restore>移回進行中</button><button type="button" class="icon danger" data-deldone>刪除</button></span>
      </div></details>`;
  }).map((h,k)=>({h,d:ds[k].doneAt||""})).concat(de.map(ev=>({d:ev.doneAt,h:`<details class="done-item ${dnew(ev.id)}" data-ev="${ev.id}" ${openDone.has(ev.id)?"open":""}>
      <summary><span class="t"><span class="ok-dot" aria-hidden="true"></span>${esc(ev.name)}</span><span class="sub">${editing?`<button type="button" class="inline-date" data-donedate aria-label="修改完成日期">${fmt(ev.doneAt)} ✎</button>`:fmt(ev.doneAt)} · 即時回報${parentOf(ev)?` → ${esc(parentOf(ev).title)}`:""}</span></summary>
      <div class="done-body">${ev.desc?`<p style="margin:0;white-space:pre-wrap">${esc(ev.desc)}</p>`:""}${(ev.links||[]).length?`<div class="links">${ev.links.map(l=>`<a class="link" style="background:${esc(l.color)}" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join("")}</div>`:""}
<span class="edit-only" style="gap:6px"><button type="button" class="icon" data-evlinkissue>${parentOf(ev)?"更改母議題":"與議題連結"}</button><button type="button" class="icon" data-evundo>移回即時回報</button><button type="button" class="icon danger" data-evdel>刪除</button></span>
      </div></details>`}))).sort((a,b)=>b.d.localeCompare(a.d)).map(x=>x.h).join("")||`<p class="empty">完成度達 100% 的議題和完成的即時回報會收進這裡。</p>`;
  prevDone=ids;
}

