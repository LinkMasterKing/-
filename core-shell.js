/* 畫面骨架：核心程式的 HTML 結構。部門資訊（logo、名稱）由 dept/ 提供，這裡不寫死任何部門。 */
const SHELL_IDS=["pager","importFile","dlg","animOv","toast"];
const SHELL_HTML=`<div class="pager" id="pager">
  <!-- main page -->
  <div class="page page-main" id="pageMain">
    <div class="wrap">
      <header class="hero">
        <a class="logo-box" href="home.html" title="各部門總覽"></a>
        <div class="hero-l">
          <div class="eyebrow">WORK&nbsp;&nbsp;BOARD<span class="zh-sm">工作看板</span> <span class="arrow-line" aria-hidden="true"></span> <span id="yearTxt"></span></div>
          <div class="hero-title"><span class="pill"><span id="weekPill"></span><span class="pill-zh" id="weekZh"></span></span><span id="titleSlot"></span></div>
        </div>

        <div class="hero-r">
          <div class="bigdate" id="bigDate"></div>
          <div class="dow"><span id="dowEn"></span><span class="circ" id="dowZh"></span></div>
        </div>
      </header>
      <div class="hero-rule"><span class="hero-info"><span class="sub" id="saveInfo"></span></span><span class="actions"><span class="hero-btns" id="actions"></span><button type="button" class="week-btn" id="weekBtn">每週概述 <span aria-hidden="true">→</span></button></span></div>
      <div class="banner"><span class="live-dot" aria-hidden="true"></span><b>編輯中</b><span class="sub">在進度條上按住拖曳新增註記 · 拖曳註記調整位置 · 點註記可修改 · 填開始／結束日的議題會出現在甘特圖 · 完成後按「儲存並定型」</span></div>

      <section class="panel follow-panel" id="followPanel" aria-labelledby="fwH" hidden>
        <div class="panel-head"><h2 id="fwH">追蹤<span class="en">FOLLOW</span></h2></div>
        <div class="follows" id="follows"></div>
        <button class="ghost edit-only add-row" id="addFollow">+ 追蹤項目</button>
      </section>
      <div class="layout">
        <div class="sgroup" data-sec="live">
          <section class="panel" id="livePanel" aria-labelledby="evH">
            <div class="panel-head"><h2 id="evH">即時回報<span class="en">LIVE</span></h2></div>
            <div class="md" id="liveMD"><div class="events" id="events"></div><div class="md-pane" id="evDetail" hidden></div></div>
            <button class="ghost edit-only add-row" id="addEvent">+ 新增即時回報</button>
          </section>
        </div>

        <div class="sgroup" data-sec="progress">
          <section class="panel" aria-labelledby="ganttH">
            <div class="panel-head"><h2 id="ganttH">時間甘特圖<span class="en">TIMELINE</span></h2></div>
            <div class="legend" aria-label="圖例"><span><i class="lg-today" aria-hidden="true"></i>目前時間</span><span><i class="lg-line" style="--c:var(--prog-hi)" aria-hidden="true"></i>已過時程</span><span><i class="lg-rest" aria-hidden="true"></i>剩餘時程</span><span class="lg-hint">點議題列可跳到該議題 · 左右滑動瀏覽月份</span></div>
            <div class="range">時間軸 <input type="month" id="rStart" aria-label="起始月份"> 到 <input type="month" id="rEnd" aria-label="結束月份"> <button class="icon" id="autoRange">依議題自動調整</button></div>
            <div class="gantt" id="gantt"></div>
          </section>

          <section class="panel" id="cardsPanel" aria-labelledby="cardsH">
            <div class="panel-head"><h2 id="cardsH">個別進度<span class="en">PROGRESS</span></h2></div>
            <div class="md" id="cardsMD"><div class="cards" id="cards"></div><div class="md-pane" id="cardDetail" hidden></div></div>
            <button class="ghost edit-only add-row" id="addIssue">+ 新增議題</button>
          </section>
        </div>

        <div class="sgroup" data-sec="done">
          <aside class="panel" id="donePanel" aria-labelledby="doneH">
            <div class="panel-head"><h2 id="doneH">完成紀錄<span class="en">DONE</span><span class="count" id="doneCount">0</span></h2></div>
            <div class="md" id="doneMD"><div class="scroll" id="doneList"></div><div class="md-pane" id="doneDetail" hidden></div></div>
          </aside>
        </div>
      </div>
    </div>
  </div>

  <!-- weekly page (swipe right) -->
  <aside class="page page-week" id="pageWeek" aria-labelledby="weekH">
    <div class="week-wrap">
      <div class="week-top">
        <button class="icon" id="backMain" aria-label="回到主畫面"><svg class="ico" viewBox="0 0 8 14" width="7" height="12" aria-hidden="true"><path d="M6.5 1.5 1.5 7l5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>返回</span></button>
        <h2 id="weekH">每週更新概述<span class="en">WEEKLY</span></h2>
        <button class="gen-btn" id="genWeek"><svg class="spark" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M10 3l1.9 5.1L17 10l-5.1 1.9L10 17l-1.9-5.1L3 10l5.1-1.9z"/><path fill="currentColor" d="M18.5 2l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/><path fill="currentColor" d="M18 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/></svg>生成週報</button>
        <button class="ghost edit-only" id="addWeek">+ 新增週報</button>
      </div>
      <div id="weekList"></div>
    </div>
  </aside>
</div>


<input type="file" id="importFile" accept=".html,.htm,.json" hidden>
<dialog id="dlg"><form method="dialog" id="dlgForm"></form></dialog>
<div class="anim-ov" id="animOv" role="dialog" aria-modal="true" aria-label="動畫模式" hidden>
  <div class="anim-top"><div class="anim-title"><span class="anim-k">ANIMATION</span><b id="animTitle"></b><span class="sub" id="animDate"></span><span class="sub anim-tip">點畫面暫停 · Esc 關閉</span></div>
    <div class="anim-ctl"><button type="button" id="animFs">全螢幕</button><button type="button" id="animClose" aria-label="關閉動畫模式"><svg class="ico " viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="i-x" d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>關閉</button></div></div>
  <section class="story" id="story" aria-label="動態摘要"><div class="story-stage" id="storyStage"></div><div class="story-dots" id="storyDots"></div></section>
  </div>
<div class="toast" id="toast" role="status"></div>
`;
(function mountShell(){
  if(!document.getElementById("pager"))document.body.insertAdjacentHTML("afterbegin",SHELL_HTML);
  const box=document.querySelector(".logo-box"),tpl=document.getElementById("dept-logo");
  /* 還沒有 logo 的部門（設定檔 logo:false）：先用文字代替 */
  if(box&&!box.firstElementChild){if(CFG.logo&&tpl)box.append(tpl.content.cloneNode(true));
    else box.innerHTML=`<div class="logo-text" role="img" aria-label="${CFG.brand}"><b>${CFG.dept.name}</b><small>${CFG.dept.org}</small></div>`}
  if(CFG.brand){const svg=box&&box.querySelector("svg");if(svg&&!svg.getAttribute("aria-label"))svg.setAttribute("aria-label",CFG.brand)}
  /* 部門主色 → CSS 變數（只覆寫設定檔有給的值） */
  const c=CFG.colors||{},map={accentLight:"--accent-light",accentDark:"--accent-dark",ok:"--ok",neon:"--neon",okDot:"--ok-dot"};
  const vars=Object.keys(map).filter(k=>c[k]).map(k=>`${map[k]}:${c[k]}`).join(";");
  if(vars&&!document.getElementById("dept-theme")){const st=document.createElement("style");st.id="dept-theme";st.textContent=`:root{${vars}}`;document.head.append(st)}
  /* 關閉的區塊 */
  Object.entries(CFG.sections).forEach(([k,on])=>document.body.classList.toggle("no-"+k,!on));
})();
