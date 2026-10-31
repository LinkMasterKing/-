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
  w.style.overflow="hidden";
  const wa=w.animate(open?[{height:"0px",opacity:0},{height:full+"px",opacity:1}]:[{height:cur+"px",opacity:1},{height:"0px",opacity:0}],{...EXPAND,duration:open?EXPAND.duration:380});
  const anims=[wa];
  if(r0!==r1)anims.push(d.animate([{borderRadius:r0},{borderRadius:r1}],{...EXPAND,duration:open?EXPAND.duration:380}));
  d._anims=anims;d.classList.add("animating");
  wa.onfinish=()=>{w.style.overflow="";d._anims=[];d.classList.remove("animating","closing");if(!open)d.open=false};
  wa.oncancel=()=>{w.style.overflow="";d.classList.remove("animating","closing")};
}
document.addEventListener("click",e=>{
  const sm=e.target.closest("summary");if(!sm)return;
  const d=sm.parentElement;if(!d||!d.matches(".ev,.done-item,.week,.log"))return;
  if(e.target.closest("input,button,a")){if(e.target.closest("summary button,summary input"))e.preventDefault();return}
  e.preventDefault();animateDetails(d,!d.open);
},true);
let flipBusy=false;
function flipCards(mutate){
  if(flipBusy)return;
  const snap=new Set(openIds);mutate();const next=new Set(openIds);openIds=snap;
  const closing=[...snap].filter(id=>!next.has(id)).map(id=>document.getElementById("card-"+id)).filter(Boolean);
  const finish=()=>{
    const before=new Map([...document.querySelectorAll(".card")].map(c=>[c.id,c.offsetHeight]));
    const wasOpen=new Set(openIds);
    openIds=next;render();
    document.querySelectorAll(".card.open").forEach(c=>{if(!wasOpen.has(c.dataset.issue)){c.classList.add("opening");setTimeout(()=>c.classList.remove("opening"),1600)}});
    if(reduceMotion())return;
    document.querySelectorAll(".card").forEach(c=>{
      const h0=before.get(c.id),h1=c.offsetHeight;if(h0==null||Math.abs(h0-h1)<2)return;
      c.style.overflow="hidden";
      c.animate([{height:h0+"px"},{height:h1+"px"}],EXPAND).onfinish=()=>{c.style.overflow=""};
    });
  };
  if(!closing.length||reduceMotion()){finish();return}
  /* collapse animation: content fades up while the frame shrinks to its folded height, then re-render */
  flipBusy=true;const DUR=360;
  closing.forEach(c=>{
    const cs=getComputedStyle(c),top=c.querySelector(".card-top");
    const target=top.offsetHeight+8+16+parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom)+parseFloat(cs.borderTopWidth)+parseFloat(cs.borderBottomWidth);
    c.style.overflow="hidden";
    [...c.children].filter(k=>k!==top).forEach((k,n)=>k.animate([{opacity:1,transform:"none"},{opacity:0,transform:"translateY(-8px)"}],{duration:220,delay:Math.max(0,(c.children.length-2-n))*25,easing:"ease-in",fill:"forwards"}));
    c.animate([{height:c.offsetHeight+"px"},{height:target+"px"}],{duration:DUR,easing:"cubic-bezier(.4,0,.2,1)",fill:"forwards"});
    const chev=c.querySelector(".chev");chev&&chev.animate([{transform:"rotate(180deg)"},{transform:"rotate(0deg)"}],{duration:DUR,fill:"forwards"});
  });
  setTimeout(()=>{flipBusy=false;finish()},DUR);
}

/* open link buttons robustly: new tab first, fall back to same tab when a viewer blocks pop-ups */
document.addEventListener("click",e=>{
  const a=e.target.closest("a.link[href]");if(!a||editing)return;
  const url=a.getAttribute("href");if(!url||url==="#")return;
  e.preventDefault();e.stopPropagation();
  let w=null;try{w=window.open(url,"_blank")}catch(_){}
  if(w){try{w.opener=null}catch(_){}}
  else{try{window.top.location.href=url}catch(_){location.href=url}}
},true);

document.addEventListener("click",e=>{
  if(editing)return;const m=e.target.closest(".marker.quiet");if(!m)return;
  const tr=m.closest(".c-track");m.classList.add("peek");tr&&tr.classList.add("peeking");clearTimeout(m._pk);m._pk=setTimeout(()=>{m.classList.remove("peek");tr&&tr.classList.remove("peeking")},2200);
});
document.addEventListener("mouseover",e=>{const m=e.target.closest(".marker.quiet,.g-mk.quiet");const tr=m&&m.closest(".c-track,.g-track");document.querySelectorAll(".peeking").forEach(x=>{if(x!==tr)x.classList.remove("peeking")});if(tr)tr.classList.add("peeking")});
