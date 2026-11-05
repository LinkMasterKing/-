/* 核心｜動畫規則（全介面共用，2026-11-05）
   ---------------------------------------------------------------------------
   目的：任何區域（新的、舊的）只要「標記」就自動有基礎過渡，不用各自寫動畫。三條規則：

   1. 長度（高度變化）：符合 FLOW_SEL 或加了 data-flow 的容器，內容變高變矮時從舊高度滑到新高度
      （motion.js 的 flowWatch，ResizeObserver；每次 render 後自動重新掛上）。
   2. 位置／順序／進出（FLIP）：加了 data-flip 的容器，裡面的項目在每次 render() 前後比對位置：
      - 位置變了（排序、移到另一區、上下兩區互換）→ 從舊位置滑到新位置；
      - 新出現 → 由下往上淡入（rise）；
      - 消失 → 在原位留一個分身淡出縮小（leave），不會瞬間不見。
      項目的 key 看 data-ev／data-done／data-issue／data-fw／data-week／data-set／data-fk（第一個有的）。
   3. 上下層：移動中的項目暫時提高 z-index（移動距離越大越上面），結束後還原；
      疊層頁（設定、通知、每週概述）一律「進場由下往上淡入、退場淡出」或「從右滑入」，用 Anim.enter／Anim.leave。

   時間與曲線一律用 MO（CSS 同名變數 --mo-*，board.css 開頭）：
     fast 160ms（退場、小東西）｜base 280ms（淡入、換內容）｜slow 460ms（位置移動）｜layout 560ms（區塊放大、展開）
     out＝減速（進場、移動）｜in＝加速（退場）｜spring＝略帶回彈（彈出、放下）
   分段切換：用 LiquidSeg（本檔最後），跟底部工具列同一套鏡片物理與外觀。
   減少動態（prefers-reduced-motion）時全部直接跳到結果。
   不做的情況：膠囊正在展開收合（motion-busy）、左右兩欄正在開合（mdBusy）、拖曳排序中、分頁在背景、開頁進場中。 */
const MO={fast:160,base:280,slow:460,layout:560,out:"cubic-bezier(.2,.9,.25,1)",in:"cubic-bezier(.4,0,1,1)",spring:"cubic-bezier(.3,1.3,.5,1)"};
const Anim=(()=>{
  const reduced=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
  const KEY_ATTRS=["ev","done","issue","fw","week","set","fk"];
  const ITEM_SEL=KEY_ATTRS.map(a=>`[data-${a}]`).join(",");
  const keyOf=el=>{for(const a of KEY_ATTRS){const v=el.dataset[a];if(v!=null&&v!=="")return a+":"+v}return null};
  const off=()=>reduced()||document.hidden||document.documentElement.matches(".motion-busy,.ev-drag-on")||(typeof mdBusy!=="undefined"&&mdBusy)||document.body.matches(".intro");
  /* 容器裡「最外層」的項目（項目裡面再包項目的不算，例如完成紀錄膠囊同時有 data-done 與 data-ev） */
  function items(box){return [...box.querySelectorAll(ITEM_SEL)].filter(el=>{const p=el.parentElement&&el.parentElement.closest(ITEM_SEL);return !p||!box.contains(p)})}
  /* render 前：記下每個 data-flip 容器裡項目的位置 */
  function capture(){
    if(off())return null;
    const snap=[];
    document.querySelectorAll("[data-flip]").forEach(box=>{
      if(!box.offsetParent&&box!==document.body)return;
      const m=new Map();items(box).forEach(el=>{const k=keyOf(el);if(!k||m.has(k))return;const r=el.getBoundingClientRect();if(r.width&&r.height)m.set(k,{r,el})});
      snap.push({box,id:box.dataset.flip||box.id,m});
    });
    return snap;
  }
  /* render 後：位置變了的滑過去、新的淡入、不見的留分身淡出 */
  function play(snap){
    if(!snap||off())return;
    snap.forEach(({box,m})=>{
      if(!box.isConnected||!box.offsetParent)return;
      const now=items(box),seen=new Set();let n=0;
      now.forEach(el=>{
        const k=keyOf(el);if(!k)return;seen.add(k);
        if(el.getAnimations().some(a=>a.playState==="running"))return;   /* 已經有自己的動畫（例如 mdFlip、.new）就不疊 */
        const a=m.get(k),b=el.getBoundingClientRect();if(!b.width)return;
        if(!a){if(m.size&&n<24)enter(el,"rise",{delay:Math.min(n++,8)*24});return}
        const dx=a.r.left-b.left,dy=a.r.top-b.top;if(Math.abs(dx)<1&&Math.abs(dy)<1)return;
        lift(el,Math.round(Math.hypot(dx,dy)));
        el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:"none"}],{duration:MO.slow,easing:MO.out}).finished.catch(()=>{}).then(()=>drop(el));
      });
      m.forEach((v,k)=>{if(!seen.has(k))ghost(v.r,v.el)});
    });
  }
  /* 上下層：移動中的項目暫時浮到上面（移動越遠越上面） */
  function lift(el,z){el.style.zIndex=String(2+Math.min(6,Math.round(z/80)));   /* 最多 8：只在同一區裡排上下，不會蓋過疊層頁（設定 38、通知 37） */el.style.position=getComputedStyle(el).position==="static"?"relative":el.style.position}
  function drop(el){el.style.zIndex="";if(el.style.position==="relative")el.style.position=""}
  /* 消失的項目：在原位放一個分身淡出縮小（分身不能點、沒有 id） */
  function ghost(r,src){
    const g=src.cloneNode(true);g.removeAttribute("id");g.querySelectorAll("[id]").forEach(x=>x.removeAttribute("id"));
    Object.assign(g.style,{position:"fixed",left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px",margin:"0",pointerEvents:"none",zIndex:"40"});
    g.setAttribute("aria-hidden","true");g.inert=true;document.body.append(g);
    g.animate([{opacity:1,transform:"none"},{opacity:0,transform:"scale(.94)"}],{duration:MO.base,easing:MO.in,fill:"forwards"}).finished.catch(()=>{}).then(()=>g.remove());
  }
  /* 進場：rise（由下往上淡入）／fade／pop（略帶回彈放大）／right（從右滑入） */
  const IN={rise:[{opacity:0,transform:"translateY(10px)"},{opacity:1,transform:"none"}],fade:[{opacity:0},{opacity:1}],
    pop:[{opacity:0,transform:"scale(.92)"},{opacity:1,transform:"none"}],right:[{opacity:0,transform:"translateX(24px)"},{opacity:1,transform:"none"}],
    down:[{opacity:0,transform:"translateY(-8px)"},{opacity:1,transform:"none"}]};
  function enter(el,kind="rise",o={}){
    if(!el||reduced())return Promise.resolve();
    return el.animate(IN[kind]||IN.rise,{duration:o.duration||(kind==="pop"?MO.slow:MO.base),delay:o.delay||0,easing:kind==="pop"?MO.spring:MO.out,fill:"backwards"}).finished.catch(()=>{});
  }
  /* 退場：反向播放，動畫結束才 resolve（呼叫的人接著藏起來或移除） */
  function leave(el,kind="fade",o={}){
    if(!el||reduced())return Promise.resolve();
    const k=[...(IN[kind]||IN.fade)].reverse();
    return el.animate(k,{duration:o.duration||MO.fast,easing:MO.in,fill:"forwards"}).finished.catch(()=>{});
  }
  /* 換內容：舊的淡出 → 換 → 新的淡入（同一個位置換掉內容時用） */
  async function swap(el,mutate,kind="rise"){
    if(!el||reduced()){mutate();return}
    await leave(el,"fade",{duration:120});mutate();el.getAnimations().forEach(a=>a.cancel());await enter(el,kind);
  }
  /* 顯示／隱藏（hidden 屬性）也有過渡 */
  async function show(el,kind="rise"){if(!el)return;el.hidden=false;return enter(el,kind)}
  async function hide(el,kind="fade"){if(!el||el.hidden)return;await leave(el,kind);el.hidden=true;el.getAnimations().forEach(a=>a.cancel())}
  /* 燈號擴散（CSS 動畫 ping）：重畫後新的燈號會從頭播，跟原本的節奏對不上、看起來像跳一下。
     把每個 ping 動畫的起點都對齊到頁面時間軸 0，重畫前後相位一樣，所有燈號也同步 */
  function syncPings(){if(reduced())return;try{document.getAnimations().forEach(x=>{if(x.animationName==="ping"&&x.startTime!==0&&x.playState==="running")x.startTime=0})}catch(_){}}
  return {capture,play,enter,leave,swap,show,hide,lift,drop,syncPings};
})();

/* ---------- 液態分段切換 LiquidSeg（2026-11-05） ----------
   跟底部工具列（nav.js）同一套：毛玻璃底（.glass）、實心鏡片、鏡片底下那一格反白（.lit，跟著鏡片走不是跟著選取）。
   物理參數照工具列（Convx）：按下鏡片放大 78/56（主軸 .6／250、側軸 .7／250）、移動時依速度沿主軸拉伸、
   整列按下時放大、拖曳時整列跟著偏最多 4px、白光（--hp／--hx）；只有按在鏡片那一格才能拖，放開吸到最近的一格；
   點別格＝按下 → 移過去 → 接近目標或 400ms 後放開。
   用法：new LiquidSeg(box,{onPick:k=>…})；box 裡放 <span class="lseg-lens"> 和一排 button[data-k]（role="tab"）；
   程式改選取用 seg.set(k)（instant＝不播動畫）。只有橫向（要直向時照 nav.js 的 isRail 加）。spring／sprStep 在 nav.js。 */
class LiquidSeg{
  constructor(box,{onPick}={}){
    this.box=box;this.onPick=onPick;this.lensEl=box.querySelector(".lseg-lens");
    this.s={val:spring(0,1,1000),press:spring(0,1,1000),sx:spring(1,.6,250),sy:spring(1,.7,250),vel:spring(0,.5,300),off:spring(0,1,300),hl:spring(0,.5,300)};
    this.drag=null;this.raf=0;this.last=0;this.releasing=false;this.releaseAt=0;this.cur=0;this.suppress=false;
    glassify(box);this.bind();
    const on=this.btns().findIndex(b=>b.getAttribute("aria-selected")==="true");this.set(on<0?0:on,true);
    addEventListener("resize",()=>this.set(this.cur,true));document.fonts?.ready.then(()=>this.set(this.cur,true));
  }
  btns(){return [...this.box.querySelectorAll("[data-k]")]}
  geo(){const bs=this.btns();return bs.map(b=>({x:b.offsetLeft+b.offsetWidth/2,w:b.offsetWidth,k:b.dataset.k}))}
  set(i,instant){
    if(typeof i==="string")i=this.btns().findIndex(b=>b.dataset.k===i);if(i<0)return;this.cur=i;
    this.btns().forEach((b,j)=>b.setAttribute("aria-selected",j===i));
    if(instant||matchMedia("(prefers-reduced-motion: reduce)").matches||!this.box.offsetWidth){Object.values(this.s).forEach(x=>sprSnap(x,x===this.s.val?i:(x===this.s.sx||x===this.s.sy?1:0)));this.frame();return}
    if(this.s.val.t!==i&&!this.drag){this.s.val.t=i;this.pressOn();this.release()}   /* 點別格：按下 → 移過去 → 放開 */
    this.kick();
  }
  pressOn(){if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;const s=this.s;s.press.t=1;s.sx.t=78/56;s.sy.t=78/56;this.releasing=false}
  release(){this.releasing=true;this.releaseAt=performance.now()}
  frame(){
    const g=this.geo();if(!g.length||!this.box.offsetWidth)return;const s=this.s,l=this.lensEl,n=g.length;
    const it=(key)=>{const v=s.val.x,a=Math.max(0,Math.min(n-1,Math.floor(v))),b=Math.min(n-1,a+1),f=v-a;return g[a][key]+(g[b][key]-g[a][key])*f};
    const pos=it("x"),w=it("w"),v=s.vel.x/10,c=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
    /* 按下的放大改成固定像素（寬 +8、高 +6），鏡片一定留在玻璃框裡；這排常貼著內容邊緣，用工具列的比例會被捲動區切掉 */
    const lh=l.offsetHeight||1,P=(s.sx.x-1)/(78/56-1),Q=(s.sy.x-1)/(78/56-1);
    const ma=(w+8*P)/w/(1-c(v*.75,-.2,.2)),cr=(lh+6*Q)/lh*(1-c(v*.25,-.2,.2));
    /* 放大、拉長之後的鏡片一定留在玻璃框裡（左右至少留 2px）：超出就整顆往內推（縮放是以鏡片中心為準） */
    const bw=this.box.offsetWidth||1,W2=w*ma,x0=c(pos-W2/2,2,Math.max(2,bw-2-W2));
    l.style.width=w.toFixed(1)+"px";l.style.transform=`translateX(${(x0+W2/2-w/2).toFixed(2)}px) scale(${ma.toFixed(4)},${cr.toFixed(4)})`;
    const lit=Math.round(c(s.val.x,0,n-1));this.btns().forEach((b,j)=>b.classList.toggle("lit",j===lit));
    const len=this.box.offsetWidth||1,fr=c(s.off.x/len,-1,1),ease=1-Math.pow(1-Math.abs(fr),2),po=4*Math.sign(fr)*ease,p=s.press.x;
    this.box.style.transform=po?`translateX(${po.toFixed(2)}px)`:"";this.box.style.scale=p>.0005?(1+12/len*p).toFixed(4):"";
    this.box.style.setProperty("--ts",(1+.12*p).toFixed(4));this.box.style.setProperty("--hp",s.hl.x.toFixed(4));this.box.style.setProperty("--hx",(pos+po).toFixed(1)+"px");
  }
  loop(now){
    const s=this.s,all=Object.values(s),dt=Math.min(1/30,Math.max(1/240,(now-(this.last||now))/1000||1/60));this.last=now;
    if(!this.drag)all.forEach(x=>sprStep(x,dt));else{[s.press,s.sx,s.sy,s.hl].forEach(x=>sprStep(x,dt));if(now-this.drag.t>80)sprSnap(s.vel,0)}
    if(this.releasing){const n=Math.max(1,this.btns().length-1);if(Math.abs(s.val.x-s.val.t)<n*.025||now-this.releaseAt>400){this.releasing=false;s.vel.t=0;s.press.t=0;s.sx.t=1;s.sy.t=1}}
    this.frame();
    if(this.drag||this.releasing||!all.every(x=>sprDone(x,.0008))){this.raf=requestAnimationFrame(t=>this.loop(t));return}
    all.forEach(x=>sprSnap(x,x.t));this.frame();this.raf=0;this.last=0;
  }
  kick(){if(!this.raf){this.last=0;this.raf=requestAnimationFrame(t=>this.loop(t))}}
  bind(){
    const box=this.box,s=this.s;let lastX=0,lastT=0,lastV=0;
    box.addEventListener("click",e=>{if(this.suppress){e.stopPropagation();e.preventDefault();return}
      const b=e.target.closest("[data-k]");if(!b)return;const i=this.btns().indexOf(b);if(i===this.cur)return;this.set(i);this.onPick&&this.onPick(b.dataset.k)},true);
    box.addEventListener("pointerdown",e=>{
      if(e.button>0||this.drag||!e.target.closest("[data-k]"))return;
      const g=this.geo(),r=box.getBoundingClientRect(),slot=g.length>1?Math.abs(g[1].x-g[0].x):box.offsetWidth;
      const n=g.length,v=s.val.x,a=Math.max(0,Math.min(n-1,Math.floor(v))),b=Math.min(n-1,a+1),lp=g[a].x+(g[b].x-g[a].x)*(v-a);
      if(Math.abs(e.clientX-r.left-lp)>slot/2)return;   /* 只有按在鏡片那一格才能拖 */
      this.drag={id:e.pointerId,x:e.clientX,moved:false,slot,n,t:performance.now()};lastX=e.clientX;lastT=performance.now();lastV=s.val.x;
      try{box.setPointerCapture(e.pointerId)}catch(_){}
      this.pressOn();s.hl.t=matchMedia("(prefers-reduced-motion: reduce)").matches?0:1;this.kick();
    });
    box.addEventListener("pointermove",e=>{
      const d=this.drag;if(!d||e.pointerId!==d.id)return;if(e.pointerType==="mouse"&&e.buttons===0){end();return}
      const dx=e.clientX-d.x;d.x=e.clientX;if(!dx)return;if(Math.abs(e.clientX-lastX)>2||d.moved)d.moved=true;
      sprSnap(s.val,Math.max(0,Math.min(d.n-1,s.val.x+dx/d.slot)));sprSnap(s.off,s.off.x+dx);
      const now=performance.now(),dt=Math.max(8,now-lastT)/1000;sprSnap(s.vel,(s.val.x-lastV)/dt/Math.max(1,d.n-1));lastV=s.val.x;lastT=now;d.t=now;lastX=e.clientX;this.kick();
    });
    const end=()=>{const d=this.drag;if(!d)return;this.drag=null;
      if(d.moved){this.suppress=true;setTimeout(()=>this.suppress=false,80)}
      const i=Math.round(Math.max(0,Math.min(d.n-1,s.val.x)));s.vel.t=s.vel.x;s.off.t=0;s.hl.t=0;s.val.t=i;this.release();this.kick();
      if(i!==this.cur){this.cur=i;this.btns().forEach((b,j)=>b.setAttribute("aria-selected",j===i));this.onPick&&this.onPick(this.btns()[i].dataset.k)}};
    box.addEventListener("pointerup",end);box.addEventListener("pointercancel",end);box.addEventListener("lostpointercapture",e=>{if(e.target===box)end()});
  }
}
