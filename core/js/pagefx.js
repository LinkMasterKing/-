/* 核心｜換頁動畫（2026-11-05 使用者指定，取代原本的預測返回動畫與左右推入）：
   「往下／往後」是指圖層的前後（離你遠近），不是畫面的上下：
   舊頁往後退（縮小、遠離）、越退越快、越快越模糊並淡掉；新頁一開始在後面、是糊的，往前浮上來（放大回原尺寸）、越來越慢、越來越清楚。
   每一種換頁都用這一套：總覽 ↔ 各部門看板（跨頁）、看板 ↔ 每週概述、打開／關閉設定、通知、編輯紀錄、工作報告。
   做法：
   - 每一格（requestAnimationFrame）同時設定縮放、透明度、模糊（CSS filter: blur，四周平均的景深模糊，交給顯示卡畫）；
     模糊量跟「這一刻的速度」成正比（縮放曲線的斜率），所以舊頁剛開始退的時候清楚、越退越糊；新頁剛浮出來最糊、停下來時清楚。
   - 縮放的中心是「畫面正中央」（換算成元素自己的座標），長頁面捲到一半也一樣往畫面中央退。
   - 模糊屬於 DESIGN.md「動畫規則」裡換頁動畫的例外（使用者要求）；手機忙的時候可能掉格。
   - 疊層（設定、通知、編輯紀錄、工作報告、設定子頁；z-index 比較高的）打開時底下那頁不動，只有疊層從後面浮上來、前 8% 就不透明；
     關閉時底下那頁也不動，疊層往後退、淡掉（2026-11-05 使用者：打開設定不要閃現主頁）。同一層級之間（每週概述、跨頁）才是前後兩頁一起動。
   - 同一時間只有兩層在動（舊頁、新頁）：新頁等舊頁退到八成五、幾乎淡掉才出發，並在前 15% 就變成不透明，
     兩層同時半透明的時間很短，不會看起來像三層疊在一起（2026-11-05 使用者回報「圖層太多、太透」）；
     上一次換頁還沒播完的其他層，新的換頁一開始就直接藏起來，不跟著一起淡。
   - 減少動態（prefers-reduced-motion）時直接換，不播動畫。
   - 跨頁（總覽 ↔ 看板）整個 body 只縮放＋透明度、不模糊，到達時等整頁載入完再播（2026-11-06，手機比較順）。
   這個檔不依賴看板的其他程式（home.html 也載入它）。 */
const PageFx=(()=>{
  const RM=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
  const OUT=280,IN=440,OVER=.85,BLUR=14,SCALE=.12,FADE_IN=.15,COVER_IN=.08;   /* 舊頁退多久、新頁浮多久、新頁在舊頁退到幾成時出發、最大模糊（px）、退到多小（1−SCALE）、新頁在前幾成變成不透明 */
  let tok=0;const owner=new WeakMap();const live=new Set();   /* live：目前還在換頁動畫裡的元素；owner：每個元素目前歸哪一次換頁管：被新的換頁接手，舊的那段就停下 */
  const keep=new WeakMap();
  function save(el){if(!keep.has(el))keep.set(el,{t:el.style.transform,g:el.style.transformOrigin,f:el.style.filter,o:el.style.opacity,w:el.style.willChange,p:el.style.pointerEvents})}
  function reset(el){const k=keep.get(el);if(!k)return;keep.delete(el);el.style.transform=k.t;el.style.transformOrigin=k.g;el.style.filter=k.f;el.style.opacity=k.o;el.style.willChange=k.w;el.style.pointerEvents=k.p}
  /* 先藏起來（新頁還沒輪到它浮上來時）：只動透明度 */
  function hold(el){save(el);el.style.opacity="0"}
  /* 一段動畫：dir＝"out"（往後退）或 "in"（從後面浮上來）；t＝0..1
     out：縮小量＝SCALE·t³（越來越快），速度 ∝ t²；in：SCALE·(1−t)³ 反過來（越來越慢），速度 ∝ (1−t)² */
  function run(el,dir,my,fadeIn=FADE_IN,blurK=1){   /* blurK：模糊量倍數（跨頁的整個 body 用 0：整頁模糊在手機上很吃效能、會卡） */
    return new Promise(res=>{
      if(!el){res();return}
      save(el);const dur=dir==="out"?OUT:IN,t0=performance.now(),r=el.getBoundingClientRect();
      el.style.transformOrigin=`${Math.round(innerWidth/2-r.left)}px ${Math.round(innerHeight/2-r.top)}px`;   /* 往畫面正中央退 */
      el.style.willChange="transform,opacity,filter";el.style.pointerEvents="none";
      const frame=now=>{
        if(owner.get(el)!==my){res();return}   /* 這個元素被下一次換頁接手（或 settle）：停下 */
        const t=Math.min(1,(now-t0)/dur),out=dir==="out";
        const k=out?SCALE*t*t*t:SCALE*Math.pow(1-t,3),v=out?t*t:Math.pow(1-t,2);
        const o=out?(t<.35?1:Math.max(0,1-(t-.35)/.65)):Math.min(1,t/fadeIn);
        el.style.transform=`scale(${(1-k).toFixed(4)})`;el.style.filter=blurK?`blur(${(BLUR*blurK*v).toFixed(2)}px)`:"";el.style.opacity=o.toFixed(3);
        if(t<1)requestAnimationFrame(frame);else res();
      };
      requestAnimationFrame(frame);
    });
  }
  /* 疊層的高低（z-index；一般頁面＝0）：用來判斷是「疊層蓋上來」還是「疊層退開」 */
  const zOf=el=>{const z=parseInt(getComputedStyle(el).zIndex,10);return isNaN(z)?0:z};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  /* 換頁：from 往後退；退到 OVER 時呼叫 mid()（把新頁顯示出來、換捲動位置等），to 從後面浮上來；全部播完呼叫 done()（藏起舊頁等），再把兩頁的樣式還原。
     from 和 to 是同一個元素（例如每週概述：整個看板退後、換到每週概述、再浮上來）就等它退完才換、再浮上來 */
  async function swap(from,to,{mid,done}={}){
    const my=++tok;let m=false;const M=()=>{if(!m){m=true;mid&&mid()}};
    if(RM()||!from||!to){M();done&&done();return}
    /* 上一次換頁還沒播完、這次又不用的層（例如快速開關設定）：直接藏起來，畫面上只留這次的前後兩層 */
    const stale=[...live].filter(el=>el!==from&&el!==to);stale.forEach(el=>{owner.set(el,my);save(el);el.style.opacity="0"});
    owner.set(from,my);owner.set(to,my);live.add(from);live.add(to);
    const zf=from===to?0:zOf(from),zt=from===to?0:zOf(to);
    if(from===to){await run(from,"out",my);M();await run(to,"in",my)}
    else if(zt>zf){
      /* 疊層蓋上來（打開設定、通知、編輯紀錄、工作報告、設定子頁）：底下那頁不動，疊層從後面浮上來、一開始就變不透明蓋住它（2026-11-05 使用者：不要閃現主頁） */
      owner.delete(from);live.delete(from);hold(to);M();await run(to,"in",my,COVER_IN);
    }else if(zf>zt){
      /* 疊層退開（關閉）：底下那頁本來就在、不動，疊層往後退、淡掉露出它 */
      owner.delete(to);live.delete(to);reset(to);M();await run(from,"out",my);
    }else{hold(to);const pOut=run(from,"out",my);await wait(OUT*OVER);M();await Promise.all([pOut,run(to,"in",my)])}
    /* 中途被打斷也一樣把該做的做完（顯示新頁、藏起舊頁），只是還在別次換頁手上的元素不還原樣式 */
    M();done&&done();
    for(const el of new Set([from,to,...stale]))if(owner.get(el)===my){owner.delete(el);live.delete(el);reset(el)}
  }
  /* 立刻停掉這些元素的換頁動畫並還原樣式（例如關閉動畫還沒播完又打開） */
  function settle(...els){els.forEach(el=>{if(!el)return;owner.delete(el);live.delete(el);reset(el)})}

  /* ---------- 跨頁（總覽 ↔ 看板） ----------
     離開：攔下站內的連結（同網站的 .html 或資料夾），整頁往後退完再換頁。
     到達：從站內換頁過來的（head 裡的小程式先加上 html.pfx-arrive，CSS 讓 body 先透明，不會閃一下），整頁從後面浮上來；
     從上一頁快取回來（bfcache）也一樣。重新整理、從外面進來不放（看板有開場動畫）。
     瀏覽器的返回鍵沒辦法在離開前先播動畫，只有新頁浮上來那一半。 */
  function leave(href){
    if(RM()){location.href=href;return}
    const my=++tok;owner.set(document.body,my);run(document.body,"out",my,FADE_IN,0).then(()=>{if(owner.get(document.body)===my)location.href=href});
  }
  /* 到達：等整頁載入完、再等兩格（看板第一次畫完、字型就位）才開始浮上來，動畫期間主執行緒比較閒，不會一頓一頓；
     整個 body 不做模糊（只縮放＋透明度），手機才順（2026-11-06 使用者：選好部門進去的動畫有點卡） */
  function arrive(){
    const h=document.documentElement;if(!h.classList.contains("pfx-arrive"))return;
    if(RM()){h.classList.remove("pfx-arrive","pfx-burst");h.style.background="";return}
    if(h.classList.contains("pfx-burst"))return burstIn();
    const start=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const my=++tok;owner.set(document.body,my);hold(document.body);h.classList.remove("pfx-arrive");
      run(document.body,"in",my,FADE_IN,0).then(()=>{if(owner.get(document.body)===my){owner.delete(document.body);reset(document.body)}});
    }));
    let go=false;const once=()=>{if(!go){go=true;start()}};
    if(document.readyState==="complete")once();else{addEventListener("load",once,{once:true});setTimeout(once,900)}   /* 最多等 0.9 秒（字型、圖片很慢時不要一直空白） */
  }
  /* 第二次擴散（2026-11-06 使用者：總覽的部門圈放開時，放開的位置跑兩次全螢幕擴散）：
     總覽那邊第一次擴散蓋滿一片光色後換頁（home.html 的 go），位置與顏色存在 sessionStorage；這裡整頁先是那片光色（index.html head 的小程式設 html 底色），
     看板準備好（跟一般到達一樣等 load、最多 0.9 秒）後，body 用 clip-path 圓形從同一個位置擴散開來，露出看板 */
  function burstIn(){
    const h=document.documentElement;let b=null;try{b=JSON.parse(sessionStorage.getItem("pfx-burst")||"null");sessionStorage.removeItem("pfx-burst")}catch(_){}
    const done=()=>{h.classList.remove("pfx-arrive","pfx-burst");h.style.background="";document.body.style.clipPath=""};
    if(!b){done();return}
    /* clip-path 的動畫在主執行緒上跑：看板第一次畫面還在忙的時候開始，會停在原地再一口氣跳完。所以等「畫面刷新好了」：
       連續 4 格都在 24ms 內畫完（主執行緒閒下來）才開始，最多等 1.6 秒 */
    const calm=f=>{let n=0,last=performance.now();const t0=last;const tick=now=>{n=now-last<24?n+1:0;last=now;if(n>=4||now-t0>1600)f();else requestAnimationFrame(tick)};requestAnimationFrame(tick)};
    const go=()=>calm(()=>{
      const x=Math.min(innerWidth,Math.max(0,b.x)),y=Math.min(innerHeight,Math.max(0,b.y)),R=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y))+2;
      document.body.style.clipPath=`circle(0px at ${x}px ${y}px)`;h.classList.remove("pfx-arrive");
      document.body.animate([{clipPath:`circle(0px at ${x}px ${y}px)`},{clipPath:`circle(${R}px at ${x}px ${y}px)`}],{duration:620,easing:"cubic-bezier(.2,.75,.25,1)"}).finished.then(done,done);
    });
    let once=false;const go1=()=>{if(!once){once=true;go()}};
    if(document.readyState==="complete")go1();else{addEventListener("load",go1,{once:true});setTimeout(go1,900)}
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
