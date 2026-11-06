/* 核心｜所有點擊／輸入／拖曳事件 */
/* ---------- events ---------- */
document.addEventListener("click",async e=>{
  const t=e.target;
  const jump=t.closest("[data-jump]");
  const tgl=t.closest("[data-toggle]");
  if(tgl&&tgl.closest("#cardDetail"))return;   /* 詳情裡的標題列不收合 */
  /* 進度卡片：點甘特圖的議題列換成該議題詳情，按返回回到甘特圖 */
  if(t.closest("#pvBack")){progShow(null);return}
  if(jump&&!t.closest("[data-marker]")){e.preventDefault();if(curSec!=="progress")setSection("progress",{instant:true});progShow(jump.dataset.jump);return}
  /* 單卡編輯（render.js 的 startEdit／cancelEdit）：卡片上的「編輯」、編輯中那張的「取消｜儲存」 */
  const edb=t.closest("[data-edit]");if(edb){e.preventDefault();e.stopPropagation();await startEdit(edb.dataset.edit);return}
  if(t.closest("[data-edcancel]")){cancelEdit();return}
  if(t.closest("[data-edsave]")){if(!fldCommitOpen())return;await saveFlow();return}   /* 還開著的那一欄先存回（填錯就停在原欄） */
  if(t.closest("[data-copyweek]")){const bt=t.closest("[data-copyweek]");const w=state.weeks.find(x=>x.id===t.closest("[data-week]").dataset.week);copyText(w.text);bt.classList.add("copied");bt.innerHTML="已複製"+ico("check","sm");clearTimeout(bt._t);bt._t=setTimeout(()=>{bt.classList.remove("copied");bt.textContent="複製文字"},1500);return}
  if(t.closest("#genWeek")&&readOnly()){
    const r=buildWeekly();
    const v=await ask("生成週報",[{name:"text",label:`統計期間 ${fmt(r.start)} 之後 – ${fmt(r.end)}（唯讀版不會儲存，按確定即複製全文）`,type:"textarea",value:r.text}],{wide:true});
    if(v&&v.text)copyText(v.text);return}
  if(t.closest("#genWeek")&&!readOnly()){
    const r=buildWeekly();
    const v=await ask("生成週報",[{name:"date",label:"日期",type:"date",value:r.end},{name:"text",label:`列出標了「會議要報告」的即時回報（沒有人標就列全部即時回報），與 ${fmt(r.start)} 之後到 ${fmt(r.end)} 完成的項目（只有標題），可直接修改後按確定`,type:"textarea",value:r.text}],{wide:true});
    if(v&&v.text){{const nw={id:uid("w"),date:v.date||r.end,text:v.text,auto:true};state.weeks.push(nw);state.events.forEach(e=>{e.report=false});newWeekId=nw.id;(openWeeks=openWeeks||new Set()).add(nw.id);setTimeout(()=>{newWeekId=null},1500)}snapshotBase(v.date||r.end);if(editing)changed();else save();toast("已產生並存成週報")}return}
  /* 週報（週報頁）：登入就能新增、修改、刪除，按確定直接儲存（沒有編輯階段） */
  if(t.closest("#addWeek,[data-editweek],[data-delweek]")&&!canEdit())return;
  if(t.closest("#addWeek")){
    const last=[...state.weeks].sort((a,b)=>b.date.localeCompare(a.date))[0];
    const v=await ask("新增週報",[{name:"date",label:"日期",type:"date",value:today()},{name:"text",label:last?"內容（已預帶上一週內容當底稿，可直接改或全部清掉）":"內容",type:"textarea",value:last?last.text:"",ph:"貼上本週概述文字"}],{wide:true});
    if(v&&v.text)await settingSave(()=>{const nw={id:uid("w"),date:v.date||today(),text:v.text};state.weeks.push(nw);newWeekId=nw.id;(openWeeks=openWeeks||new Set()).add(nw.id);setTimeout(()=>{newWeekId=null},1500);snapshotBase(v.date||today())},"已新增週報");return}

  const wk=t.closest("[data-week]");
  if(wk&&t.closest("[data-editweek]")){const w=state.weeks.find(x=>x.id===wk.dataset.week);
    const v=await ask("編輯週報",[{name:"date",label:"日期",type:"date",value:w.date},{name:"text",label:"內容",type:"textarea",value:w.text}],{wide:true,danger:"刪除此週"});
    if(v)await settingSave(()=>{if(v==="delete")state.weeks=state.weeks.filter(x=>x!==w);else Object.assign(w,{date:v.date||w.date,text:v.text})},v==="delete"?"已刪除週報":"已更新週報");return}
  if(wk&&t.closest("[data-delweek]")){e.preventDefault();const w=state.weeks.find(x=>x.id===wk.dataset.week);const v=await ask(`刪除 ${fmt(w.date)} 的週報？`,[],{danger:"刪除"});if(v==="delete")await settingSave(()=>{state.weeks=state.weeks.filter(x=>x!==w)},"已刪除週報");return}

  /* small events（即時回報） */
  /* 左右兩欄時直接新增一筆空白的，選到它、在右側填寫 */
  /* 新增即時回報：左右兩欄時直接開始編輯一筆空白的（選到它、在右側填名稱，取消就不留）；其他時候填一個小表單，按確定直接儲存 */
  if(t.closest("#addEvent")&&!editing&&mdOn("live")){const ev={id:uid("e"),name:"新的即時回報",desc:"",createdAt:today(),staff:[],links:[],times:[],round:1,touched:[]};
    if(await startEdit("e:"+ev.id,()=>{evTouch(ev);state.events.push(ev);selEv=ev.id;evFld={ev:ev.id,k:"name"};dirty=true})){mdPaneIn($("#evDetail"));const n=$('#evDetail .evf.open [data-e="name"]');n?.focus();n?.select()}return}
  if(t.closest("#addEvent")&&!editing){if(!(await ensureLogin()))return;const v=await ask("新增即時回報",[{name:"name",label:"名稱",ph:"例如：飲水機故障通報"},{name:"desc",label:"說明",type:"textarea",ph:"簡短說明"},...staffField([])]);
    if(v&&v.name)await settingSave(()=>{const ev={id:uid("e"),name:v.name,desc:v.desc||"",createdAt:today(),staff:v.staff||[],links:[],times:[],round:1,touched:[]};evTouch(ev);state.events.push(ev)},"已新增即時回報");return}
  /* 新增議題：開始編輯一個空白議題、換到它的詳情並打開名稱欄（取消就不留） */
  if(t.closest("#addIssue")&&!editing){const it={id:uid("i"),title:"新議題",tags:[...CFG.stageTags],cur:0,start:"",end:"",doneAt:null,markers:[],links:[]};
    if(await startEdit("i:"+it.id,()=>{state.issues.push(it);keepIds.add(it.id);ifFld={t:"i",id:it.id,k:"title"};dirty=true}))progShow(it.id,ifFldFocus);return}
  /* 以下都是編輯中那張卡片裡的工具 */
  if(!editing)return;

  const evAct=t.closest("[data-evdone],[data-evundo],[data-evdel]");
  if(evAct){e.preventDefault();const ev=evOf(evAct);
    /* 結案、移回、刪除都會讓這張卡片離開原本的位置（找不到它的「儲存」）：做完直接儲存，結束這次編輯 */
    if(evAct.dataset.evdone!==undefined){if(!fldCommitOpen())return;ev.doneAt=today();evTouch(ev);syncLink(ev);dirty=true;await saveFlow();toast(parentOf(ev)?`已結案，並記錄到「${parentOf(ev).title}」`:"已結案，移到完成紀錄")}
    else if(evAct.dataset.evundo!==undefined){if(!fldCommitOpen())return;ev.doneAt=null;evTouch(ev);syncLink(ev);dirty=true;await saveFlow()}
    else{const v=await ask(`刪除「${ev.name}」？`,[],{danger:"刪除"});if(v==="delete"){unlinkEv(ev);state.events=state.events.filter(x=>x!==ev);evFld=null;dirty=true;await saveFlow()}}
    return}
  /* 逐欄編輯：鉛筆打開一欄、取消／完成／刪除（只在編輯中出現） */
  /* 點一欄：原本開著的那欄先存回（填錯就停在原欄），再打開這一欄 */
  const pen=t.closest("[data-evpen]");if(pen){const id=evOf(pen).id,k=pen.dataset.evpen;
    if(!fldCommitOpen())return;ifFld=null;evFld={ev:id,k};render();evFldFocus();return}
  const fx=t.closest("[data-evfx]");if(fx){evFldAct(fx);return}
  /* 進度、完成紀錄的逐欄編輯（跟即時回報同一套；畫面在 views.js 的 issueFieldsHTML／doneFieldsHTML） */
  const ipen=t.closest("[data-ifpen]");if(ipen){const r=ipen.closest("[data-ifid]");
    if(!fldCommitOpen())return;evFld=null;ifFld={t:r.dataset.ift,id:r.dataset.ifid,k:ipen.dataset.ifpen};render();ifFldFocus();return}
  const ifx=t.closest("[data-iffx]");if(ifx){ifFldAct(ifx);return}
  /* 右側詳情（編輯中）：完成這一段的展開框 */
  const evd=t.closest("#evDetail [data-evd]");
  if(evd){const ev=evOf(evd),k=evd.dataset.evd,box=$("#evDetail .evd-round");
    if(k==="round"){Anim.show(box,"down");box.querySelector("textarea").focus();return}
    if(k==="roundcancel"){Anim.hide(box);return}
    if(k==="roundok"){evRoundDone(ev,box.querySelector('[data-rf="done"]').value.trim(),box.querySelector('[data-rf="next"]').value.trim());return}
    return}
  /* 完成這一段：把這段的內容複製一份到完成紀錄，卡片留著進入下一段 */
  /* 會議要報告：只是標記，不算「更新」（不改燈號） */
  const evRep=t.closest("[data-evrep]");if(evRep){const ev=evOf(evRep);ev.report=!ev.report;changed();   /* 移到上／下區的動畫由動畫規則 2（data-flip）自動處理 */toast(ev.report?"已標記會議要報告":"已取消報告標記");return}
  const evRound=t.closest("[data-evround]");
  if(evRound){const ev=evOf(evRound);
    const v=await ask(`完成「${ev.name}」第 ${ev.round} 段`,[
      {name:"done",label:"這一段完成了什麼（存進完成紀錄）",type:"textarea",rows:4,value:ev.desc||""},
      {name:"next",label:"下一段要追蹤什麼（取代卡片上的說明；留空就沿用）",type:"textarea",rows:3,ph:"例如：等總務處回覆維修時程"}]);
    if(!v)return;
    evRoundDone(ev,v.done||"",v.next||"");return}


  /* issues */
  if(t.closest("#autoRange")){const ds=state.issues.flatMap(i=>[i.start,i.end,...i.markers.map(m=>m.date)]).filter(Boolean).sort();if(!ds.length){toast("還沒有填日期的議題");return}state.range={start:ds[0].slice(0,7),end:ds[ds.length-1].slice(0,7)};changed();return}
  const it=findIssue(t);if(!it)return;
  if(t.closest("[data-restore]")){if(!fldCommitOpen())return;it.doneAt=null;dirty=true;await saveFlow();toast("已取消結案，移回進行中");return}   /* 卡片會離開完成紀錄：直接儲存 */
  /* 結案／取消結案（編輯中，卡片工具列）：結案的議題儲存後移到完成紀錄 */
  if(t.closest("[data-closeissue]")){it.doneAt=it.doneAt?null:today();keepIds.add(it.id);changed();toast(it.doneAt?"已結案，儲存後移到完成紀錄":"已取消結案");return}
  if(t.closest("[data-deldone]")||t.closest("[data-delissue]")){e.preventDefault();const v=await ask(`刪除「${it.title}」？`,[],{danger:"刪除議題"});if(v==="delete"){state.issues=state.issues.filter(x=>x!==it);ifFld=null;dirty=true;await saveFlow()}return}   /* 刪掉了就沒有「儲存」可按：直接儲存 */
  const mv=t.closest("[data-move]");
  if(mv){const list=activeIssues();const k=list.indexOf(it),o=list[k+(+mv.dataset.move)];if(o){const a=state.issues.indexOf(it),b=state.issues.indexOf(o);[state.issues[a],state.issues[b]]=[o,it];changed()}return}
  if(t.closest("[data-addmarker]")){const tr=t.closest("[data-issue]").querySelector(".c-track");tr.scrollIntoView({behavior:"smooth",block:"center"});makePending(tr,schedPct(it)??50);toast("把虛線標記拖到想要的位置後放開");return}
});
document.addEventListener("toggle",e=>{const d=e.target;if(d.classList&&d.classList.contains("week")&&!d.classList.contains("closing")){openWeeks=openWeeks||new Set();d.open?openWeeks.add(d.dataset.week):openWeeks.delete(d.dataset.week)}if(d.classList&&d.dataset.done){const id=d.dataset.issue||d.dataset.ev;d.open?openDone.add(id):openDone.delete(id)}if(d.classList&&d.classList.contains("ev")&&!d.dataset.done){d.open?openEv.add(d.dataset.ev):openEv.delete(d.dataset.ev)}},true);
["rStart","rEnd"].forEach(id=>$("#"+id).addEventListener("change",e=>{const k=id==="rStart"?"start":"end";if(e.target.value){state.range[k]=e.target.value;if(state.range.end<state.range.start)state.range.end=state.range.start;changed()}}));

const evOf=el=>{const m=mtOf(el);return (m?m.data:state).events.find(x=>x.id===el.closest("[data-ev]").dataset.ev)};   /* 秘書處面板裡的卡片屬於別的部門（meeting.js） */   /* 元素所在的即時回報（膠囊、完成紀錄、右側詳情都帶 data-ev） */
/* 完成這一段：把這段的內容複製一份到完成紀錄（已經過去的時間標記跟著走），卡片留著進入下一段 */
function evRoundDone(ev,done,next){
  const now=nowStr().replace(" ","T"),past=ev.times.filter(x=>x.start<=now);
  const rec={id:uid("e"),name:ev.name,desc:done||"",createdAt:ev.createdAt,doneAt:today(),issueId:ev.issueId||null,links:ev.links.map(l=>({...l})),staff:[...ev.staff],labels:[...(ev.labels||[])],times:past,round:ev.round,fromEv:ev.id};
  ev.times=ev.times.filter(x=>!past.includes(x));ev.round+=1;ev.roundAt=now;if(next)ev.desc=next;evTouch(ev);
  state.events.push(rec);syncLink(ev);syncLink(rec);openEv.add(ev.id);changed();
  toast(`第 ${rec.round} 段已存進完成紀錄，接著追第 ${ev.round} 段`);
}
/* ---------- 即時回報的逐欄編輯（畫面在 views.js 的 evFieldsHTML） ----------
   按「完成」才寫回 state；按「取消」或打開別欄就放棄這一欄的修改。Enter＝完成（說明欄要換行用 Shift+Enter 以外照常），Esc＝取消 */
function evFldFocus(){fldFocus($("#evDetail .evf.open")||document.querySelector("#events .evf.open"))}
function ifFldFocus(){fldFocus($("#doneDetail .evf.open")||document.querySelector(".evf.open[data-iffk]"))}
/* 點別欄時，先把目前打開的那一欄存回（即時回報或進度／完成紀錄）；填錯回傳 false、停在原欄 */
function fldCommitOpen(){const cur=document.querySelector(".evf.open");if(!cur)return true;return cur.dataset.iffk!==undefined?ifFldWrite(cur):evFldCommit(cur)}
function fldFocus(box){
  if(!box)return;
  const f=box.querySelector("[data-e],.csel-btn,input[type=checkbox]");if(f){f.focus({preventScroll:true});if(f.select&&f.type!=="date")f.select()}
  box.scrollIntoView({block:"nearest",behavior:reduceMotion()?"auto":"smooth"});
}
function evFldAct(fx){
  const box=fx.closest(".evf"),ev=evOf(box),k=box.dataset.evfk,a=fx.dataset.evfx,g=n=>box.querySelector(`[data-e="${n}"]`);
  if(a==="color"){const c=COLORS[(COLORS.indexOf(fx.dataset.c)+1)%COLORS.length];fx.dataset.c=c;fx.style.background=c;return}
  if(a==="cancel"){evFld=null;render();return}
  const tid=k.startsWith("t:")?k.slice(2):null,lid=k.startsWith("l:")?k.slice(2):null;
  if(a==="ok"){if(evFldCommit(box)){evFld=null;changed()}return}
  if(a==="del"){
    const run=()=>{if(tid)ev.times=ev.times.filter(x=>x.id!==tid);if(lid)ev.links=ev.links.filter(x=>x.id!==lid);evTouch(ev);syncLink(ev)},m=mtOf(box);
    if(m){withState(m.data,run);m.dirty=true}else run();
    evFld=null;changed();return}
}
/* 把打開的那一欄寫回 state（不重畫；有改才算更新並標 dirty）；填錯回傳 false、停在原欄 */
function evFldCommit(box){
  const m=mtOf(box);if(!m)return evFldWrite(box);
  const r=withState(m.data,()=>evFldWrite(box));if(JSON.stringify(m.data)!==JSON.stringify(m.base))m.dirty=true;return r;   /* 秘書處改別的部門：在那個部門的資料上寫 */
}
function evFldWrite(box){
  const ev=evOf(box),k=box.dataset.evfk,g=n=>box.querySelector(`[data-e="${n}"]`),before=JSON.stringify(ev);
  const tid=k.startsWith("t:")?k.slice(2):null,lid=k.startsWith("l:")?k.slice(2):null;
  if(k==="name"){const v=g("name").value.trim();if(!v){toast("請填名稱");g("name").classList.add("bad");return false}ev.name=v}
  else if(k==="desc")ev.desc=g("desc").value.trim();
  else if(k==="issue"){const v=box.querySelector('input[name="evIssue"]').value||null;if(v!==(ev.issueId||null)){ev.issueId=v;toast(v?`已連結到「${parentOf(ev).title}」`:"已取消連結")}}
  else if(k==="staff")ev.staff=[...box.querySelectorAll('input[name="staff"]:checked')].map(x=>x.value);
  else if(k==="labels")ev.labels=[...box.querySelectorAll('input[name="labels"]:checked')].map(x=>x.value);
  else if(tid){const r=evTimeParts({label:g("label").value.trim(),sd:g("sd").value,st:g("st").value,ed:g("ed").value,et:g("et").value});
    if(r.msg){toast(r.msg);return false}
    const v={label:g("label").value.trim(),start:r.start,end:r.end,place:(g("place")?g("place").value.trim():""),toIssue:!!(g("toIssue")&&g("toIssue").checked)};
    if(tid==="+")ev.times.push({id:uid("t"),...v});else Object.assign(ev.times.find(x=>x.id===tid),v)}
  else if(lid){const v={name:g("name").value.trim(),url:g("url").value.trim(),color:box.querySelector("[data-c]").dataset.c};
    if(!v.name){toast("請填按鈕名稱");g("name").classList.add("bad");return false}
    if(lid==="+")ev.links.push({id:uid("l"),...v});else Object.assign(ev.links.find(x=>x.id===lid),v)}
  if(JSON.stringify(ev)===before)return true;   /* 沒改東西：不算「更新」，燈號不動 */
  evTouch(ev);syncLink(ev);openEv.add(ev.id);dirty=true;return true;
}
/* ---------- 進度、完成紀錄的逐欄編輯：按鈕與存回 ----------
   跟即時回報一樣：按「完成」才寫回 state；議題的階段（stg）在打開的欄位裡直接加列、刪列、換「目前」，按完成才一起存 */
const ifObj=box=>(box.dataset.ift==="e"?state.events:state.issues).find(x=>x.id===box.dataset.ifid);
function ifFldAct(fx){
  const box=fx.closest("[data-iffk]"),a=fx.dataset.iffx;
  if(a==="color"){const c=COLORS[(COLORS.indexOf(fx.dataset.c)+1)%COLORS.length];fx.dataset.c=c;fx.style.background=c;return}
  if(a==="stgadd"){const list=box.querySelector(".stg-list");list.insertAdjacentHTML("beforeend",stageRowHTML("",!list.querySelector('.stg-cur[aria-pressed="true"]')));list.lastElementChild.querySelector("input").focus();return}
  if(a==="stgdel"){const row=fx.closest(".stg-row"),was=row.querySelector('.stg-cur[aria-pressed="true"]');row.remove();if(was)box.querySelector(".stg-cur")?.setAttribute("aria-pressed","true");return}
  if(a==="stgcur"){box.querySelectorAll(".stg-cur").forEach(b=>b.setAttribute("aria-pressed",b===fx));return}
  if(a==="cancel"){ifFld=null;render();return}
  if(a==="ok"){if(ifFldWrite(box)){ifFld=null;changed()}return}
  if(a==="del"){const o=ifObj(box),lid=box.dataset.iffk.slice(2);o.links=o.links.filter(x=>x.id!==lid);ifFld=null;changed();return}
}
/* 把打開的那一欄寫回 state（不重畫；有改才標 dirty）；填錯回傳 false、停在原欄。完成紀錄裡的即時回報改了名稱、日期、母議題，同步母議題的處理紀錄 */
function ifFldWrite(box){
  const o=ifObj(box);if(!o)return true;
  const k=box.dataset.iffk,g=n=>box.querySelector(`[data-e="${n}"]`),before=JSON.stringify(o),bad=n=>{g(n).classList.add("bad");g(n).focus();return false};
  if(k==="title"||k==="name"){const v=g(k).value.trim();if(!v){toast("請填名稱");return bad(k)}o[k]=v}
  else if(k==="note"||k==="desc")o[k]=g(k).value.trim();
  else if(k==="dates"){const a=g("start").value,b=g("end").value;if(a&&b&&b<a){toast("結束日不能早於開始日");return bad("end")}o.start=a;o.end=b}
  else if(k==="stage"){const rows=[...box.querySelectorAll(".stg-row")].map(r=>({n:r.querySelector("input").value.trim(),cur:r.querySelector(".stg-cur").getAttribute("aria-pressed")==="true"})).filter(r=>r.n);
    o.tags=rows.map(r=>r.n);o.cur=Math.max(0,rows.findIndex(r=>r.cur))}
  else if(k==="staff")o.staff=[...box.querySelectorAll('input[name="staff"]:checked')].map(x=>x.value);
  else if(k==="labels")o.labels=[...box.querySelectorAll('input[name="labels"]:checked')].map(x=>x.value);
  else if(k==="done"){const v=g("done").value;if(!v){toast("請選完成日期");return bad("done")}o.doneAt=v}
  else if(k==="issue")o.issueId=box.querySelector('input[name="evIssue"]').value||null;
  else if(k.startsWith("l:")){const lid=k.slice(2),v={name:g("name").value.trim(),url:g("url").value.trim(),color:box.querySelector("[data-c]").dataset.c};
    if(!v.name){toast("請填按鈕名稱");return bad("name")}
    if(lid==="+")o.links.push({id:uid("l"),...v});else Object.assign(o.links.find(x=>x.id===lid),v)}
  if(JSON.stringify(o)===before)return true;
  if(box.dataset.ift==="e")syncLink(o);
  dirty=true;return true;
}
/* 打開的欄位（即時回報、進度、完成紀錄）：Esc＝取消；Enter（說明欄 Ctrl／⌘＋Enter）＝完成 */
document.addEventListener("keydown",e=>{
  const box=e.target.closest&&e.target.closest(".evf.open");if(!box||document.querySelector(".csel.open"))return;
  if(e.key==="Escape"){e.preventDefault();e.stopPropagation();evFld=null;ifFld=null;render();return}
  const ok=box.querySelector('[data-evfx="ok"],[data-iffx="ok"]');if(!ok)return;
  if(e.key==="Enter"&&!e.isComposing&&e.target.matches("input[data-e],input[data-stg]")){e.preventDefault();ok.click()}
  if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)&&e.target.matches("textarea[data-e]")){e.preventDefault();ok.click()}
},true);
/* markers on cards: press-and-drag to place a new one, drag to move, click to edit */
let drag=null;
function makePending(tr,pct){
  tr.querySelector(".marker.pending")?.remove();
  const el=document.createElement("div");el.className="marker up pending";el.dataset.marker="__pending";
  el.style.left=pct+"%";el.style.setProperty("--mc","var(--acc)");
  el.innerHTML='<span class="stem"></span><span class="dot"></span><span class="lbl">拖到位置後放開</span>';
  tr.append(el);layoutTrack(tr);return el;
}
async function finishPending(it,at){
  const v=await ask("新增註記",markerFields({at:Math.round(at),date:hasDates(it)?dateAtPct(it,at):today(),pos:"up",stage:it.tags[it.cur]||""},it));
  if(v&&v.text){it.markers.push(applyMarker({id:uid("m"),at:Math.round(at)},v,it));changed()}else render();
}
document.addEventListener("pointerdown",e=>{
  if(!editing||e.button>0)return;{const c=e.target.closest&&e.target.closest("[data-issue]");if(!c||!cardEd("i",c.dataset.issue))return}   /* 只有編輯中的那個議題可以加、拖註記 */
  const m=e.target.closest("[data-marker]");
  if(m){e.preventDefault();const tr=m.closest("[data-track]");drag={m,tr,it:findIssue(m),id:m.dataset.marker,x0:e.clientX,moved:false,pending:m.classList.contains("pending"),pct:parseFloat(m.style.left)};m.setPointerCapture(e.pointerId);return}
  const tr=e.target.closest(".c-track");if(!tr)return;
  e.preventDefault();const r=tr.getBoundingClientRect();const pct=clamp((e.clientX-r.left)/r.width*100);
  const el=makePending(tr,pct);drag={m:el,tr,it:findIssue(tr),x0:e.clientX,moved:true,pending:true,pct};tr.setPointerCapture(e.pointerId);
});
document.addEventListener("pointermove",e=>{
  if(!drag)return;if(Math.abs(e.clientX-drag.x0)>3)drag.moved=true;if(!drag.moved)return;
  const r=drag.tr.getBoundingClientRect();drag.pct=clamp((e.clientX-r.left)/r.width*100);drag.m.style.left=drag.pct+"%";
  const lbl=drag.pending&&drag.m.querySelector(".lbl");if(lbl)lbl.textContent=hasDates(drag.it)?fmt(dateAtPct(drag.it,drag.pct)).slice(5):Math.round(drag.pct)+"%";
});
document.addEventListener("pointerup",async()=>{
  if(!drag)return;const d=drag;drag=null;
  if(d.pending){finishPending(d.it,d.pct);return}
  const mk=d.it.markers.find(x=>x.id===d.id);
  if(d.moved){mk.at=Math.round(d.pct);if(hasDates(d.it))mk.date=dateAtPct(d.it,d.pct);changed();return}   /* 有期間的議題：拖到哪就是哪一天 */
  editMarker(d.it,mk);
});
/* import data from a backup / older version file */
$("#importFile").addEventListener("change",async e=>{
  const f=e.target.files[0];e.target.value="";if(!f)return;
  try{
    const txt=await f.text();
    const m=txt.match(/<script id="state" type="application\/json">([\s\S]*?)<\/script>/);
    const raw=JSON.parse(m?m[1]:txt);
    if(!raw||!Array.isArray(raw.issues))throw 0;
    const data=normalize(raw);
    const v=await ask(`匯入「${f.name}」？`,[],{});
    if(v===null)return;
    data.locked=false;data.id=state.id;state=data;state.savedAt=nowStr();
    editing=false;dirty=false;progOpen=null;render();await persist(`已匯入並${HOSTED?'發布':'儲存'}`);
    toast(`已匯入：${state.issues.length} 個議題、${state.events.length} 則即時回報、${state.weeks.length} 份週報`);
  }catch(err){toast("這個檔案讀不到看板資料")}
});
window.addEventListener("beforeunload",e=>{if(editing&&dirty){e.preventDefault();e.returnValue=""}});

/* 桌面即時回報的右側：Esc 收起（有對話框或設定開著時不管） */
/* Esc：收起即時回報／完成紀錄的右側 */
document.addEventListener("keydown",e=>{if(e.key!=="Escape"||setOpen||notiOpen||$("#dlg").open)return;
  const k=selEv&&mdOn("live")?"live":selDone&&mdOn("done")?"done":null;if(!k)return;
  if(document.activeElement&&document.activeElement.closest&&document.activeElement.closest(MD[k].pane))document.activeElement.blur();mdSelect(k,MD[k].get())});

/* ---------- 即時回報排序（登入後、沒有卡片在編輯時拖曳；放開直接儲存） ----------
   滑鼠：按住膠囊標題拖動超過 6px 開始；觸控：長按 0.38 秒開始（之前就移動＝照常捲動）。
   拖到另一顆上面就換位（其他膠囊 FLIP 讓位），放開後依畫面順序寫回 state.events（只換即時回報彼此的位置，完成紀錄的順序不動）。
   排序不算「更新」（不改狀態燈）；放開就直接儲存（settingSave） */
(()=>{
  let d=null,suppress=false;
  const handle=t=>canEdit()&&!editing&&t.closest&&!t.closest("button,a,input,textarea,select,.csel")&&t.closest("#events .events>.ev>summary");
  const rects=()=>new Map([...document.querySelectorAll("#events .events>.ev")].map(el=>[el,el.getBoundingClientRect()]));
  function begin(el,x,y){
    const r=el.getBoundingClientRect();
    d={el,ox:x-r.left,oy:y-r.top,x,y,on:true};
    el.classList.add("ev-dragging");document.documentElement.classList.add("ev-drag-on");
    el.animate([{scale:1},{scale:1.04}],{duration:180,easing:"cubic-bezier(.3,1.4,.5,1)",fill:"forwards"});
    if(navigator.vibrate)try{navigator.vibrate(12)}catch(_){}
  }
  function move(x,y){
    if(!d||!d.on)return;d.x=x;d.y=y;const el=d.el;
    const hit=[...document.querySelectorAll("#events .events>.ev")].find(o=>{if(o===el||o.parentNode!==el.parentNode)return false;const r=o.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom});
    if(hit&&performance.now()>(d.lock||0)){d.lock=performance.now()+220;   /* 剛換過位，讓位動畫跑一下再判斷，免得來回抖 */
      const list=[...el.parentNode.children],before=rects();
      if(list.indexOf(hit)>list.indexOf(el))hit.after(el);else hit.before(el);
      if(!reduceMotion())before.forEach((a,o)=>{if(o===el)return;const b=o.getBoundingClientRect(),dx=a.left-b.left,dy=a.top-b.top;
        if(Math.abs(dx)>1||Math.abs(dy)>1)o.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:"none"}],{duration:300,easing:"cubic-bezier(.2,.9,.25,1)"})});
    }
    el.style.translate="";const b=el.getBoundingClientRect();
    el.style.translate=`${x-d.ox-b.left}px ${y-d.oy-b.top}px`;
  }
  function end(){
    if(!d)return;const s=d;d=null;clearTimeout(s.timer);if(!s.on)return;
    const el=s.el,from=el.style.translate||"0px 0px";el.style.translate="";
    document.documentElement.classList.remove("ev-drag-on");
    el.getAnimations().forEach(a=>a.cancel());
    const fin=()=>{el.classList.remove("ev-dragging");commit()};
    if(reduceMotion())fin();else el.animate([{translate:from,scale:1.04},{translate:"0px 0px",scale:1}],{duration:260,easing:"cubic-bezier(.2,.9,.25,1)"}).onfinish=fin;
    suppress=true;setTimeout(()=>suppress=false,0);
  }
  function commit(){
    const ids=[...document.querySelectorAll("#events .events>.ev")].map(el=>el.dataset.ev),live=state.events.filter(e=>!e.doneAt);
    if(ids.length!==live.length||ids.every((id,i)=>live[i].id===id))return;
    const by=new Map(live.map(e=>[e.id,e]));let k=0;
    settingSave(()=>{state.events=state.events.map(e=>e.doneAt?e:by.get(ids[k++]))},"已更新排序");
  }
  /* 拖完放開的那一下不要當成點擊（不然會展開／選取）：window 捕獲階段最先攔 */
  addEventListener("click",e=>{if(suppress){e.preventDefault();e.stopPropagation();suppress=false}},true);
  /* 滑鼠 */
  document.addEventListener("pointerdown",e=>{if(e.pointerType==="touch"||e.button!==0)return;const sm=handle(e.target);if(!sm)return;d={el:sm.parentElement,sx:e.clientX,sy:e.clientY,on:false}});
  addEventListener("pointermove",e=>{if(!d||e.pointerType==="touch")return;if(!d.on){if(Math.hypot(e.clientX-d.sx,e.clientY-d.sy)<6)return;const el=d.el;d=null;begin(el,e.clientX,e.clientY)}move(e.clientX,e.clientY)});
  addEventListener("pointerup",e=>{if(e.pointerType!=="touch")end()});
  /* 觸控：長按 */
  document.addEventListener("touchstart",e=>{if(e.touches.length!==1)return;const sm=handle(e.target);if(!sm)return;const t=e.touches[0];
    d={el:sm.parentElement,sx:t.clientX,sy:t.clientY,on:false};d.timer=setTimeout(()=>{if(d&&!d.on){const el=d.el;d=null;begin(el,t.clientX,t.clientY)}},380)},{passive:true});
  addEventListener("touchmove",e=>{if(!d)return;const t=e.touches[0];
    if(!d.on){if(Math.hypot(t.clientX-d.sx,t.clientY-d.sy)>8){clearTimeout(d.timer);d=null}return}
    e.preventDefault();move(t.clientX,t.clientY)},{passive:false});
  addEventListener("touchend",end);addEventListener("touchcancel",end);
  /* 長按時不要跳出系統選單 */
  document.addEventListener("contextmenu",e=>{if(d||handle(e.target))e.preventDefault()});
})();
