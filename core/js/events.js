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
  if(t.closest("#editBtn")){if(!(await ensureLogin()))return;morph(()=>{editing=true;secEdit=new Set();snapshot=JSON.stringify(state);keepIds=new Set(state.issues.filter(i=>!i.doneAt).map(i=>i.id));render()});return}
  if(t.closest("#cancelBtn")){morph(()=>{if(CFG.meeting)mtDiscard();if(dirty)state=normalize(JSON.parse(snapshot));editing=false;dirty=false;render()});return}
  if(t.closest("#saveBtn")){await saveFlow();return}
  if(t.closest("[data-copyweek]")){const bt=t.closest("[data-copyweek]");const w=state.weeks.find(x=>x.id===t.closest("[data-week]").dataset.week);copyText(w.text);bt.classList.add("copied");bt.innerHTML="已複製"+ico("check","sm");clearTimeout(bt._t);bt._t=setTimeout(()=>{bt.classList.remove("copied");bt.textContent="複製文字"},1500);return}
  if(t.closest("#genWeek")&&readOnly()){
    const r=buildWeekly();
    const v=await ask("生成週報",[{name:"text",label:`統計期間 ${fmt(r.start)} 之後 – ${fmt(r.end)}（唯讀版不會儲存，按確定即複製全文）`,type:"textarea",value:r.text}],{wide:true});
    if(v&&v.text)copyText(v.text);return}
  if(t.closest("#genWeek")&&!readOnly()){
    const r=buildWeekly();
    const v=await ask("生成週報",[{name:"date",label:"日期",type:"date",value:r.end},{name:"text",label:`列出標了「會議要報告」的即時回報（沒有人標就列全部即時回報），與 ${fmt(r.start)} 之後到 ${fmt(r.end)} 完成的項目（只有標題），可直接修改後按確定`,type:"textarea",value:r.text}],{wide:true});
    if(v&&v.text){{const nw={id:uid("w"),date:v.date||r.end,text:v.text,auto:true};state.weeks.push(nw);state.events.forEach(e=>{e.report=false});newWeekId=nw.id;(openWeeks=openWeeks||new Set()).add(nw.id);setTimeout(()=>{newWeekId=null},1500)}snapshotBase(v.date||r.end);if(editing)changed();else save();toast("已產生並存成週報")}return}
  if(!editing)return;
  const se=t.closest("[data-secedit]");if(se){toggleSecEdit(se.dataset.secedit);return}

  const dd=t.closest("[data-donedate]");
  if(dd){const box=dd.closest("[data-done]");const obj=box.dataset.issue?state.issues.find(i=>i.id===box.dataset.issue):state.events.find(x=>x.id===box.dataset.ev);
    const v=await ask(`「${box.dataset.issue?obj.title:obj.name}」完成日期`,[{name:"d",label:"完成日期",type:"date",value:obj.doneAt||today()}]);
    if(v&&v.d){obj.doneAt=v.d;if(!box.dataset.issue)syncLink(obj);changed();toast("完成日期已更新")}return}
  /* weekly */
  if(t.closest("#addWeek")){
    const last=[...state.weeks].sort((a,b)=>b.date.localeCompare(a.date))[0];
    const v=await ask("新增週報",[{name:"date",label:"日期",type:"date",value:today()},{name:"text",label:last?"內容（已預帶上一週內容當底稿，可直接改或全部清掉）":"內容",type:"textarea",value:last?last.text:"",ph:"貼上本週概述文字"}],{wide:true});
    if(v&&v.text){{const nw={id:uid("w"),date:v.date||today(),text:v.text};state.weeks.push(nw);newWeekId=nw.id;(openWeeks=openWeeks||new Set()).add(nw.id);setTimeout(()=>{newWeekId=null},1500)}snapshotBase(v.date||today());changed()}return}

  const wk=t.closest("[data-week]");
  if(wk&&t.closest("[data-editweek]")){const w=state.weeks.find(x=>x.id===wk.dataset.week);
    const v=await ask("編輯週報",[{name:"date",label:"日期",type:"date",value:w.date},{name:"text",label:"內容",type:"textarea",value:w.text}],{wide:true,danger:"刪除此週"});
    if(v==="delete")state.weeks=state.weeks.filter(x=>x!==w);else if(v)Object.assign(w,{date:v.date||w.date,text:v.text});if(v)changed();return}
  if(wk&&t.closest("[data-delweek]")){e.preventDefault();const w=state.weeks.find(x=>x.id===wk.dataset.week);const v=await ask(`刪除 ${fmt(w.date)} 的週報？`,[],{danger:"刪除"});if(v==="delete"){state.weeks=state.weeks.filter(x=>x!==w);changed()}return}

  /* small events（即時回報） */
  /* 左右兩欄時直接新增一筆空白的，選到它、在右側填寫 */
  if(t.closest("#addEvent")&&mdOn("live")){const ev={id:uid("e"),name:"新的即時回報",desc:"",createdAt:today(),staff:[],links:[],times:[],round:1,touched:[]};evTouch(ev);state.events.push(ev);selEv=ev.id;evFld={ev:ev.id,k:"name"};changed();mdPaneIn($("#evDetail"));const n=$('#evDetail .evf.open [data-e="name"]');n?.focus();n?.select();return}
  if(t.closest("#addEvent")){const v=await ask("新增即時回報",[{name:"name",label:"名稱",ph:"例如：飲水機故障通報"},{name:"desc",label:"說明",type:"textarea",ph:"簡短說明"},...staffField([])]);
    if(v&&v.name){const ev={id:uid("e"),name:v.name,desc:v.desc||"",createdAt:today(),staff:v.staff||[],links:[],times:[],round:1,touched:[]};evTouch(ev);state.events.push(ev);changed()}return}
  const evAct=t.closest("[data-evdone],[data-evundo],[data-evdel]");
  if(evAct){e.preventDefault();const ev=evOf(evAct);
    if(evAct.dataset.evdone!==undefined){ev.doneAt=today();evTouch(ev);syncLink(ev);changed();toast(parentOf(ev)?`已結案，並記錄到「${parentOf(ev).title}」`:"已結案，移到完成紀錄")}
    else if(evAct.dataset.evundo!==undefined){ev.doneAt=null;evTouch(ev);syncLink(ev);changed()}
    else{const v=await ask(`刪除「${ev.name}」？`,[],{danger:"刪除"});if(v==="delete"){unlinkEv(ev);state.events=state.events.filter(x=>x!==ev);changed()}}
    return}
  /* 逐欄編輯：鉛筆打開一欄、取消／完成／刪除（只在編輯中出現） */
  /* 點一欄：原本開著的那欄先存回（填錯就停在原欄），再打開這一欄 */
  const pen=t.closest("[data-evpen]");if(pen){const cur=document.querySelector(".evf.open"),id=evOf(pen).id,k=pen.dataset.evpen;
    if(cur&&!evFldCommit(cur))return;evFld={ev:id,k};render();evFldFocus();return}
  const fx=t.closest("[data-evfx]");if(fx){evFldAct(fx);return}
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

  /* 完成紀錄裡的即時回報：更改母議題（即時回報區改成逐欄編輯，這裡照舊用對話框） */
  const evLinkIssue=t.closest("[data-evlinkissue]");
  if(evLinkIssue){const ev=evOf(evLinkIssue);
    const opts=[["","（不連結）"],...state.issues.map(i=>[i.id,i.title+(i.doneAt?"（已結案）":"")])];
    const v=await ask("與議題連結",[{name:"iid",label:"母議題（完成時會自動寫進該議題的時間戳記與處理紀錄）",type:"select",value:ev.issueId||"",options:opts}]);
    if(v){ev.issueId=v.iid||null;if(!ev.doneAt)evTouch(ev);syncLink(ev);openEv.add(ev.id);changed();toast(ev.issueId?`已連結到「${parentOf(ev).title}」`:"已取消連結")}return}

  /* issues */
  if(t.closest("#addIssue")){const it={id:uid("i"),title:"新議題",tags:[...CFG.stageTags],cur:0,start:"",end:"",doneAt:null,markers:[],links:[]};state.issues.push(it);keepIds.add(it.id);changed();
    progShow(it.id);setTimeout(()=>$("#cardDetail")?.querySelector('[data-f="title"]')?.select(),reduceMotion()?0:180);return}
  if(t.closest("#autoRange")){const ds=state.issues.flatMap(i=>[i.start,i.end,...i.markers.map(m=>m.date)]).filter(Boolean).sort();if(!ds.length){toast("還沒有填日期的議題");return}state.range={start:ds[0].slice(0,7),end:ds[ds.length-1].slice(0,7)};changed();return}
  const addLink=t.closest("[data-addlink]");
  if(addLink){const it=state.issues.find(i=>i.id===addLink.dataset.addlink);
    const v=await ask("新增超連結按鈕",[{name:"name",label:"按鈕名稱",ph:"例如：會議紀錄"},{name:"url",label:"連結網址",type:"url",ph:"https://"},{name:"color",label:"按鈕顏色",type:"color",value:COLORS[0]}]);
    if(v&&v.name){it.links.push({id:uid("l"),name:v.name,url:v.url,color:v.color});changed()}return}
  const el=t.closest("[data-editlink]");
  if(el){e.preventDefault();const it=state.issues.find(i=>i.id===el.dataset.iid);const l=it.links.find(x=>x.id===el.dataset.editlink);
    const v=await ask("編輯超連結按鈕",[{name:"name",label:"按鈕名稱",value:l.name},{name:"url",label:"連結網址",type:"url",value:l.url},{name:"color",label:"按鈕顏色",type:"color",value:l.color}],{danger:"刪除按鈕"});
    if(v==="delete")it.links=it.links.filter(x=>x!==l);else if(v)Object.assign(l,{name:v.name||l.name,url:v.url,color:v.color});if(v)changed();return}
  const it=findIssue(t);if(!it)return;
  if(t.closest("[data-restore]")){it.doneAt=null;keepIds.add(it.id);changed();toast("已取消結案，移回進行中");return}
  /* 結案／取消結案（編輯中，卡片工具列）：結案的議題儲存後移到完成紀錄 */
  if(t.closest("[data-closeissue]")){it.doneAt=it.doneAt?null:today();keepIds.add(it.id);changed();toast(it.doneAt?"已結案，儲存後移到完成紀錄":"已取消結案");return}
  if(t.closest("[data-deldone]")||t.closest("[data-delissue]")){e.preventDefault();const v=await ask(`刪除「${it.title}」？`,[],{danger:"刪除議題"});if(v==="delete"){state.issues=state.issues.filter(x=>x!==it);changed()}return}
  const mv=t.closest("[data-move]");
  if(mv){const list=activeIssues();const k=list.indexOf(it),o=list[k+(+mv.dataset.move)];if(o){const a=state.issues.indexOf(it),b=state.issues.indexOf(o);[state.issues[a],state.issues[b]]=[o,it];changed()}return}
  const dt=t.closest("[data-deltag]");
  if(dt){e.stopPropagation();const k=+dt.dataset.deltag;it.tags.splice(k,1);if(it.cur>=it.tags.length)it.cur=Math.max(0,it.tags.length-1);else if(k<it.cur)it.cur--;changed();return}
  if(t.closest("[data-editstaff]")){if(!state.members.length){toast("還沒有任何身分：新成員先按「編輯」→「＋ 新增身分」");return}const v=await ask(`「${it.title}」的專員`,staffField(it.staff));if(v){it.staff=v.staff||[];changed()}return}
  if(t.closest("[data-editlabels]")){if(!state.labels.length){toast("還沒有標籤：管理員可以到「設定 → 標籤」建立");return}const v=await ask(`「${it.title}」的標籤`,[{name:"labels",label:"人事時地物（常用的排前面，可複選）",type:"labels",value:it.labels}],{wide:true});if(v){it.labels=v.labels||[];changed()}return}
  if(t.closest("[data-addtag]")){const v=await ask("新增階段標籤",[{name:"t",label:"標籤名稱",ph:"例如：公告"}]);if(v&&v.t){it.tags.push(v.t);changed()}return}
  const tg=t.closest("[data-tag]");if(tg){it.cur=+tg.dataset.tag;changed();return}
  if(t.closest("[data-addmarker]")){const tr=t.closest("[data-issue]").querySelector(".c-track");tr.scrollIntoView({behavior:"smooth",block:"center"});makePending(tr,schedPct(it)??50);toast("把虛線標記拖到想要的位置後放開");return}
});
document.addEventListener("toggle",e=>{const d=e.target;if(d.classList&&d.classList.contains("week")&&!d.classList.contains("closing")){openWeeks=openWeeks||new Set();d.open?openWeeks.add(d.dataset.week):openWeeks.delete(d.dataset.week)}if(d.classList&&d.dataset.done){const id=d.dataset.issue||d.dataset.ev;d.open?openDone.add(id):openDone.delete(id)}if(d.classList&&d.classList.contains("ev")&&!d.dataset.done){d.open?openEv.add(d.dataset.ev):openEv.delete(d.dataset.ev)}},true);
document.addEventListener("dblclick",async e=>{
  if(!editing)return;const tg=e.target.closest("[data-tag]");if(!tg)return;const it=findIssue(tg);const k=+tg.dataset.tag;
  const v=await ask("修改標籤",[{name:"t",label:"標籤名稱",value:it.tags[k]}]);if(v&&v.t){it.tags[k]=v.t;changed()}
});
document.addEventListener("input",e=>{
  if(!editing)return;
  const f=e.target.dataset.f;if(!f)return;const it=findIssue(e.target);if(!it)return;
  it[f]=e.target.value;
  dirty=true;
});
document.addEventListener("change",e=>{
  if(!editing)return;
  if(e.target.matches("[data-donedate]")){const box=e.target.closest("[data-done]");const obj=box.dataset.issue?state.issues.find(i=>i.id===box.dataset.issue):state.events.find(x=>x.id===box.dataset.ev);if(obj&&e.target.value){obj.doneAt=e.target.value;changed();toast("完成日期已更新")}return}const f=e.target.dataset.f;
  if(f==="start"||f==="end")render();
});
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
function evFldFocus(){
  const box=$("#evDetail .evf.open")||document.querySelector("#events .evf.open");if(!box)return;
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
document.addEventListener("keydown",e=>{
  const box=e.target.closest&&e.target.closest(".evf.open");if(!box||document.querySelector(".csel.open"))return;
  if(e.key==="Escape"){e.preventDefault();e.stopPropagation();evFld=null;render();return}
  if(e.key==="Enter"&&!e.isComposing&&e.target.matches("input[data-e]")){e.preventDefault();evFldAct(box.querySelector('[data-evfx="ok"]'))}
  if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)&&e.target.matches("textarea[data-e]")){e.preventDefault();evFldAct(box.querySelector('[data-evfx="ok"]'))}
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
  if(!secEd("progress")||e.button>0)return;
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

/* ---------- 即時回報排序（編輯中拖曳） ----------
   滑鼠：按住膠囊標題拖動超過 6px 開始；觸控：長按 0.38 秒開始（之前就移動＝照常捲動）。
   拖到另一顆上面就換位（其他膠囊 FLIP 讓位），放開後依畫面順序寫回 state.events（只換即時回報彼此的位置，完成紀錄的順序不動）。
   排序不算「更新」（不改狀態燈），存檔時跟其他修改一起上傳 */
(()=>{
  let d=null,suppress=false;
  const handle=t=>secEd("live")&&t.closest&&!t.closest("button,a,input,textarea,select,.csel")&&t.closest("#events .events>.ev>summary");
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
    state.events=state.events.map(e=>e.doneAt?e:by.get(ids[k++]));changed();
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
