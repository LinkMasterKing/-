/* 核心｜動畫模式（動態摘要） */
/* ---------- 傻瓜模式動態摘要 (story) ---------- */
const story={i:0,t:null,end:0,remain:0,dur:0,running:false,paused:false};
const firstLine=t=>String(t||"").split("\n").map(x=>x.replace(/^\s*[・•\-❏*]\s*/,"").trim()).filter(Boolean)[0]||"";
function sceneLive(){
  const evs=state.events.filter(e=>!e.doneAt).slice().reverse();
  const show=evs.slice(0,5),more=evs.length-show.length;
  const t0=1.5,step=.38;
  const items=show.length?show.map((e,i)=>`<li style="--d:${(t0+i*step).toFixed(2)}s"><span class="sc-dot red"></span><b>${esc(e.name)}</b>${parentOf(e)?`<span class="sc-tag">${esc(parentOf(e).title)}</span>`:""}<span class="sc-desc">${esc(firstLine(e.desc))}</span></li>`).join("")+(more>0?`<li class="sc-more" style="--d:${(t0+show.length*step).toFixed(2)}s">還有 ${more} 則</li>`:"")
    :`<li style="--d:${t0}s"><span class="sc-dot green"></span><b>目前沒有待處理的即時回報</b></li>`;
  const html=`<div class="sc-head"><span class="sc-num">01</span><span class="live-dot sc-live"></span><h3>即時回報</h3><span class="sc-count" style="--d:.5s">${evs.length}</span></div>
    <p class="sc-sub" style="--d:.9s">目前最新待處理事項</p><ol class="sc-list">${items}</ol>`;
  return {html,dur:(t0+Math.max(1,show.length+(more>0?1:0))*step+2.4)*1000};
}
function sceneProgress(){
  const act=state.issues.filter(i=>i.progress<100);
  const rows=act.filter(hasDates).slice(0,6);
  let gEnd=0,g="";
  if(rows.length){
    const ds=rows.flatMap(i=>[i.start,i.end]).sort();
    const a=pd(ds[0]),b=pd(ds[ds.length-1]);a.setDate(1);b.setMonth(b.getMonth()+1,1);
    const W=Math.max(300,(($("#storyStage")||{}).clientWidth||900)-(innerWidth<640?36:52)),L=8,Rr=W-8;const SH=(($("#storyStage")||{}).clientHeight||330);const span=b-a,X=d=>L+((pd(d)-a)/span)*(Rr-L),RH=Math.round(Math.min(72,Math.max(30,(SH-240)/rows.length))),H=48+rows.length*RH;
    const ms=[];const m=new Date(a);while(m<=b){ms.push(new Date(m));m.setMonth(m.getMonth()+1)}
    const grid=ms.map((mm,k)=>{const x=X(ymd(mm));return `<line class="sg-grid" x1="${x}" x2="${x}" y1="22" y2="${H}" style="--d:${(.35+k*.05).toFixed(2)}s"/><text class="sg-m" x="${x+4}" y="14" style="--d:${(.35+k*.05).toFixed(2)}s">${mm.getMonth()+1}月</text>`}).join("");
    const tx=X(today());const todayL=(tx>L&&tx<Rr)?`<line class="sg-today" x1="${tx}" x2="${tx}" y1="18" y2="${H}" pathLength="1" style="--d:.9s"/>`:"";
    const r0=1.1,rs=.28;
    const bars=rows.map((it,k)=>{const y=50+k*RH,x1=X(it.start<it.end?it.start:it.end),x2=X(it.start<it.end?it.end:it.start),xf=x1+(x2-x1)*it.progress/100,c=`var(--prog-${progTone(it.progress)})`,d=r0+k*rs;
      return `<line class="sg-rest" x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" pathLength="1" style="--d:${d.toFixed(2)}s"/>`+
        (it.progress>0?`<line class="sg-fill" x1="${x1}" x2="${Math.max(x1+.1,xf)}" y1="${y}" y2="${y}" pathLength="1" stroke="${c}" style="--d:${(d+.35).toFixed(2)}s"/>`:"")+
        `<rect class="sg-knob" x="${xf-2}" y="${y-8}" width="4" height="16" rx="2" fill="${c}" style="--d:${(d+.9).toFixed(2)}s"/>`+
        `<text class="sg-t" x="${Math.min(Math.max(L+2,x1),Rr-120)}" y="${y-8}" style="--d:${(d+.2).toFixed(2)}s">${esc(it.title)}</text>`}).join("");
    gEnd=r0+rows.length*rs+1.4;
    g=`<div class="sc-gantt" style="--o:${(gEnd+.4).toFixed(2)}s"><svg viewBox="0 0 ${W} ${H+6}" width="${W}" height="${H+6}" aria-hidden="true"><line class="sg-axis" x1="${L}" x2="${Rr}" y1="22" y2="22" pathLength="1" style="--d:.2s"/>${grid}${todayL}${bars}</svg></div>`;
  }
  const show=act.slice(0,5),more=act.length-show.length;
  const b0=rows.length?gEnd+.7:.9,step=Math.min(.75,3.2/Math.max(1,show.length));
  const list=show.length?show.map((it,k)=>{const c=progTone(it.progress);return `<li style="--d:${(b0+k*step).toFixed(2)}s"><span class="sp-t">${esc(it.title)}</span><span class="sp-bar"><i class="${c}" style="--p:${it.progress}%;--d:${(b0+k*step+.15).toFixed(2)}s"></i></span><span class="sp-n ${c}">${it.progress}%</span></li>`}).join("")+(more>0?`<li class="sc-more" style="--d:${(b0+show.length*step).toFixed(2)}s">還有 ${more} 個議題</li>`:"")
    :`<li style="--d:${b0}s"><span class="sp-t">目前沒有進行中的議題</span></li>`;
  const html=`<div class="sc-head"><span class="sc-num">02</span><h3>目前進度</h3><span class="sc-count" style="--d:.5s">${act.length}</span></div>
    <div class="sc-body">${g}<ol class="sc-bars ${rows.length?"after":""}">${list}</ol></div>`;
  return {html,dur:(b0+Math.max(1,show.length+(more>0?1:0))*step+2.6)*1000};
}
function sceneDone(){
  const items=[...state.issues.filter(i=>i.progress>=100).map(i=>({t:i.title,d:i.doneAt||"",k:"議題"})),...state.events.filter(e=>e.doneAt).map(e=>({t:e.name,d:e.doneAt,k:"即時回報"}))].sort((a,b)=>b.d.localeCompare(a.d));
  const show=items.slice(0,6),more=items.length-show.length,t0=1.0,step=.42;
  const list=show.length?show.map((x,i)=>`<li style="--d:${(t0+i*step).toFixed(2)}s"><span class="ok-dot sc-ok"></span><b>${esc(x.t)}</b><span class="sc-desc">${fmt(x.d)} · ${x.k}</span></li>`).join("")+(more>0?`<li class="sc-more" style="--d:${(t0+show.length*step).toFixed(2)}s">還有 ${more} 項</li>`:"")
    :`<li style="--d:${t0}s"><b>還沒有完成的項目</b></li>`;
  const html=`<div class="sc-head"><span class="sc-num">03</span><h3>已經完成</h3><span class="sc-count" style="--d:.5s">${items.length}</span></div><ol class="sc-list sc-done">${list}</ol>`;
  return {html,dur:(t0+Math.max(1,show.length+(more>0?1:0))*step+2.8)*1000};
}
const SCENES=[["即時回報",sceneLive,"live"],["目前進度",sceneProgress,"progress"],["已經完成",sceneDone,"done"]].filter(x=>secOn(x[2]));
function storyPlay(idx){
  clearTimeout(story.t);story.i=idx;story.running=true;story.paused=false;
  const st=$("#storyStage");if(!st)return;
  st.classList.remove("paused");
  const {html,dur}=SCENES[idx][1]();
  st.querySelectorAll(".scene").forEach(o=>{o.classList.remove("cur");o.classList.add("out");setTimeout(()=>o.remove(),800)});
  const el=document.createElement("div");el.className="scene cur";el.innerHTML=html;st.append(el);
  /* never clip: shrink the scene to fit the stage when content is taller */
  const fit=()=>{el.style.zoom="";const over=el.scrollHeight/el.clientHeight;if(over>1.01)el.style.zoom=String(Math.max(.55,1/over))};fit();
  story.dur=dur;story.end=Date.now()+dur;
  $("#storyDots").innerHTML=SCENES.map(([t],k)=>`<button type="button" class="sdot-btn ${k===idx?"cur":""} ${k<idx?"seen":""}" data-story="${k}" aria-label="${t}"><span class="sdot-t">${t}</span><span class="sdot-bar"><i style="${k===idx?`animation-duration:${dur}ms`:""}"></i></span></button>`).join("");
  if(!reduceMotion())story.t=setTimeout(()=>storyPlay((idx+1)%SCENES.length),dur+900);
}
let animOpen=false;
function storySync(){
  const on=animOpen;
  if(on&&!story.running)storyPlay(0);
  if(!on&&story.running){clearTimeout(story.t);story.running=false;const st=$("#storyStage");if(st)st.innerHTML=""}
}
function storyPause(p){
  if(!story.running||story.paused===p)return;const st=$("#storyStage");story.paused=p;
  if(p){clearTimeout(story.t);story.remain=Math.max(0,story.end-Date.now())+900;st.classList.add("paused");$("#story").classList.add("paused")}
  else{st.classList.remove("paused");$("#story").classList.remove("paused");story.end=Date.now()+story.remain-900;if(!reduceMotion())story.t=setTimeout(()=>storyPlay((story.i+1)%SCENES.length),story.remain)}
}

/* ---------- 動畫模式視窗 ---------- */
document.addEventListener("visibilitychange",()=>{if(document.hidden)storyPause(true)});
function openAnim(){
  if(setOpen)closeSettings(true);
  animOpen=true;const ov=$("#animOv");ov.hidden=false;
  $("#animTitle").textContent=state.title;$("#animDate").textContent=fmt(state.boardDate||today());
  ov.classList.remove("closing");void ov.offsetWidth;ov.classList.add("show");
  story.running=false;
  const fs=ov.requestFullscreen?ov.requestFullscreen():Promise.reject();
  fs.catch(()=>{}).finally(()=>setTimeout(()=>storySync(),120));
  /* 工具列跟著進全螢幕，留在原位 */
  const tb=$("#tabbar");if(tb){ov.append(tb);tb.classList.add("in-anim");renderTabbar()}
}
document.addEventListener("fullscreenchange",()=>{if(!document.fullscreenElement&&animOpen)closeAnim()});
function closeAnim(){
  if(!animOpen)return;animOpen=false;const ov=$("#animOv");ov.classList.remove("show");ov.classList.add("closing");
  storySync();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  setTimeout(()=>{if(!animOpen){ov.hidden=true;ov.classList.remove("closing")}},420);
  const tb=$("#tabbar");if(tb){tb.classList.remove("in-anim");document.body.append(tb);renderTabbar()}
}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&animOpen&&!$("#dlg").open)closeAnim()});
