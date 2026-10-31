/* 核心｜所有點擊／輸入／拖曳事件 */
/* ---------- events ---------- */
document.addEventListener("click",async e=>{
  const t=e.target;
  const segB=t.closest(".seg [data-mode]");if(segB){const want=segB.dataset.mode==="simple";if(want===simple)return;simple=want;try{localStorage.setItem(SIMPLE_KEY,simple?"1":"0")}catch(_){}render();if(!simple)layoutAll();return}
  const sp=t.closest("[data-simple]");if(sp){toggleSimpleGroup(sp.dataset.simple);return}
  if(t.closest("#animBtn")){openAnim();return}
  if(t.closest("#animClose")){closeAnim();return}
  if(t.closest("#animFs")){const ov=$("#animOv");if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else (ov.requestFullscreen?ov.requestFullscreen():Promise.reject()).catch(()=>toast("這個環境不支援全螢幕"));return}
  const sd=t.closest("[data-story]");if(sd){storyPlay(+sd.dataset.story);return}
  if(t.closest("#storyStage")){storyPause(!story.paused);return}
  if(t.closest("[data-goweek]")){goWeek();return}
  if(t.closest("[data-copylast]")){const w=[...state.weeks].sort((a,b)=>b.date.localeCompare(a.date))[0];if(w)copyText(w.text);return}
  const jump=t.closest("[data-jump]");
  const tgl=t.closest("[data-toggle]");
  if(tgl){const id=tgl.closest("[data-issue]").dataset.issue;flipCards(()=>{if(openIds.has(id))openIds.delete(id);else{if(!editing)openIds.clear();openIds.add(id)}});return}
  if(jump&&!t.closest("[data-marker]")){e.preventDefault();flipCards(()=>{if(!editing)openIds.clear();openIds.add(jump.dataset.jump)});const c=document.getElementById("card-"+jump.dataset.jump);if(c){c.scrollIntoView({behavior:"smooth",block:"center"});c.classList.add("flash");setTimeout(()=>c.classList.remove("flash"),1900)}return}
  if(t.closest("#editBtn")){if(!(await unlockEdit()))return;morph(()=>{editing=true;snapshot=JSON.stringify(state);keepIds=new Set(state.issues.filter(i=>i.progress<100).map(i=>i.id));render()});return}
  if(t.closest("#cancelBtn")){morph(()=>{if(dirty)state=normalize(JSON.parse(snapshot));editing=false;dirty=false;render()});return}
  if(t.closest("#saveBtn")){await saveFlow();return}
  if(t.closest("#cloudBtn")){await cloudSettings();return}
  if(t.closest("#exportLocked")){exportHTML(true);return}
  if(t.closest("#exportEdit")){exportHTML(false);return}
  if(t.closest("#importBtn")){$("#importFile").click();return}
  if(t.closest("[data-copyweek]")){const bt=t.closest("[data-copyweek]");const w=state.weeks.find(x=>x.id===t.closest("[data-week]").dataset.week);copyText(w.text);bt.classList.add("copied");bt.innerHTML="已複製"+ico("check","sm");clearTimeout(bt._t);bt._t=setTimeout(()=>{bt.classList.remove("copied");bt.textContent="複製文字"},1500);return}
  if(t.closest("#genWeek")&&readOnly()){
    const r=buildWeekly();
    const v=await ask("生成週報",[{name:"text",label:`統計期間 ${fmt(r.start)} 之後 – ${fmt(r.end)}（唯讀版不會儲存，按確定即複製全文）`,type:"textarea",value:r.text}],{wide:true});
    if(v&&v.text)copyText(v.text);return}
  if(t.closest("#genWeek")&&!readOnly()){
    const r=buildWeekly();
    const v=await ask("生成週報",[{name:"date",label:"日期",type:"date",value:r.end},{name:"text",label:`統計期間 ${fmt(r.start)} 之後 – ${fmt(r.end)}：已依即時回報與議題更新自動歸納，可直接修改後按確定`,type:"textarea",value:r.text}],{wide:true});
    if(v&&v.text){{const nw={id:uid("w"),date:v.date||r.end,text:v.text,auto:true};state.weeks.push(nw);newWeekId=nw.id;(openWeeks=openWeeks||new Set()).add(nw.id);setTimeout(()=>{newWeekId=null},1500)}snapshotBase(v.date||r.end);if(editing)changed();else save();toast("已產生並存成週報")}return}
  if(!editing)return;

  const dd=t.closest("[data-donedate]");
  if(dd){const box=dd.closest(".done-item");const obj=box.dataset.issue?state.issues.find(i=>i.id===box.dataset.issue):state.events.find(x=>x.id===box.dataset.ev);
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
  if(wk&&t.closest("[data-delweek]")){const w=state.weeks.find(x=>x.id===wk.dataset.week);const v=await ask(`刪除 ${fmt(w.date)} 的週報？`,[],{danger:"刪除"});if(v==="delete"){state.weeks=state.weeks.filter(x=>x!==w);changed()}return}

  /* small events */
  if(t.closest("#addEvent")){const v=await ask("新增即時回報",[{name:"name",label:"名稱",ph:"例如：飲水機故障通報"},{name:"desc",label:"說明",type:"textarea",ph:"簡短說明"},...staffField([])]);
    if(v&&v.name){state.events.push({id:uid("e"),name:v.name,desc:v.desc||"",createdAt:today(),staff:v.staff||[]});changed()}return}
  const evAct=t.closest("[data-evdone],[data-evundo],[data-evdel]");
  if(evAct){const ev=state.events.find(x=>x.id===evAct.closest("[data-ev]").dataset.ev);
    if(evAct.dataset.evdone!==undefined){ev.doneAt=today();syncLink(ev);changed();toast(parentOf(ev)?`已完成，並記錄到「${parentOf(ev).title}」`:"已移到完成紀錄")}
    else if(evAct.dataset.evundo!==undefined){ev.doneAt=null;syncLink(ev);changed()}
    else{const v=await ask(`刪除「${ev.name}」？`,[],{danger:"刪除"});if(v==="delete"){state.issues.forEach(i=>i.markers.forEach(m=>{if(m.evId===ev.id)delete m.evId}));state.events=state.events.filter(x=>x!==ev);changed()}}
    return}
  const evLinkIssue=t.closest("[data-evlinkissue]");
  if(evLinkIssue){const ev=state.events.find(x=>x.id===evLinkIssue.closest("[data-ev]").dataset.ev);
    const opts=[["","（不連結）"],...state.issues.map(i=>[i.id,i.title+(i.progress>=100?"（已完成）":"")])];
    const v=await ask("與議題連結",[{name:"iid",label:"母議題（完成時會自動寫進該議題的時間戳記與處理紀錄）",type:"select",value:ev.issueId||"",options:opts}]);
    if(v){ev.issueId=v.iid||null;syncLink(ev);openEv.add(ev.id);changed();toast(ev.issueId?`已連結到「${parentOf(ev).title}」`:"已取消連結")}return}
  const evLinkAdd=t.closest("[data-addevlink]");
  if(evLinkAdd){const ev=state.events.find(x=>x.id===evLinkAdd.closest("[data-ev]").dataset.ev);
    const v=await ask("新增超連結按鈕",[{name:"name",label:"按鈕名稱",ph:"例如：公文連結"},{name:"url",label:"連結網址",type:"url",ph:"https://"},{name:"color",label:"按鈕顏色",type:"color",value:COLORS[0]}]);
    if(v&&v.name){(ev.links=ev.links||[]).push({id:uid("l"),name:v.name,url:v.url,color:v.color});openEv.add(ev.id);changed()}return}
  const evLink=t.closest("[data-editevlink]");
  if(evLink){e.preventDefault();const ev=state.events.find(x=>x.id===evLink.closest("[data-ev]").dataset.ev);const l=ev.links.find(x=>x.id===evLink.dataset.editevlink);
    const v=await ask("編輯超連結按鈕",[{name:"name",label:"按鈕名稱",value:l.name},{name:"url",label:"連結網址",type:"url",value:l.url},{name:"color",label:"按鈕顏色",type:"color",value:l.color}],{danger:"刪除按鈕"});
    if(v==="delete")ev.links=ev.links.filter(x=>x!==l);else if(v)Object.assign(l,{name:v.name||l.name,url:v.url,color:v.color});if(v)changed();return}
  const evEl=t.closest("[data-editev]");
  if(evEl){const ev=state.events.find(x=>x.id===evEl.closest("[data-ev]").dataset.ev);
    const v=await ask("編輯即時回報",[{name:"name",label:"名稱",value:ev.name},{name:"desc",label:"說明",type:"textarea",value:ev.desc},...staffField(ev.staff)],{danger:"刪除"});
    if(v==="delete"){state.issues.forEach(i=>i.markers.forEach(m=>{if(m.evId===ev.id)delete m.evId}));state.events=state.events.filter(x=>x!==ev)}else if(v){Object.assign(ev,{name:v.name||ev.name,desc:v.desc||""});if(v.staff)ev.staff=v.staff;syncLink(ev)}if(v)changed();return}

  /* issues */
  if(t.closest("#addIssue")){const it={id:uid("i"),title:"新議題",tags:[...CFG.stageTags],cur:0,start:"",end:"",progress:0,doneAt:null,markers:[],links:[]};state.issues.push(it);keepIds.add(it.id);openIds.add(it.id);changed();document.getElementById("card-"+it.id)?.classList.add("opening");
    const c=document.getElementById("card-"+it.id);c?.scrollIntoView({behavior:"smooth",block:"center"});c?.querySelector('[data-f="title"]')?.select();return}
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
  if(t.closest("[data-restore]")){setProgress(it,90);keepIds.add(it.id);changed();toast("已移回進行中（90%）");return}
  if(t.closest("[data-deldone]")||t.closest("[data-delissue]")){const v=await ask(`刪除「${it.title}」？`,[],{danger:"刪除議題"});if(v==="delete"){state.issues=state.issues.filter(x=>x!==it);changed()}return}
  const mv=t.closest("[data-move]");
  if(mv){const list=activeIssues();const k=list.indexOf(it),o=list[k+(+mv.dataset.move)];if(o){const a=state.issues.indexOf(it),b=state.issues.indexOf(o);[state.issues[a],state.issues[b]]=[o,it];changed()}return}
  const dt=t.closest("[data-deltag]");
  if(dt){e.stopPropagation();const k=+dt.dataset.deltag;it.tags.splice(k,1);if(it.cur>=it.tags.length)it.cur=Math.max(0,it.tags.length-1);else if(k<it.cur)it.cur--;changed();return}
  if(t.closest("[data-editstaff]")){if(!state.staff.length){toast("還沒有專員名單：先到「身分與專員」新增");return}const v=await ask(`「${it.title}」的專員`,staffField(it.staff));if(v){it.staff=v.staff||[];changed()}return}
  if(t.closest("[data-addtag]")){const v=await ask("新增階段標籤",[{name:"t",label:"標籤名稱",ph:"例如：公告"}]);if(v&&v.t){it.tags.push(v.t);changed()}return}
  const tg=t.closest("[data-tag]");if(tg){it.cur=+tg.dataset.tag;changed();return}
  const lm=t.closest("[data-logmk]");if(lm){const mk=it.markers.find(x=>x.id===lm.dataset.logmk);if(mk)editMarker(it,mk);return}
  if(t.closest("[data-addmarker]")){const tr=t.closest("[data-issue]").querySelector(".c-track");tr.scrollIntoView({behavior:"smooth",block:"center"});makePending(tr,it.progress);toast("把虛線標記拖到想要的位置後放開");return}
});
document.addEventListener("toggle",e=>{const d=e.target;if(d.classList&&d.classList.contains("week")&&!d.classList.contains("closing")){openWeeks=openWeeks||new Set();d.open?openWeeks.add(d.dataset.week):openWeeks.delete(d.dataset.week)}if(d.classList&&d.classList.contains("done-item")){const id=d.dataset.issue||d.dataset.ev;d.open?openDone.add(id):openDone.delete(id)}if(d.classList&&d.classList.contains("ev")){d.open?openEv.add(d.dataset.ev):openEv.delete(d.dataset.ev)}},true);
document.addEventListener("dblclick",async e=>{
  if(!editing)return;const tg=e.target.closest("[data-tag]");if(!tg)return;const it=findIssue(tg);const k=+tg.dataset.tag;
  const v=await ask("修改標籤",[{name:"t",label:"標籤名稱",value:it.tags[k]}]);if(v&&v.t){it.tags[k]=v.t;changed()}
});
document.addEventListener("input",e=>{
  if(!editing)return;
  if(e.target.id==="titleIn"){state.title=e.target.value;dirty=true;return}
  if(e.target.id==="dateIn"){state.boardDate=e.target.value;dirty=true;renderHero();return}
  if(e.target.id==="yearIn"){state.yearLabel=e.target.value;dirty=true;$("#yearTxt").textContent=state.yearLabel;return}
  if(e.target.id==="termIn"){state.termStart=e.target.value;dirty=true;renderHero();return}
  const f=e.target.dataset.f;if(!f)return;const it=findIssue(e.target);if(!it)return;
  if(f==="progress"){setProgress(it,e.target.value);const card=e.target.closest("[data-issue]");
    card.querySelectorAll('[data-f="progress"]').forEach(x=>{if(x!==e.target)x.value=it.progress});
    card.querySelectorAll(".fill").forEach(x=>x.style.width=it.progress+"%");card.style.setProperty("--acc",`var(--${it.progress>=50?"green":"red"})`);card.querySelector("input[type=range]").style.setProperty("--p",it.progress+"%");card.querySelector("[data-hpct]").textContent=it.progress+"%";card.classList.toggle("done-card",it.progress>=100)}
  else it[f]=e.target.value;
  dirty=true;
});
document.addEventListener("change",e=>{
  if(!editing)return;
  if(e.target.matches("[data-donedate]")){const box=e.target.closest(".done-item");const obj=box.dataset.issue?state.issues.find(i=>i.id===box.dataset.issue):state.events.find(x=>x.id===box.dataset.ev);if(obj&&e.target.value){obj.doneAt=e.target.value;changed();toast("完成日期已更新")}return}const f=e.target.dataset.f;
  if(f==="start"||f==="end"||(f==="progress"))render();
});
["rStart","rEnd"].forEach(id=>$("#"+id).addEventListener("change",e=>{const k=id==="rStart"?"start":"end";if(e.target.value){state.range[k]=e.target.value;if(state.range.end<state.range.start)state.range.end=state.range.start;changed()}}));

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
  const v=await ask("新增註記",markerFields({at:Math.round(at),pos:"up",stage:it.tags[it.cur]||""},it));
  if(v&&v.text){it.markers.push(applyMarker({id:uid("m")},v));changed()}else render();
}
document.addEventListener("pointerdown",e=>{
  if(!editing||e.button>0)return;
  const m=e.target.closest("[data-marker]");
  if(m){e.preventDefault();const tr=m.closest("[data-track]");drag={m,tr,it:findIssue(m),id:m.dataset.marker,x0:e.clientX,moved:false,pending:m.classList.contains("pending"),pct:parseFloat(m.style.left)};m.setPointerCapture(e.pointerId);return}
  const tr=e.target.closest(".c-track");if(!tr)return;
  e.preventDefault();const r=tr.getBoundingClientRect();const pct=clamp((e.clientX-r.left)/r.width*100);
  const el=makePending(tr,pct);drag={m:el,tr,it:findIssue(tr),x0:e.clientX,moved:true,pending:true,pct};tr.setPointerCapture(e.pointerId);
});
document.addEventListener("pointermove",e=>{
  if(!drag)return;if(Math.abs(e.clientX-drag.x0)>3)drag.moved=true;if(!drag.moved)return;
  const r=drag.tr.getBoundingClientRect();drag.pct=clamp((e.clientX-r.left)/r.width*100);drag.m.style.left=drag.pct+"%";
  const lbl=drag.pending&&drag.m.querySelector(".lbl");if(lbl)lbl.textContent=Math.round(drag.pct)+"%";
});
document.addEventListener("pointerup",async()=>{
  if(!drag)return;const d=drag;drag=null;
  if(d.pending){finishPending(d.it,d.pct);return}
  const mk=d.it.markers.find(x=>x.id===d.id);
  if(d.moved){mk.at=Math.round(d.pct);changed();return}
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
    editing=false;dirty=false;openIds.clear();render();await persist(`已匯入並${HOSTED?'發布':'儲存'}`);
    toast(`已匯入：${state.issues.length} 個議題、${state.events.length} 則即時回報、${state.weeks.length} 份週報`);
  }catch(err){toast("這個檔案讀不到看板資料")}
});
window.addEventListener("beforeunload",e=>{if(editing&&dirty){e.preventDefault();e.returnValue=""}});
