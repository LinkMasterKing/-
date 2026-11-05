/* 畫面骨架：核心程式的 HTML 結構。部門資訊（logo、名稱）由 dept/ 提供，這裡不寫死任何部門。 */
const SHELL_IDS=["pager","importFile","dlg","toast","splash"];
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
          <div class="bigdate" id="bigDate"><span class="bd-k" aria-hidden="true">上次編輯</span></div>
          <div class="dow"><span id="dowEn"></span><span class="circ" id="dowZh"></span></div>
        </div>
      </header>
      <div class="hero-rule"><span class="hero-info"><span class="sub" id="saveInfo"></span></span><span class="actions"><span class="hero-btns" id="actions"></span><button type="button" class="week-btn" id="weekBtn">每週概述 <span aria-hidden="true">→</span></button></span></div>
      <div class="banner"><span class="live-dot" aria-hidden="true"></span><b>編輯中</b><span class="sub">即時回報：點哪一欄就改哪一欄 · 其他區按標題列的「編輯這區」，一次改一區 · 全部改完按「儲存並同步」</span></div>

      <section class="panel follow-panel" id="followPanel" data-secbox="follow" aria-labelledby="fwH" hidden>
        <div class="panel-head"><h2 id="fwH">追蹤<span class="en">FOLLOW</span></h2><button type="button" class="icon sec-edit-btn" data-secedit="follow" aria-pressed="false">編輯這區</button></div>
        <div class="follows" id="follows"></div>
        <button class="ghost edit-only add-row" id="addFollow">+ 追蹤項目</button>
      </section>
      <div class="layout">
        <div class="sgroup" data-sec="live" data-secbox="live">
          <section class="panel" id="livePanel" aria-labelledby="evH">
            <div class="panel-head"><h2 id="evH">即時回報<span class="en">LIVE</span></h2></div>
            <div class="md" id="liveMD"><div class="ev-zones" id="events"></div><div class="md-pane" id="evDetail" hidden></div></div>
          </section>
        </div>

        <div class="sgroup" data-sec="progress" data-secbox="progress">
          <!-- 進度：甘特圖與個別議題合成一張卡片。預設看甘特圖；點議題列換成該議題的詳情，按返回回到甘特圖（views.js 的 progShow） -->
          <section class="panel" id="progPanel" aria-labelledby="ganttH">
            <div class="panel-head"><h2 id="ganttH">時間甘特圖<span class="en">TIMELINE</span></h2><button type="button" class="icon sec-edit-btn" data-secedit="progress" aria-pressed="false">編輯這區</button></div>
            <div class="pv-page" id="pvGantt">
            <div class="legend" aria-label="圖例"><span><i class="lg-today" aria-hidden="true"></i>目前時間</span><span><i class="lg-line" style="--c:var(--prog-hi)" aria-hidden="true"></i>已過時程</span><span><i class="lg-rest" aria-hidden="true"></i>剩餘時程</span><span class="lg-hint">點議題列看詳情 · 左右滑動瀏覽月份</span></div>
            <div class="range">時間軸 <input type="month" id="rStart" aria-label="起始月份"> 到 <input type="month" id="rEnd" aria-label="結束月份"> <button class="icon" id="autoRange">依議題自動調整</button></div>
            <div class="gantt" id="gantt"></div>
            <button class="ghost edit-only add-row" id="addIssue">+ 新增議題</button>
            </div>
            <div class="pv-page" id="pvDetail" hidden>
              <button type="button" class="pv-back" id="pvBack">返回甘特圖</button>
              <div id="cardDetail"></div>
            </div>
          </section>
        </div>

        <div class="sgroup" data-sec="done" data-secbox="done">
          <aside class="panel" id="donePanel" aria-labelledby="doneH">
            <div class="panel-head"><h2 id="doneH">完成紀錄<span class="en">DONE</span><span class="count" id="doneCount">0</span></h2><button type="button" class="icon sec-edit-btn" data-secedit="done" aria-pressed="false">編輯這區</button></div>
            <div class="md" id="doneMD"><div class="events scroll" id="doneList"></div><div class="md-pane" id="doneDetail" hidden></div></div>
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
<div class="toast" id="toast" role="status"></div>
`;
(function mountShell(){
  if(!document.getElementById("pager"))document.body.insertAdjacentHTML("afterbegin",SHELL_HTML);
  /* 開頁的學生會進場畫面：從網站外面進來（或重新整理）才放，站內切換部門／總覽有換頁動畫就不放。
     最上面是學生會彩色標誌（黃、藍兩塊從兩側合進來，顏色是 board.css 的 --su-yellow／--su-blue；原檔是學生會素材庫的標誌，只取圖形不取英文字）。
     蓋住讀資料、讀字型那一下卡頓；boot.js 準備好後收掉 */
  let inSite=false;try{inSite=!!document.referrer&&new URL(document.referrer).origin===location.origin&&performance.getEntriesByType("navigation")[0]?.type!=="reload"}catch(_){}
  if(!inSite&&!document.getElementById("splash"))document.body.insertAdjacentHTML("afterbegin",`<div class="splash" id="splash" aria-hidden="true">
    <div class="sp-mark"><svg class="sp-emb" viewBox="34 20 208 236" aria-hidden="true"><path class="sp-y" d="M104.17,137.59a67,67,0,0,1,66.06-67A67.08,67.08,0,0,0,39.05,90.28v47.31a67.09,67.09,0,0,0,67.08,67.09,8,8,0,0,0,1,0,66.27,66.27,0,0,0,31.58-8.4,67.85,67.85,0,0,0,15-11.33,66.83,66.83,0,0,0,19.52-47.32Zm-8-66.35a4.47,4.47,0,0,1,0-.73,8.07,8.07,0,1,1,16.14,0v.29a8.07,8.07,0,0,1-16.1.44Z"/><path class="sp-b" d="M171.25,70.51a8.7,8.7,0,0,0-1,0,67.07,67.07,0,0,0-66.06,67h69a66.83,66.83,0,0,1-19.52,47.32,67.85,67.85,0,0,1-15,11.33,66.27,66.27,0,0,1-31.58,8.4,67.1,67.1,0,0,0,131.22-19.73V137.59A67.1,67.1,0,0,0,171.25,70.51Zm10,48a8.07,8.07,0,0,1-8,7.34,9.43,9.43,0,0,1-1.06-.07,8,8,0,0,1-6.36-4.83,7.67,7.67,0,0,1-.65-2.87v-.3a8,8,0,0,1,2.87-6.14,8.57,8.57,0,0,1,2.14-1.3,7.82,7.82,0,0,1,3.06-.62,8,8,0,0,1,8.06,8.06A5.86,5.86,0,0,1,181.21,118.55Z"/></svg><span class="sp-k">STUST&nbsp;&nbsp;STUDENT&nbsp;&nbsp;ASSOCIATION</span><b class="sp-t">南臺科技大學學生會</b><span class="sp-line"></span><span class="sp-d">${CFG.dept.name||""}</span></div></div>`);
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
