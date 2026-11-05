/* 核心｜展開收合與模式切換動畫 */
/* ---------- smooth mode switch (edit <-> view): morph instead of a hard cut ---------- */
function morph(fn){
  if(reduceMotion()){fn();return}
  const ease=EXPAND.easing,D=560;
  const arrow=document.querySelector(".eyebrow .arrow-line"),aw=arrow?arrow.getBoundingClientRect().width:0;
  const lay=document.querySelector(".layout"),ly=lay.getBoundingClientRect().top;
  const hr=document.querySelector(".hero-rule"),hh=hr.offsetHeight;
  const wasEdit=editing;
  fn();
  const arrow2=document.querySelector(".eyebrow .arrow-line");
  if(arrow2){const aw2=arrow2.getBoundingClientRect().width;if(Math.abs(aw-aw2)>1)arrow2.animate([{maxWidth:aw+"px",minWidth:aw+"px"},{maxWidth:aw2+"px",minWidth:aw2+"px"}],{duration:D,easing:ease})}
  const hh2=hr.offsetHeight;if(Math.abs(hh-hh2)>1){hr.style.overflow="hidden";hr.animate([{height:hh+"px"},{height:hh2+"px"}],{duration:D,easing:ease}).onfinish=()=>{hr.style.overflow=""}}
  const dy=ly-lay.getBoundingClientRect().top;
  if(Math.abs(dy)>1)lay.animate([{transform:`translateY(${dy}px)`},{transform:"none"}],{duration:D,easing:ease});
  const cls=editing&&!wasEdit?"edit-anim":(!editing&&wasEdit?"view-anim":"");
  if(cls){document.body.classList.remove("edit-anim","view-anim");void document.body.offsetWidth;document.body.classList.add(cls);clearTimeout(morph._t);morph._t=setTimeout(()=>document.body.classList.remove(cls),1200)}
}
/* ---------- expand / collapse motion (app-launch style) ---------- */
const EXPAND={duration:560,easing:"cubic-bezier(.2,.9,.25,1)"};
const reduceMotion=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
function detailsBody(d){
  let kids=[...d.children].filter(k=>k.tagName!=="SUMMARY");
  if(kids.length===1&&kids[0].classList.contains("dwrap"))return kids[0];
  const w=document.createElement("div");w.className="dwrap";kids.forEach(k=>w.append(k));d.append(w);return w;
}
/* 有展開收合動畫進行時在 <html> 加 .motion-busy：頁面上其他一直在跑的小動畫（燈號擴散）先暫停，動畫才順 */
let _busy=0;
function motionBusy(n){_busy=Math.max(0,_busy+n);document.documentElement.classList.toggle("motion-busy",_busy>0)}
function animateDetails(d,open){
  (d._anims||[]).forEach(a=>a.cancel());d._anims=[];
  if(reduceMotion()){d.open=open;return}
  const rad=(r,h)=>Math.min(parseFloat(r)||0,h/2)+"px";
  const h0=d.offsetHeight,r0=rad(getComputedStyle(d).borderRadius,h0);
  if(open){d.open=true}
  const w=detailsBody(d);
  const full=w.scrollHeight;
  const cur=open?0:w.getBoundingClientRect().height;
  d.open=open;const h1=open?d.offsetHeight:h0-cur;const r1=rad(getComputedStyle(d).borderRadius,h1);
  d.open=true;
  d.classList.toggle("closing",!open);
  if(open){d.classList.add("opening");clearTimeout(d._ot);d._ot=setTimeout(()=>d.classList.remove("opening"),1400)}
  /* 手機焦點：即時回報展開那一下像被拿起來——放大一點、歪一點，再落回平的（不會一直歪，展開後文字照常好讀） */
  if(open&&d.matches(".ev")&&isPhone())d.animate([{scale:1,rotate:"0deg"},{scale:1.035,rotate:"-1.6deg",offset:.3},{scale:1,rotate:"0deg"}],{duration:640,easing:"cubic-bezier(.3,.7,.3,1)"});
  w.style.overflow="hidden";
  const wa=w.animate(open?[{height:"0px",opacity:0},{height:full+"px",opacity:1}]:[{height:cur+"px",opacity:1},{height:"0px",opacity:0}],{...EXPAND,duration:open?EXPAND.duration:380});
  const anims=[wa];
  if(r0!==r1)anims.push(d.animate([{borderRadius:r0},{borderRadius:r1}],{...EXPAND,duration:open?EXPAND.duration:380}));
  d._anims=anims;d.classList.add("animating");motionBusy(1);
  wa.onfinish=()=>{w.style.overflow="";d._anims=[];d.classList.remove("animating","closing");if(!open)d.open=false;motionBusy(-1)};
  wa.oncancel=()=>{w.style.overflow="";d.classList.remove("animating","closing");motionBusy(-1)};
}
document.addEventListener("click",e=>{
  const sm=e.target.closest("summary");if(!sm)return;
  const d=sm.parentElement;if(!d||!d.matches(".ev,.week,.log"))return;
  if(e.target.closest("input,button,a")){if(e.target.closest("summary button,summary input"))e.preventDefault();return}
  e.preventDefault();
  /* 桌面、區塊被選到時：點即時回報或完成紀錄的一筆＝在右側打開，再點一次＝收起（不就地展開）。
     例外：在別的區塊被選到時就地展開過、切過來還開著的那一筆，點了先就地收起（不然會收不起來、直接跳去分欄） */
  if(!d.open&&d.matches(".ev:not([data-done])")&&mdOn("live")){mdSelect("live",d.dataset.ev);return}
  if(!d.open&&d.matches("[data-done]")&&mdOn("done")){mdSelect("done",d.dataset.issue||d.dataset.ev);return}
  animateDetails(d,!d.open);
},true);

/* open link buttons robustly: new tab first, fall back to same tab when a viewer blocks pop-ups */
document.addEventListener("click",e=>{
  const a=e.target.closest("a.link[href]");if(!a||a.closest(".sec-edit"))return;
  const url=a.getAttribute("href");if(!url||url==="#")return;
  e.preventDefault();e.stopPropagation();
  let w=null;try{w=window.open(url,"_blank")}catch(_){}
  if(w){try{w.opener=null}catch(_){}}
  else{try{window.top.location.href=url}catch(_){location.href=url}}
},true);

document.addEventListener("click",e=>{
  if(secEd("progress"))return;const m=e.target.closest(".marker.quiet");if(!m)return;
  const tr=m.closest(".c-track");m.classList.add("peek");tr&&tr.classList.add("peeking");clearTimeout(m._pk);m._pk=setTimeout(()=>{m.classList.remove("peek");tr&&tr.classList.remove("peeking")},2200);
});
document.addEventListener("mouseover",e=>{const m=e.target.closest(".marker.quiet,.g-mk.quiet");const tr=m&&m.closest(".c-track,.g-track");document.querySelectorAll(".peeking").forEach(x=>{if(x!==tr)x.classList.remove("peeking")});if(tr)tr.classList.add("peeking")});

/* ---------- 左右兩欄的開合（即時回報、完成紀錄） ----------
   被點的那一項「飛」到右半邊變成詳情卡，原位留虛線空位（CSS 的 .sel）；收起時詳情卡縮小彈回空位，那一項再出現。
   三種動作都走 mdSelect：
   - 打開（沒選→選）：清單 FLIP 縮到左半邊，詳情卡從被點那一項原本的位置彈出放大（mdPop "out"）
   - 換選（選 A→選 B）：A 的詳情卡先縮回 A 的空位（mdPop "in"），A 出現；再從 B 彈出
   - 收起（選→沒選）：詳情卡縮回空位，那一項出現，清單 FLIP 展開回全寬
   只動 transform／clip-path（不縮放內容，字不變形）；動作進行中 mdBusy 擋住重複點擊 */
const MD={live:{list:"#events",item:".ev",key:el=>el.dataset.ev,pane:"#evDetail",get:()=>selEv,set:v=>{selEv=v},render:()=>renderEvents()},
  done:{list:"#doneList",item:"[data-done]",key:el=>el.dataset.done,pane:"#doneDetail",get:()=>selDone,set:v=>{selDone=v},render:()=>renderDone()}};
const MD_POP={out:{duration:560,easing:"cubic-bezier(.3,1.3,.5,1)"},in:{duration:300,easing:"cubic-bezier(.5,0,.3,1)"}};
let mdBusy=false;
const mdItem=(m,id)=>id&&[...document.querySelectorAll(`${m.list} ${m.item}`)].find(el=>m.key(el)===id);
const mdBox=el=>el&&{rect:el.getBoundingClientRect(),r:parseFloat(getComputedStyle(el).borderRadius)||0};
async function mdSelect(k,id){
  if(mdBusy)return;
  const m=MD[k],cur=m.get(),next=cur===id?null:id,pane=$(m.pane);
  const set=v=>{m.set(v);m.render();layoutAll()};
  if(reduceMotion()){set(next);if(next)mdPaneIn(pane);return}
  mdBusy=true;
  try{
    /* 1. 原本開著的先彈回自己的空位 */
    if(cur&&pane&&!pane.hidden){const home=mdBox(mdItem(m,cur));if(home)await mdPop(pane,home,"in")}
    /* 2. 切換：打開／收起要換版面（FLIP），換選只換內容 */
    const from=next&&!cur?mdBox(mdItem(m,next)):null;           /* 打開：從清單換版面之前的位置彈出 */
    if(!!cur!==!!next)mdFlip(m,()=>set(next));else set(next);
    pane&&pane.getAnimations().forEach(x=>x.cancel());
    if(cur)mdLand(mdItem(m,cur));
    /* 3. 新選的彈出去 */
    if(next&&pane)mdPop(pane,from||mdBox(mdItem(m,next)),"out");
  }finally{mdBusy=false}
}
/* 詳情卡在「清單那一項的位置與大小」和「自己的位置」之間變形：位移＋clip-path 圓角裁切 */
function mdPop(pane,home,dir){
  if(!home)return Promise.resolve();
  const a=home.rect,b=pane.getBoundingClientRect(),R=parseFloat(getComputedStyle(pane).borderRadius)||0;
  const w=Math.min(a.width,b.width),h=Math.min(a.height,b.height);
  const small={transform:`translate(${a.left-b.left}px,${a.top-b.top}px)`,clipPath:`inset(0px ${b.width-w}px ${b.height-h}px 0px round ${Math.min(home.r,h/2)}px)`};
  const big={transform:"none",clipPath:`inset(0px 0px 0px 0px round ${R}px)`};
  const kids=[...pane.children],o=MD_POP[dir];
  if(dir==="out"){kids.forEach(c=>c.animate([{opacity:0},{opacity:0,offset:.3},{opacity:1}],{duration:o.duration,easing:"ease-out"}));return pane.animate([small,big],o).finished.catch(()=>{})}
  kids.forEach(c=>c.animate([{opacity:1},{opacity:0}],{duration:120,fill:"forwards"}));
  return pane.animate([big,small],{...o,fill:"forwards"}).finished.catch(()=>{});
}
/* 那一項回到清單：輕輕彈一下，像剛落回原位 */
function mdLand(el){if(el)el.animate([{scale:1.05},{scale:1}],{duration:320,easing:"cubic-bezier(.3,1.5,.5,1)"})}
function mdFlip(m,mutate){
  if(reduceMotion())return mutate();
  const first=new Map([...document.querySelectorAll(`${m.list} ${m.item}`)].map(el=>[m.key(el),el.getBoundingClientRect()]));
  mutate();
  document.querySelectorAll(`${m.list} ${m.item}`).forEach((el,i)=>{
    const a=first.get(m.key(el));if(!a)return;const b=el.getBoundingClientRect(),dx=a.left-b.left,dy=a.top-b.top;
    if(Math.abs(dx)<1&&Math.abs(dy)<1&&Math.abs(a.width-b.width)<1)return;
    el.animate([{transform:`translate(${dx}px,${dy}px)`,width:a.width+"px"},{transform:"none",width:b.width+"px"}],{duration:460,delay:Math.min(i,8)*14,easing:"cubic-bezier(.2,.9,.25,1)",fill:"backwards"});
  });
}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-mdclose]");if(b){e.preventDefault();const k=b.dataset.mdclose;mdSelect(k,MD[k].get())}});
/* 上一個／下一個：照清單畫面上的順序換選（現在這張縮回空位、下一張彈出）；鍵盤左右鍵同功能（游標在輸入框裡時不搶） */
function mdStep(k,dir){const m=MD[k],ids=[...document.querySelectorAll(`${m.list} ${m.item}`)].map(m.key),to=ids[ids.indexOf(m.get())+dir];if(to)mdSelect(k,to)}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-mdstep]");if(b&&!b.disabled){e.preventDefault();mdStep(b.dataset.mdstep,+b.dataset.dir)}});
document.addEventListener("keydown",e=>{
  if((e.key!=="ArrowLeft"&&e.key!=="ArrowRight")||e.altKey||e.ctrlKey||e.metaKey||setOpen||$("#dlg").open)return;
  const a=document.activeElement;if(a&&(a.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)))return;
  const k=selEv&&mdOn("live")?"live":selDone&&mdOn("done")?"done":null;if(!k)return;
  e.preventDefault();mdStep(k,e.key==="ArrowRight"?1:-1);
});

/* ---------- 版面長度過渡（全介面共用） ----------
   區塊（.panel）、設定頁的群組與右側面板，內容一變高或變矮，就從原本的高度滑到新的高度，下面的東西跟著滑，不會「卡一下整個往下」。
   用 ResizeObserver 看高度（在畫面畫出來之前就收到），所以各處的程式不用自己呼叫。
   不做的情況：裡面的膠囊／清單正在跑自己的展開收合（motionBusy）、第一次出現、從隱藏變顯示（高度 0）、寬度也一起變（換區塊放大、視窗縮放，交給原本的 FLIP）、減少動態、動畫模式。
   動畫進行中自己造成的尺寸變化不理；動畫結束後如果內容又變了，ResizeObserver 會再收到一次，從目前高度接著滑 */
const FLOW_SEL=".panel,#setOv .set-list,#setOv .set-pane";
const flowLast=new WeakMap();
const flowRO=typeof ResizeObserver==="function"?new ResizeObserver(es=>{
  for(const e of es){
    const el=e.target;if(el._flow)continue;
    const bs=e.borderBoxSize&&e.borderBoxSize[0],w=bs?bs.inlineSize:el.offsetWidth,h=bs?bs.blockSize:el.offsetHeight,last=flowLast.get(el);
    flowLast.set(el,{w,h});
    if(!last||!last.h||!h||Math.abs(last.w-w)>1||Math.abs(last.h-h)<3||_busy||reduceMotion()||document.hidden||document.body.matches(".intro"))continue;   /* _busy：膠囊自己在展開收合，區塊本來就跟著平滑變高 */
    el.style.overflow="clip";
    const a=el.animate([{height:last.h+"px"},{height:h+"px"}],{duration:Math.min(560,260+Math.abs(h-last.h)*.35),easing:"cubic-bezier(.2,.9,.25,1)"});
    el._flow=a;
    const done=()=>{if(el._flow!==a)return;el._flow=null;el.style.overflow="";flowLast.set(el,{w:el.offsetWidth,h:el.offsetHeight})};
    a.onfinish=done;a.oncancel=done;
  }
}):null;
function flowWatch(){if(flowRO)document.querySelectorAll(FLOW_SEL).forEach(el=>flowRO.observe(el))}
