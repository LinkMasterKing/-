/* 核心｜換頁動畫（2026-11-05 使用者指定，取代原本的預測返回動畫與左右推入）：
   舊頁往下沉、越沉越快、越快越模糊（只往上下方向模糊）並淡掉；新頁一開始是糊的，從下方升上來、越來越慢、越來越清楚。
   每一種換頁都用這一套：總覽 ↔ 各部門看板（跨頁）、看板 ↔ 每週概述、打開／關閉設定、通知、編輯紀錄、工作報告。
   做法：
   - 只往上下方向的模糊＝SVG 濾鏡 feGaussianBlur stdDeviation="0 N"（水平 0、垂直 N），元素用 filter:url(#…) 套上；
     兩組濾鏡（pfxA／pfxB）輪流用，舊頁、新頁同時在動也不會互相影響。
   - 每一格（requestAnimationFrame）同時算位置、透明度、模糊：模糊量跟「這一刻的速度」成正比（位置曲線的斜率），
     所以舊頁剛開始沉的時候清楚、越往下越糊；新頁剛冒出來最糊、停下來時清楚。
   - 注意：模糊濾鏡由瀏覽器在主執行緒畫，手機忙的時候可能掉格；iPhone（WebKit）可能比較卡或模糊效果較弱。
     使用者知道這個取捨（DESIGN.md「動畫規則」裡換頁動畫是可以用模糊的例外）。
   - 減少動態（prefers-reduced-motion）時直接換，不播動畫。
   這個檔不依賴看板的其他程式（home.html 也載入它）。 */
const PageFx=(()=>{
  const RM=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
  const OUT=280,IN=440,OVER=.62,BLUR=18,DIST=()=>Math.round(Math.min(innerHeight*.3,320));   /* 舊頁沉多久、新頁升多久、新頁在舊頁沉到幾成時出發、最大模糊、移動距離 */
  let slot=0,tok=0;const owner=new WeakMap();   /* 每個元素目前歸哪一次換頁管：被新的換頁接手，舊的那段就停下 */
  function filters(){
    if(document.getElementById("pfxA"))return;
    const f=id=>`<filter id="${id}" x="-5%" y="-25%" width="110%" height="150%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 0"/></filter>`;
    document.body.insertAdjacentHTML("beforeend",`<svg width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true" focusable="false">${f("pfxA")}${f("pfxB")}</svg>`);
  }
  const keep=new WeakMap();
  function save(el){if(!keep.has(el))keep.set(el,{t:el.style.transform,f:el.style.filter,o:el.style.opacity,w:el.style.willChange,p:el.style.pointerEvents})}
  function reset(el){const k=keep.get(el);if(!k)return;keep.delete(el);el.style.transform=k.t;el.style.filter=k.f;el.style.opacity=k.o;el.style.willChange=k.w;el.style.pointerEvents=k.p}
  /* 先藏起來（新頁還沒輪到它升上來時）：只動透明度 */
  function hold(el){save(el);el.style.opacity="0"}
  /* 一段動畫：dir＝"out"（往下沉）或 "in"（從下方升上來）；t＝0..1
     out：位置 y＝D·t³（越來越快），速度 ∝ t²；in：y＝D·(1−t)³ 反過來（越來越慢），速度 ∝ (1−t)² */
  function run(el,dir,my){
    return new Promise(res=>{
      if(!el){res();return}
      filters();save(el);const id=(slot^=1)?"pfxA":"pfxB",fe=document.querySelector(`#${id} feGaussianBlur`),D=DIST(),dur=dir==="out"?OUT:IN,t0=performance.now();
      el.style.willChange="transform,opacity,filter";el.style.filter=`url(#${id})`;el.style.pointerEvents="none";
      const frame=now=>{
        if(owner.get(el)!==my){fe.setAttribute("stdDeviation","0 0");res();return}   /* 這個元素被下一次換頁接手（或 settle）：停下 */
        const t=Math.min(1,(now-t0)/dur),out=dir==="out";
        const y=out?D*t*t*t:D*Math.pow(1-t,3),v=out?t*t:Math.pow(1-t,2);
        const o=out?(t<.4?1:Math.max(0,1-(t-.4)/.6)):Math.min(1,t/.3);
        fe.setAttribute("stdDeviation",`0 ${(BLUR*v).toFixed(2)}`);
        el.style.transform=`translate3d(0,${y.toFixed(1)}px,0)`;el.style.opacity=o.toFixed(3);
        if(t<1)requestAnimationFrame(frame);else{fe.setAttribute("stdDeviation","0 0");res()}
      };
      requestAnimationFrame(frame);
    });
  }
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  /* 換頁：from 往下沉；沉到 OVER 時呼叫 mid()（把新頁顯示出來、換捲動位置等），to 從下方升上來；全部播完呼叫 done()（藏起舊頁等），再把兩頁的樣式還原。
     from 和 to 是同一個元素（例如每週概述：整個看板沉下去、換到每週概述、再升上來）就等它沉完才換、再升起 */
  async function swap(from,to,{mid,done}={}){
    const my=++tok;let m=false;const M=()=>{if(!m){m=true;mid&&mid()}};
    if(RM()||!from||!to){M();done&&done();return}
    owner.set(from,my);owner.set(to,my);
    if(from!==to)hold(to);
    if(from===to){await run(from,"out",my);M();await run(to,"in",my)}
    else{const pOut=run(from,"out",my);await wait(OUT*OVER);M();await Promise.all([pOut,run(to,"in",my)])}
    /* 中途被打斷也一樣把該做的做完（顯示新頁、藏起舊頁），只是還在別次換頁手上的元素不還原樣式 */
    M();done&&done();
    for(const el of new Set([from,to]))if(owner.get(el)===my){owner.delete(el);reset(el)}
  }
  /* 立刻停掉這些元素的換頁動畫並還原樣式（例如關閉動畫還沒播完又打開） */
  function settle(...els){els.forEach(el=>{if(!el)return;owner.delete(el);reset(el)})}

  /* ---------- 跨頁（總覽 ↔ 看板） ----------
     離開：攔下站內的連結（同網站的 .html 或資料夾），整頁往下沉完再換頁。
     到達：從站內換頁過來的（head 裡的小程式先加上 html.pfx-arrive，CSS 讓 body 先透明，不會閃一下），整頁從下方升上來；
     從上一頁快取回來（bfcache）也一樣。重新整理、從外面進來不放（看板有開場動畫）。
     瀏覽器的返回鍵沒辦法在離開前先播動畫，只有新頁升上來那一半。 */
  function leave(href){
    if(RM()){location.href=href;return}
    const my=++tok;owner.set(document.body,my);run(document.body,"out",my).then(()=>{if(owner.get(document.body)===my)location.href=href});
  }
  function arrive(){
    const h=document.documentElement;if(!h.classList.contains("pfx-arrive"))return;
    h.classList.remove("pfx-arrive");if(RM())return;
    const my=++tok;owner.set(document.body,my);run(document.body,"in",my).then(()=>{if(owner.get(document.body)===my){owner.delete(document.body);reset(document.body)}});
  }
  const inSite=a=>{try{const u=new URL(a.href,location.href);return u.origin===location.origin&&(/\.html?$/.test(u.pathname)||u.pathname.endsWith("/"))&&!a.target&&!a.hasAttribute("download")}catch(_){return false}};
  document.addEventListener("click",e=>{
    if(e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    const a=e.target.closest&&e.target.closest("a[href]");if(!a||!inSite(a))return;
    const u=new URL(a.href,location.href);if(u.pathname===location.pathname&&u.search===location.search)return;
    e.preventDefault();leave(u.href);
  });
  addEventListener("pageshow",e=>{if(e.persisted){reset(document.body);document.documentElement.classList.add("pfx-arrive");arrive()}});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",arrive);else arrive();
  return {swap,settle,leave,hold,reset};
})();
