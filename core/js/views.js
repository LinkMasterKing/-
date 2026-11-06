/* 核心｜各區塊畫面：頁首、週報、甘特圖、議題卡片、即時回報、完成紀錄 */
function renderHeader(){
  document.title=state.title;renderHero();
  $("#saveInfo").textContent=readOnly()?`更新於 ${fmt(state.savedAt)||"—"}`
    :(state.savedAt?`上次儲存 ${state.savedAt}${state.savedBy?`（${state.savedBy}）`:""}`:"尚未儲存")+(cloudOn()?` · ${({ok:"雲端已同步",empty:"雲端尚無資料，儲存後建立",offline:"離線中",limited:"GitHub 讀取次數暫時用完",error:"雲端讀取失敗"})[cloud.status]||"連線雲端中…"}${cloudOn()&&!ghToken()&&loggedIn()?" · 這台裝置沒有連上雲端，儲存只會留在這台裝置":""}`:"")+(localOK?"":" · 這個瀏覽器無法本機保存，請用「匯出備份」");
  offlinePill();notiBadge();if(notiOpen)renderNoti();
  /* 2026-11-06：頁首的「編輯／取消／儲存」拿掉，改成每張卡片自己的「編輯」與「取消｜儲存」（render.js 的單卡編輯） */
}

function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y)/864e5+1)/7)}
function termWeek(d){const ts=termCfg().termStart;if(!ts)return 0;const diff=Math.floor((pd(ymd(d))-pd(ts))/864e5);return diff<0?0:Math.floor(diff/7)+1}
function renderHero(){
  /* 頁首只留 logo、搜尋欄（提示字含開學第幾週）、通知鈕（2026-11-05 使用者要求精簡；看板名稱、學年、大日期、上次儲存不再顯示在頁首） */
  const tw=termWeek(new Date());
  /* 2026-11-06：週次不再是獨立的膠囊（那個位置換成通知鈕），寫進搜尋欄的提示字：「搜尋 權益部 第9週」 */
  {const q=$("#boardQ"),ph=`搜尋 ${CFG.dept.name||state.title||"看板"} ${tw>0?`第${tw}週`:"開學前"}`;if(q&&q.placeholder!==ph)q.placeholder=ph}
  weekDotSync();
}

function renderWeeks(){
  const ws=[...state.weeks].sort((a,b)=>b.date.localeCompare(a.date));
  if(!openWeeks&&ws.length)openWeeks=new Set([ws[0].id]);
  const lines=t=>String(t||"").split("\n").map(l=>`<span class="wl">${l.trim()?esc(l):"&nbsp;"}</span>`).join("");
  $("#weekList").innerHTML=ws.map((w,k)=>`<details class="week ${w.id===newWeekId?"new":""}" data-week="${w.id}" ${openWeeks&&openWeeks.has(w.id)?"open":""}>
      <summary><span class="num">${fmt(w.date)}</span>${k===0?'<span class="badge">最新</span>':""}<button type="button" class="icon danger auth-only week-del" data-delweek aria-label="刪除 ${fmt(w.date)} 的週報">刪除</button></summary>
      <div class="week-tools"><button type="button" class="icon" data-copyweek>複製文字</button><button type="button" class="icon auth-only" data-editweek>${ico("edit")}編輯</button></div>
      <div class="week-text">${lines(w.text)}</div></details>`).join("")
    ||`<p class="empty">還沒有週報。${state.locked?"":"登入後按「+ 新增週報」貼上本週文字，或按「生成週報」。"}</p>`;
}

/* 細刻度（甘特圖每一列、議題詳情的時程條共用）：n 根細直線排滿整條；s～e＝議題期間（%），t＝今天（%；在範圍外就給 -1 或 101）。
   期間外＝淡色短刻度、期間內已過＝深色長刻度、期間內還沒到＝灰色中刻度、今天那一根＝綠色最高 */
function ticksHTML(n,s,e,t){
  const half=50/n;let h="";
  for(let i=0;i<n;i++){const p=(i+.5)/n*100,inR=p>=s-half&&p<=e+half,now=inR&&Math.abs(p-t)<=half;h+=`<i class="${now?"now":!inR?"":p<t?"on":"in"}"></i>`}
  return `<div class="tk" aria-hidden="true">${h}</div>`;
}
let ganttSeg=null;
function renderGantt(){
  $("#rStart").value=state.range.start;$("#rEnd").value=state.range.end;
  /* 全部／上學期／下學期：液態分段切換（anim.js 的 LiquidSeg）；在骨架裡、不跟著重畫，換的時候舊圖淡出、新圖淡入 */
  if(!ganttSeg&&$("#gTerm"))ganttSeg=new LiquidSeg($("#gTerm"),{onPick:k=>{Anim.swap($("#gantt"),()=>{ganttTerm=k;renderGantt();layoutAll()},"fade")}});
  if(ganttSeg&&!ganttTerm&&ganttSeg.cur!==["all","up","down"].indexOf(gTermNow()))ganttSeg.set(gTermNow(),true);   /* 還沒臨時切過：跟著設定的學期 */
  const ms=months(),tp=pos(today()),[s0,e0]=rangeMs(),inRange=Date.now()>s0&&Date.now()<e0;
  const all=activeIssues(),list=all.filter(hasDates),undated=all.filter(i=>!hasDates(i));
  const narrow=innerWidth<640,nameW=narrow?104:170;
  /* 手機看單一學期（6 個月）時，時間軸剛好塞進畫面寬，不用左右滑（2026-11-06）；看「全部」照舊依月份數加寬、可以左右滑 */
  const fit=narrow&&gTermNow()!=="all",avail=Math.max(220,($("#gantt").clientWidth||360)-nameW-14);   /* 14：列的左右內距，不然會多出一點點要滑 */
  const width=fit?avail:Math.max(narrow?360:640,ms.length*(narrow?84:130));
  /* 細刻度（2026-11-05 使用者選的 A 方案）：每一列整條時間軸是一排細直線（約每 6px 一根），格子與「已經過去」的打亮都拿掉；
     今天＝每列一條往下淡掉的細綠線，時間軸上方綠色小膠囊寫日期。tN＝今天在時間軸上的位置（範圍之前 -1、之後 101） */
  const tN=inRange?tp:Date.now()>=e0?101:-1,nT=Math.max(40,Math.round(width/6));
  const grid=inRange?`<span class="today" style="left:${tp}%" title="今天"></span>`:"";
  let h=`<div style="min-width:${width+nameW}px"><div class="g-row"><div class="g-name sub" style="font-weight:400">議題</div><div class="g-axis">${inRange?`<span class="today-tag" style="left:${tp}%">今天 ${fmt(today()).slice(5)}</span>`:""}${ms.map((m,k)=>`<span style="left:${pos(ymd(m))}%">${!fit&&(k===0||m.getMonth()===0)?m.getFullYear()+"/":""}${m.getMonth()+1}月</span>`).join("")}</div></div>`;
  h+=list.map(it=>{
    let s=it.start,e=it.end;if(e<s)[s,e]=[e,s];
    const l=pos(s),w=Math.max(.8,pos(e)-l);
    const gL=latestMarkerId(it.markers.filter(m=>m.date));const mk=it.markers.filter(m=>m.date).map(m=>{const p=pos(m.date);return `<span class="g-mk ${p<6?"edgeL":p>94?"edgeR":""} ${m.id!==gL?"quiet":""}" style="left:${p}%;--mc:${esc(m.color||MARK_COLORS[0])}" title="${esc(fmt(m.date))} ${m.stage?"【"+esc(m.stage)+"】":""}${esc(m.text)}"><span class="stem"></span><span class="dot"></span><span class="lbl">${esc(m.text)}</span></span>`}).join("");
    return `<div class="g-row g-issue" data-jump="${it.id}" data-fk="g${it.id}" title="點一下看「${esc(it.title)}」的詳情"><div class="g-name"><a href="#" data-jump="${it.id}">${esc(it.title)}</a><span class="sub" style="font-size:11.5px">${fmt(s).slice(5)} – ${fmt(e).slice(5)}</span></div>
      <div class="g-track">${grid}<div class="g-bar">${ticksHTML(nT,l,l+w,tN)}</div>${mk}</div></div>`;
  }).join("");
  /* 還沒填期間的議題也列出來（沒有條），才點得到詳情去補日期 */
  h+=undated.map(it=>`<div class="g-row g-issue g-undated" data-jump="${it.id}" data-fk="g${it.id}" title="點一下看「${esc(it.title)}」的詳情"><div class="g-name"><a href="#" data-jump="${it.id}">${esc(it.title)}</a><span class="sub" style="font-size:11.5px">未排程</span></div><div class="g-track">${grid}</div></div>`).join("");
  h+="</div>";
  if(!all.length)h+=`<p class="empty">${state.locked?"目前沒有進行中的議題。":"還沒有議題，登入後按「+ 新增議題」開始。"}</p>`;
  $("#gantt").innerHTML=h;
}

/* 階段標籤與連結按鈕（只顯示；編輯中改用逐欄編輯的「階段」「超連結」欄） */
function tagsHTML(it){return it.tags.map((g,k)=>`<span class="tag ${k===it.cur?"cur":k<it.cur?"past":""}">${esc(g)}</span>`).join("")}
function linkHTML(l){return `<a class="link" style="--c:${esc(l.color)}" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.name)}</a>`}
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
  return `<details class="log" open><summary>處理紀錄<span class="count">${ms.length}</span></summary><ol>${ms.map(m=>`<li><span class="log-dot" style="background:${esc(m.color||MARK_COLORS[0])}"></span><span class="num log-d">${m.date?fmt(m.date):"—"}</span>${m.stage?`<span class="tag cur sm">${esc(m.stage)}</span>`:""}<span>${esc(m.text)}</span>${m.evId?`<span class="sub" title="來自即時回報">（即時回報）</span>`:""}</li>`).join("")}</ol></details>`;
}

/* stack marker labels into lanes so many markers never overlap */
const LH=22;
function layoutTrack(tr){
  const isG=tr.classList.contains("g-track"),W=tr.clientWidth;if(!W||!tr.querySelector(".g-bar,.c-bar"))return;   /* 未排程的甘特列沒有條 */
  const barH=isG?22:16,dotH=isG?6:16,gap=isG?3:4;   /* 註記都放在刻度「上方」、不疊在刻度上：甘特圖是 6px 小點；議題詳情是 16px 細長條（2026-11-06 使用者：長條疊在刻度上又半透明很粗糙） */
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
  const barTop=(isG?6:8)+nUp*LH+(nUp?6:(isG?14:18))+(isG?0:dotH+gap-10);   /* 議題詳情多留長條的高度 */
  const below=barTop+barH+(isG?6:20);
  tr.querySelector(isG?".g-bar":".c-bar").style.top=barTop+"px";
  tr.querySelectorAll(".tick").forEach(t=>t.style.top=(barTop+barH+3)+"px");
  info.forEach(({m,lbl,side,k})=>{
    const dot=m.querySelector(".dot"),stem=m.querySelector(".stem");
    dot.style.top=(barTop-dotH-gap)+"px";
    if(side==="up"){const base=isG?barTop:barTop-dotH-gap,top=base-6-(k+1)*LH+2;lbl.style.top=top+"px";stem.style.top=(top+18)+"px";stem.style.height=Math.max(0,base-top-18)+"px"}
    else{const top=below+k*LH;lbl.style.top=top+"px";stem.style.top=(barTop+barH)+"px";stem.style.height=Math.max(0,top-barTop-barH)+"px"}
  });
  tr.style.height=(nDown?below+nDown*LH+4:below+(isG?0:4))+"px";
}
const layoutAll=()=>document.querySelectorAll(".c-track,.g-track").forEach(layoutTrack);
let _rz;window.addEventListener("resize",()=>{clearTimeout(_rz);_rz=setTimeout(layoutAll,120)});
document.fonts?.ready.then(layoutAll);

/* 一張議題卡片；open＝展開內容，sel＝左右兩欄時清單裡選到的那列，pane＝畫在右側詳情（不帶 id，避免重複） */
function cardHTML(it,open,pane,sel){
  const ed=cardEd("i",it.id);
  return `<article class="card ${it.doneAt?"closed":""} ${open?"open":""} ${sel?"sel":""} ${pane?"in-pane":""} ${ed?"sec-edit":""}" ${pane?"":`id="card-${it.id}"`} data-issue="${it.id}" data-edbox="i:${it.id}"${sel?' aria-current="true"':""}>
    <div class="card-top">
      <button type="button" class="card-toggle" data-toggle aria-expanded="${open}"><span class="card-title">${esc(it.title)}</span>${it.tags[it.cur]?`<span class="tag cur sm">${esc(it.tags[it.cur])}</span>`:""}${it.doneAt?'<span class="tag sm closed-tag">已結案</span>':""}<span class="hpct num${schedPct(it)==null?" none":""}" data-hpct title="時程：設定的期間已經過的比例">${schedPct(it)==null?"未排程":`<small>時程</small>${schedPct(it)}%`}</span><span class="chev-btn">${open?"收合":"展開"}<span class="chev" aria-hidden="true">▾</span></span></button>
      ${editBtnHTML("i:"+it.id)}<div class="card-tools"><button type="button" class="icon" data-addmarker>+ 註記</button><button type="button" class="icon" data-closeissue>${it.doneAt?"取消結案":"結案"}</button><button type="button" class="icon" data-move="-1" aria-label="往前移">↑</button><button type="button" class="icon" data-move="1" aria-label="往後移">↓</button><button type="button" class="icon danger" data-delissue aria-label="刪除議題「${esc(it.title)}」">刪除</button></div>
    </div>
    ${open?`
    ${ed?issueFieldsHTML(it):`<div class="meta"><span class="sub">${hasDates(it)?`${fmt(it.start)} – ${fmt(it.end)}`:"未排入甘特圖"}</span></div>
    <div class="tags">${tagsHTML(it)}</div>
    ${staffHTML(it.staff)}${labelChipsHTML(it.labels)}
    ${it.note?`<p class="note"><span class="note-h">目前進度</span>${esc(it.note)}</p>`:""}`}
    <div class="c-track" data-track>
      <div class="c-bar">${ticksHTML(Math.round(Math.min(Math.max(innerWidth-(innerWidth>=900?260:60),280),1100)/6),0,100,hasDates(it)?(pd(today())-pd(it.start))/Math.max(1,pd(it.end)-pd(it.start))*100:-1)}</div>
      ${hasDates(it)?issueSpan(it).map((d,k)=>`<span class="tick ${k?"tick-e":"tick-s"}" style="left:${k*100}%">${fmt(d).slice(5)}</span>`).join(""):`<span class="tick tick-hint" style="left:0">未排程：填開始日與結束日後，時程條才會照時間填色</span>`}
      ${(()=>{const L=latestMarkerId(it.markers);return it.markers.map(m=>markerHTML(m,L,it)).join("")})()}
    </div>
    ${(()=>{const kids=state.events.filter(e=>!e.doneAt&&e.issueId===it.id);return kids.length?`<div class="kid-evs"><div class="att-h">進行中的即時回報</div><div class="kid-list">${kids.map(e=>`<span class="kid-ev" data-st="${evStatus(e)}"><span class="live-dot" aria-hidden="true"></span>${esc(e.name)}</span>`).join("")}</div></div>`:""})()}
    ${logHTML(it)}
    ${ed||!it.links.length?"":`<div class="att"><div class="att-h">相關連結</div><div class="links">${it.links.map(linkHTML).join("")}</div></div>`}
    ${ed?editBarHTML():""}`:`<div class="mini-bar" data-toggle title="點一下展開"><div class="fill" style="width:${schedPct(it)||0}%"></div></div>`}
  </article>`;
}
/* ---------- 進度、完成紀錄的逐欄編輯（跟即時回報同一套外觀與操作：點哪一欄改哪一欄、一次一欄、Enter 完成、Esc 取消） ----------
   按了卡片的「編輯」之後才能改（render.js 的單卡編輯）。
   ifFld＝{t,id,k}：t＝"i"（議題，含已結案的）或 "e"（完成紀錄裡的即時回報）；
   k＝title／stage／note／dates／staff／labels／l:連結 id（l:+＝新增）／done（完成日期）／name／desc／issue（母議題）。
   存回在 events.js 的「進度、完成紀錄的逐欄編輯」段 */
let ifFld=null;
const ifOpen=(t,id,k)=>!!ifFld&&ifFld.t===t&&ifFld.id===id&&ifFld.k===k;
function ifFieldHTML(t,id,k,label,view,editor){return fldRowHTML({open:ifOpen(t,id,k),k,label,view,editor,del:/^l:(?!\+)/.test(k),key:"iffk",pen:"ifpen",fx:"iffx",attr:`data-ift="${t}" data-ifid="${id}"`})}
const noneTxt=t=>`<span class="sub">（${t}）</span>`;
/* 階段：每一列一個階段（可改名、刪除），「目前」選這個議題現在在哪個階段；「+ 階段」在最後加一列 */
const stageRowHTML=(g,cur)=>`<span class="stg-row"><button type="button" class="stg-cur" data-iffx="stgcur" aria-pressed="${cur}">目前</button><input data-stg value="${esc(g)}" placeholder="階段名稱"><button type="button" class="icon stg-del" data-iffx="stgdel" aria-label="刪除這個階段">${ico("close","solo")}</button></span>`;
function stageEditorHTML(it){return `<div class="stg-list">${it.tags.map((g,k)=>stageRowHTML(g,k===it.cur)).join("")}</div><button type="button" class="ghost evd-add" data-iffx="stgadd">+ 階段</button><span class="sub evf-hint">按「目前」選這個議題現在在哪個階段；空白的階段會拿掉</span>`}
/* 議題詳情（編輯中）的欄位 */
function issueFieldsHTML(it){
  const F=(k,l,v,e)=>ifFieldHTML("i",it.id,k,l,v,e);
  return `<div class="evfs">
      ${F("title","名稱",`<b>${esc(it.title)}</b>`,()=>`<input data-e="title" value="${esc(it.title)}">`)}
      ${F("stage","階段",it.tags.length?`<span class="tags">${tagsHTML(it)}</span>`:noneTxt("沒有階段"),()=>stageEditorHTML(it))}
      ${F("note","目前進度",it.note?`<span class="evf-desc">${esc(it.note)}</span>`:noneTxt("沒有說明，點一下填寫"),()=>`<textarea data-e="note" rows="3" placeholder="例如：已和總務處確認，等待書面回覆">${esc(it.note||"")}</textarea>`)}
      ${F("dates","期間",hasDates(it)?`<span class="num">${fmt(it.start)} – ${fmt(it.end)}</span>`:noneTxt("未排程，點一下填開始與結束日"),()=>`<span class="evd-when"><input type="date" data-e="start" value="${it.start||""}" aria-label="開始日"><span class="sub">～</span><input type="date" data-e="end" value="${it.end||""}" aria-label="結束日"></span><span class="sub evf-hint">兩個日期都填才會顯示在甘特圖；清空就從甘特圖移除</span>`)}
      ${state.members.length?F("staff","專員",staffNames(it.staff).map(n=>`<span class="staff-chip">${esc(n)}</span>`).join("")||noneTxt("沒有標專員"),()=>fieldHTML({name:"staff",label:"從本看板的身分挑選，可複選",type:"multi",value:it.staff||[],options:staffOpts()})):""}
      ${F("labels","標籤",labelChipsHTML(it.labels)||noneTxt("沒有標籤"),()=>labelPickerHTML("labels",it.labels))}
      <div class="evf-group"><span class="evf-l">超連結</span>
        ${it.links.map(l=>F("l:"+l.id,"",`<span class="link" style="--c:${esc(l.color)}">${esc(l.name)}</span><span class="sub evf-url">${esc(l.url)}</span>`,()=>linkEditorHTML(l,it.links.length,"iffx"))).join("")}
        ${ifOpen("i",it.id,"l:+")?F("l:+","","",()=>linkEditorHTML(null,it.links.length,"iffx")):`<button type="button" class="ghost evd-add" data-ifpen="l:+" data-ift="i" data-ifid="${it.id}">+ 超連結</button>`}</div>
    </div>`;
}
/* 完成紀錄（編輯中）的欄位：議題＝名稱、完成日期、說明；即時回報＝名稱、完成日期、說明、母議題 */
function doneFieldsHTML(o,isEv){
  const t=isEv?"e":"i",nk=isEv?"name":"title",dk=isEv?"desc":"note",F=(k,l,v,e)=>ifFieldHTML(t,o.id,k,l,v,e),par=isEv&&parentOf(o);
  const opts=[["","（不連結）"],...state.issues.map(i=>[i.id,i.title+(i.doneAt?"（已結案）":"")])];
  return `<div class="evfs">
      ${F(nk,"名稱",`<b>${esc(o[nk])}</b>`,()=>`<input data-e="${nk}" value="${esc(o[nk])}">`)}
      ${F("done","完成日期",`<span class="num">${fmt(o.doneAt)||"—"}</span>`,()=>`<input type="date" data-e="done" value="${o.doneAt||""}">`)}
      ${F(dk,"說明",o[dk]?`<span class="evf-desc">${esc(o[dk])}</span>`:noneTxt("沒有說明，點一下填寫"),()=>`<textarea data-e="${dk}" rows="3">${esc(o[dk]||"")}</textarea>`)}
      ${isEv?F("issue","母議題",par?esc(par.title):noneTxt("不連結"),()=>fieldHTML({name:"evIssue",label:"完成紀錄會寫進這個議題的處理紀錄",type:"select",value:o.issueId||"",options:opts})):""}
    </div>`;
}
/* 進度卡片的詳情頁：progOpen＝正在看的議題 id（null＝看甘特圖）。議題不見了（刪除、結案後儲存）就自動回甘特圖 */
function renderCards(){
  if(!editing)ifFld=null;
  const it=progOpen&&activeIssues().find(i=>i.id===progOpen);
  if(progOpen&&!it)progOpen=null;
  $("#ganttEdBtn").hidden=!!it;   /* 甘特圖時間軸的「編輯」只在看甘特圖時出現 */
  $("#pvBack").innerHTML=ico("prev","sm")+"返回甘特圖";
  $("#cardDetail").innerHTML=it?cardHTML(it,true,true,false):"";
  $("#pvGantt").hidden=!!it;$("#pvDetail").hidden=!it;
}
/* 甘特圖 ⇄ 詳情切換：原本的畫面往下淡出，新的畫面往上淡入（id＝要看的議題，null＝回甘特圖） */
let pvTok=0;
function progShow(id,then){   /* then：換好畫面後要做的事（例如新增議題後把游標放進名稱欄） */
  const tok=++pvTok,out=$(progOpen?"#pvDetail":"#pvGantt");
  [$("#pvGantt"),$("#pvDetail")].forEach(p=>p.getAnimations().forEach(a=>a.cancel()));
  const swap=()=>{if(tok!==pvTok)return;progOpen=id;renderCards();layoutAll();
    const sc=$("#pageMain"),d=$("#progPanel").getBoundingClientRect().top-sc.getBoundingClientRect().top-12;if(d<0)sc.scrollTop+=d;   /* 卡片頂端捲出畫面時捲回來 */
    if(!reduceMotion())$(id?"#pvDetail":"#pvGantt").animate([{opacity:0,transform:"translateY(16px)"},{opacity:1,transform:"none"}],{duration:340,easing:"cubic-bezier(.2,.9,.25,1)"});
    if(then)then()};
  if(reduceMotion()||out.hidden){swap();return}
  const a=out.animate([{opacity:1,transform:"none"},{opacity:0,transform:"translateY(12px)"}],{duration:160,easing:"cubic-bezier(.4,0,1,1)",fill:"forwards"});
  a.onfinish=()=>{swap();a.cancel()};
}

/* ===== 即時回報 =====
   組成：共用小片段（狀態列、時間標記、連結、編輯工具）→ 膠囊 evCapHTML → 右側詳情 evDetailHTML → 整區 renderEvents。
   哪一顆在編輯由 cardEd("e",id) 決定（展開後按那顆的「編輯」；render.js 的單卡編輯），編輯中逐欄修改。 */
/* 狀態列：狀態標籤、第幾段、最後更新（膠囊與右側詳情共用） */
function evMetaHTML(ev,st){
  return `<p class="ev-meta"><span class="ev-st">${EV_ST[st]}</span>${ev.round>1?`<span>第 ${ev.round} 段</span>`:""}${ev.touchedAt?`<span>最後更新 <span class="num">${fmt(ev.touchedAt).slice(5)} ${ev.touchedAt.slice(11,16)}</span></span>`:""}</p>`;
}
/* 時間標記清單（即時回報區、完成紀錄共用） */
function evTimesHTML(ev){
  const par=parentOf(ev),ts=evTimesSorted(ev);if(!ts.length)return "";
  return `<ol class="ev-times">${ts.map(t=>`<li>${evTimeView(t,par)}</li>`).join("")}</ol>`;
}
/* 連結按鈕列 */
function evLinksHTML(ev){
  if(!ev.links.length)return "";
  return `<div class="links ev-links">${ev.links.map(l=>`<a class="link" style="--c:${esc(l.color)}" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join("")}</div>`;
}
/* ---------- 逐欄編輯（按了卡片的「編輯」之後） ----------
   檢視時照常顯示內容；編輯中每一欄本身就是可以點的（滑過去底色微亮、游標變成可點），點哪一欄只有那一欄變成輸入框，其他照常顯示。
   沒有鉛筆鈕：點標題才改標題、點母議題才改母議題。「完成」（或 Enter、或直接點別欄）存回，「取消」（或 Esc）放棄。
   一次只開一欄：evFld＝{ev:即時回報 id,k:欄位}；k＝name／desc／issue／staff／labels／t:時間標記 id／l:連結 id（t:+、l:+ 是新增）。
   膠囊（手機、總覽）與右側詳情共用同一套（evFieldsHTML）；存回在 events.js 的「逐欄編輯」段 */
let evFld=null;
const evFldOpen=(ev,k)=>!!evFld&&evFld.ev===ev.id&&evFld.k===k;
/* 一欄（即時回報、進度、完成紀錄共用）：標題＋內容（整個內容是一顆按鈕，點了就編這一欄）；打開時換成輸入框＋取消／完成。
   o＝{open,k,label,view,editor（函式，打開時才產生）,del（多一顆刪除）,key／pen／fx（data 屬性名：欄位、點內容、按鈕）,attr（外框多帶的屬性）} */
function fldRowHTML(o){
  const lb=o.label?`<span class="evf-l">${o.label}</span>`:"",at=o.attr?" "+o.attr:"";
  if(o.open)return `<div class="evf open" data-${o.key}="${o.k}"${at}>${lb}<div class="evf-ed">${o.editor()}</div>
        <div class="evf-btns">${o.del?`<button type="button" class="icon danger" data-${o.fx}="del">刪除</button><span class="evd-gap"></span>`:""}<button type="button" class="ghost" data-${o.fx}="cancel">取消</button><button type="button" class="primary" data-${o.fx}="ok">完成</button></div></div>`;
  return `<div class="evf" data-${o.key}="${o.k}"${at}>${lb}<button type="button" class="evf-v" data-${o.pen}="${o.k}" title="點一下修改${o.label||"這一項"}">${o.view}</button></div>`;
}
function evFieldHTML(ev,k,label,view,editor){return fldRowHTML({open:evFldOpen(ev,k),k,label,view,editor,del:/^[tl]:(?!\+)/.test(k),key:"evfk",pen:"evpen",fx:"evfx"})}
/* 時間的文字：「日期 時刻 名稱 期間 · 地點」（顯示與編輯中共用） */
function evTimeView(t,par){const x=evTimeText(t);
  return `<span class="num ev-t-when">${x.when}</span><span class="ev-t-label">${esc(t.label)}</span>${x.span?`<span class="sub num">${x.span}</span>`:""}${t.place?`<span class="ev-t-place">· ${esc(t.place)}</span>`:""}${t.toIssue&&par?`<span class="sub" title="這筆也寫進母議題的處理紀錄">（母議題）</span>`:""}`}
/* 時間標記的輸入框（名稱、日期、時刻、結束、地點、寫進母議題） */
function evTimeEditor(ev,tm){
  const par=parentOf(ev),sp=x=>[(x||"").slice(0,10),(x||"").slice(11,16)],[sd,st]=tm?sp(tm.start):[today(),""],[ed,et]=tm?sp(tm.end):["",""];
  const inp=(k,v,ph,type)=>`<input ${type?`type="${type}"`:""} data-e="${k}" value="${esc(v||"")}" ${ph?`placeholder="${esc(ph)}"`:""}>`;
  return `${inp("label",tm&&tm.label,"這個時間是什麼（例如：與總務處開會）")}
          <span class="evd-when">${inp("sd",sd,"","date")}${inp("st",st,"時刻")}<span class="sub">～</span>${inp("ed",ed,"","date")}${inp("et",et,"時刻")}</span>
          <span class="sub evf-hint">只填日期＝一個日子；加時刻＝具體時間；填結束＝一段期間</span>
          <span class="evd-place">${inp("place",tm&&tm.place,"地點（選填，例如：學生會辦公室）")}${placeQuickHTML()}</span>
          ${par?`<label class="fld-check"><input type="checkbox" data-e="toIssue" ${tm&&tm.toIssue?"checked":""}><span>也寫進母議題的處理紀錄</span></label>`:""}`;
}
/* 連結的輸入框（顏色、名稱、網址） */
function evLinkEditor(ev,l){return linkEditorHTML(l,ev.links.length,"evfx")}
/* 連結輸入框（即時回報、議題共用）：n＝目前幾個連結（新增時輪流選顏色），fx＝按鈕的 data 屬性名 */
function linkEditorHTML(l,n,fx){
  const c=l?l.color:COLORS[n%COLORS.length];
  return `<span class="evd-row evd-link"><button type="button" class="evd-sw" style="background:${esc(c)}" data-${fx}="color" data-c="${esc(c)}" aria-label="換顏色"></button><input data-e="name" value="${esc(l?l.name:"")}" placeholder="按鈕名稱"><input data-e="url" value="${esc(l?l.url:"")}" placeholder="https://" inputmode="url"></span>`;
}
/* 編輯中的內容：每一欄各自可以點 */
function evFieldsHTML(ev){
  const par=parentOf(ev),ts=evTimesSorted(ev);
  const opts=[["","（不連結）"],...state.issues.map(i=>[i.id,i.title+(i.doneAt?"（已結案）":"")])];
  const staffChips=staffNames(ev.staff).map(n=>`<span class="staff-chip">${esc(n)}</span>`).join("");
  const lblChips=labelChipsHTML(ev.labels);
  return `<div class="evfs">
      ${evFieldHTML(ev,"name","名稱",`<b>${esc(ev.name)}</b>`,()=>`<input data-e="name" value="${esc(ev.name)}">`)}
      ${evFieldHTML(ev,"desc","說明",ev.desc?`<span class="evf-desc">${esc(ev.desc)}</span>`:`<span class="sub">（沒有說明，點一下填寫）</span>`,()=>`<textarea data-e="desc" rows="4" placeholder="簡短說明">${esc(ev.desc||"")}</textarea>`)}
      ${evFieldHTML(ev,"issue","母議題",par?esc(par.title):`<span class="sub">（不連結）</span>`,()=>fieldHTML({name:"evIssue",label:"結案或完成一段時，會自動寫進這個議題的處理紀錄",type:"select",value:ev.issueId||"",options:opts}))}
      ${state.members.length?evFieldHTML(ev,"staff","專員",staffChips||`<span class="sub">（沒有標專員）</span>`,()=>fieldHTML({name:"staff",label:"從本看板的身分挑選，可複選",type:"multi",value:ev.staff||[],options:staffOpts()})):""}
      ${evFieldHTML(ev,"labels","標籤",lblChips||`<span class="sub">（沒有標籤）</span>`,()=>labelPickerHTML("labels",ev.labels))}
      <div class="evf-group"><span class="evf-l">時間標記</span>
        ${ts.map(t=>evFieldHTML(ev,"t:"+t.id,"",evTimeView(t,par),()=>evTimeEditor(ev,t))).join("")}
        ${evFldOpen(ev,"t:+")?evFieldHTML(ev,"t:+","",'',()=>evTimeEditor(ev,null)):`<button type="button" class="ghost evd-add" data-evpen="t:+">${ico("calendar")}+ 時間</button>`}</div>
      <div class="evf-group"><span class="evf-l">超連結</span>
        ${ev.links.map(l=>evFieldHTML(ev,"l:"+l.id,"",`<span class="link" style="--c:${esc(l.color)}">${esc(l.name)}</span><span class="sub evf-url">${esc(l.url)}</span>`,()=>evLinkEditor(ev,l))).join("")}
        ${evFldOpen(ev,"l:+")?evFieldHTML(ev,"l:+","",'',()=>evLinkEditor(ev,null)):`<button type="button" class="ghost evd-add" data-evpen="l:+">+ 超連結</button>`}</div>
    </div>`;
}
/* 展開膠囊裡的動作列（編輯中）：欄位改用鉛筆，這裡只剩整筆的動作 */
function evToolsHTML(ev){
  return `<span class="ev-tools"><button type="button" class="icon" data-evrep aria-pressed="${ev.report}">${ev.report?"取消報告":"會議要報告"}</button><button type="button" class="icon" data-evround>${ico("progress")}完成這一段</button><button type="button" class="icon" data-evdone>${ico("check")}結案</button></span>`;
}
/* 一顆膠囊。o：md＝左右兩欄中、sel＝被選到、next＝「下一個」記號。展開後最下面一顆「編輯」（登入才看得到）；編輯中換成逐欄編輯＋整筆動作＋「取消｜儲存」 */
function evCapHTML(ev,o){
  const st=evStatus(ev),par=parentOf(ev),sel=o.md&&ev.id===o.sel,ed=cardEd("e",ev.id);
  /* 左右兩欄時被選到的那顆只是清單裡的空位，內容在右側詳情，不重複畫編輯欄位 */
  const body=ed&&!sel?`${evMetaHTML(ev,st)}${evFieldsHTML(ev)}${evToolsHTML(ev)}${editBarHTML()}`
    :`${par?`<p class="ev-parent-full">母議題：${esc(par.title)}</p>`:""}${evMetaHTML(ev,st)}${ev.desc?`<p>${esc(ev.desc)}</p>`:`<p class="sub">（沒有說明）</p>`}
        ${evTimesHTML(ev)}${staffHTML(ev.staff)}${labelChipsHTML(ev.labels)}
        ${evLinksHTML(ev)}${sel?"":`<div class="ev-edrow">${editBtnHTML("e:"+ev.id)}</div>`}`;
  return `<details class="ev ${sel?"sel":""} ${ev.id===o.next?"next":""} ${ed?"sec-edit":""}" data-ev="${ev.id}" data-edbox="e:${ev.id}" data-st="${st}" ${!o.md&&(openEv.has(ev.id)||ed)?"open":""}${sel?' aria-current="true"':""}>
      <summary><span class="live-dot" aria-hidden="true"></span><b>${esc(ev.name)}</b>${par?`<span class="ev-parent">→ ${esc(par.title)}</span>`:""}${ev.report?'<span class="ev-rep">報告</span>':""}<button type="button" class="ev-del edit-only" data-evdel aria-label="刪除「${esc(ev.name)}」">${ico("close","solo")}</button><span class="ev-chev" aria-hidden="true">▾</span></summary>
      <div class="ev-body">${body}</div>
    </details>`;
}
/* 右側詳情（桌面、即時回報被選到時）：檢視時只看內容，標題列有「編輯」；編輯中一次改一欄，最下面「取消｜儲存」 */
function evDetailHTML(ev){
  const st=evStatus(ev),par=parentOf(ev),ed=cardEd("e",ev.id);
  const head=`<div class="evd-head"><span class="live-dot" aria-hidden="true"></span><b>${esc(ev.name)}</b>${ev.report?'<span class="ev-rep">報告</span>':""}${editBtnHTML("e:"+ev.id)}${mdStepHTML("live",liveOrder().map(e=>e.id),ev.id)}<button type="button" class="icon md-close" data-mdclose="live" aria-label="收起右側">${ico("close")}收起</button></div>
    ${evMetaHTML(ev,st)}`;
  if(!ed)return `<div class="evd" data-ev="${ev.id}" data-st="${st}">${head}
    ${par?`<p class="sub evd-par">母議題：${esc(par.title)}</p>`:""}
    ${ev.desc?`<p class="evd-desc">${esc(ev.desc)}</p>`:`<p class="sub">（沒有說明）</p>`}
    ${evTimesHTML(ev)}${staffHTML(ev.staff)}${labelChipsHTML(ev.labels)}
    ${evLinksHTML(ev)}</div>`;
  return `<div class="evd editing sec-edit" data-ev="${ev.id}" data-edbox="e:${ev.id}" data-st="${st}">${head}
    ${evFieldsHTML(ev)}
    <section class="evd-sec evd-acts">
      <div class="evd-round" hidden><label class="evd-f">這一段完成了什麼（存進完成紀錄）<textarea data-rf="done" rows="3">${esc(ev.desc||"")}</textarea></label>
        <label class="evd-f">下一段要追蹤什麼（取代說明；留空就沿用）<textarea data-rf="next" rows="2" placeholder="例如：等總務處回覆維修時程"></textarea></label>
        <div class="evd-btns"><button type="button" class="ghost" data-evd="roundcancel">取消</button><button type="button" class="primary" data-evd="roundok">完成第 ${ev.round} 段</button></div></div>
      <div class="evd-btns evd-main"><button type="button" class="icon danger" data-evdel>刪除</button><span class="evd-gap"></span><button type="button" class="icon" data-evrep aria-pressed="${ev.report}">${ev.report?"取消報告":"會議要報告"}</button><button type="button" class="icon" data-evd="round">${ico("progress")}完成這一段</button><button type="button" class="icon" data-evdone>${ico("check")}結案</button></div>
    </section>${editBarHTML()}</div>`;
}
/* 左右兩欄詳情卡上的「上一個／下一個」（開會時照清單順序一路講下去；鍵盤左右鍵同功能，見 motion.js） */
function mdStepHTML(k,ids,id){const i=ids.indexOf(id);
  return `<span class="md-step"><button type="button" class="icon" data-mdstep="${k}" data-dir="-1" ${i<=0?"disabled":""} aria-label="上一個">${ico("prev")}上一個</button><button type="button" class="icon" data-mdstep="${k}" data-dir="1" ${i<0||i>=ids.length-1?"disabled":""} aria-label="下一個">下一個${ico("next")}</button></span>`}
/* 會議要報告：ev.report 為真的排在上方「會議報告事項」區，其他在下方；生成週報後標記自動清掉。
   上一個／下一個、「下一個」記號都照畫面順序（上區再下區） */
const liveOrder=()=>{const a=state.events.filter(ev=>!ev.doneAt);return[...a.filter(e=>e.report),...a.filter(e=>!e.report)]};
function renderEvents(){
  const live=liveOrder(),rep=live.filter(e=>e.report),rest=live.filter(e=>!e.report);if(selEv&&!live.some(e=>e.id===selEv))selEv=null;
  /* 左右兩欄只在點選一筆之後才出現；沒選的時候照常排成膠囊格 */
  const md=mdOn("live")&&!!selEv,pane=$("#evDetail");mdLast.live=mdOn("live");
  $("#liveMD").classList.toggle("split",md);
  if(!editing)evFld=null;
  const o={md,sel:selEv,next:md?(live[live.findIndex(e=>e.id===selEv)+1]||{}).id:null};   /* next：畫面順序裡的下一顆，加「下一個」記號 */
  const cap=ev=>evCapHTML(ev,o);
  const addBtn=`<button type="button" class="ghost auth-only add-row" id="addEvent">+ 新增即時回報</button>`;   /* 新增鈕排在格子最後一格，跟一顆膠囊一樣大（登入、沒有卡片在編輯時顯示） */
  const empty=`<p class="empty">${state.locked?"目前沒有即時回報。":"需要即時回報的事項放這裡，只要名稱和說明。登入後按「+ 新增即時回報」。"}</p>`;
  /* 2026-11-06 使用者從預覽選 D：報告區不寫區名（每顆膠囊右邊自己標「報告」），其他回報上面一條細線、中間小字區名 */
  const zone=(k,h,list,tail)=>`<div class="ev-zone" data-zone="${k}">${h?`<div class="ev-zone-h"><span>${h}</span></div>`:""}<div class="events">${list.length?list.map(cap).join(""):h?"":empty}${tail}</div></div>`;
  $("#events").innerHTML=rep.length?zone("rep","",rep,"")+"\n      "+zone("rest","其他回報",rest,addBtn):zone("rest","",live,addBtn);
  if(md){pane.innerHTML=evDetailHTML(live.find(e=>e.id===selEv));pane.hidden=false}else{pane.innerHTML="";pane.hidden=true}
  Anim.syncPings();
}

/* 完成紀錄：一般是可展開的清單；桌面放大成全寬時（mdOn）改成左側清單、右側詳情 */
function renderDone(){
  const ds=doneIssues();
  const de=state.events.filter(ev=>ev.doneAt);
  const ids=new Set([...ds.map(i=>i.id),...de.map(e=>e.id)]);
  const dnew=id=>prevDone&&!prevDone.has(id)?"new":"";
  const link=l=>`<a class="link" style="--c:${esc(l.color)}" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.name)}</a>`;
  /* 每一筆拆成：屬性、標題、副標、內容，膠囊與右側詳情共用。內容最下面「編輯」（登入才看得到）；
     編輯中（cardEd）名稱、完成日期、說明（即時回報多母議題）換成逐欄編輯（doneFieldsHTML），最下面「取消｜儲存」 */
  const tail=(key,ed)=>ed?editBarHTML():`<div class="ev-edrow">${editBtnHTML(key)}</div>`;
  const items=ds.map(it=>{const ed=cardEd("i",it.id);return {id:it.id,ed,key:"i:"+it.id,d:it.doneAt||"",attr:`data-issue="${it.id}"`,title:esc(it.title),sub:`${fmt(it.doneAt)||"—"} · 議題`,del:`data-deldone aria-label="刪除「${esc(it.title)}」"`,
    body:`${ed?doneFieldsHTML(it,false):""}${hasDates(it)?`<div class="sub">期間 ${fmt(it.start)} – ${fmt(it.end)}</div>`:""}
        ${!ed&&it.note?`<p style="margin:0;white-space:pre-wrap">${esc(it.note)}</p>`:""}
        ${it.tags.length?`<div class="tags">${it.tags.map((g,k)=>`<span class="tag ${k===it.cur?"cur":k<it.cur?"past":""}">${esc(g)}</span>`).join("")}</div>`:""}
        ${it.markers.length?`<ul>${sortedMarkers(it).map(m=>`<li>${m.date?`<span class="num">${fmt(m.date)}</span> `:""}${m.stage?`【${esc(m.stage)}】`:""}${esc(m.text)}</li>`).join("")}</ul>`:""}
        ${it.links.length?`<div class="links">${it.links.map(link).join("")}</div>`:""}
        <span class="edit-only" style="gap:6px"><button type="button" class="icon" data-restore>取消結案</button></span>${tail("i:"+it.id,ed)}`}})
  .concat(de.map(ev=>{const ed=cardEd("e",ev.id);return {id:ev.id,ed,key:"e:"+ev.id,d:ev.doneAt,attr:`data-ev="${ev.id}"`,title:esc(evName(ev)),sub:`${fmt(ev.doneAt)||"—"} · 即時回報${parentOf(ev)?` → ${esc(parentOf(ev).title)}`:""}`,del:`data-evdel aria-label="刪除「${esc(ev.name)}」"`,
    body:`${ed?doneFieldsHTML(ev,true):ev.desc?`<p style="margin:0;white-space:pre-wrap">${esc(ev.desc)}</p>`:""}${(ev.links||[]).length?`<div class="links">${ev.links.map(link).join("")}</div>`:""}
        ${evTimesHTML(ev)}
        ${ev.fromEv?"":`<span class="edit-only" style="gap:6px"><button type="button" class="icon" data-evundo>移回即時回報</button></span>`}${tail("e:"+ev.id,ed)}`}}))
  .sort((a,b)=>b.d.localeCompare(a.d));
  /* 跟即時回報同一套膠囊與左右兩欄（class ev＋done-ev、data-st="done"）：收合是空心綠框綠字，展開跟即時回報一樣；data-done＝這一筆的 id */
  if(!items.some(x=>x.id===selDone))selDone=null;
  const md=mdOn("done")&&!!selDone,pane=$("#doneDetail");mdLast.done=mdOn("done");
  $("#doneMD").classList.toggle("split",md);
  $("#doneCount").textContent=items.length;
  const nextDone=md?(items[items.findIndex(y=>y.id===selDone)+1]||{}).id:null;
  const cap=x=>`<details class="ev done-ev ${dnew(x.id)} ${md&&x.id===selDone?"sel":""} ${x.id===nextDone?"next":""} ${x.ed?"sec-edit":""}" data-done="${x.id}" data-edbox="${x.key}" ${x.attr} data-st="done" ${!md&&(openDone.has(x.id)||x.ed)?"open":""}${md&&x.id===selDone?' aria-current="true"':""}>
      <summary><span class="live-dot" aria-hidden="true"></span><b>${x.title}</b><button type="button" class="ev-del edit-only" ${x.del}>${ico("close","solo")}</button><span class="ev-chev" aria-hidden="true">▾</span></summary>
      <div class="ev-body"><p class="ev-meta">${x.sub}</p><div class="done-body">${md&&x.id===selDone?"":x.body}</div></div></details>`;   /* 左右兩欄時被選到的那顆只是空位，內容（含編輯欄位）只畫在右側詳情 */
  $("#doneList").innerHTML=items.map(cap).join("")||`<p class="empty">結案的議題和完成的即時回報會收進這裡。</p>`;
  if(md){const x=items.find(y=>y.id===selDone);
    pane.innerHTML=`<div class="evd ${x.ed?"sec-edit":""}" data-st="done" data-done="${x.id}" data-edbox="${x.key}" ${x.attr}><div class="evd-head"><span class="live-dot" aria-hidden="true"></span><b>${x.title}</b>${mdStepHTML("done",items.map(y=>y.id),x.id)}<button type="button" class="icon md-close" data-mdclose="done" aria-label="收起右側">${ico("close")}收起</button></div>
      <p class="ev-meta">${x.sub}</p><div class="done-body">${x.body}</div></div>`;pane.hidden=false;
  }else{pane.innerHTML="";pane.hidden=true}
  prevDone=ids;Anim.syncPings();
}
/* 左右兩欄時換選一筆：右側內容淡入（完成紀錄與個別進度共用） */
function mdPaneIn(el){if(el&&!reduceMotion())el.animate([{opacity:0,transform:"translateX(14px)"},{opacity:1,transform:"none"}],{duration:280,easing:"cubic-bezier(.2,.9,.25,1)"})}

