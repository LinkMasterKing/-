/* 核心｜頁首搜尋欄（2026-11-05，使用者要求：頁首只留玻璃搜尋欄「搜尋權益部」＋週次＋logo）
   - 搜尋這個看板：即時回報（名稱、說明、時間標記與地點）、議題（名稱、說明、處理紀錄）、完成紀錄（名稱）。
   - 結果在搜尋欄下面浮出（毛玻璃清單，最多 30 筆，符合的字黃底）；上下鍵選、Enter 打開、Esc 先清字。
   - 點一筆＝換到那一區（底部分頁同一套 setSection），捲到那一項並打開（即時回報／完成紀錄展開膠囊或選到右側詳情、議題打開詳情）。 */
const HS={q:"",items:[],on:-1};
const HS_KIND={live:["即時回報","var(--st-ok)"],issue:["議題","var(--ink)"],done:["完成紀錄","var(--ok-dot)"]};
function hsIndex(){
  const out=[];
  state.events.forEach(e=>{
    const k=e.doneAt?"done":"live";
    out.push({k,id:e.id,title:evName(e),sub:e.doneAt?`完成 ${fmt(e.doneAt).slice(5)}`:(e.desc||""),hay:[e.name,e.desc,...(e.times||[]).flatMap(t=>[t.label,t.place])].join(" ")});
    if(!e.doneAt)(e.times||[]).forEach(t=>out.push({k:"live",id:e.id,title:t.label,sub:[fmt(t.start).slice(5),t.place,e.name].filter(Boolean).join("・"),hay:[t.label,t.place].join(" "),time:true}));
  });
  state.issues.forEach(i=>out.push({k:i.doneAt?"done":"issue",id:i.id,title:i.title,sub:i.doneAt?`結案 ${fmt(i.doneAt).slice(5)}`:(i.note||schedLabel(i)),hay:[i.title,i.note,...(i.markers||[]).map(m=>m.text)].join(" ")}));
  return out;
}
const hsHL=(s,q)=>{const t=String(s||"");const i=t.toLowerCase().indexOf(q.toLowerCase());return i<0||!q?esc(t):esc(t.slice(0,i))+`<mark>${esc(t.slice(i,i+q.length))}</mark>`+esc(t.slice(i+q.length))};
function hsRender(){
  const box=$("#boardRes"),q=HS.q.trim(),lab=$("#pageMain .hero-search");if(!box)return;
  lab.classList.toggle("has-q",!!HS.q);
  if(!q){hsShow(false);return}
  const ql=q.toLowerCase();
  HS.items=hsIndex().filter(x=>x.hay.toLowerCase().includes(ql)).sort((a,b)=>(b.title.toLowerCase().includes(ql)-a.title.toLowerCase().includes(ql))).slice(0,30);
  HS.on=HS.items.length?0:-1;
  box.innerHTML=HS.items.map((x,i)=>`<button type="button" class="hr-item${i===HS.on?" on":""}" data-hs="${i}" role="option" style="--c:${HS_KIND[x.k][1]}"><span class="hr-k">${x.time?"時間":HS_KIND[x.k][0]}</span><span class="hr-main"><b>${hsHL(x.title,q)}</b>${x.sub?`<small>${hsHL(x.sub,q)}</small>`:""}</span></button>`).join("")||`<p class="hr-none">「${esc(q)}」找不到符合的項目</p>`;
  hsShow(true);
}
/* 顯示／隱藏（打字很快時不會被還沒播完的隱藏動畫蓋掉） */
function hsShow(on){
  const box=$("#boardRes");if(!box||!!box._on===on)return;box._on=on;
  box.getAnimations().forEach(a=>a.cancel());
  if(on){box.hidden=false;Anim.enter(box,"down");return}
  if(reduceMotion()){box.hidden=true;return}
  const a=box.animate([{opacity:1},{opacity:0}],{duration:MO.fast,easing:MO.in,fill:"forwards"});
  a.finished.then(()=>{if(!box._on){box.hidden=true;a.cancel()}}).catch(()=>{});
}
function hsMark(i){HS.on=i;document.querySelectorAll("#boardRes .hr-item").forEach((b,j)=>b.classList.toggle("on",j===i));const b=document.querySelectorAll("#boardRes .hr-item")[i];b&&b.scrollIntoView({block:"nearest"})}
/* 打開一筆：換區塊 → 捲到那一項 → 打開 */
function hsGo(x){
  hsShow(false);$("#boardQ").blur();
  if(notiOpen)closeNoti(true);if(setOpen)closeSettings(true);
  const sec=x.k==="issue"?"progress":x.k;if(typeof setSection==="function"&&secOn(sec))setSection(sec);
  setTimeout(()=>{
    const el=x.k==="issue"?document.querySelector(`#gantt [data-jump="${x.id}"]`):document.querySelector(x.k==="live"?`#events [data-ev="${x.id}"]`:`#donePanel [data-done="${x.id}"]`);
    if(!el){toast("在看板上找不到這一項");return}
    el.scrollIntoView({block:"center",behavior:reduceMotion()?"auto":"smooth"});
    if(x.k==="issue"){el.click();return}
    if(el.tagName==="DETAILS"&&!el.open&&!el.classList.contains("sel")){const s=el.querySelector("summary");s&&s.click()}
  },reduceMotion()?0:360);
}
(()=>{
  const q=$("#boardQ");if(!q)return;
  glassify($("#pageMain .hero-search"));
  q.addEventListener("input",()=>{HS.q=q.value;hsRender()});
  q.addEventListener("focus",()=>{if(HS.q.trim())hsRender()});
  q.addEventListener("keydown",e=>{
    if(e.key==="Escape"){if(q.value){e.preventDefault();e.stopPropagation();q.value=HS.q="";hsRender()}else q.blur();return}
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){if(!HS.items.length)return;e.preventDefault();hsMark((HS.on+(e.key==="ArrowDown"?1:-1)+HS.items.length)%HS.items.length);return}
    if(e.key==="Enter"){e.preventDefault();const x=HS.items[HS.on];if(x)hsGo(x)}
  });
  $("#pageMain .hq-clear").addEventListener("click",()=>{q.value=HS.q="";hsRender();q.focus()});
  document.addEventListener("click",e=>{
    const t=e.target;if(!t.closest)return;
    const it=t.closest("#boardRes [data-hs]");if(it){hsGo(HS.items[+it.dataset.hs]);return}
    if(!t.closest("#pageMain .hero-find"))hsShow(false);
  });
})();
