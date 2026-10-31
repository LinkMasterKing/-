/* 核心｜對話框 */
/* ---------- dialog ---------- */
function fieldHTML(x){
  if(x.type==="textarea")return `<label>${esc(x.label)}<textarea name="${x.name}" rows="16" placeholder="${esc(x.ph||"")}">${esc(x.value||"")}</textarea></label>`;
  if(x.type==="select")return `<label>${esc(x.label)}<select name="${x.name}">${x.options.map(([v,t])=>`<option value="${esc(v)}" ${v===x.value?"selected":""}>${esc(t)}</option>`).join("")}</select></label>`;
  if(x.type==="color")return `<label>${esc(x.label)}<span class="swatches">${(x.palette||COLORS).map(c=>`<button type="button" style="background:${c}" data-sw="${c}" aria-pressed="${c===x.value}" aria-label="顏色 ${c}"></button>`).join("")}<input type="color" name="${x.name}" value="${esc(x.value)}" style="width:46px;height:32px;padding:2px" aria-label="自訂顏色"></span></label>`;
  const t=x.type==="url"?"text":(x.type||"text");
  return `<label>${esc(x.label)}<input name="${x.name}" type="${t}" value="${esc(x.value??"")}" ${x.ph?`placeholder="${esc(x.ph)}"`:""} ${x.type==="url"?'inputmode="url"':""} ${t==="number"?'min="0" max="100"':""}></label>`;
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
    f.onkeydown=ev=>{if(ev.key==="Enter"&&!ev.isComposing&&ev.target.tagName==="INPUT"&&ev.target.type!=="color"){ev.preventDefault();d.close("ok")}};
    d.onclose=()=>{const v=d.returnValue;if(v==="ok"){const o={};new FormData(f).forEach((val,k)=>o[k]=f.querySelector(`textarea[name="${k}"]`)?String(val).replace(/\s+$/,""):String(val).trim());res(o)}else res(v==="delete"?"delete":v==="alt"?"alt":null)};
    d.returnValue="";d.showModal();(f.querySelector("textarea")||f.querySelector("input"))?.focus();
  });
}
const markerFields=(m,it)=>[
  {name:"text",label:"註記文字",value:m.text||"",ph:"例如：校務會議"},
  {name:"stage",label:"對應階段（選填）",type:"select",value:m.stage||"",options:[["","（不指定）"],...[...new Set([...it.tags,...(m.stage?[m.stage]:[])])].map(t=>[t,t])]},
  {name:"date",label:"日期（選填，填了也會顯示在甘特圖）",type:"date",value:m.date??today()},
  {name:"at",label:"位置（進度條上的 %）",type:"number",value:m.at},
  {name:"pos",label:"文字放在",type:"select",value:m.pos||"up",options:[["up","進度條上方"],["down","進度條下方"]]}];
const applyMarker=(m,v)=>Object.assign(m,{text:v.text||m.text,stage:v.stage||"",at:clamp(Math.round(+v.at||0)),date:v.date||"",pos:v.pos,color:v.color||m.color});
async function editMarker(it,mk){
  const v=await ask("編輯註記",markerFields(mk,it),{danger:"刪除註記"});
  if(v==="delete")it.markers=it.markers.filter(x=>x!==mk);else if(v)applyMarker(mk,v);if(v)changed();
}

