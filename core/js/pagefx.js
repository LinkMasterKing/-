/* 核心｜換頁動畫（2026-11-05 使用者指定；2026-11-06 第四版改成 Windows 10 Mobile 的做法，見 run 上面的說明）：
   每一種整頁切換都用這一套：總覽 ↔ 各部門看板（跨頁）、看板 ↔ 每週概述、打開／關閉設定、通知、編輯紀錄、工作報告、設定子頁。
   - 前進：舊頁很快淡掉；新頁的區塊由下往上滑入、浮現（由上往下錯開）。返回：目前這頁往下滑、淡掉；上一頁的區塊在原位淡入。沒有模糊、沒有 3D。
   - 圖層前後照舊：疊層（設定、通知、編輯紀錄、工作報告、設定子頁；z-index 比較高的）打開時底下那頁不動，疊層很快變成不透明、裡面的區塊依序滑上來；
     關閉（返回）時疊層往下滑、淡掉，底下那頁的區塊淡入歸位（2026-11-05 使用者：打開設定不要閃現主頁）。同一層級之間（每週概述、跨頁）才是前後兩頁一起動：
     新頁等舊頁播到七成才出發。上一次換頁還沒播完的其他層，新的換頁一開始就停掉並藏起來。
   - 減少動態（prefers-reduced-motion）時直接換，不播動畫。
   - 跨頁（總覽 ↔ 看板）：離開時整頁淡掉再換頁；到達時等整頁載入完、畫面穩定再讓區塊滑上來。
   這個檔不依賴看板的其他程式（home.html 也載入它）。 */
const PageFx=(()=>{
  const RM=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* 2026-11-06 第四版：Windows 10 Mobile 的換頁（使用者：旋轉門是 WP7/8 的做法，比較喜歡 WP10 的新動畫）。只動位移與透明度：
     前進：舊頁整頁很快淡掉（0.22 秒）；新頁的區塊（pieces）由下往上滑入（最多 120px）並浮現，依上下位置錯開 0.2 秒，越來越慢（0.68 秒）。
     返回：目前這頁整頁往下滑 80px 並淡掉（0.3 秒，越來越快）；上一頁的區塊在原位淡入、從上方 24px 略微往下歸位（0.56 秒，錯開 0.11 秒）。
     元素本身（整頁或疊層）：前進離開＝整頁淡掉；返回離開＝整頁往下滑並淡掉；進來＝一開始淡入（fadeIn＝0：本來就看得到，不動） */
  /* 2026-11-06 使用者：整頁動畫慢一點，效果比較明顯——時間全部拉長約 1.5 倍（位移距離、曲線不變） */
  const OUT=220,BOUT=300,IN=680,BIN=560,SPREAD_IN=200,SPREAD_BIN=110,OVER=.7,BACK_OVER=.55,FADE_IN=.12,COVER_IN=.06;
  const EASE_OUT="cubic-bezier(.4,0,1,1)",EASE_IN="cubic-bezier(.1,.9,.2,1)",MAXP=14;
  let tok=0;const owner=new WeakMap();const live=new Set();   /* live：目前還在換頁動畫裡的元素；owner：每個元素目前歸哪一次換頁管：被新的換頁接手，舊的那段就停下 */
  const keep=new WeakMap(),anims=new WeakMap();
  function save(el){if(!keep.has(el))keep.set(el,{o:el.style.opacity,p:el.style.pointerEvents})}
  function reset(el){(anims.get(el)||[]).forEach(a=>a.cancel());anims.delete(el);const k=keep.get(el);if(!k)return;keep.delete(el);el.style.opacity=k.o;el.style.pointerEvents=k.p}
  /* 先藏起來（新頁還沒輪到它浮上來時）：只動透明度 */
  function hold(el){save(el);el.style.opacity="0"}
  /* 找出要翻的區塊：從元素往下找，比畫面高四成多的容器繼續往裡面拆，其他的（卡片、膠囊、標題列、工具列…）當成一塊；只算畫面上看得到的，最多 MAXP 塊 */
  function pieces(el){
    const H=innerHeight,W=innerWidth,out=[];
    const walk=(n,depth)=>{for(const c of n.children){
      if(out.length>=MAXP)return;
      if(c.matches("script,style,template,link,[hidden]"))continue;
      const cs=getComputedStyle(c);if(cs.display==="none"||cs.visibility==="hidden")continue;
      if(cs.display==="contents"){walk(c,depth);continue}
      const r=c.getBoundingClientRect();if(!(r.bottom>0&&r.top<H&&r.right>0&&r.left<W&&r.width>1&&r.height>1))continue;
      if(r.height>H*.42&&c.children.length&&depth<7)walk(c,depth+1);else out.push({el:c,r,base:cs.transform&&cs.transform!=="none"?cs.transform:""});
    }};
    walk(el,0);return out;
  }
  /* 一段動畫：dir＝"out"（離開）或 "in"（進來）；back＝返回；fadeIn＝新頁在前幾成變成不透明；lag＝整段晚多久開始（期間區塊停在起始狀態） */
  function run(el,dir,my,fadeIn=FADE_IN,back=false,lag=0){
    if(!el)return Promise.resolve();
    save(el);el.style.pointerEvents="none";(anims.get(el)||[]).forEach(a=>a.cancel());
    const o=dir==="out",H=innerHeight||1,list=[];
    if(o){
      /* 離開：整個元素一起動（前進＝淡掉；返回＝往下滑並淡掉），不用拆塊 */
      const base=getComputedStyle(el).transform,B=base&&base!=="none"?" "+base:"";
      list.push(el.animate(back?[{transform:"translateY(0)"+B,opacity:1},{transform:"translateY(80px)"+B,opacity:0}]:[{opacity:1},{opacity:0}],
        {duration:(back?BOUT:OUT)+lag,easing:EASE_OUT,fill:"both",delay:0}));
    }else{
      const ps=pieces(el),dur=back?BIN:IN,spread=back?SPREAD_BIN:SPREAD_IN,dy=back?-24:Math.min(120,Math.round(H*.14)),total=dur+spread+lag;
      ps.forEach(({el:p,r,base})=>{
        const delay=lag+Math.round(Math.max(0,Math.min(1,r.top/H))*spread),B=base?" "+base:"";   /* 區塊原本的變形（例如工具列置中的 translateX）接在後面保留 */
        list.push(p.animate([{transform:`translateY(${dy}px)${B}`,opacity:0},{opacity:1,offset:.4},{transform:`translateY(0)${B}`,opacity:1}],{duration:dur,delay,easing:EASE_IN,fill:"both"}));
      });
      if(fadeIn>0)list.push(el.animate([{opacity:0},{opacity:1,offset:Math.max(.02,fadeIn*dur/total)},{opacity:1}],{duration:total,easing:"linear",fill:"both"}));
    }
    anims.set(el,list);
    return Promise.all(list.map(a=>a.finished.catch(()=>{}))).then(()=>{});
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
    const stale=[...live].filter(el=>el!==from&&el!==to);stale.forEach(el=>{owner.set(el,my);reset(el);hold(el)});   /* 先停掉它還在跑的翻頁動畫，再藏起來 */
    owner.set(from,my);owner.set(to,my);live.add(from);live.add(to);
    const zf=from===to?0:zOf(from),zt=from===to?0:zOf(to);
    if(from===to){await run(from,"out",my);M();reset(from);save(from);from.style.opacity="0";await run(to,"in",my)}
    else if(zt>zf){
      /* 疊層蓋上來（打開設定、通知、編輯紀錄、工作報告、設定子頁）：底下那頁不動，疊層從後面浮上來、一開始就變不透明蓋住它（2026-11-05 使用者：不要閃現主頁） */
      owner.delete(from);live.delete(from);hold(to);M();await run(to,"in",my,COVER_IN);
    }else if(zf>zt){
      /* 疊層退開（關閉，返回）：疊層的區塊朝你翻走、疊層淡掉；播到 BACK_OVER 時底下那頁的區塊從被翻開的位置轉回來（底下那頁本身一直是不透明的） */
      reset(to);M();await Promise.all([run(from,"out",my,FADE_IN,true),run(to,"in",my,0,true,Math.round(BOUT*BACK_OVER))]);
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
    const my=++tok;owner.set(document.body,my);run(document.body,"out",my).then(()=>{if(owner.get(document.body)===my)location.href=href});
  }
  /* 到達：等整頁載入完、再等兩格（看板第一次畫完、字型就位）才開始浮上來，動畫期間主執行緒比較閒，不會一頓一頓；
     區塊由下往上滑入（2026-11-06 第四版） */
  function arrive(){
    const h=document.documentElement;if(!h.classList.contains("pfx-arrive"))return;
    if(RM()){h.classList.remove("pfx-arrive");return}
    /* 2026-11-06 使用者：進部門後整個介面卡一下。看板剛載入時要畫第一次畫面、讀雲端、套秘書處的學年（又重畫一次），
       翻進來的動畫跟這些搶主執行緒就會頓。所以等「畫面穩定」：連續 5 格都在 22ms 內畫完才開始，最多等 1.6 秒；
       等的這段時間整頁還是透明（底色），看不到半成品 */
    const calm=f=>{let n=0,last=performance.now();const t0=last,tick=now=>{n=now-last<22?n+1:0;last=now;if(n>=5||now-t0>1600)f();else requestAnimationFrame(tick)};requestAnimationFrame(tick)};
    const start=()=>calm(()=>{
      const my=++tok;owner.set(document.body,my);hold(document.body);h.classList.remove("pfx-arrive");
      run(document.body,"in",my).then(()=>{if(owner.get(document.body)===my){owner.delete(document.body);reset(document.body)}});
    });
    let go=false;const once=()=>{if(!go){go=true;start()}};
    if(document.readyState==="complete")once();else{addEventListener("load",once,{once:true});setTimeout(once,900)}   /* 最多等 0.9 秒（字型、圖片很慢時不要一直空白） */
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
