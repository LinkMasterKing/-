/* 核心｜工作報告：選期間 → 預覽（文字可直接修改、可新增或移除區塊）→ 列印成 PDF
   內容：本期摘要（數字＋期間甘特圖）、議題處理情形（逐案）、自訂區塊（預設「工作檢討」「下期規劃」）
   預覽裡打的字只用在這一份報告，不會存進看板。 */
let rptOpen=false,rptRange=null;

/* ---------- 資料：期間內處理過的議題、即時回報、週報 ---------- */
function rptData(from,to){
  const inP=d=>!!d&&d>=from&&d<=to;
  const act=state.issues.filter(i=>i.progress<100&&(!i.start||i.start<=to));
  const done=state.issues.filter(i=>i.progress>=100&&inP(i.doneAt)).sort((a,b)=>a.doneAt.localeCompare(b.doneAt));
  const extra=state.issues.filter(i=>!act.includes(i)&&!done.includes(i)&&i.markers.some(m=>inP(m.date)));
  const issues=[...act,...done,...extra];
  const evNew=state.events.filter(e=>inP(e.createdAt)),evDone=state.events.filter(e=>inP(e.doneAt));
  return {from,to,inP,issues,nDone:issues.filter(i=>i.progress>=100).length,nAct:issues.filter(i=>i.progress<100).length,evNew,evDone,evLinked:evDone.filter(e=>e.issueId).length,
    marks:issues.reduce((n,i)=>n+i.markers.filter(m=>inP(m.date)).length,0),weeks:state.weeks.filter(w=>inP(w.date))};
}

/* ---------- 期間甘特圖（只畫這段期間，超出的部分切掉） ---------- */
function rptGantt(d){
  const rows=d.issues.filter(i=>hasDates(i)&&(i.start<i.end?i.start:i.end)<=d.to&&(i.start<i.end?i.end:i.start)>=d.from);
  if(!rows.length)return "";
  const W=720,NW=176,L=NW+12,R=W-6,RH=28,top=30,H=top+rows.length*RH;
  const t0=pd(d.from).getTime(),t1=pd(d.to).getTime()+864e5,X=s=>L+Math.max(0,Math.min(1,(pd(s).getTime()-t0)/(t1-t0)))*(R-L);
  const ms=[],m=pd(d.from);m.setDate(1);if(m.getTime()<t0)m.setMonth(m.getMonth()+1);
  while(m.getTime()<t1){ms.push(ymd(m));m.setMonth(m.getMonth()+1)}
  const grid=ms.map(s=>`<line class="rg-grid" x1="${X(s)}" x2="${X(s)}" y1="16" y2="${H}"/>${X(s)<R-26?`<text class="rg-m" x="${X(s)+3}" y="12">${pd(s).getMonth()+1}月</text>`:""}`).join("");
  const td=today(),now=td>=d.from&&td<=d.to?`<line class="rg-today" x1="${X(td)}" x2="${X(td)}" y1="14" y2="${H}"/>`:"";
  const bars=rows.map((it,k)=>{
    const y=top+k*RH,s=it.start<it.end?it.start:it.end,e=it.start<it.end?it.end:it.start,x1=X(s),x2=X(e);
    const xf=X(ymd(new Date(pd(s).getTime()+(pd(e)-pd(s))*it.progress/100))),name=it.title.length>12?it.title.slice(0,12)+"…":it.title;
    return `<g data-tone="${progTone(it.progress)}"><text class="rg-t" x="0" y="${y+4}">${esc(name)}</text><text class="rg-p" x="${NW}" y="${y+4}" text-anchor="end">${it.progress}%</text>`+
      `<line class="rg-rest" x1="${x1}" x2="${Math.max(x1+1,x2)}" y1="${y}" y2="${y}"/>${xf>x1?`<line class="rg-fill" x1="${x1}" x2="${xf}" y1="${y}" y2="${y}"/>`:""}</g>`}).join("");
  return `<figure class="rpt-gantt" contenteditable="false"><svg viewBox="0 0 ${W} ${H+8}" role="img" aria-label="期間甘特圖">${grid}${now}${bars}</svg></figure>`;
}

/* ---------- 報告內容 ---------- */
const rptSec=(k,h,body,cls="")=>`<section class="rpt-sec ${cls}" data-k="${k}"><button type="button" class="rpt-x" contenteditable="false" aria-label="移除這個區塊">移除</button><h2 contenteditable="true">${h}</h2>${body}</section>`;
const rptFree=(h,ph)=>rptSec("free",h,`<div class="rpt-text" contenteditable="true" data-ph="${ph}"></div>`,"rpt-free");
function rptHTML(d){
  const dept=CFG.dept.name||state.title,logo=document.getElementById("dept-logo");
  const staffNames=ids=>(ids||[]).map(id=>(state.staff.find(s=>s.id===id)||{}).name).filter(Boolean).join("、");
  const head=`<header class="rpt-head"><div class="rpt-logo">${logo?logo.innerHTML:""}</div>
    <div class="rpt-ttl"><h1 contenteditable="true">${esc(dept)} 工作報告</h1><p class="rpt-sub" contenteditable="true">${state.yearLabel?esc(state.yearLabel)+"　｜　":""}報告期間 ${fmt(d.from)} – ${fmt(d.to)}</p></div>
    <dl class="rpt-meta"><div><dt>報告人</dt><dd contenteditable="true">${esc(meName())}</dd></div><div><dt>製表日期</dt><dd contenteditable="true">${fmt(today())}</dd></div></dl></header>`;
  const stat=(n,t,s)=>`<div><b>${n}</b><span>${t}</span><small>${s}</small></div>`;
  const sum=rptSec("sum","本期摘要",`<div class="rpt-stats" contenteditable="true">${stat(d.issues.length,"處理議題",`完成 ${d.nDone}・進行中 ${d.nAct}`)}${stat(d.marks,"處理紀錄","期間內的議題註記")}${stat(d.evNew.length,"新增即時回報",`完成 ${d.evDone.length}・併入議題 ${d.evLinked}`)}${stat(d.weeks.length,"每週概述","期間內的週報")}</div>${rptGantt(d)}`);
  const issue=it=>{
    const meta=[hasDates(it)?`期間 ${fmt(it.start)} – ${fmt(it.end)}`:"",it.tags[it.cur]?`目前階段：${it.tags[it.cur]}`:"",staffNames(it.staff)?`專員：${staffNames(it.staff)}`:""].filter(Boolean).join("　｜　");
    const mk=sortedMarkers(it).filter(m=>!m.date||d.inP(m.date));
    const evs=state.events.filter(e=>e.issueId===it.id&&(!e.doneAt||d.inP(e.doneAt)||d.inP(e.createdAt)));
    return `<article class="rpt-issue" data-tone="${progTone(it.progress)}"><h3>${esc(it.title)}<span class="rpt-st">${it.progress>=100?`已完成 ${fmt(it.doneAt)}`:`進行中 ${it.progress}%`}</span></h3>
      ${meta?`<p class="rpt-meta2">${esc(meta)}</p>`:""}<div class="rpt-prog" contenteditable="false"><i style="width:${it.progress}%"></i></div>
      <h4>處理經過</h4>${mk.length?`<ul class="rpt-tl">${mk.map(m=>`<li><span class="rpt-d">${m.date?fmt(m.date).slice(5):"未標日期"}</span>${m.stage?`【${esc(m.stage)}】`:""}${esc(m.text||"")}</li>`).join("")}</ul>`:`<p class="rpt-none">這段期間沒有處理紀錄</p>`}
      ${it.note?`<h4>目前進度</h4><p>${esc(it.note)}</p>`:""}
      ${evs.length?`<h4>相關即時回報</h4><p>${evs.map(e=>`${esc(e.name)}（${e.doneAt?fmt(e.doneAt).slice(5)+" 完成":"處理中"}）`).join("、")}</p>`:""}
      ${it.links.length?`<h4>相關連結</h4><p>${it.links.map(l=>`<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join("、")}</p>`:""}</article>`};
  const iss=rptSec("issues","議題處理情形",`<div class="rpt-body" contenteditable="true">${d.issues.map(issue).join("")||'<p class="rpt-none">這段期間沒有處理中的議題</p>'}</div>`);
  return head+sum+iss+rptFree("工作檢討","在這裡輸入這段期間的工作檢討…")+rptFree("下期規劃","在這裡輸入下一期的規劃…");
}

/* ---------- 預覽視窗 ---------- */
async function reportDialog(){
  const t=today(),pick=[state.termStart,CFG.term.start].find(x=>x&&x<=t)||addDays(t,-90);
  const v=await ask("匯出工作報告",[{name:"from",label:"期間開始（預設是本學期開學日）",type:"date",value:pick},{name:"to",label:"期間結束",type:"date",value:t}]);
  if(!v)return;let a=v.from||pick,b=v.to||t;if(a>b)[a,b]=[b,a];
  openReport(a,b);
}
function openReport(from,to){
  closeReport(true);rptRange={from,to};
  document.body.insertAdjacentHTML("beforeend",`<div class="rpt-ov" id="rptOv" role="dialog" aria-modal="true" aria-label="工作報告預覽">
    <div class="anim-top rpt-bar"><div class="anim-title"><span class="anim-k">REPORT</span><b>工作報告預覽</b><span class="sub rpt-hint">文字都可以直接點開修改・空白的區塊不會印出來</span></div>
      <div class="anim-ctl"><button type="button" id="rptAdd">＋ 新增區塊</button><button type="button" class="primary" id="rptPrint">${ico("download")}存成 PDF</button><button type="button" id="rptClose" aria-label="關閉工作報告">${ico("close")}關閉</button></div></div>
    <div class="rpt-scroll"><article class="rpt-paper" spellcheck="false">${rptHTML(rptData(from,to))}</article></div></div>`);
  const ov=$("#rptOv");rptOpen=true;document.body.classList.add("rpt-open");
  $("#rptClose").onclick=()=>closeReport();$("#rptPrint").onclick=rptPrint;$("#rptAdd").onclick=rptAdd;
  ov.addEventListener("click",e=>{const x=e.target.closest(".rpt-x");if(x){const s=x.closest(".rpt-sec");if(reduceMotion())s.remove();else s.animate([{opacity:1},{opacity:0,transform:"translateY(-6px)"}],{duration:200,easing:"ease-in"}).onfinish=()=>s.remove()}});
  /* 貼上時只留純文字，不帶別處的格式 */
  ov.addEventListener("paste",e=>{const t=e.clipboardData&&e.clipboardData.getData("text/plain");if(t==null||!e.target.closest('[contenteditable="true"]'))return;e.preventDefault();document.execCommand("insertText",false,t)});
  if(!reduceMotion())ov.animate([{transform:"translateX(28px)",opacity:0},{transform:"none",opacity:1}],{duration:380,easing:"cubic-bezier(.2,.9,.25,1)"});
}
function closeReport(instant){
  const ov=$("#rptOv");if(!ov)return;rptOpen=false;
  const done=()=>{ov.remove();if(!$("#rptOv"))document.body.classList.remove("rpt-open")};
  if(instant||reduceMotion())return done();
  ov.animate([{transform:"none",opacity:1},{transform:"translateX(28px)",opacity:0}],{duration:220,easing:"cubic-bezier(.4,0,1,1)"}).onfinish=done;
}
function rptAdd(){
  const p=$("#rptOv .rpt-paper");if(!p)return;
  p.insertAdjacentHTML("beforeend",rptFree("新區塊","在這裡輸入內容…"));
  const s=p.lastElementChild,h=s.querySelector("h2");
  s.scrollIntoView({behavior:reduceMotion()?"auto":"smooth",block:"center"});
  h.focus();const r=document.createRange();r.selectNodeContents(h);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);
}
/* 列印：只印報告本身；PDF 的預設檔名用報告名稱 */
function rptPrint(){
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
  const t=document.title,r=rptRange||{from:"",to:""};
  document.title=`${CFG.dept.name||""}工作報告_${r.from.replaceAll("-","")}-${r.to.replaceAll("-","")}`;
  const back=()=>{document.title=t;removeEventListener("afterprint",back)};addEventListener("afterprint",back);
  try{window.print()}catch(_){back();toast("這個環境不能列印：請用瀏覽器打開網站再匯出")}
}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&rptOpen&&!$("#dlg").open)closeReport()});
