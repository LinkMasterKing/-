/* 畫面骨架：核心程式的 HTML 結構。部門資訊（logo、名稱）由 dept/ 提供，這裡不寫死任何部門。 */
const SHELL_IDS=["pager","weekWrap","importFile","dlg","toast","splash"];
const SHELL_HTML=`<div class="pager" id="pager">
  <!-- main page -->
  <div class="page page-main" id="pageMain">
    <div class="wrap">
      <header class="hero">
        <a class="logo-box" href="home.html" title="各部門總覽"></a>
        <div class="hero-find">
          <label class="hero-search"><svg class="hs-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.6 15.6 4.4 4.4"/></svg><input id="boardQ" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" aria-label="搜尋這個看板" aria-controls="boardRes"><button type="button" class="hq-clear" aria-label="清除搜尋"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></label>
          <div class="hero-res glass" id="boardRes" role="listbox" aria-label="搜尋結果" hidden></div>
        </div>
        <button type="button" class="noti-btn" id="notiBtn" aria-label="通知" title="今日／明日要處理的事、行事曆"><svg class="ico solo" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g class="i-bell"><path d="M6.2 16.4V11a5.8 5.8 0 0 1 11.6 0v5.4l1.6 1.8H4.6z"/><path d="M10.2 20.4a2 2 0 0 0 3.6 0"/></g></svg><span class="noti-n num" hidden></span></button>
      </header>
      <div class="hero-rule"><span class="hero-info"><span class="sub sr-only" id="saveInfo" role="status"></span></span><span class="actions"><span class="hero-btns" id="actions"></span></span></div>

      <!-- 會長室：文件連結（follow.js 的 renderDocs）。會長自己新增的超連結按鈕，點了用新分頁打開 -->
      <section class="panel docs-panel" id="docsPanel" data-edbox="s:docs" aria-labelledby="dcH" hidden>
        <div class="panel-head"><h2 id="dcH">文件<span class="en">DOCS</span></h2><button type="button" class="icon card-edit-btn" data-edit="s:docs">編輯</button></div>
        <div class="docs" id="docsList" data-flip></div>
        <button class="ghost edit-only add-row" id="addDoc">+ 新增文件</button>
      </section>
      <!-- 會長室：秘書處會議編輯的開關（2026-11-06 使用者：不用這麼大，小小一個開關） -->
      <section class="panel grant-panel" id="grantPanel" hidden>
        <div class="grant-row"><span class="grant-l" id="grH">秘書處會議編輯</span><button type="button" class="sw" id="grantSw" role="switch" aria-checked="false" aria-labelledby="grH"><i aria-hidden="true"></i></button><p class="sub grant-st" id="grantSt"></p></div>
      </section>
      <section class="panel act-panel" id="actPanel" aria-labelledby="acH" hidden>
        <div class="panel-head"><h2 id="acH">各部門編輯量<span class="en">ACTIVITY</span></h2><button type="button" class="icon" id="actRefresh">重新整理</button></div>
        <p class="sub ac-info" id="actInfo"></p>
        <div class="ac-chart" id="actChart"></div>
        <div class="ac-legend" id="actLegend"></div>
      </section>
      <section class="panel follow-panel" id="followPanel" data-edbox="s:follow" aria-labelledby="fwH" hidden>
        <div class="panel-head"><h2 id="fwH">追蹤<span class="en">FOLLOW</span></h2><button type="button" class="icon card-edit-btn" data-edit="s:follow">編輯</button></div>
        <div class="follows" id="follows" data-flip></div>
        <button class="ghost edit-only add-row" id="addFollow">+ 追蹤項目</button>
      </section>
      <section class="panel follow-panel meet-panel" id="meetPanel" aria-labelledby="mtH" hidden>
        <div class="panel-head"><h2 id="mtH">會議報告事項<span class="en">MEETING</span></h2><button type="button" class="icon" data-mtrefresh>重新整理</button></div>
        <div class="mt-depts" id="meetList" data-flip></div>
      </section>
      <section class="panel follow-panel meet-panel wk-panel" id="wkPanel" aria-labelledby="wkH" hidden>
        <div class="panel-head"><h2 id="wkH">各部門週報<span class="en">WEEKLY</span></h2><button type="button" class="icon" data-mtrefresh>擷取最新</button></div>
        <div class="wk-depts" id="wkDepts" role="tablist" aria-label="部門"></div>
        <div class="wk-body" id="wkBody" data-flow></div>
      </section>
      <section class="panel follow-panel meet-panel meet-edit" id="meetEdPanel" data-edbox="s:meetedit" aria-labelledby="meH" hidden>
        <div class="panel-head"><h2 id="meH">會議編輯<span class="en">EDIT</span></h2><button type="button" class="icon" data-mtrefresh>重新整理</button><button type="button" class="icon card-edit-btn" data-edit="s:meetedit" hidden>編輯</button></div>
        <p class="sub grant-st" id="meetEdSt"></p>
        <div class="mt-depts" id="meetEdList" data-flip></div>
      </section>
      <div class="layout">
        <div class="sgroup" data-sec="live">
          <section class="panel" id="livePanel" aria-labelledby="evH">
            <div class="panel-head"><h2 id="evH">即時回報<span class="en">LIVE</span></h2></div>
            <div class="md" id="liveMD"><div class="ev-zones" id="events" data-flip></div><div class="md-pane" id="evDetail" hidden></div></div>
          </section>
        </div>

        <div class="sgroup" data-sec="progress">
          <!-- 進度：甘特圖與個別議題合成一張卡片。預設看甘特圖；點議題列換成該議題的詳情，按返回回到甘特圖（views.js 的 progShow） -->
          <section class="panel" id="progPanel" aria-labelledby="ganttH">
            <div class="panel-head"><h2 id="ganttH">時間甘特圖<span class="en">TIMELINE</span></h2><button type="button" class="icon card-edit-btn" id="ganttEdBtn" data-edit="s:gantt" aria-label="編輯甘特圖時間軸">編輯</button></div>
            <div class="pv-page" id="pvGantt" data-edbox="s:gantt">
            <div class="g-term lseg" id="gTerm" role="tablist" aria-label="甘特圖範圍"><span class="lseg-lens" aria-hidden="true"></span><button type="button" role="tab" data-k="all" aria-selected="true">全部</button><button type="button" role="tab" data-k="up" aria-selected="false">上學期</button><button type="button" role="tab" data-k="down" aria-selected="false">下學期</button></div>
            <div class="legend" aria-label="圖例"><span><i class="lg-tk now" aria-hidden="true"></i>今天</span><span><i class="lg-tk on" aria-hidden="true"></i>已過時程</span><span><i class="lg-tk in" aria-hidden="true"></i>剩餘時程</span><span class="lg-hint">點議題列看詳情 · 左右滑動瀏覽月份</span></div>
            <div class="range">時間軸 <input type="month" id="rStart" aria-label="起始月份"> 到 <input type="month" id="rEnd" aria-label="結束月份"> <button class="icon" id="autoRange">依議題自動調整</button></div>
            <div class="gantt" id="gantt" data-flip></div>
            <button class="ghost auth-only add-row" id="addIssue">+ 新增議題</button>
            </div>
            <div class="pv-page" id="pvDetail" hidden>
              <button type="button" class="pv-back" id="pvBack">返回甘特圖</button>
              <div id="cardDetail"></div>
            </div>
          </section>
        </div>

        <div class="sgroup" data-sec="done">
          <aside class="panel" id="donePanel" aria-labelledby="doneH">
            <div class="panel-head"><h2 id="doneH">完成紀錄<span class="en">DONE</span><span class="count" id="doneCount">0</span></h2></div>
            <div class="md" id="doneMD"><div class="events scroll" id="doneList" data-flip></div><div class="md-pane" id="doneDetail" hidden></div></div>
          </aside>
        </div>
      </div>
    </div>
  </div>

</div>

  <!-- 每週概述（2026-11-06 起是設定裡的一頁：weekly.js 的 weekPane 打開時搬進設定的右側面板／手機子頁，平常藏在這裡） -->
    <div class="week-wrap" id="weekWrap" role="region" aria-labelledby="weekH" hidden>
      <div class="week-top">
        <button class="icon" id="backMain" aria-label="回到「報告」"><svg class="ico" viewBox="0 0 8 14" width="7" height="12" aria-hidden="true"><path d="M6.5 1.5 1.5 7l5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>返回</span></button>
        <h2 id="weekH">每週概述</h2>
        <a class="week-sec" id="weekSecLink" href="?d=secretariat" title="秘書處可以調閱各部門的週報">秘書處調閱 →</a>
        <button class="gen-btn" id="genWeek"><svg class="spark" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M10 3l1.9 5.1L17 10l-5.1 1.9L10 17l-1.9-5.1L3 10l5.1-1.9z"/><path fill="currentColor" d="M18.5 2l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/><path fill="currentColor" d="M18 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/></svg>生成週報</button>
        <button class="ghost auth-only" id="addWeek">+ 新增週報</button>
      </div>
      <div id="weekList" data-flip></div>
    </div>



<input type="file" id="importFile" accept=".html,.htm,.json" hidden>
<dialog id="dlg"><form method="dialog" id="dlgForm"></form></dialog>
<div class="toast" id="toast" role="status"></div>
`;
/* 頁首學生會 logo：同一份 SU_LOGO 路徑。淺色模式用原檔的彩色（2026-11-06 使用者）；深色模式全部填文字色（board.css「頁首」段蓋掉 fill）。
   深色時標誌黃藍兩塊同色會黏成一團，所以藍色那塊的外框先描一圈底色（--bg）當分隔縫（.logo-gap，只在深色顯示），再疊上藍色本體；
   描邊只描外框那一段路徑（不含眼睛的洞），眼睛才不會被描大；
   描邊是整圈（2026-11-06 使用者：只描黃色範圍裡的半圈會在邊緣變細收尾，要就整圈）；外圍那段跟底色同色，看不見 */
function suLogoMono(label){
  const [VX,VY,VW,VH]=SU_LOGO.box,[,,,,[[cy,dy],[cb,db]]]=SU_LOGO.emb,outer=db.slice(0,db.indexOf("Z")+1);
  return `<svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="${VX} ${VY} ${VW} ${VH}" role="img" aria-label="${label}"><g>
    <path fill="${cy}" d="${dy}"/><path class="logo-gap" d="${outer}"/><path fill="${cb}" d="${db}"/>${SU_LOGO.g.map(g=>`<path fill="${g[4]}" d="${g[5]}"/>`).join("")}</g></svg>`;
}
/* 文件（工作報告）上的學生會 logo：一律原檔彩色、不跟深淺色（2026-11-06 使用者：logo 在文件上都用彩色）。
   class 不是 .logo，所以深色模式把 .logo 改成單色的規則不會套到；也不需要切割線（兩塊顏色本來就不同）。
   黑白列印用的單色線稿另外放在 assets/學生會logo-單色線稿.svg（使用者提供，目前沒有用到） */
function suLogoColor(label){
  const [VX,VY,VW,VH]=SU_LOGO.box,[,,,,[[cy,dy],[cb,db]]]=SU_LOGO.emb;
  return `<svg class="su-logo-c" xmlns="http://www.w3.org/2000/svg" viewBox="${VX} ${VY} ${VW} ${VH}" role="img" aria-label="${label}"><path fill="${cy}" d="${dy}"/><path fill="${cb}" d="${db}"/>${SU_LOGO.g.map(g=>`<path fill="${g[4]}" d="${g[5]}"/>`).join("")}</svg>`;
}
(function mountShell(){
  if(!document.getElementById("pager"))document.body.insertAdjacentHTML("afterbegin",SHELL_HTML);
  mountSplash();   /* 開頁的學生會進場畫面（core/js/splash.js，總覽頁也用同一份） */
  /* 頁首 logo：所有部門都放學生會 logo（標誌＋STUSTSA＋南臺科大學生會，見 suLogoMono），淺色彩色、深色單色跟著文字色 */
  const box=document.querySelector(".logo-box");
  if(box&&!box.firstElementChild)box.innerHTML=suLogoMono(CFG.brand||"南臺科大學生會");
  /* 部門主色 → CSS 變數（只覆寫設定檔有給的值） */
  const c=CFG.colors||{},map={accentLight:"--accent-light",accentDark:"--accent-dark",ok:"--ok",neon:"--neon",okDot:"--ok-dot"};
  const vars=Object.keys(map).filter(k=>c[k]).map(k=>`${map[k]}:${c[k]}`).join(";");
  if(vars&&!document.getElementById("dept-theme")){const st=document.createElement("style");st.id="dept-theme";st.textContent=`:root{${vars}}`;document.head.append(st)}
  /* 部門專用的分頁（CFG.ext）與完成紀錄併進即時回報（CFG.mergeDone），見 dept/config.js。
     會長室、秘書處的面板原本疊在三個區塊上面（2026-11-06 使用者：太臃腫），搬進自己的分頁 */
  const lay=document.querySelector(".layout");
  if(lay&&CFG.mergeDone){const g=lay.querySelector('.sgroup[data-sec="done"]'),l=lay.querySelector('.sgroup[data-sec="live"]');if(g&&l){while(g.firstChild)l.append(g.firstChild);g.remove()}}
  if(lay&&CFG.ext&&!lay.querySelector('.sgroup[data-sec="ext"]')){lay.insertAdjacentHTML("beforeend",'<div class="sgroup sgroup-ext" data-sec="ext"></div>');const x=lay.lastElementChild;
    ["#docsPanel","#grantPanel","#followPanel","#actPanel","#meetPanel","#meetEdPanel","#wkPanel"].forEach(q=>{const p=document.querySelector(q);if(p)x.append(p)})}
  /* 關閉的區塊 */
  Object.entries(CFG.sections).forEach(([k,on])=>document.body.classList.toggle("no-"+k,!on));
})();
