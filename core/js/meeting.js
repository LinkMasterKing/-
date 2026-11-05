/* 核心｜秘書處的「會議報告事項」（只能看）與「會議編輯」（會長室開放才能改）面板（設定檔 meeting:true），以及會長室的授權開關（grant:true）
   - 列出各部門標了「會議要報告」（ev.report）的即時回報，依部門分組；會長室追蹤一樣的讀法，但會記住 sha 以便寫回。
   - 「會議編輯」：會長室今天開放（會長室資料的 meetGrant.date＝今天）時，頁首「編輯」→ 這區按「編輯這區」後，卡片跟部門自己的即時回報同一套逐欄編輯（點哪欄改哪欄：名稱、說明、母議題、專員、標籤、時間標記與地點、連結）。
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
/* 一組部門卡片（ed＝畫成可以點欄位編輯） */
function mtGroupsHTML(ed){
  return [...MT.depts.values()].map(m=>{
    const evs=m.data?m.data.events.filter(e=>!e.doneAt&&e.report):[];if(!evs.length)return "";
    return `<section class="mt-dept" data-mtdept="${m.id}" data-fk="mt${m.id}"><h3><span class="tag sm">${esc(m.name)}</span><span class="num">${evs.length}</span>${ed&&m.dirty?'<span class="sub">（已修改，儲存後寫回）</span>':""}<a class="fw-open" href="?d=${encodeURIComponent(m.id)}" target="_blank" rel="noopener">開啟看板 →</a></h3>
      <div class="mt-list">${withState(m.data,()=>evs.map(e=>{const st=evStatus(e);
        return `<article class="mt-ev" data-ev="${e.id}" data-st="${st}"><div class="mt-top"><span class="live-dot" aria-hidden="true"></span><b>${esc(e.name)}</b><span class="ev-st">${EV_ST[st]}</span></div>
          ${ed?evFieldsHTML(e):`${parentOf(e)?`<p class="sub">母議題：${esc(parentOf(e).title)}</p>`:""}${e.desc?`<p class="fw-text">${esc(e.desc)}</p>`:""}${evTimesHTML(e)}${staffHTML(e.staff)}${labelChipsHTML(e.labels)}${evLinksHTML(e)}`}</article>`}).join(""))}</div></section>`}).join("");
}
/* 兩區：「會議報告事項」只能看；「會議編輯」要會長室今天開放、再按「編輯這區」才能改 */
function renderMeet(){
  const view=$("#meetPanel"),edp=$("#meetEdPanel");if(!view||!edp)return;
  view.hidden=edp.hidden=!CFG.meeting;if(!CFG.meeting)return;
  if(!MT.depts.size&&!MT.loading){mtLoadAll();return}
  const errs=[...MT.depts.values()].filter(m=>!m.data&&m.err!=="還沒有資料").map(m=>m.name);
  const none=MT.depts.size?`<p class="empty">目前沒有部門標「會議要報告」。各部門在自己的即時回報按「會議要報告」後會出現在這裡。</p>`:"";
  const loading=MT.loading&&!MT.depts.size?`<p class="sub">讀取各部門資料中…</p>`:"";
  $("#meetList").innerHTML=loading+(mtGroupsHTML(false)||none)+(errs.length?`<p class="sub">讀不到：${errs.map(esc).join("、")}</p>`:"");
  const g=mtGrant(),btn=edp.querySelector("[data-secedit]");
  if(!g&&secEdit.has("meetedit"))secEdit.delete("meetedit");   /* 授權過期或被關掉：自動收起 */
  btn.hidden=!g||!editing;
  $("#meetEdSt").innerHTML=g?`<span class="grant-on">會長室已開放</span>（${esc(g.by||"會長室")}，${esc((g.at||"").slice(11,16))}）· 今天 23:59 前有效${editing?" · 按「編輯這區」開始修改":" · 按頁首「編輯」後可以修改"}`
    :`<span class="grant-off">${ico("close","sm")}尚未開放</span>：要會長室在他們的看板上把「秘書處會議編輯」切到「開放今天」，開放後當天有效。`;
  const ed=mtCanEdit();
  $("#meetEdList").innerHTML=!g?"":loading+(mtGroupsHTML(ed)||none)+(ed&&!ghToken()?`<p class="sub">這台裝置沒有權杖，改了也寫不回其他部門。</p>`:"");
}
/* ---------- 會長室：開放秘書處會議編輯的開關（設定檔 grant:true） ----------
   切到「開放今天」＝寫入 state.meetGrant＝{date:今天,by,at}，立刻儲存並同步（編輯中就併入這次編輯）；隔天自動失效。
   要登入才能切；取消登入或儲存失敗就切回原本的位置 */
let grantSeg=null;
const grantOn=()=>!!(state.meetGrant&&state.meetGrant.date===today());
function renderGrant(){
  const p=$("#grantPanel");if(!p)return;p.hidden=!CFG.grant;if(!CFG.grant)return;
  if(!grantSeg)grantSeg=new LiquidSeg(p.querySelector(".grant-seg"),{onPick:async k=>{
    const want=k==="on";if(want===grantOn())return;
    if(readOnly()||!(await ensureLogin())){grantSeg.set(grantOn()?"on":"off");return}
    const ok=await settingSave(()=>{state.meetGrant=want?{date:today(),by:meName(),at:nowStr()}:null},want?"已開放秘書處今天的會議編輯":"已關閉秘書處的會議編輯");
    if(ok===false)grantSeg.set(grantOn()?"on":"off");render()}});
  else if(!grantSeg.drag&&!grantSeg.raf)grantSeg.set(grantOn()?"on":"off",true);
  const g=state.meetGrant;
  $("#grantSt").textContent=grantOn()?`開放中：${g.by||""} ${(g.at||"").slice(11,16)} 開放，今天 23:59 自動關閉。秘書處只能改各部門標「會議要報告」的即時回報。`
    :"關閉中：秘書處只能看各部門的會議報告事項，不能修改。開會時切到「開放今天」，當天有效。";
}
/* 存回：秘書處自己的資料存完後，改過的部門各自寫回 */
async function mtPushAll(){
  const cc=cloudCfg(),tok=ghToken(),who=meName()?`秘書處 ${meName()}`:"秘書處";
  const dirty=[...MT.depts.values()].filter(m=>m.dirty&&m.data);if(!dirty.length)return;
  if(!tok){toast("沒有權杖，其他部門的修改沒有寫回");return}
  /* 寫回前再讀一次會長室的授權（可能剛被關掉或已過了當天） */
  const pr=await fwLoad("president",true),g=pr&&pr.data&&pr.data.meetGrant;
  if(!g||g.date!==today()){dirty.forEach(m=>{m.data=JSON.parse(JSON.stringify(m.base));m.dirty=false});render();toast("會長室的授權已經關閉或過期，其他部門的修改沒有寫回");return}
  const fails=[];
  for(const m of dirty){
    const d=fwDept(m.id);m.data.savedAt=nowStr();m.data.savedBy=who;
    const body={message:commitMessage(m.base,m.data,who),content:b64enc(JSON.stringify(m.data,null,1)),branch:cc.branch};if(m.sha)body.sha=m.sha;
    try{const r=await fetch(apiURL({...cc,path:d.path}),{method:"PUT",headers:{Accept:"application/vnd.github+json",Authorization:"Bearer "+tok,"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(r.ok){const j=await r.json();m.sha=j.content&&j.content.sha;m.base=JSON.parse(JSON.stringify(m.data));m.dirty=false}
      else fails.push(m.name+(r.status===409||r.status===422?"（對方剛存過，請重新整理再改）":""))}
    catch(_){fails.push(m.name)}
  }
  render();toast(fails.length?`沒有寫回：${fails.join("、")}`:`已寫回 ${dirty.map(m=>m.name).join("、")}`);
}
/* 取消編輯：丟掉其他部門的修改 */
function mtDiscard(){MT.depts.forEach(m=>{if(m.dirty&&m.base){m.data=JSON.parse(JSON.stringify(m.base));m.dirty=false}})}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-mtrefresh]");if(b){MT.at=0;mtLoadAll(true)}});
if(CFG.meeting)document.addEventListener("visibilitychange",()=>{if(!document.hidden)mtLoadAll()});
