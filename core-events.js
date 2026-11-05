/* 核心｜所有點擊／輸入／拖曳事件 */
/* ---------- events ---------- */
document.addEventListener("click",async e=>{
  const t=e.target;
  const jump=t.closest("[data-jump]");
  const tgl=t.closest("[data-toggle]");
  if(tgl&&tgl.closest("#cardDetail"))return;   /* 詳情裡的標題列不收合 */
  /* 進度卡片：點甘特圖的議題列換成該議題詳情，按返回回到甘特圖 */
  if(t.closest("#pvBack")){progShow(null);return}
  /* 即時回報篩選：全部／只看會議要報告（不用登入，不存檔） */
  const ef=t.closest("[data-evfilter]");if(ef){const on=ef.dataset.evfilter==="rep";if(on!==evRepOnly){evRepOnly=on;renderEvents();layoutAll()}return}
  if(jump&&!t.closest("[data-marker]")){e.preventDefault();if(curSec!=="progress")setSection("progress",{instant:true});progShow(jump.dataset.jump);return}
  if(t.closest("#editBtn")){if(!(await ensureLogin()))return;morph(()=>{editing=true;snapshot=JSON.stringify(state);keepIds=new Set(state.issues.filter(i=>!i.doneAt).map(i=>i.id));render()});return}
  if(t.closest("#cancelBtn")){morph(()=>{if(dirty)state=normalize(JSON.parse(snapshot));editing=false;dirty=false;render()});return}
  if(t.closest("#saveBtn")){await saveFlow();return}
  if(t.closest("[data-copyweek]")){const bt=t.closest("[data-copyweek]");const w=state.weeks.find(x=>x.id===t.closest("[data-week]").dataset.week);copyText(w.text);bt.classList.add("copied");bt.innerHTML="已複製"+ico("check","sm");clearTimeout(bt._t);bt._t=setTimeout(()=>{bt.classList.remove("copied");bt.textContent="複製文字"},1500);return}
  if(t.closest("#genWeek")&&readOnly()){
    const r=buildWeekly();
    const v=await ask("生成週報",[{name:"text",label:`統計期間 ${fmt(r.start)} 之後 – ${fmt(r.end)}（唯讀版不會儲存，按確定即複製全文）`,type:"textarea",value:r.text}],{wide:true});
    if(v&&v.text)copyText(v.text);return}
  if(t.closest("#genWeek")&&!readOnly()){
    const r=buildWeekly();
    const v=await ask("生成週報",[{name:"date",label:"日期",type:"date",value:r.end},{name:"text",label:`統計期間 ${fmt(r.start)} 之後 – ${fmt(r.end)}：已依即時回報與議題更新自動歸納，可直接修改後按確定`,type:"textarea",value:r.text}],{wide:true});
    if(v&&v.text){{const nw={id:uid("w"),date:v.date||r.end,text:v.text,auto:true};state.weeks.push(nw);state.events.forEach(e=>{e.report=false});newWeekId=nw.id;(openWeeks=openWeeks||new Set()).add(nw.id);setTimeout(()=>{newWeekId=null},1500)}snapshotBase(v.date||r.end);if(editing)changed();else save();toast("已產生並存成週報")}return}
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
  if(wk&&t.closest("[data-delweek]")){e.preventDefault();const w=state.weeks.find(x=>x.id===wk.dataset.week);const v=await ask(`刪除 ${fmt(w.date)} 的週報？`,[],{danger:"刪除"});if(v==="delete"){state.weeks=state.weeks.filter(x=>x!==w);changed()}return}

  /* small events（即時回報） */
  /* 左右兩欄時直接新增一筆空白的，選到它、在右側填寫 */
  if(t.closest("#addEvent")&&mdOn("live")){const ev={id:uid("e"),name:"新的即時回報",desc:"",createdAt:today(),staff:[],links:[],times:[],round:1,touched:[]};evTouch(ev);state.events.push(ev);selEv=ev.id;changed();mdPaneIn($("#evDetail"));const n=$('#evDetail [data-evf="name"]');n?.focus();n?.select();return}
  if(t.closest("#addEvent")){const v=await ask("新增即時回報",[{name:"name",label:"名稱",ph:"例如：飲水機故障通報"},{name:"desc",label:"說明",type:"textarea",ph:"簡短說明"},...staffField([])]);
    if(v&&v.name){const ev={id:uid("e"),name:v.name,desc:v.desc||"",createdAt:today(),staff:v.staff||[],links:[],times:[],round:1,touched:[]};evTouch(ev);state.events.push(ev);changed()}return}
  const evAct=t.closest("[data-evdone],[data-evundo],[data-evdel]");
  if(evAct){e.preventDefault();const ev=evOf(evAct);
    if(evAct.dataset.evdone!==undefined){ev.doneAt=today();evTouch(ev);syncLink(ev);changed();toast(parentOf(ev)?`已結案，並記錄到「${parentOf(ev).title}」`:"已結案，移到完成紀錄")}
    else if(evAct.dataset.evundo!==undefined){ev.doneAt=null;evTouch(ev);syncLink(ev);changed()}
    else{const v=await ask(`刪除「${ev.name}」？`,[],{danger:"刪除"});if(v==="delete"){unlinkEv(ev);state.events=state.events.filter(x=>x!==ev);changed()}}
    return}
  /* 右側詳情（編輯中）的按鈕 */
  const evd=t.closest("#evDetail [data-evd]");
  if(evd){const ev=evOf(evd),k=evd.dataset.evd,box=$("#evDetail .evd-round");
    if(k==="round"){box.hidden=false;box.animate([{opacity:0,transform:"translateY(-6px)"},{opacity:1,transform:"none"}],{duration:240,easing:"cubic-bezier(.2,.9,.25,1)"});box.querySelector("textarea").focus();return}
    if(k==="roundcancel"){box.hidden=true;return}
    if(k==="roundok"){evRoundDone(ev,box.querySelector('[data-rf="done"]').value.trim(),box.querySelector('[data-rf="next"]').value.trim());return}
    if(k==="addtime"){const tm={id:uid("t"),label:"",start:today(),end:"",toIssue:false};ev.times.push(tm);evTouch(ev);changed();$(`#evDetail [data-tm="${tm.id}"] [data-tmf="label"]`)?.focus();return}
    if(k==="deltime"){const id=evd.closest("[data-tm]").dataset.tm;ev.times=ev.times.filter(x=>x.id!==id);evTouch(ev);syncLink(ev);changed();return}
    if(k==="addlink"){const l={id:uid("l"),name:"",url:"",color:COLORS[ev.links.length%COLORS.length]};ev.links.push(l);evTouch(ev);changed();$(`#evDetail [data-lk="${l.id}"] [data-lkf="name"]`)?.focus();return}
    if(k==="dellink"){const id=evd.closest("[data-lk]").dataset.lk;ev.links=ev.links.filter(x=>x.id!==id);evTouch(ev);changed();return}
    if(k==="linkcolor"){const l=ev.links.find(x=>x.id===evd.closest("[data-lk]").dataset.lk);l.color=COLORS[(COLORS.indexOf(l.color)+1)%COLORS.length];changed();return}
    return}
  /* 完成這一段：把這段的內容複製一份到完成紀錄，卡片留著進入下一段 */
  /* 會議要報告：只是標記，不算「更新」（不改燈號） */
  const evRep=t.closest("[data-evrep]");if(evRep){const ev=evOf(evRep);ev.report=!ev.report;changed();toast(ev.report?"已標記會議要報告":"已取消報告標記");return}
  const evRound=t.closest("[data-evround]");
  if(evRound){const ev=evOf(evRound);
    const v=await ask(`完成「${ev.name}」第 ${ev.round} 段`,[
      {name:"done",label:"這一段完成了什麼（存進完成紀錄）",type:"textarea",rows:4,value:ev.desc||""},
      {name:"next",label:"下一段要追蹤什麼（取代卡片上的說明；留空就沿用）",type:"textarea",rows:3,ph:"例如：等總務處回覆維修時程"}]);
    if(!v)return;
    evRoundDone(ev,v.done||"",v.next||"");return}
  /* 時間標記：新增、編輯 */
  const tmAdd=t.closest("[data-addevtime]"),tmEd=t.closest("[data-evtime]");
  if(tmAdd||tmEd){const ev=evOf(tmAdd||tmEd),tm=tmEd?ev.times.find(x=>x.id===tmEd.dataset.evtime):null;
    const v=await askEvTime(ev,tm);if(!v)return;
    if(v==="delete")ev.times=ev.times.filter(x=>x!==tm);else if(tm)Object.assign(tm,v);else ev.times.push({id:uid("t"),...v});
    evTouch(ev);syncLink(ev);openEv.add(ev.id);changed();return}
  const evLinkIssue=t.closest("[data-evlinkissue]");
  if(evLinkIssue){const ev=evOf(evLinkIssue);
    const opts=[["","（不連結）"],...state.issues.map(i=>[i.id,i.title+(i.doneAt?"（已結案）":"")])];
    const v=await ask("與議題連結",[{name:"iid",label:"母議題（完成時會自動寫進該議題的時間戳記與處理紀錄）",type:"select",value:ev.issueId||"",options:opts}]);
    if(v){ev.issueId=v.iid||null;if(!ev.doneAt)evTouch(ev);syncLink(ev);openEv.add(ev.id);changed();toast(ev.issueId?`已連結到「${parentOf(ev).title}」`:"已取消連結")}return}
  const evLinkAdd=t.closest("[data-addevlink]");
  if(evLinkAdd){const ev=evOf(evLinkAdd);
    const v=await ask("新增超連結按鈕",[{name:"name",label:"按鈕名稱",ph:"例如：公文連結"},{name:"url",label:"連結網址",type:"url",ph:"https://"},{name:"color",label:"按鈕顏色",type:"color",value:COLORS[0]}]);
    if(v&&v.name){ev.links.push({id:uid("l"),name:v.name,url:v.url,color:v.color});evTouch(ev);openEv.add(ev.id);changed()}return}
  const evLink=t.closest("[data-editevlink]");
  if(evLink){e.preventDefault();const ev=evOf(evLink);const l=ev.links.find(x=>x.id===evLink.dataset.editevlink);
    const v=await ask("編輯超連結按鈕",[{name:"name",label:"按鈕名稱",value:l.name},{name:"url",label:"連結網址",type:"url",value:l.url},{name:"color",label:"按鈕顏色",type:"color",value:l.color}],{danger:"刪除按鈕"});
    if(v==="delete")ev.links=ev.links.filter(x=>x!==l);else if(v)Object.assign(l,{name:v.name||l.name,url:v.url,color:v.color});if(v){evTouch(ev);changed()}return}
  const evEl=t.closest("[data-editev]");
  if(evEl){const ev=evOf(evEl);
    const v=await ask("編輯即時回報",[{name:"name",label:"名稱",value:ev.name},{name:"desc",label:"說明",type:"textarea",value:ev.desc},...staffField(ev.staff)],{danger:"刪除"});
    if(v==="delete"){unlinkEv(ev);state.events=state.events.filter(x=>x!==ev)}else if(v){Object.assign(ev,{name:v.name||ev.name,desc:v.desc||""});if(v.staff)ev.staff=v.staff;evTouch(ev);syncLink(ev)}if(v)changed();return}

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
  if(t.closest("[data-editstaff]")){if(!state.staff.length){toast("還沒有專員名單：先到「身分與專員」新增");return}const v=await ask(`「${it.title}」的專員`,staffField(it.staff));if(v){it.staff=v.staff||[];changed()}return}
  if(t.closest("[data-addtag]")){const v=await ask("新增階段標籤",[{name:"t",label:"標籤名稱",ph:"例如：公告"}]);if(v&&v.t){it.tags.push(v.t);changed()}return}
  const tg=t.closest("[data-tag]");if(tg){it.cur=+tg.dataset.tag;changed();return}
  if(t.closest("[data-addmarker]")){const tr=t.closest("[data-issue]").querySelector(".c-track");tr.scrollIntoView({behavior:"smooth",block:"center"});makePending(tr,schedPct(it)??50);toast("把虛線標記拖到想要的位置後放開");return}
});
document.addEventListener("toggle",e=>{const d=e.target;if(d.classList&&d.classList.contains("week")&&!d.classList.contains("closing")){openWeeks=openWeeks||new Set();d.open?openWeeks.add(d.dataset.week):openWeeks.delete(d.dataset.week)}if(d.classList&&d.classList.contains("done-item")){const id=d.dataset.issue||d.dataset.ev;d.open?openDone.add(id):openDone.delete(id)}if(d.classList&&d.classList.contains("ev")){d.open?openEv.add(d.dataset.ev):openEv.delete(d.dataset.ev)}},true);
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
  if(e.target.matches("[data-donedate]")){const box=e.target.closest(".done-item");const obj=box.dataset.issue?state.issues.find(i=>i.id===box.dataset.issue):state.events.find(x=>x.id===box.dataset.ev);if(obj&&e.target.value){obj.doneAt=e.target.value;changed();toast("完成日期已更新")}return}const f=e.target.dataset.f;
  if(f==="start"||f==="end")render();
});
["rStart","rEnd"].forEach(id=>$("#"+id).addEventListener("change",e=>{const k=id==="rStart"?"start":"end";if(e.target.value){state.range[k]=e.target.value;if(state.range.end<state.range.start)state.range.end=state.range.start;changed()}}));

const evOf=el=>state.events.find(x=>x.id===el.closest("[data-ev]").dataset.ev);   /* 元素所在的即時回報（膠囊、完成紀錄、右側詳情都帶 data-ev） */
/* 完成這一段：把這段的內容複製一份到完成紀錄（已經過去的時間標記跟著走），卡片留著進入下一段 */
function evRoundDone(ev,done,next){
  const now=nowStr().replace(" ","T"),past=ev.times.filter(x=>x.start<=now);
  const rec={id:uid("e"),name:ev.name,desc:done||"",createdAt:ev.createdAt,doneAt:today(),issueId:ev.issueId||null,links:ev.links.map(l=>({...l})),staff:[...ev.staff],times:past,round:ev.round,fromEv:ev.id};
  ev.times=ev.times.filter(x=>!past.includes(x));ev.round+=1;ev.roundAt=now;if(next)ev.desc=next;evTouch(ev);
  state.events.push(rec);syncLink(ev);syncLink(rec);openEv.add(ev.id);changed();
  toast(`第 ${rec.round} 段已存進完成紀錄，接著追第 ${ev.round} 段`);
}
/* 右側詳情（編輯中）的欄位：名稱、說明邊打邊存；其他離開欄位或選完才存並重畫 */
document.addEventListener("input",e=>{
  const f=e.target.closest&&e.target.closest("#evDetail [data-evf]");if(!f||!editing)return;
  const ev=evOf(f);ev[f.dataset.evf]=f.value;evTouch(ev);paneDirty();
  if(f.dataset.evf==="name"){const c=document.querySelector(`#events [data-ev="${ev.id}"] summary b`);if(c)c.textContent=f.value;const h=$("#evDetail .evd-head b");if(h)h.textContent=f.value}
});
document.addEventListener("change",e=>{
  const el=e.target;if(!editing||!el.closest||!el.closest("#evDetail"))return;
  const ev=evOf(el);
  if(el.name==="evIssue"){ev.issueId=el.value||null;evTouch(ev);syncLink(ev);changed();toast(ev.issueId?`已連結到「${parentOf(ev).title}」`:"已取消連結");return}
  if(el.name==="staff"){ev.staff=[...document.querySelectorAll('#evDetail input[name="staff"]:checked')].map(x=>x.value);evTouch(ev);changed();return}
  const row=el.closest("[data-tm]");
  if(row){const tm=ev.times.find(x=>x.id===row.dataset.tm),g=k=>row.querySelector(`[data-tmf="${k}"]`);
    if(el.dataset.tmf==="toIssue"){tm.toIssue=el.checked;evTouch(ev);syncLink(ev);changed();return}
    const r=evTimeParts({label:g("label").value.trim(),sd:g("sd").value,st:g("st").value,ed:g("ed").value,et:g("et").value});
    if(r.msg){if(!(el.dataset.tmf==="label"&&!g("label").value.trim()&&!tm.label))toast(r.msg);el.classList.add("bad");return}
    Object.assign(tm,{label:g("label").value.trim(),start:r.start,end:r.end});el.classList.remove("bad");evTouch(ev);syncLink(ev);paneDirty();
    const sp=row.querySelector(".evd-span");if(sp)sp.textContent=evTimeText(tm).span;return}
  const lr=el.closest("[data-lk]");
  if(lr){const l=ev.links.find(x=>x.id===lr.dataset.lk);l[el.dataset.lkf]=el.value.trim();evTouch(ev);paneDirty();return}
});
/* 在右側一欄一欄填的時候不重畫（會把游標弄丟）；焦點離開整個右側詳情時才重畫一次，讓甘特圖、議題卡片跟上 */
let _paneDirty=false;
function paneDirty(){_paneDirty=true;dirty=true}
document.addEventListener("focusout",e=>{
  if(!_paneDirty||!e.target.closest||!e.target.closest("#evDetail"))return;
  if(e.relatedTarget&&e.relatedTarget.closest&&e.relatedTarget.closest("#evDetail"))return;
  _paneDirty=false;setTimeout(render,0);
});
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
document.addEventListener("keydown",e=>{if(e.key!=="Escape"||setOpen||$("#dlg").open)return;
  const k=selEv&&mdOn("live")?"live":selDone&&mdOn("done")?"done":null;if(!k)return;
  if(document.activeElement&&document.activeElement.closest&&document.activeElement.closest(MD[k].pane))document.activeElement.blur();mdSelect(k,MD[k].get())});

/* ---------- 即時回報排序（編輯中拖曳） ----------
   滑鼠：按住膠囊標題拖動超過 6px 開始；觸控：長按 0.38 秒開始（之前就移動＝照常捲動）。
   拖到另一顆上面就換位（其他膠囊 FLIP 讓位），放開後依畫面順序寫回 state.events（只換即時回報彼此的位置，完成紀錄的順序不動）。
   排序不算「更新」（不改狀態燈），存檔時跟其他修改一起上傳 */
(()=>{
  let d=null,suppress=false;
  const handle=t=>editing&&t.closest&&!t.closest("button,a,input,textarea,select,.csel")&&t.closest("#events>.ev>summary");
  const rects=()=>new Map([...document.querySelectorAll("#events>.ev")].map(el=>[el,el.getBoundingClientRect()]));
  function begin(el,x,y){
    const r=el.getBoundingClientRect();
    d={el,ox:x-r.left,oy:y-r.top,x,y,on:true};
    el.classList.add("ev-dragging");document.documentElement.classList.add("ev-drag-on");
    el.animate([{scale:1},{scale:1.04}],{duration:180,easing:"cubic-bezier(.3,1.4,.5,1)",fill:"forwards"});
    if(navigator.vibrate)try{navigator.vibrate(12)}catch(_){}
  }
  function move(x,y){
    if(!d||!d.on)return;d.x=x;d.y=y;const el=d.el;
    const hit=[...document.querySelectorAll("#events>.ev")].find(o=>{if(o===el)return false;const r=o.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom});
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
    const ids=[...document.querySelectorAll("#events>.ev")].map(el=>el.dataset.ev),live=state.events.filter(e=>!e.doneAt);
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
