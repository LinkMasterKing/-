/* 核心｜動畫模式（動態摘要）
   一輪三段，接著循環：
   1. 本週完成：白色卡片一張張由慢到快滑進來，接著跑馬燈
   2. 議題進度：沒關聯的卡片淡出，有連到議題的卡片從四散飛到該議題底下排好；進度條等速進場，再依序從上一份週報的進度跑到現在
   3. 本週新增：進度區整片往下滑走，這週新增的即時回報從左右兩邊滑進來
   「本週」＝上一份週報之後（和生成週報同一個期間）。暫停時整條時間軸一起停。 */
const story={tok:0,i:0,running:false,paused:false};
const STOP=Symbol("stop");
let animOpen=false;
const firstLine=t=>String(t||"").split("\n").map(x=>x.replace(/^\s*[・•\-❏*]\s*/,"").trim()).filter(Boolean)[0]||"";
const CHAPTERS=[["本週完成","done",chDone],["議題進度","progress",chProgress],["本週新增","live",chNew]].filter(c=>secOn(c[1]));

/* ---------- 每一輪的資料 ---------- */
function svCtx(){
  const {start,end}=weekRange(),inW=d=>!!d&&d>start&&d<=end,base=state.reportBase&&state.reportBase.issues;
  const has=id=>state.issues.some(i=>i.id===id);
  const done=[...state.issues.filter(i=>i.progress>=100&&inW(i.doneAt)).map(i=>({key:"i"+i.id,t:i.title,d:i.doneAt,k:"議題",iss:i.id})),
    ...state.events.filter(e=>inW(e.doneAt)).map(e=>({key:"e"+e.id,t:e.name,d:e.doneAt,k:"即時回報",iss:e.issueId&&has(e.issueId)?e.issueId:null}))].sort((a,b)=>a.d.localeCompare(b.d));
  const rows=state.issues.filter(i=>i.progress<100||inW(i.doneAt)).map(i=>({it:i,from:base&&base[i.id]?base[i.id].progress:0,to:i.progress}));
  const fresh=state.events.filter(e=>inW(e.createdAt));
  return {start,end,done,rows,fresh};
}
const svRange=c=>`${fmt(addDays(c.start,1)).slice(5)} – ${fmt(c.end).slice(5)}`;

/* ---------- 小工具：動畫都用 Web Animations，等待也是一段空動畫，暫停時一起停 ---------- */
function svKit(tok){
  const st=$("#storyStage"),RM=reduceMotion();
  const alive=()=>tok===story.tok&&animOpen;
  const fin=a=>a.finished.then(()=>{if(!alive())throw STOP},()=>{throw STOP});
  const A=(el,kf,o)=>el.animate(kf,{fill:"both",...o,duration:RM?1:o.duration,delay:RM?0:(o.delay||0)});
  const wait=ms=>fin(st.animate([],{duration:ms}));
  return {st,RM,alive,fin,A,wait};
}
const svEl=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e};
function svLayer(K,cls,title,count,sub,delay=0){
  const L=svEl("div","sv-layer "+cls),h=svEl("div","sv-head",`<h3>${title}</h3>${count!=null?`<span class="sv-count">${count}</span>`:""}${sub?`<span class="sv-sub">${sub}</span>`:""}`);
  L.append(h);K.st.append(L);
  K.A(h,[{opacity:0,transform:"translateY(12px)"},{opacity:1,transform:"none"}],{duration:520,delay,easing:"cubic-bezier(.2,.9,.25,1)"});
  return L;
}
/* 放不下就從最後面拿掉，改成「還有 N 個」 */
function svFit(L,box,items,more){
  let note=null,n=0;
  while(items.length>1&&L.scrollHeight>L.clientHeight+1){items.pop().remove();n++;if(!note){note=svEl("p","sv-more");box.after(note)}note.textContent=more(n)}
  return items;
}
async function svFade(K,L){await K.fin(K.A(L,[{opacity:1},{opacity:0}],{duration:600,easing:"ease"}));L.remove()}
const svCard=x=>{const c=svEl("div","sv-card",`<span class="sv-ck" aria-hidden="true"></span><b>${esc(x.t)}</b><small>${fmt(x.d).slice(5)} · ${x.k}${x.k==="即時回報"&&x.iss?` → ${esc((state.issues.find(i=>i.id===x.iss)||{}).title||"")}`:""}</small>`);c.dataset.key=x.key;return c};

/* ---------- 1. 本週完成 ---------- */
async function chDone(K,ctx){
  const {A,wait}=K,W=K.st.clientWidth;
  const L=svLayer(K,"sv-l0","本週完成",ctx.done.length,svRange(ctx));
  if(!ctx.done.length){L.append(svEl("p","sv-empty","本週還沒有完成的事項"));await wait(2600);await svFade(K,L);return ctx}
  const track=svEl("div","sv-track");L.append(track);
  const cards=ctx.done.map(svCard);track.append(...cards);
  /* 由慢到快：一張接一張從右邊等速滑進來，每張花的時間和間隔越來越短 */
  let t=200;cards.forEach((c,i)=>{const dur=Math.max(380,1000-i*120);A(c,[{transform:`translateX(${W}px)`},{transform:"none"}],{duration:dur,delay:t,easing:"linear"});t+=Math.max(110,540-i*90)});
  await wait(t+Math.max(380,1000-(cards.length-1)*120));
  /* 排不下就接著跑馬燈（後面接一份複本，無縫循環） */
  ctx.layer=L;ctx.track=track;ctx.marquee=null;
  if(!K.RM&&track.scrollWidth>L.clientWidth+2){
    cards.forEach(c=>{const d=c.cloneNode(true);d.setAttribute("aria-hidden","true");track.append(d)});
    const shift=track.children[cards.length].offsetLeft-cards[0].offsetLeft;
    ctx.marquee=A(track,[{transform:"translateX(0)"},{transform:`translateX(${-shift}px)`}],{duration:shift/70*1000,iterations:Infinity,easing:"linear"});
    await wait(Math.min(8000,Math.max(5000,shift/70*1000)));
  }else await wait(3600);
  return ctx;
}

/* ---------- 2. 議題進度 ---------- */
async function chProgress(K,ctx){
  const {st,A,wait,fin,RM}=K;
  const L=svLayer(K,"sv-l1","議題進度",null,ctx.rows.length?"和上一份週報比較":"",ctx.layer?320:0);
  const list=svEl("div","sv-rows");L.append(list);
  if(!ctx.rows.length)list.append(svEl("p","sv-empty","目前沒有進行中的議題"));
  let rows=ctx.rows.map(r=>{
    const el=svEl("div","sv-row",`<span class="sv-rt">${esc(r.it.title)}</span><span class="sv-bar"><i style="width:${r.from}%"></i></span><span class="sv-pct" style="--n:${r.from}"></span><span class="sv-chips"></span>`);
    el._r=r;el.dataset.tone=progTone(r.from);list.append(el);return el});
  /* 有連到議題的完成卡片，在該議題底下留位置 */
  const chips=[];
  ctx.done.forEach(x=>{const row=rows.find(e=>e._r.it.id===x.iss);if(!row)return;
    const c=svEl("span","sv-chip",`<span class="sv-ck" aria-hidden="true"></span>${esc(x.k==="議題"?"本週完成":x.t)}`);c._key=x.key;row.querySelector(".sv-chips").append(c);chips.push(c)});
  rows=svFit(L,list,rows,n=>`還有 ${n} 個議題`);
  const live=chips.filter(c=>c.isConnected);
  live.forEach(c=>c.style.visibility="hidden");
  /* 先量好每張卡片要落腳的位置（進場動畫開始前，位置才準） */
  const slot=new Map(live.map(c=>[c,c.getBoundingClientRect()]));
  /* 進度條等速進場 */
  const enter=rows.map((e,i)=>A(e,[{opacity:0,transform:"translateX(-28px)"},{opacity:1,transform:"none"}],{duration:560,delay:(ctx.layer?420:120)+i*120,easing:"linear"}));
  const flights=[];
  if(ctx.layer&&!RM){
    ctx.marquee&&ctx.marquee.pause();
    const sr=st.getBoundingClientRect(),ox=sr.left+st.clientLeft,oy=sr.top+st.clientTop,vis=c=>{const r=c.getBoundingClientRect();return Math.max(0,Math.min(r.right,sr.right)-Math.max(r.left,sr.left))};
    const used=new Set();
    live.forEach((c,i)=>{
      const src=[...ctx.track.querySelectorAll(`[data-key="${c._key}"]`)].sort((a,b)=>vis(b)-vis(a))[0];if(!src)return;
      ctx.track.querySelectorAll(`[data-key="${c._key}"]`).forEach(s=>used.add(s));
      const a=src.getBoundingClientRect(),b=slot.get(c);
      const f=src.cloneNode(true);f.classList.add("sv-fly");f.style.cssText=`left:${a.left-ox}px;top:${a.top-oy}px;width:${a.width}px;height:${a.height}px`;st.append(f);
      ctx.track.querySelectorAll(`[data-key="${c._key}"]`).forEach(s=>s.style.opacity=0);
      /* 由亂到有序：先往四周散開、轉一點角度，再飛進議題底下的位置 */
      const rx=(Math.random()-.5)*140,ry=(Math.random()-.5)*90,rot=(Math.random()-.5)*22;
      const dx=b.left-a.left,dy=b.top-a.top,sx=b.width/a.width,sy=b.height/a.height;
      const fl=A(f,[{transform:"none",transformOrigin:"0 0"},{transform:`translate(${rx}px,${ry}px) rotate(${rot}deg) scale(.92)`,transformOrigin:"0 0",offset:.35},{transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`,transformOrigin:"0 0"}],{duration:1400,delay:180+i*80,easing:"cubic-bezier(.3,.7,.2,1)"});
      flights.push(fin(fl).then(()=>{c.style.visibility="";f.remove()}));
    });
    /* 沒關聯的卡片慢慢淡出 */
    [...ctx.track.children].filter(s=>!used.has(s)).forEach(s=>A(s,[{opacity:1},{opacity:0}],{duration:1200,easing:"ease-out"}));
    A(ctx.layer.firstChild,[{opacity:1},{opacity:0}],{duration:280,easing:"ease-in"});
  }
  await Promise.all([...enter.map(fin),...flights]);
  if(ctx.layer){ctx.layer.remove();ctx.layer=null}
  live.forEach((c,i)=>{if(c.style.visibility){c.style.visibility="";A(c,[{opacity:0,transform:"scale(.8)"},{opacity:1,transform:"none"}],{duration:380,delay:i*60,easing:"cubic-bezier(.3,1.5,.5,1)"})}});
  await wait(400);
  /* 依序把每個議題的進度從上一份週報跑到現在 */
  for(const e of rows){
    const r=e._r,bar=e.querySelector(".sv-bar"),pct=e.querySelector(".sv-pct");
    e.classList.add("on");
    if(r.from!==r.to){
      const d=Math.max(700,Math.abs(r.to-r.from)*26),ease="cubic-bezier(.45,0,.2,1)";
      A(pct,[{"--n":r.from},{"--n":r.to}],{duration:d,easing:ease});
      await fin(A(bar.firstChild,[{width:r.from+"%"},{width:r.to+"%"}],{duration:d,easing:ease}));
      e.dataset.tone=progTone(r.to);pct.style.setProperty("--n",r.to);
    }else await fin(A(pct,[{transform:"none"},{transform:"scale(1.18)"},{transform:"none"}],{duration:520,easing:"ease-in-out"}));
    await wait(220);e.classList.remove("on");
  }
  await wait(1500);
  /* 全部往下滑走；下一段趁勢接上 */
  const out=A(L,[{transform:"none",opacity:1},{transform:"translateY(80px)",opacity:0}],{duration:900,easing:"cubic-bezier(.5,0,.75,0)"});
  out.finished.then(()=>L.remove(),()=>{});
  await wait(380);
  return ctx;
}

/* ---------- 3. 本週新增的即時回報 ---------- */
async function chNew(K,ctx){
  const {A,wait}=K,W=K.st.clientWidth;
  const L=svLayer(K,"sv-l2","本週新增",ctx.fresh.length,"即時回報");
  const grid=svEl("div","sv-grid");L.append(grid);
  if(!ctx.fresh.length)grid.append(svEl("p","sv-empty","本週沒有新增的即時回報"));
  let cards=ctx.fresh.map(e=>svEl("div","sv-card sv-ev",`<span class="${e.doneAt?"ok-dot":"live-dot"}" aria-hidden="true"></span><b>${esc(e.name)}</b><small>${fmt(e.createdAt).slice(5)} 新增 · ${e.doneAt?"已完成":"處理中"}${parentOf(e)?` → ${esc(parentOf(e).title)}`:""}</small>${firstLine(e.desc)?`<p>${esc(firstLine(e.desc))}</p>`:""}`));
  grid.append(...cards);cards=svFit(L,grid,cards,n=>`還有 ${n} 則`);
  /* 左右兩邊輪流滑進來（兩欄時左欄從左、右欄從右） */
  const cols=getComputedStyle(grid).gridTemplateColumns.split(" ").length;
  cards.forEach((c,i)=>{const side=(cols>1?i%cols===0:i%2===0)?-1:1;A(c,[{transform:`translateX(${side*W*.7}px)`,opacity:0},{transform:"none",opacity:1}],{duration:780,delay:100+i*110,easing:"cubic-bezier(.2,.9,.25,1)"})});
  await wait(900+cards.length*110+5200);
  await svFade(K,L);
  return ctx;
}

/* ---------- 播放控制 ---------- */
function svDots(k){
  const box=$("#storyDots");if(!box)return;
  box.innerHTML=CHAPTERS.map(([t],i)=>`<button type="button" class="sdot-btn ${i===k?"cur":""} ${i<k?"seen":""}" data-story="${i}" aria-label="${t}"><span class="sdot-t">${t}</span><span class="sdot-bar"><i></i></span></button>`).join("");
}
async function storyRun(k){
  const tok=++story.tok,K=svKit(tok);if(!K.st||!CHAPTERS.length)return;
  K.st.getAnimations({subtree:true}).forEach(a=>a.cancel());K.st.innerHTML="";
  let ctx=svCtx();
  try{for(;;){story.i=k;svDots(k);ctx=await CHAPTERS[k][2](K,ctx);k=(k+1)%CHAPTERS.length;if(k===0)ctx=svCtx()}}
  catch(e){if(e!==STOP)console.error(e)}
}
function storyPlay(idx){
  story.running=true;story.paused=false;
  const st=$("#storyStage");if(!st)return;st.classList.remove("paused");$("#story").classList.remove("paused");
  storyRun(idx);
}
function storySync(){
  if(animOpen&&!story.running)storyPlay(0);
  if(!animOpen&&story.running){story.running=false;story.tok++;const st=$("#storyStage");if(st){st.getAnimations({subtree:true}).forEach(a=>a.cancel());st.innerHTML=""}}
}
function storyPause(p){
  if(!story.running||story.paused===p)return;story.paused=p;
  const box=$("#story");box.classList.toggle("paused",p);$("#storyStage").classList.toggle("paused",p);
  box.getAnimations({subtree:true}).forEach(a=>{if(p&&a.playState==="running")a.pause();else if(!p&&a.playState==="paused")a.play()});
}

/* ---------- 動畫模式視窗 ---------- */
document.addEventListener("visibilitychange",()=>{if(document.hidden)storyPause(true)});
function openAnim(){
  if(setOpen)closeSettings(true);
  animOpen=true;const ov=$("#animOv");ov.hidden=false;
  $("#animTitle").textContent=state.title;$("#animDate").textContent=fmt(state.boardDate||today());
  ov.classList.remove("closing");void ov.offsetWidth;ov.classList.add("show");
  story.running=false;setTimeout(()=>storySync(),120);
  renderTabbar();
}
function closeAnim(){
  if(!animOpen)return;animOpen=false;const ov=$("#animOv");ov.classList.remove("show");ov.classList.add("closing");
  storySync();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  setTimeout(()=>{if(!animOpen){ov.hidden=true;ov.classList.remove("closing")}},420);
  renderTabbar();
}
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&animOpen&&!$("#dlg").open)closeAnim()});
