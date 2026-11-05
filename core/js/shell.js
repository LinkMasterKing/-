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
      <div class="hero-rule"><span class="hero-info"><span class="sub" id="saveInfo"></span></span><span class="actions"><span class="hero-btns" id="actions"></span><button type="button" class="noti-btn" id="notiBtn" aria-label="通知" title="今日／明日要處理的事、行事曆"><svg class="ico solo" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g class="i-bell"><path d="M6.2 16.4V11a5.8 5.8 0 0 1 11.6 0v5.4l1.6 1.8H4.6z"/><path d="M10.2 20.4a2 2 0 0 0 3.6 0"/></g></svg><span class="noti-n num" hidden></span></button><button type="button" class="week-btn" id="weekBtn">每週概述 <span aria-hidden="true">→</span></button></span></div>
      <div class="banner"><span class="live-dot" aria-hidden="true"></span><b>編輯中</b><span class="sub">即時回報：點哪一欄就改哪一欄 · 其他區按標題列的「編輯這區」，一次改一區 · 全部改完按「儲存並同步」</span></div>

      <section class="panel follow-panel" id="followPanel" data-secbox="follow" aria-labelledby="fwH" hidden>
        <div class="panel-head"><h2 id="fwH">追蹤<span class="en">FOLLOW</span></h2><button type="button" class="icon sec-edit-btn" data-secedit="follow" aria-pressed="false">編輯這區</button></div>
        <div class="follows" id="follows" data-flip></div>
        <button class="ghost edit-only add-row" id="addFollow">+ 追蹤項目</button>
      </section>
      <section class="panel follow-panel meet-panel" id="meetPanel" data-secbox="meet" aria-labelledby="mtH" hidden>
        <div class="panel-head"><h2 id="mtH">會議報告事項<span class="en">MEETING</span></h2><button type="button" class="icon" id="meetRefresh">重新整理</button><button type="button" class="icon sec-edit-btn" data-secedit="meet" aria-pressed="false">編輯這區</button></div>
        <div class="mt-depts" id="meetList" data-flip></div>
      </section>
      <div class="layout">
        <div class="sgroup" data-sec="live" data-secbox="live">
          <section class="panel" id="livePanel" aria-labelledby="evH">
            <div class="panel-head"><h2 id="evH">即時回報<span class="en">LIVE</span></h2></div>
            <div class="md" id="liveMD"><div class="ev-zones" id="events" data-flip></div><div class="md-pane" id="evDetail" hidden></div></div>
          </section>
        </div>

        <div class="sgroup" data-sec="progress" data-secbox="progress">
          <!-- 進度：甘特圖與個別議題合成一張卡片。預設看甘特圖；點議題列換成該議題的詳情，按返回回到甘特圖（views.js 的 progShow） -->
          <section class="panel" id="progPanel" aria-labelledby="ganttH">
            <div class="panel-head"><h2 id="ganttH">時間甘特圖<span class="en">TIMELINE</span></h2><button type="button" class="icon sec-edit-btn" data-secedit="progress" aria-pressed="false">編輯這區</button></div>
            <div class="pv-page" id="pvGantt">
            <div class="legend" aria-label="圖例"><span><i class="lg-today" aria-hidden="true"></i>目前時間</span><span><i class="lg-line" style="--c:var(--prog-hi)" aria-hidden="true"></i>已過時程</span><span><i class="lg-rest" aria-hidden="true"></i>剩餘時程</span><span class="lg-hint">點議題列看詳情 · 左右滑動瀏覽月份</span></div>
            <div class="range">時間軸 <input type="month" id="rStart" aria-label="起始月份"> 到 <input type="month" id="rEnd" aria-label="結束月份"> <button class="icon" id="autoRange">依議題自動調整</button></div>
            <div class="gantt" id="gantt" data-flip></div>
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
            <div class="md" id="doneMD"><div class="events scroll" id="doneList" data-flip></div><div class="md-pane" id="doneDetail" hidden></div></div>
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
      <div id="weekList" data-flip></div>
    </div>
  </aside>
</div>


<input type="file" id="importFile" accept=".html,.htm,.json" hidden>
<dialog id="dlg"><form method="dialog" id="dlgForm"></form></dialog>
<div class="toast" id="toast" role="status"></div>
`;
/* 學生會 logo（assets/學生會logo-彩色文字版.svg）拆成：標誌（黃藍兩塊）＋ 14 個字（STUSTSA 7、南臺科大學生會 7）。
   每個字是自己的小 svg（viewBox＝那個字的外框），位置用 %；這樣每個字只要動 transform／opacity，主執行緒忙的時候動畫也不會停。
   box＝整個 logo 裁掉空白後的範圍；emb＝[x,y,w,h,[[顏色,路徑]…]]；g＝[[x,y,w,h,顏色,路徑]…]（座標都是原檔的 viewBox） */
const SU_LOGO={"box":[20,48,547,186],"emb":[25.08,53.16,152.57,175.44,[["#f0bc23","M75,141a51.19,51.19,0,0,1,15-36.23,51.19,51.19,0,0,1,35.62-15.11A51.37,51.37,0,0,0,25.08,104.79V141A51.37,51.37,0,0,0,76.45,192.4a6.27,6.27,0,0,0,.75,0,50.76,50.76,0,0,0,24.19-6.43,52.2,52.2,0,0,0,11.46-8.68,51.2,51.2,0,0,0,15-36.24ZM68.8,90.21a3.57,3.57,0,0,1,0-.56,6.18,6.18,0,1,1,12.36,0v.22a6.18,6.18,0,0,1-12.33.34Z"],["#0a5baa","M126.32,89.65a6.78,6.78,0,0,0-.78,0A51.36,51.36,0,0,0,75,141H127.8a51.2,51.2,0,0,1-15,36.24,52.2,52.2,0,0,1-11.46,8.68,50.76,50.76,0,0,1-24.19,6.43,51.39,51.39,0,0,0,100.5-15.11V141A51.39,51.39,0,0,0,126.32,89.65ZM134,126.44a6.18,6.18,0,0,1-6.15,5.62c-.28,0-.53,0-.81-.05a6.15,6.15,0,0,1-4.87-3.71,5.67,5.67,0,0,1-.5-2.19v-.23a6.1,6.1,0,0,1,2.2-4.7,6.62,6.62,0,0,1,1.64-1,5.86,5.86,0,0,1,2.34-.47,6.16,6.16,0,0,1,6.18,6.17A3.44,3.44,0,0,1,134,126.44Z"]]],"g":[[204.21,79.79,37.6,51.72,"#0a5baa","M204.21,124.34,211,116.1c3.49,3,8.11,5.09,12.06,5.09,4.43,0,6.5-1.67,6.5-4.35,0-2.88-2.74-3.82-7-5.63l-6.37-2.68c-5.22-2.08-10.11-6.43-10.11-13.67,0-8.37,7.5-15.07,18.09-15.07a23.2,23.2,0,0,1,16.21,6.56l-6,7.51c-3.29-2.48-6.37-3.82-10.25-3.82-3.69,0-5.9,1.47-5.9,4.08,0,2.82,3.08,3.89,7.5,5.63l6.24,2.48c6.16,2.48,9.84,6.63,9.84,13.67,0,8.31-7,15.61-19,15.61A27.89,27.89,0,0,1,204.21,124.34Z"],[253.19,80.64,39,49.93,"#0a5baa","M266.65,90.64H253.19v-10h39v10H278.65v39.93h-12Z"],[308,80.66,40.2,50.85,"#0a5baa","M308,107.12V80.66h11.93V108.4c0,9.44,2.81,12.79,8.31,12.79s8.44-3.35,8.44-12.79V80.66h11.52v26.46c0,16.82-6.7,24.39-20,24.39S308,123.94,308,107.12Z"],[363.8,79.79,37.64,51.72,"#0a5baa","M363.8,124.34l6.84-8.24c3.48,3,8.1,5.09,12.06,5.09,4.42,0,6.5-1.67,6.5-4.35,0-2.88-2.75-3.82-7-5.63l-6.36-2.68c-5.23-2.08-10.12-6.43-10.12-13.67,0-8.37,7.5-15.07,18.09-15.07A23.2,23.2,0,0,1,400,86.35l-6,7.51c-3.28-2.48-6.36-3.82-10.25-3.82-3.68,0-5.9,1.47-5.9,4.08,0,2.82,3.09,3.89,7.51,5.63l6.23,2.48c6.16,2.48,9.85,6.63,9.85,13.67,0,8.31-7,15.61-19,15.61A27.89,27.89,0,0,1,363.8,124.34Z"],[412.78,80.64,39,49.93,"#0a5baa","M426.25,90.64H412.78v-10h39v10H438.24v39.93h-12Z"],[462.9,79.79,37.66,51.72,"#113865","M462.9,124.34l6.83-8.24c3.48,3,8.11,5.09,12.06,5.09,4.42,0,6.5-1.67,6.5-4.35,0-2.88-2.75-3.82-7-5.63l-6.36-2.68c-5.23-2.08-10.12-6.43-10.12-13.67,0-8.37,7.51-15.07,18.09-15.07a23.22,23.22,0,0,1,16.22,6.56l-6,7.51c-3.28-2.48-6.36-3.82-10.25-3.82-3.68,0-5.89,1.47-5.89,4.08,0,2.82,3.08,3.89,7.5,5.63l6.23,2.48c6.17,2.48,9.85,6.63,9.85,13.67,0,8.31-7,15.61-19,15.61A27.87,27.87,0,0,1,462.9,124.34Z"],[510.94,80.66,45.29,49.91,"#113865","M526.41,80.66h14.34l15.48,49.91h-12.6l-2.88-11.45H526l-2.88,11.45H510.94Zm1.88,29.21h10.18l-1.07-4.22c-1.34-5-2.61-10.92-3.95-16h-.27c-1.21,5.22-2.55,11-3.82,16Z"],[203,142.82,40.31,42.18,"#0a5baa","M226.13,151.35v3.42h15.46v24.76c0,2.64-.64,3.87-2.51,4.65s-4.51.77-8.16.77a19,19,0,0,0-1.78-4.6c2.24.13,5.06.13,5.79.09s1-.23,1-1V159.74H219.07a24.92,24.92,0,0,1,2.55,4.88l-3.47,1.14H225l-.32-.1a32.83,32.83,0,0,0,2.78-5.88l4.56,1.28c-1,1.69-1.87,3.33-2.73,4.7h3.92V170h-7.71v3h8.71v4.33h-8.71v6.48h-5.11v-6.48H212V173h8.39v-3H213v-4.24h4a29.25,29.25,0,0,0-2.23-4.79l4.15-1.23h-8.66V185H204.7V154.77h15.51v-3.42H203v-5.06h17.24v-3.47h5.92v3.47h17.15v5.06Z"],[256.45,142.5,40.35,41.63,"#0a5baa","M296.8,144.78v3.33H279.16v1.51h13.95v3.14h-33v-3.14h13.54v-1.51H256.45v-3.33h17.24V142.5h5.47v2.28Zm-17.64,35.7h17.37v3.65H256.77v-3.65h16.92V179h-12.5v-3.19h12.5v-1.32c-7.8.18-9.17.32-10.17.64-.18-.73-.73-2.42-1.09-3.38a10.5,10.5,0,0,0,2.37-.59,26.81,26.81,0,0,0,3.1-1.32h-6.2v-.73H257v-6.84h39.31v6.84h-5.11v-3.47H261.79V167H291v2.87h-3.24a42.32,42.32,0,0,1,5.06,3.51l-3,2.46h2.69V179H279.16Zm12.54-26.4V161H261.79v-6.89Zm-5.34,2.65h-19.6v1.59h19.6Zm-12.58,13.13c-1,.64-2,1.23-3.06,1.73l12.5-.18c-.87-.5-1.74-1-2.47-1.37l.23-.18Zm5.38,6h10.21c-.55-.5-1.28-1.09-2.05-1.68l-8.16.22Z"],[308.22,142.5,43.34,42.6,"#0a5baa","M323.7,171.59a48.94,48.94,0,0,0-2.73-5v18.51h-5.25V168.67a42.2,42.2,0,0,1-5,9,29.88,29.88,0,0,0-2.5-5.15c2.55-2.92,5.1-7.8,6.75-12.22h-6.16v-5.06h6.88v-5.15c-1.77.27-3.46.54-5.15.73a16.15,16.15,0,0,0-1.46-4.2,72.25,72.25,0,0,0,14.68-3.74l3.06,4.43A40.36,40.36,0,0,1,321,149v6.25h6v5.06h-6v.37c1.32,1.27,5.06,5.56,5.93,6.61Zm22.48,2V185h-5.33V174.51l-13.77,2.37-.87-5.15,14.64-2.51V142.5h5.33v25.81l4.51-.78.87,5.06Zm-11.44-6.34a41.61,41.61,0,0,0-7.25-7l3.46-3.1a39.89,39.89,0,0,1,7.48,6.61Zm1.18-12a34.09,34.09,0,0,0-6.79-6.84l3.56-3.1c2.46,1.87,5.65,4.56,7,6.56Z"],[362.46,142.55,42.22,42.45,"#0a5baa","M387.63,160.33c3,8.89,8.52,16,17.05,19.51a21.62,21.62,0,0,0-4,5.11c-8.26-3.88-13.55-10.53-17.1-19.33A31.4,31.4,0,0,1,366.52,185a16.16,16.16,0,0,0-4.06-4.61c10.44-4.65,14.77-12.22,16.55-20.06H363.32v-5.61h16.6c.46-4.28.41-8.43.46-12.17h5.92c0,3.74-.09,7.93-.54,12.17h17.91v5.61Z"],[416.21,142.73,41.22,42.28,"#1a264b","M457.43,176.74H440V180c0,2.41-.54,3.6-2.41,4.33s-4.38.68-7.8.68a17.61,17.61,0,0,0-1.64-4.56c2.14.09,4.88.09,5.56.05s1-.14,1-.69v-3.1H416.21v-4.28h18.47v-1.32a33.69,33.69,0,0,0,5-2.65H425.06v-3.78h19.83l1.14-.28,3.06,2.78a63.39,63.39,0,0,1-8.71,5.25h17.05Zm-35.24-8.57H417v-9.34h3.42l-.82-13.55a61.85,61.85,0,0,0,9.21-2.55l2.24,3.15a45.51,45.51,0,0,1-6.25,1.73l.09,1.32h5.79v3.38H425.1l.1,1.55h5.6v2.32a29.16,29.16,0,0,0,3.19-1.73c-.86-.55-1.73-1-2.55-1.51L434,150.8c.91.46,1.87,1,2.87,1.55a17.54,17.54,0,0,0,1.78-1.91l3.56,1.05a20.41,20.41,0,0,1-2.42,2.73,21.8,21.8,0,0,1,2.78,2.1l-2.73,2.37a31.81,31.81,0,0,0-2.65-2.24,33.27,33.27,0,0,1-3.69,2.38h14.77l.18-1.6H443v-3.37h5.7l.09-1.55h-5.56v-3.38H449l.09-1.5H443V144h11.4c-.23,4.79-.59,10.58-1,14.82h3.38v9.34h-5.38v-5.42H422.19Zm3.28-9.34h7.38a26.55,26.55,0,0,0-2.05-2.1v.5h-5.42Zm14.13-8.39a23.47,23.47,0,0,0-2.37-1.92,23.07,23.07,0,0,1-3.69,2.28,21.77,21.77,0,0,0-2.83-2.42,20.62,20.62,0,0,0,3.47-1.77c-.87-.5-1.64-1-2.47-1.37l2.42-2.1c.87.41,1.83.91,2.78,1.46a14.49,14.49,0,0,0,1.64-1.82l3.56,1.05a16.59,16.59,0,0,1-2.28,2.5c.91.64,1.73,1.28,2.37,1.83Z"],[468.97,142.58,41.94,41.23,"#1a264b","M510.91,178.48v5.33h-41v-5.33h17.6v-9.17H475.17v-5.24h12.35v-8h-9.44a37.22,37.22,0,0,1-4.24,6.62,42.89,42.89,0,0,0-4.87-3.24c3.55-3.83,6.52-10.12,8.07-16.32l5.6,1.23c-.64,2.19-1.36,4.33-2.14,6.43h7v-8.21h5.7v8.21h15.37V156H493.22v8h13.63v5.24H493.22v9.17Z"],[518.17,142.14,43.68,42.86,"#1a264b","M543.61,143.87l-.68.82c4.2,3.69,11.67,6.75,18.92,8.25a17.57,17.57,0,0,0-3.42,4.11c-.91-.23-1.87-.55-2.82-.82V168H523.92V156.5c-1,.32-1.92.64-2.83.91a22.81,22.81,0,0,0-2.92-4.15c8.39-2,16.55-5.83,20.66-11.12ZM554,155.63a49.91,49.91,0,0,1-6.2-2.78V154h-16v-.91a53.07,53.07,0,0,1-5.52,2.5Zm-27.49,13.86h26.81v15.42h-5.56v-1.1H531.81V185h-5.34Zm5.15-4.78a17.51,17.51,0,0,0-1.55-4.74l3.51-1h-5.15v5.75Zm.19,8.34v1.82h15.91v-1.82Zm15.91,7.2v-1.82H531.81v1.82ZM537.37,159h-3.56a20.9,20.9,0,0,1,1.83,4.84l-2.92.91h4.65Zm6.56-8.43a44.93,44.93,0,0,1-3.83-3c-1.18,1-2.5,2-3.87,3ZM541.75,159v5.75H546l-2.74-.78a35.27,35.27,0,0,0,1.78-5Zm9,0H546l3.56.87c-.91,1.82-1.78,3.6-2.51,4.88h3.69Z"]]};
/* 開場動畫：標誌兩塊從左上、右下合進來，接著英文字一個一個彈出、中文字一個一個由下滑入。
   一律 Web Animations、只動 transform／opacity（交給合成執行緒，後面的 script 在跑時也不會卡）；減少動態時不動。
   boot.js 的 splashOut 會等這些動畫真的播完（最多 3.5 秒）才轉場進看板 */
function splashPlay(){
  const sp=document.getElementById("splash");if(!sp||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const O="cubic-bezier(.2,.9,.25,1)",SPR="cubic-bezier(.3,1.35,.45,1)";
  const y=sp.querySelector(".sp-y"),b=sp.querySelector(".sp-b");
  y.animate([{opacity:0,transform:"translate(-30%,-14%) scale(.72) rotate(-8deg)"},{opacity:1,offset:.4},{opacity:1,transform:"none"}],{duration:820,easing:SPR,fill:"backwards"});
  b.animate([{opacity:0,transform:"translate(30%,14%) scale(.72) rotate(8deg)"},{opacity:1,offset:.4},{opacity:1,transform:"none"}],{duration:820,delay:110,easing:SPR,fill:"backwards"});
  sp.querySelectorAll(".sp-g.en").forEach((g,i)=>g.animate([{opacity:0,transform:"translateY(45%) scale(.6)"},{opacity:1,transform:"none"}],{duration:520,delay:380+i*55,easing:SPR,fill:"backwards"}));
  sp.querySelectorAll(".sp-g.zh").forEach((g,i)=>g.animate([{opacity:0,transform:"translateY(60%)"},{opacity:1,transform:"none"}],{duration:560,delay:640+i*70,easing:O,fill:"backwards"}));
}
(function mountShell(){
  if(!document.getElementById("pager"))document.body.insertAdjacentHTML("afterbegin",SHELL_HTML);
  /* 開頁的學生會進場畫面：從網站外面進來（或重新整理）才放，站內切換部門／總覽有換頁動畫就不放。
     白底（不跟深淺色），整個學生會 logo（標誌＋STUSTSA＋南臺科大學生會，見 SU_LOGO）照原檔排版，動畫見 splashPlay。
     蓋住讀資料、讀字型那一下卡頓；boot.js 等動畫播完、資料好了才收掉 */
  let inSite=false;try{inSite=!!document.referrer&&new URL(document.referrer).origin===location.origin&&performance.getEntriesByType("navigation")[0]?.type!=="reload"}catch(_){}
  if(!inSite&&!document.getElementById("splash")){
    const [VX,VY,VW,VH]=SU_LOGO.box,pc=(v,o,t)=>((v-o)/t*100).toFixed(3)+"%";
    const piece=(x,y,w,h,inner,cls)=>`<svg class="${cls}" viewBox="${x} ${y} ${w} ${h}" style="left:${pc(x,VX,VW)};top:${pc(y,VY,VH)};width:${(w/VW*100).toFixed(3)}%;height:${(h/VH*100).toFixed(3)}%" aria-hidden="true">${inner}</svg>`;
    const [ex,ey,ew,eh,ep]=SU_LOGO.emb;
    document.body.insertAdjacentHTML("afterbegin",`<div class="splash" id="splash" aria-hidden="true"><div class="sp-logo" role="img" aria-label="南臺科大學生會 STUSTSA">
      ${piece(ex,ey,ew,eh,ep.map(([c,d],i)=>`<path class="${i?"sp-b":"sp-y"}" fill="${c}" d="${d}"/>`).join(""),"sp-emb")}
      ${SU_LOGO.g.map(([x,y,w,h,c,d],i)=>piece(x,y,w,h,`<path fill="${c}" d="${d}"/>`,"sp-g "+(i<7?"en":"zh"))).join("")}</div></div>`);
    splashPlay();
  }
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
