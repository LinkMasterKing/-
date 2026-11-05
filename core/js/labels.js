/* 核心｜人事時地物標籤（schemaVersion 8）
   state.labels[]＝{id,kind,name}，kind 是「人／事／時／地／物」其中之一；由管理員在設定頁「標籤」建立。
   即時回報與議題各自有 labels[]（存標籤 id）。挑選時各類別裡「用得越多的排越前面」（像常用選字）。
   跟時間標記上的「地點」（times[].place，自由文字）分工：「地」標籤是常去的地方，填地點時會列成快速選項，點了就填進地點欄。 */
const LABEL_KINDS=["人","事","時","地","物"];
const labelById=id=>state.labels.find(l=>l.id===id);
/* 每個標籤被用了幾次（即時回報＋議題，含已完成的） */
function labelUse(){const n=new Map();[...state.events,...state.issues].forEach(o=>(o.labels||[]).forEach(id=>n.set(id,(n.get(id)||0)+1)));return n}
/* 某一類的標籤，常用的排前面，同樣次數照名字 */
function labelsOf(kind,use=labelUse()){return state.labels.filter(l=>l.kind===kind).sort((a,b)=>(use.get(b.id)||0)-(use.get(a.id)||0)||a.name.localeCompare(b.name,"zh-Hant"))}
/* 顯示用的小標籤（照人事時地物的順序） */
function labelChipsHTML(ids){
  const ls=(ids||[]).map(labelById).filter(Boolean).sort((a,b)=>LABEL_KINDS.indexOf(a.kind)-LABEL_KINDS.indexOf(b.kind));
  return ls.length?`<div class="lbl-row">${ls.map(l=>`<span class="lbl-chip" data-k="${esc(l.kind)}"><i>${esc(l.kind)}</i>${esc(l.name)}</span>`).join("")}</div>`:"";
}
/* 挑選區：依類別分列，每列可以單獨點選（多選）；name＝表單欄位名（FormData 用 getAll 取） */
function labelPickerHTML(name,sel){
  const use=labelUse(),on=new Set(sel||[]);
  if(!state.labels.length)return `<p class="sub lbl-empty">還沒有標籤。管理員可以到「設定 → 標籤」建立人、事、時、地、物的常用標籤。</p>`;
  return `<div class="lbl-pick">${LABEL_KINDS.map(k=>{const ls=labelsOf(k,use);if(!ls.length)return "";
    return `<div class="lbl-grp" data-k="${k}"><span class="lbl-k">${k}</span><div class="chips">${ls.map(l=>`<label class="chip lbl-opt"><input type="checkbox" name="${name}" value="${esc(l.id)}" ${on.has(l.id)?"checked":""}><span>${esc(l.name)}</span></label>`).join("")}</div></div>`}).join("")}</div>`;
}
/* 時間標記的地點：「地」標籤當快速選項 */
function placeQuickHTML(){
  const ls=labelsOf("地");
  return ls.length?`<span class="place-quick">${ls.slice(0,8).map(l=>`<button type="button" class="tag sm" data-place="${esc(l.name)}">${esc(l.name)}</button>`).join("")}</span>`:"";
}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-place]");if(!b)return;e.preventDefault();
  const box=b.closest(".evf-ed,form"),inp=box&&box.querySelector('[data-e="place"],input[name="place"]');if(inp){inp.value=b.dataset.place;inp.focus()}});

/* ---------- 設定頁「標籤」：管理員新增、改名、刪除；其他人只看 ---------- */
function labelSetHTML(){
  const adm=isAdmin(),use=labelUse();
  const grp=k=>{const ls=labelsOf(k,use);
    return `<section class="tm-sec"><div class="att-h">${k}<span class="sub">　${{人:"例如：學務處、某位老師",事:"例如：宿舍、交通安全",時:"例如：期中考週、校慶",地:"例如：六宿、圖書館",物:"例如：飲水機、機車"}[k]}</span></div>
      <ul class="tm-list">${ls.map(l=>`<li class="tm-row">${adm?`<input data-lblname="${l.id}" value="${esc(l.name)}" aria-label="標籤名稱">`:`<span class="tm-name">${esc(l.name)}</span>`}<span class="sub">用了 ${use.get(l.id)||0} 次</span>${adm?`<button type="button" class="icon danger" data-x="del" data-id="${l.id}">刪除</button>`:""}</li>`).join("")||'<li class="sub">還沒有</li>'}</ul>
      ${adm?`<div class="tm-tools"><input data-newlbl="${k}" placeholder="新增「${k}」標籤" aria-label="新增${k}標籤"><button type="button" data-x="add" data-k="${k}">＋ 新增</button></div>`:""}</section>`};
  return `<b>標籤（人事時地物）</b>
  <p class="sub tm-note">標在即時回報與議題上；挑選時常用的排前面。${adm?"":"新增、刪除標籤需要管理員。"}時間標記的地點可以直接點「地」標籤填入。</p>
  ${LABEL_KINDS.map(grp).join("")}
  <p class="sub tm-note">${editing?"變更會在按「儲存並同步」後生效。":"按「完成」後會直接儲存並同步。"}</p>
  <div class="dlg-actions"><button type="button" class="primary" data-x="done">完成</button></div>`;
}
async function labelSettings(){
  const d=$("#dlg"),f=$("#dlgForm");d.classList.add("wide");
  const syncNames=()=>f.querySelectorAll("[data-lblname]").forEach(i=>{const l=labelById(i.dataset.lblname),n=i.value.trim();if(l&&n&&n!==l.name){l.name=n;dirty=true}});
  const paint=()=>{f.innerHTML=labelSetHTML();bind()};
  const bind=()=>{
    f.onsubmit=ev=>ev.preventDefault();
    f.onkeydown=ev=>{const k=ev.target.dataset&&ev.target.dataset.newlbl;if(ev.key==="Enter"&&!ev.isComposing&&k){ev.preventDefault();f.querySelector(`[data-x="add"][data-k="${k}"]`).click()}};
    f.querySelectorAll("[data-x]").forEach(b=>b.onclick=async()=>{
      const x=b.dataset.x;syncNames();
      if(x==="add"){const k=b.dataset.k,inp=f.querySelector(`[data-newlbl="${k}"]`),n=inp.value.trim();if(!n)return;
        if(state.labels.some(l=>l.kind===k&&l.name===n)){toast("已經有這個標籤");return}
        state.labels.push({id:uid("g"),kind:k,name:n});dirty=true;paint();f.querySelector(`[data-newlbl="${k}"]`).focus();return}
      if(x==="del"){const id=b.dataset.id;state.labels=state.labels.filter(l=>l.id!==id);[...state.events,...state.issues].forEach(o=>{if(o.labels)o.labels=o.labels.filter(v=>v!==id)});dirty=true;paint();return}
      if(x==="done"){d.oncancel=null;if(d.open)await new Promise(r=>{d.addEventListener("close",()=>setTimeout(r,0),{once:true});d.close()});d.classList.remove("wide");
        if(editing)changed();else if(dirty)await settingSave(()=>{},"已更新標籤");else render();finish()}
    });
  };
  let finish;return new Promise(r=>{finish=r;paint();d.oncancel=ev=>{ev.preventDefault();f.querySelector('[data-x="done"]').click()};dlgOpen(false)});
}
