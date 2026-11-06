/* 核心｜秘書處的「會議報告事項」（只能看）與「會議編輯」（會長室開放才能改）面板（設定檔 meeting:true），以及會長室的授權開關（grant:true）
   - 列出各部門標了「會議要報告」（ev.report）的即時回報，依部門分組；會長室追蹤一樣的讀法，但會記住 sha 以便寫回。
   - 「會議編輯」：會長室今天開放（會長室資料的 meetGrant.date＝今天）時，登入後按這區的「編輯」，，卡片跟部門自己的即時回報同一套逐欄編輯（點哪欄改哪欄：名稱、說明、母議題、專員、標籤、時間標記與地點、連結）。
     做法：畫面與存回時把全域 state 暫時換成那個部門的資料（withState），所以 views.js／events.js 的逐欄編輯不用另寫一份。
   - 按「儲存並同步」：秘書處自己的資料照常存；改過的部門各自寫回 data-代號.json（同一個 repo、同一把權杖），
     commit 訊息照現行格式，作者是秘書處目前登入的身分（該部門的編輯紀錄會看到「〔秘書處 名字〕」）。按「取消」放棄。
   - 「會議要報告」標記仍由各部門生成週報時自動清掉；這裡不改標記本身。 */
const MT={depts:new Map(),loading:false,at:0};   /* dept id → {data,base,sha,err,dirty} */
function withState(s,fn){const keep=state;state=s;try{return fn()}finally{state=keep}}
const mtOf=el=>{const b=el&&el.closest&&el.closest("[data-mtdept]");return b?MT.depts.get(b.dataset.mtdept):null};
async function mtLoadAll(force){
  if(!CFG.meeting||MT.loading||(!force&&Date.now()-MT.at<3e5&&MT.depts.size))return;
  if(editing&&[...MT.depts.values()].some(x=>x.dirty))return;   /* 改到一半不要被覆蓋 */
  MT.loading=true;renderMeet();
  const cc=cloudCfg(),tok=ghToken();
  await Promise.all((window.BOARD_DEPTS||[]).filter(d=>d.id!==CFG.deptId).map(async d=>{
    let data=null,sha=null,err="";
    try{
      if(cc.owner&&cc.repo&&tok){const r=await fetch(apiURL({...cc,path:d.path})+`?ref=${encodeURIComponent(cc.branch)}&t=${Date.now()}`,{headers:{Accept:"application/vnd.github+json",Authorization:"Bearer "+tok},cache:"no-store"});
        if(r.ok){const j=await r.json();sha=j.sha;data=JSON.parse(b64dec(j.content))}else if(r.status===404)err="還沒有資料"}
      if(!data&&!err&&location.protocol!=="file:"){const r=await fetch(d.path,{cache:"no-cache"});if(r.ok)data=await r.json();else err="還沒有資料"}
    }catch(_){err="讀不到資料"}
    if(data)data=normalize(data);
    MT.depts.set(d.id,{id:d.id,name:d.name,data,base:data&&JSON.parse(JSON.stringify(data)),sha,err,dirty:false});
  }));
  MT.loading=false;MT.at=Date.now();render();
}
/* 會長室的授權：會長室資料的 meetGrant.date 是今天才算開放（過了那天自動失效） */
function mtGrant(){const pr=MT.depts.get("president"),g=pr&&pr.data&&pr.data.meetGrant;return g&&g.date===today()?g:null}
const mtCanEdit=()=>secEd("meetedit")&&!!mtGrant();
/* 一個部門的報告事項卡片（ed＝畫成可以點欄位編輯）。2026-11-06 起一次只畫一個部門（MTS.sel） */
const MTS={sel:""};
const mtEvs=m=>m&&m.data?m.data.events.filter(e=>!e.doneAt&&e.report):[];
function mtGroupHTML(m,ed){
  const evs=mtEvs(m);if(!evs.length)return "";
  return `<section class="mt-dept" data-mtdept="${m.id}" data-fk="mt${m.id}"><h3>${ed&&m.dirty?'<span class="sub">已修改，儲存後寫回</span>':""}<a class="fw-open" href="?d=${encodeURIComponent(m.id)}" target="_blank" rel="noopener">開啟看板 →</a></h3>
    <div class="mt-list">${withState(m.data,()=>evs.map(e=>{const st=evStatus(e);
      return `<article class="mt-ev" data-ev="${e.id}" data-st="${st}"><div class="mt-top"><span class="live-dot" aria-hidden="true"></span><b>${esc(e.name)}</b><span class="ev-st">${EV_ST[st]}</span></div>
        ${ed?evFieldsHTML(e):`${parentOf(e)?`<p class="sub">母議題：${esc(parentOf(e).title)}</p>`:""}${e.desc?`<p class="fw-text">${esc(e.desc)}</p>`:""}${evTimesHTML(e)}${staffHTML(e.staff)}${labelChipsHTML(e.labels)}${evLinksHTML(e)}`}</article>`}).join(""))}</div></section>`;
}
/* 秘書處「會議」分頁的報告事項（2026-11-06 使用者：一個一個編輯每個部門釘選要報告的即時回報，最後根據改動的紀錄匯出會議紀錄 PDF）：
   上面一排有報告事項的部門（件數；改過還沒儲存的部門有小圓點），一次看一個；下面上一個／下一個部門。
   會長室今天開放時，按這張的「編輯」就能改（每個部門都能改，切換部門不會丟掉；按「儲存」才一起寫回）。沒有報告事項的部門列在最下面一行 */
function renderMeet(){
  const edp=$("#meetEdPanel");if(!edp)return;
  edp.hidden=!CFG.meeting;if(!CFG.meeting)return;
  if(!MT.depts.size&&!MT.loading){mtLoadAll();return}
  const ms=[...MT.depts.values()],has=ms.filter(m=>mtEvs(m).length),none=ms.filter(m=>m.data&&!mtEvs(m).length),errs=ms.filter(m=>!m.data&&m.err!=="還沒有資料");
  if(!has.some(m=>m.id===MTS.sel))MTS.sel=has[0]?has[0].id:"";
  const g=mtGrant(),btn=edp.querySelector("[data-edit]");
  btn.hidden=!g;   /* 會長室今天有開放才有「編輯」（登入才看得到，見 board.css「單卡編輯」段） */
  $("#meetEdSt").innerHTML=g?`<span class="grant-on">會長室已開放</span>（${esc(g.by||"會長室")}，${esc((g.at||"").slice(11,16))}）· 今天 23:59 前可以修改${secEd("meetedit")?"":" · 登入後按「編輯」"}`
    :`<span class="grant-off">尚未開放修改</span>：要會長室在「會長室」分頁打開「秘書處會議編輯」，當天有效。`;
  $("#meetPick").innerHTML=has.map(m=>`<button type="button" role="tab" class="wk-d" data-mtpick="${m.id}" aria-selected="${m.id===MTS.sel}">${m.dirty?'<i class="wk-new" aria-label="已修改"></i>':""}${esc(m.name)}<span class="num">${mtEvs(m).length}</span></button>`).join("");
  const ed=mtCanEdit(),loading=MT.loading&&!MT.depts.size?`<p class="sub">讀取各部門資料中…</p>`:"";
  $("#meetEdList").innerHTML=loading+(MTS.sel?mtGroupHTML(MT.depts.get(MTS.sel),ed):MT.depts.size?`<p class="empty">目前沒有部門標「會議要報告」。各部門在自己的即時回報按「會議要報告」後會出現在這裡。</p>`:"")
    +(none.length?`<p class="sub mt-none">沒有報告事項：${none.map(m=>esc(m.name)).join("、")}</p>`:"")
    +(errs.length?`<p class="sub">讀不到：${errs.map(m=>esc(m.name)).join("、")}</p>`:"")+(ed&&!ghToken()?`<p class="sub">這台裝置沒有權杖，改了也寫不回其他部門。</p>`:"");
  const i=has.findIndex(m=>m.id===MTS.sel);
  $("#meetStep").innerHTML=has.length>1?`<button type="button" class="icon" data-mtstep="-1"${i>0?"":" disabled"}>${ico("prev")}${i>0?esc(has[i-1].name):"上一個部門"}</button><span class="sub num">${i+1} / ${has.length}</span><button type="button" class="icon" data-mtstep="1"${i<has.length-1?"":" disabled"}>${i<has.length-1?esc(has[i+1].name):"下一個部門"}${ico("next")}</button>`:"";
  const mins=state.minutes||[];
  $("#minutesInfo").textContent=mins.length?`已記錄 ${mins.length} 次會議（最近 ${fmt(mins[mins.length-1].date)}，${mins[mins.length-1].items.length} 項修改）`:"寫回各部門的修改會自動記下來，之後可以匯出成會議紀錄";
  renderWeekRead();
}
/* 換部門：清單淡出、新部門由下往上淡入 */
function mtPick(id){
  if(!id||id===MTS.sel)return;MTS.sel=id;const box=$("#meetEdList");
  renderMeet();if(box&&!reduceMotion())box.animate([{opacity:0,transform:"translateY(10px)"},{opacity:1,transform:"none"}],{duration:MO.base,easing:MO.out});
}
document.addEventListener("click",e=>{
  const t=e.target;if(!t.closest||!t.closest("#meetEdPanel"))return;
  const p=t.closest("[data-mtpick]");if(p){mtPick(p.dataset.mtpick);return}
  const st=t.closest("[data-mtstep]");if(st){const has=[...MT.depts.values()].filter(m=>mtEvs(m).length),i=has.findIndex(m=>m.id===MTS.sel)+(+st.dataset.mtstep);if(has[i]){mtPick(has[i].id);$("#meetEdPanel").scrollIntoView({block:"start",behavior:reduceMotion()?"auto":"smooth"})}return}
  if(t.closest("#minutesBtn"))minutesDialog();
});
/* ---------- 會長室：開放秘書處會議編輯的開關（設定檔 grant:true） ----------
   切到「開放今天」＝寫入 state.meetGrant＝{date:今天,by,at}，立刻儲存並同步（編輯中就併入這次編輯）；隔天自動失效。
   要登入才能切；取消登入或儲存失敗就切回原本的位置 */
const grantOn=()=>!!(state.meetGrant&&state.meetGrant.date===today());
/* 會長室的開關（2026-11-06 使用者：不用這麼大，小小一個開關；在「會長室」分頁）：點一下切換，要登入；狀態只寫一句短的 */
function renderGrant(){
  const p=$("#grantPanel");if(!p)return;p.hidden=!CFG.grant;if(!CFG.grant)return;
  const sw=$("#grantSw"),on=grantOn(),g=state.meetGrant;
  sw.setAttribute("aria-checked",on);sw.classList.toggle("on",on);
  $("#grantSt").textContent=on?`今天開放中（${g.by||""} ${(g.at||"").slice(11,16)} 開，23:59 自動關閉）`:"關閉：秘書處只能看各部門的報告事項";
  if(!sw._wired){sw._wired=true;sw.addEventListener("click",async()=>{
    const want=!grantOn();sw.classList.toggle("on",want);
    if(readOnly()||!(await ensureLogin())){renderGrant();return}
    await settingSave(()=>{state.meetGrant=want?{date:today(),by:meName(),at:nowStr()}:null},want?"已開放秘書處今天的會議編輯":"已關閉秘書處的會議編輯");
    render()})}
}
/* 存回：秘書處自己的資料存完後，改過的部門各自寫回 */
async function mtPushAll(){
  const cc=cloudCfg(),tok=ghToken(),who=meName()?`秘書處 ${meName()}`:"秘書處";
  const dirty=[...MT.depts.values()].filter(m=>m.dirty&&m.data);if(!dirty.length)return;
  if(!tok){toast("沒有權杖，其他部門的修改沒有寫回");return}
  /* 寫回前再讀一次會長室的授權（可能剛被關掉或已過了當天） */
  const pr=await fwLoad("president",true),g=pr&&pr.data&&pr.data.meetGrant;
  if(!g||g.date!==today()){dirty.forEach(m=>{m.data=JSON.parse(JSON.stringify(m.base));m.dirty=false});render();toast("會長室的授權已經關閉或過期，其他部門的修改沒有寫回");return}
  const fails=[],rec=[];
  for(const m of dirty){
    const items=mtDiff(m);
    const d=fwDept(m.id);m.data.savedAt=nowStr();m.data.savedBy=who;
    const body={message:commitMessage(m.base,m.data,who),content:b64enc(JSON.stringify(m.data,null,1)),branch:cc.branch};if(m.sha)body.sha=m.sha;
    try{const r=await fetch(apiURL({...cc,path:d.path}),{method:"PUT",headers:{Accept:"application/vnd.github+json",Authorization:"Bearer "+tok,"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(r.ok){const j=await r.json();m.sha=j.content&&j.content.sha;m.base=JSON.parse(JSON.stringify(m.data));m.dirty=false;rec.push(...items)}
      else fails.push(m.name+(r.status===409||r.status===422?"（對方剛存過，請重新整理再改）":""))}
    catch(_){fails.push(m.name)}
  }
  render();toast(fails.length?`沒有寫回：${fails.join("、")}`:`已寫回 ${dirty.map(m=>m.name).join("、")}`);
  if(rec.length){mtRecord(rec);await persist("已記進今天的會議紀錄");render()}   /* 寫回成功的修改記進秘書處自己的資料（state.minutes），再存一次 */
}
/* ---------- 會議紀錄（2026-11-06）：寫回各部門成功時，記下改了哪一筆、哪些欄位、改完的內容 ----------
   state.minutes[]＝{id,date,by:[名字],items:[{dept,deptName,ev,name,desc,times:[{label,start,end,place}],changed:[欄位],before:{desc}|null,at}]}，
   同一天的修改併成一次會議；同一筆改很多次只留一列（欄位累加、內容是最後的樣子、before 是當天第一次改之前的說明）。
   存在秘書處自己的資料檔（公開的 repo）。匯出：選日期 → report.js 的預覽（openReport 第三個參數）→ 存成 PDF */
const MT_F=[["name","名稱"],["desc","說明"],["times","時間"],["links","連結"],["staff","專員"],["labels","標籤"],["issueId","母議題"]];
function mtDiff(m){
  const B=new Map((m.base.events||[]).map(e=>[e.id,e])),out=[];
  (m.data.events||[]).forEach(e=>{const b=B.get(e.id);
    const ch=b?MT_F.filter(([k])=>JSON.stringify(e[k]??null)!==JSON.stringify(b[k]??null)).map(f=>f[1]):["新增"];if(!ch.length)return;
    out.push({dept:m.id,deptName:m.name,ev:e.id,name:e.name,desc:e.desc||"",times:(e.times||[]).map(t=>({label:t.label||"",start:t.start||"",end:t.end||"",place:t.place||""})),changed:ch,before:b?{desc:b.desc||""}:null})});
  return out;
}
function mtRecord(items){
  const day=today(),who=meName()||"秘書處";state.minutes=state.minutes||[];
  let mn=state.minutes.find(x=>x.date===day);if(!mn){mn={id:uid("mn"),date:day,by:[],items:[]};state.minutes.push(mn)}
  if(!mn.by.includes(who))mn.by.push(who);
  items.forEach(x=>{const o=mn.items.find(y=>y.dept===x.dept&&y.ev===x.ev);
    if(o)Object.assign(o,{...x,changed:[...new Set([...o.changed,...x.changed])],before:o.before,at:nowStr()});else mn.items.push({...x,at:nowStr()})});
}
/* 匯出：選哪一天的會議；可以順便列出那天沒有修改的報告事項（各部門目前的內容，只有選今天時有意義） */
async function minutesDialog(){
  const mins=[...(state.minutes||[])].sort((a,b)=>b.date.localeCompare(a.date));
  if(!mins.length){await ask("還沒有會議紀錄",[],{note:"會長室開放當天，在這張卡片按「編輯」修改各部門的報告事項、按「儲存」寫回後，修改會自動記下來，就可以匯出會議紀錄。"});return}
  const v=await ask("匯出會議紀錄",[{name:"d",label:"哪一次會議",type:"select",value:mins[0].id,options:mins.map(m=>[m.id,`${fmt(m.date)}（${m.items.length} 項修改）`])},
    {name:"all",label:"也列出沒有修改的報告事項（各部門目前的內容）",type:"check",value:mins[0].date===today()}],
    {note:"會打開會議紀錄的預覽：字都可以直接改，按「存成 PDF」用瀏覽器另存。預覽裡改的字不會存進看板。"});
  if(!v||v==="alt")return;
  const mn=mins.find(m=>m.id===v.d);if(!mn)return;
  openReport(mn.date,mn.date,{label:"會議紀錄",k:"MINUTES",file:`會議紀錄_${mn.date.replaceAll("-","")}`,html:minutesHTML(mn,!!v.all)});
}
function minutesHTML(mn,all){
  const dot=s=>fmt(s).replaceAll("/","."),when=t=>{const d=(t.start||"").slice(0,10),h=(t.start||"").slice(11,16),e=(t.end||"").slice(0,10),eh=(t.end||"").slice(11,16);
    return `${d?fmt(d).slice(5):""}${h?" "+h:""}${t.end?` – ${e&&e!==d?fmt(e).slice(5):""}${eh?" "+eh:""}`:""}`};
  const order=(window.BOARD_DEPTS||[]).map(d=>d.id),byDept=new Map();
  mn.items.forEach(x=>{if(!byDept.has(x.dept))byDept.set(x.dept,{name:x.deptName,items:[]});byDept.get(x.dept).items.push(x)});
  if(all)MT.depts.forEach(m=>mtEvs(m).forEach(e=>{if(!byDept.has(m.id))byDept.set(m.id,{name:m.name,items:[]});const g=byDept.get(m.id);
    if(!g.items.some(x=>x.ev===e.id))g.items.push({dept:m.id,deptName:m.name,ev:e.id,name:e.name,desc:e.desc||"",times:(e.times||[]).map(t=>({label:t.label||"",start:t.start||"",end:t.end||"",place:t.place||""})),changed:[],before:null})}));
  const depts=[...byDept.entries()].sort((a,b)=>order.indexOf(a[0])-order.indexOf(b[0]));
  const N="一二三四五六七八九十";
  const item=x=>`<article class="rpt-issue"><h3>${esc(x.name)}<span class="rpt-st">${x.changed.length?`會議中修改：${esc(x.changed.join("、"))}`:"未修改"}</span></h3>
    ${x.desc?`<p>${esc(x.desc).replace(/\n/g,"<br>")}</p>`:""}
    ${x.times.length?`<h4>時間</h4><ul class="rpt-tl">${x.times.map(t=>`<li><span class="rpt-d">${esc(when(t))}</span>${esc(t.label)}${t.place?`（${esc(t.place)}）`:""}</li>`).join("")}</ul>`:""}
    ${x.before&&x.changed.includes("說明")&&x.before.desc!==x.desc?`<h4>修改前的說明</h4><p class="rpt-none">${esc(x.before.desc)||"（空白）"}</p>`:""}</article>`;
  const body=depts.map(([id,g],i)=>`<h3 class="rpt-h1">${N[i]||i+1}、${esc(g.name)}</h3>${g.items.map(item).join("")}`).join("")||'<p class="rpt-none">這次沒有報告事項</p>';
  const cover=`<section class="rpt-page rpt-cover">
    <div class="cv-top"><div class="cv-org"><span class="cv-logo">${suLogoColor("南臺科大學生會")}</span><b contenteditable="true">${esc(CFG.dept.name||"秘書處")}</b></div><span class="cv-date num" contenteditable="true">${dot(mn.date)}</span></div>
    <div class="cv-mid"><p class="cv-k num">MEETING MINUTES</p><h1 contenteditable="true">會議紀錄</h1><p class="cv-sub" contenteditable="true">${termCfg().yearLabel?esc(termCfg().yearLabel)+"・":""}${dot(mn.date)}</p></div>
    <div class="cv-foot"><div class="cv-col"><span>紀錄</span><span contenteditable="true">${esc(mn.by.join("、"))}</span><span contenteditable="true">南臺科技大學學生會　${esc(CFG.dept.name||"秘書處")}</span></div>
      <div class="cv-col"><span>出席</span><span contenteditable="true" data-ph="出席人員（可留白）"></span><span class="num">製表 ${dot(today())}</span></div></div></section>`;
  return cover+rptCh("mtrep","各部門報告事項",rptAuto(`<div class="rpt-body" contenteditable="true">${body}</div>`))
    +rptCh("free","討論與決議",rptTextBlk("在這裡輸入會議的討論與決議…"))+rptCh("free","臨時動議",rptTextBlk("在這裡輸入臨時動議…"));
}
/* 取消編輯：丟掉其他部門的修改 */
function mtDiscard(){MT.depts.forEach(m=>{if(m.dirty&&m.base){m.data=JSON.parse(JSON.stringify(m.base));m.dirty=false}})}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-mtrefresh]");if(b){MT.at=0;mtLoadAll(true)}});
if(CFG.meeting)document.addEventListener("visibilitychange",()=>{if(!document.hidden)mtLoadAll()});

/* ---------- 秘書處：各部門週報調閱（2026-11-05，使用者要求「秘書處有按鈕可以擷取每個部門的每週概述跟調閱」） ----------
   只讀：直接用上面 MT.depts 讀到的各部門資料（weeks[]），不另外存任何東西。「擷取最新」＝重新讀一次各部門的資料檔。
   上面一排部門膠囊（後面是週報份數；這週有新的亮綠點），下面是選到的部門：週次膠囊（新到舊）＋那一份的全文＋「複製文字」；
   「全部部門最新一份」把每個部門最新那份接在一起，可以一次複製。 */
const WK={dept:"all",week:null};
function wkThisWeek(d){return !!d&&d>=addDays(today(),-((pd(today()).getDay()+6)%7))}   /* 這週（週一起）產出的 */
function renderWeekRead(){
  const p=$("#wkPanel");if(!p)return;p.hidden=!CFG.meeting;if(!CFG.meeting)return;
  const ms=[...MT.depts.values()],ws=m=>m.data?[...m.data.weeks].filter(w=>w.text).sort((a,b)=>b.date.localeCompare(a.date)):[];
  if(WK.dept!=="all"&&!MT.depts.has(WK.dept))WK.dept="all";
  $("#wkDepts").innerHTML=[`<button type="button" role="tab" class="wk-d" data-wkd="all" aria-selected="${WK.dept==="all"}">全部最新</button>`,
    ...ms.map(m=>{const n=ws(m).length,fresh=n&&wkThisWeek(ws(m)[0].date);return `<button type="button" role="tab" class="wk-d${n?"":" none"}" data-wkd="${m.id}" aria-selected="${WK.dept===m.id}">${fresh?'<i class="wk-new" aria-label="這週有新的"></i>':""}${esc(m.name)}<span class="num">${n}</span></button>`})].join("");
  const body=$("#wkBody");
  if(MT.loading&&!ms.length){body.innerHTML=`<p class="sub">讀取各部門資料中…</p>`;return}
  const block=(m,w,head)=>`<article class="wk-doc" data-wkdoc><div class="wk-top">${head}<span class="num">${fmt(w.date)}</span>${wkThisWeek(w.date)?'<span class="wk-fresh">本週</span>':""}<button type="button" class="icon" data-wkcopy>複製文字</button></div><pre class="wk-text">${esc(w.text)}</pre></article>`;
  if(WK.dept==="all"){
    const docs=ms.map(m=>{const w=ws(m)[0];return w?block(m,w,`<span class="tag sm">${esc(m.name)}</span>`):""}).filter(Boolean);
    const miss=ms.filter(m=>!ws(m).length).map(m=>m.name);
    body.innerHTML=(docs.length?`<div class="wk-all-tools"><button type="button" class="icon" data-wkcopyall>全部複製</button></div>${docs.join("")}`:`<p class="empty">還沒有任何部門產出週報。</p>`)+(miss.length?`<p class="sub wk-miss">還沒有週報：${miss.map(esc).join("、")}</p>`:"");
    return;
  }
  const m=MT.depts.get(WK.dept),list=ws(m);
  if(!list.length){body.innerHTML=`<p class="empty">${esc(m.name)}${m.data?"還沒有週報。":esc(m.err||"讀不到資料")}</p>`;return}
  const w=list.find(x=>x.id===WK.week)||list[0];
  body.innerHTML=`<div class="wk-weeks" role="tablist" aria-label="週次">${list.slice(0,12).map(x=>`<button type="button" role="tab" class="wk-w" data-wkw="${x.id}" aria-selected="${x.id===w.id}"><span class="num">${fmt(x.date).slice(5)}</span></button>`).join("")}</div>
    ${block(m,w,`<span class="tag sm">${esc(m.name)}</span>`)}<a class="wk-open" href="?d=${encodeURIComponent(m.id)}" target="_blank" rel="noopener">開啟${esc(m.name)}看板 →</a>`;
}
document.addEventListener("click",e=>{
  const t=e.target;if(!t.closest||!t.closest("#wkPanel"))return;
  const d=t.closest("[data-wkd]");if(d){WK.dept=d.dataset.wkd;WK.week=null;renderWeekRead();return}
  const w=t.closest("[data-wkw]");if(w){WK.week=w.dataset.wkw;renderWeekRead();return}
  const c=t.closest("[data-wkcopy]");if(c){navigator.clipboard.writeText(c.closest("[data-wkdoc]").querySelector(".wk-text").textContent).then(()=>toast("已複製"),()=>toast("複製失敗"));return}
  if(t.closest("[data-wkcopyall]")){const txt=[...document.querySelectorAll("#wkBody .wk-text")].map(x=>x.textContent).join("\n\n————————\n\n");navigator.clipboard.writeText(txt).then(()=>toast("已複製全部"),()=>toast("複製失敗"))}
});
