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
  return {capture,play,enter,leave,swap,show,hide,lift,drop};
})();
