/* 核心｜對話框 */
/* ---------- dialog ---------- */
function fieldHTML(x){
  if(x.type==="multi")return `<fieldset class="multi"><legend>${esc(x.label)}</legend><div class="chips">${x.options.map(([v,t])=>`<label class="chip"><input type="checkbox" name="${x.name}" value="${esc(v)}" ${(x.value||[]).includes(v)?"checked":""}><span>${esc(t)}</span></label>`).join("")}</div></fieldset>`;
  if(x.type==="check")return `<label class="fld-check"><input type="checkbox" name="${x.name}" ${x.value?"checked":""}><span>${esc(x.label)}</span></label>`;
  if(x.type==="textarea")return `<label>${esc(x.label)}<textarea name="${x.name}" rows="${x.rows||16}" placeholder="${esc(x.ph||"")}">${esc(x.value||"")}</textarea></label>`;
  if(x.type==="select"){const cur=x.options.find(o=>o[0]===x.value)||x.options[0]||["",""];
    return `<div class="fld"><span class="fld-l">${esc(x.label)}</span><div class="csel"><input type="hidden" name="${x.name}" value="${esc(cur[0])}"><button type="button" class="csel-btn" aria-haspopup="listbox" aria-expanded="false"><span class="csel-v">${esc(cur[1])}</span><svg class="csel-chev" viewBox="0 0 12 8" width="11" height="7" aria-hidden="true"><path d="M1.5 1.5 6 6l4.5-4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="csel-list" role="listbox" hidden>${x.options.map(([v,t])=>`<button type="button" role="option" class="csel-opt" data-v="${esc(v)}" aria-selected="${v===cur[0]}">${esc(t)}</button>`).join("")}</div></div></div>`}
  if(x.type==="color")return `<label>${esc(x.label)}<span class="swatches">${(x.palette||COLORS).map(c=>`<button type="button" style="background:${c}" data-sw="${c}" aria-pressed="${c===x.value}" aria-label="顏色 ${c}"></button>`).join("")}<input type="color" name="${x.name}" value="${esc(x.value)}" style="width:46px;height:32px;padding:2px" aria-label="自訂顏色"></span></label>`;
  const t=x.type==="url"||x.type==="time"?"text":(x.type||"text");
  return `<label>${esc(x.label)}<input name="${x.name}" type="${t}" value="${esc(x.value??"")}" ${x.ph?`placeholder="${esc(x.ph)}"`:""} ${x.type==="url"?'inputmode="url"':x.type==="time"?'inputmode="numeric" autocomplete="off"':""} ${t==="number"?'min="0" max="100"':""}></label>`;
}
/* 對話框開在哪裡：設定頁桌面版有右側面板時，一般表單畫在面板裡（非強制回應）；
   modal＝確認、輸入密碼這類要打斷操作的（沒有欄位，或只有密碼欄），一律跳出 */
function dlgOpen(modal){
  if($("#dlg")._fadeEnd)$("#dlg")._fadeEnd();   /* 上一個面板表單還在淡出：先關完 */
  const d=$("#dlg"),host=!modal&&typeof setPaneHost==="function"&&setPaneHost();
  if(host){d.classList.add("in-pane");if(d.parentNode!==host)host.append(d);d.show()}
  else{d.classList.remove("in-pane");if(d.parentNode!==document.body)document.body.append(d);d.showModal()}
}
function ask(title,fields,{danger,wide,alt}={}){
  return new Promise(res=>{
    const d=$("#dlg"),f=$("#dlgForm");
    d.classList.toggle("wide",!!wide);
    f.innerHTML=`<b>${esc(title)}</b>`+fields.map(fieldHTML).join("")
      +(!fields.length&&danger
        ?`<div class="dlg-actions"><button type="button" data-act="delete" class="danger-solid">${esc(danger)}</button><button type="button" data-act="cancel">取消</button></div>`
        :`<div class="dlg-actions"><button type="button" data-act="ok" class="primary">確定</button><button type="button" data-act="cancel">取消</button>${danger?`<button type="button" data-act="delete" class="danger-btn">${esc(danger)}</button>`:""}${alt?`<button type="button" data-act="alt" class="ghost alt-btn">${esc(alt)}</button>`:""}</div>`);
    f.querySelectorAll("[data-sw]").forEach(b=>b.onclick=()=>{f.querySelectorAll("[data-sw]").forEach(x=>x.setAttribute("aria-pressed",x===b));f.querySelector("input[type=color]").value=b.dataset.sw});
    /* no form submission: works inside sandboxed previews too */
    f.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>d.close(b.dataset.act));
    f.onsubmit=ev=>{ev.preventDefault();d.close(!fields.length&&danger?"delete":"ok")};
    f.onkeydown=ev=>{if(ev.key==="Enter"&&!ev.isComposing&&ev.target.tagName==="INPUT"&&ev.target.type!=="color"&&ev.target.type!=="checkbox"){ev.preventDefault();d.close("ok")}};
    d.onclose=()=>{const v=d.returnValue;if(v==="ok"){const o={},fd=new FormData(f);fd.forEach((val,k)=>o[k]=f.querySelector(`textarea[name="${k}"]`)?String(val).replace(/\s+$/,""):String(val).trim());fields.filter(x=>x.type==="multi").forEach(x=>o[x.name]=fd.getAll(x.name).map(String));res(o)}else res(v==="delete"?"delete":v==="alt"?"alt":null)};
    d.returnValue="";dlgOpen(!fields.length||fields.every(x=>x.type==="password"||x.type==="check"));(f.querySelector("textarea")||f.querySelector("input"))?.focus();
  });
}
const markerFields=(m,it)=>[
  {name:"text",label:"註記文字",value:m.text||"",ph:"例如：校務會議"},
  {name:"stage",label:"對應階段（選填）",type:"select",value:m.stage||"",options:[["","（不指定）"],...[...new Set([...it.tags,...(m.stage?[m.stage]:[])])].map(t=>[t,t])]},
  {name:"date",label:hasDates(it)?"日期（決定在時程條與甘特圖上的位置）":"日期（選填，填了也會顯示在甘特圖）",type:"date",value:m.date||today()},
  ...(hasDates(it)?[]:[{name:"at",label:"位置（時程條上的 %；議題填了開始／結束日後改照日期放）",type:"number",value:m.at}]),
  {name:"pos",label:"文字放在",type:"select",value:m.pos||"up",options:[["up","時程條上方"],["down","時程條下方"]]}];
/* 有期間的議題：位置跟著日期走；沒有日期就照 % */
const applyMarker=(m,v,it)=>{Object.assign(m,{text:v.text||m.text,stage:v.stage||"",date:v.date||"",pos:v.pos,color:v.color||m.color});
  m.at=hasDates(it)&&m.date?schedPct(it,m.date):clamp(Math.round(+(v.at??m.at)||0));return m};
async function editMarker(it,mk){
  const v=await ask("編輯註記",markerFields(mk,it),{danger:"刪除註記"});
  if(v==="delete")it.markers=it.markers.filter(x=>x!==mk);else if(v)applyMarker(mk,v,it);if(v)changed();
}

/* 即時回報的時間標記：只填日期＝一個日子；加時刻＝具體時間；填了結束＝一段期間。回傳資料、"delete" 或 null */
const parseHM=s=>{s=String(s||"").trim().replace(/[：.．]/g,":");if(!s)return "";const m=s.match(/^(\d{1,2})(?::?(\d{2}))?$/);if(!m||+m[1]>23||+(m[2]||0)>59)return null;return pad(+m[1])+":"+pad(+(m[2]||0))};
/* 時間標記的欄位（名稱、日期、時刻、結束日期、結束時刻）→ start／end；有錯回傳 msg（對話框與右側面板共用） */
function evTimeParts({label,sd,st,ed,et}){
  const hs=parseHM(st),he=parseHM(et);
  if(!label)return {msg:"請填這個時間是什麼"};
  if(!sd)return {msg:"請選日期"};
  if(hs===null||he===null)return {msg:"時刻請用 14:00 這種格式"};
  const e2=ed||(he?sd:"");
  const start=sd+(hs?"T"+hs:""),end=e2?e2+(he?"T"+he:""):"";
  if(end&&(end.slice(0,10)<start.slice(0,10)||(hs&&he&&end<start)))return {msg:"結束要晚於開始"};
  return {start,end:!end||end===start||(e2===sd&&!he)?"":end};
}
async function askEvTime(ev,tm){
  const par=parentOf(ev),sp=x=>[(x||"").slice(0,10),(x||"").slice(11,16)];
  let [sd,st]=tm?sp(tm.start):[today(),""],[ed,et]=tm?sp(tm.end):["",""],label=tm?tm.label:"",toIssue=!!(tm&&tm.toIssue);
  for(;;){
    const v=await ask(tm?"編輯時間標記":"新增時間標記",[
      {name:"label",label:"這個時間是什麼",value:label,ph:"例如：與總務處開會、公告期間、完成維修"},
      {name:"sd",label:"日期",type:"date",value:sd},
      {name:"st",label:"時刻（選填，例如 14:00）",type:"time",value:st,ph:"不填就只記日期"},
      {name:"ed",label:"結束日期（選填，填了就是一段期間）",type:"date",value:ed},
      {name:"et",label:"結束時刻（選填）",type:"time",value:et},
      ...(par?[{name:"toIssue",label:`也寫進母議題「${par.title}」的處理紀錄`,type:"check",value:toIssue}]:[])],tm?{danger:"刪除"}:{});
    if(!v||v==="delete")return v;
    ({label,sd,ed}=v);toIssue=v.toIssue==="on";st=v.st;et=v.et;
    const r=evTimeParts({label,sd,st,ed,et});if(r.msg){toast(r.msg);continue}
    return {label,start:r.start,end:r.end,toIssue};
  }
}


/* ---------- 自製下拉選單：外觀在每個瀏覽器都一樣 ---------- */
function cselClose(c,focus){
  const l=c.querySelector(".csel-list"),b=c.querySelector(".csel-btn");if(!c.classList.contains("open"))return;
  c.classList.remove("open");b.setAttribute("aria-expanded","false");
  const done=()=>{if(!c.classList.contains("open")){l.hidden=true;c.classList.remove("up")}};
  if(reduceMotion())done();else l.animate([{opacity:1,transform:"none"},{opacity:0,transform:`translateY(${c.classList.contains("up")?6:-6}px) scale(.98)`}],{duration:140,easing:"cubic-bezier(.4,0,1,1)"}).onfinish=done;
  if(focus)b.focus();
}
function cselOpen(c){
  document.querySelectorAll(".csel.open").forEach(o=>o!==c&&cselClose(o));
  const l=c.querySelector(".csel-list"),b=c.querySelector(".csel-btn");
  l.hidden=false;c.classList.add("open");c.classList.remove("up");b.setAttribute("aria-expanded","true");
  const r=l.getBoundingClientRect();if(r.bottom>innerHeight-12&&b.getBoundingClientRect().top>r.height+20)c.classList.add("up");
  if(!reduceMotion())l.animate([{opacity:0,transform:`translateY(${c.classList.contains("up")?8:-8}px) scale(.97)`},{opacity:1,transform:"none"}],{duration:240,easing:"cubic-bezier(.2,.9,.25,1.1)"});
  (l.querySelector('[aria-selected="true"]')||l.querySelector(".csel-opt")).focus({preventScroll:true});
}
document.addEventListener("click",e=>{
  const t=e.target;if(!t.closest)return;
  const b=t.closest(".csel-btn");if(b){const c=b.closest(".csel");c.classList.contains("open")?cselClose(c):cselOpen(c);return}
  const o=t.closest(".csel-opt");if(o){const c=o.closest(".csel");const inp=c.querySelector("input"),chg=inp.value!==o.dataset.v;inp.value=o.dataset.v;c.querySelector(".csel-v").textContent=o.textContent;if(chg)inp.dispatchEvent(new Event("change",{bubbles:true}));c.querySelectorAll(".csel-opt").forEach(x=>x.setAttribute("aria-selected",x===o));cselClose(c,true);return}
  document.querySelectorAll(".csel.open").forEach(c=>{if(!c.contains(t))cselClose(c)});
});
document.addEventListener("keydown",e=>{
  const c=document.querySelector(".csel.open");
  if(!c){const b=e.target.closest&&e.target.closest(".csel-btn");if(b&&(e.key==="ArrowDown"||e.key==="ArrowUp")){e.preventDefault();cselOpen(b.closest(".csel"))}return}
  const os=[...c.querySelectorAll(".csel-opt")],i=os.indexOf(document.activeElement);
  if(e.key==="Escape"){e.preventDefault();e.stopPropagation();cselClose(c,true)}
  else if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();os[(i+(e.key==="ArrowDown"?1:os.length-1)+os.length)%os.length].focus()}
  else if(e.key==="Tab")cselClose(c);
},true);

/* ---------- 對話框：玻璃質地＋開關都有過渡 ---------- */
(function(){
  const d=$("#dlg");if(!d)return;glassify(d);
  const nativeClose=HTMLDialogElement.prototype.close;
  d.close=function(v){
    if(!this.open)return;
    if(this.classList.contains("in-pane")){
      /* 右側面板裡的表單：先在原地淡出、往右滑一點再關，避免內容一關就整片消失（面板接著自己收起）。
         淡出中又要打開（例如時間格式錯了重問）時，dlgOpen 會先把這次關完 */
      if(reduceMotion()||this._fade)return nativeClose.call(this,v);
      const a=this._fade=this.animate([{opacity:1,transform:"none"},{opacity:0,transform:"translateX(18px)"}],{duration:200,easing:"cubic-bezier(.4,0,1,1)",fill:"forwards"});
      this._fadeEnd=()=>{a.onfinish=null;a.cancel();this._fade=null;this._fadeEnd=null;nativeClose.call(this,v)};
      a.onfinish=this._fadeEnd;return;
    }
    if(reduceMotion())return nativeClose.call(this,v);
    const r=this.getBoundingClientRect(),g=this.cloneNode(true);
    g.removeAttribute("id");g.querySelectorAll("[id]").forEach(x=>x.removeAttribute("id"));
    this.querySelectorAll("input,textarea,select").forEach((x,i)=>{const y=g.querySelectorAll("input,textarea,select")[i];if(y&&x.type!=="password")y.value=x.value});
    g.classList.add("dlg-ghost");g.setAttribute("aria-hidden","true");g.setAttribute("open","");
    Object.assign(g.style,{position:"fixed",left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px",margin:"0",zIndex:"2147483000"});
    const bd=document.createElement("div");bd.className="dlg-ghost-bd";
    (document.fullscreenElement||document.body).append(bd,g);
    nativeClose.call(this,v);
    g.animate([{opacity:1,transform:"none"},{opacity:0,transform:"translateY(8px) scale(.96)"}],{duration:200,easing:"cubic-bezier(.4,0,1,1)",fill:"forwards"}).onfinish=()=>g.remove();
    bd.animate([{opacity:1},{opacity:0}],{duration:220,fill:"forwards"}).onfinish=()=>bd.remove();
  };
})();
