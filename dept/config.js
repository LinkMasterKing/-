/* =========================================================
   部門設定檔（所有部門都在這裡；換 logo 放 dept/icons 與 index.html 的範本）
   ※ 這裡不放任何密碼或權杖。
   ========================================================= */
/* 共用設定（各部門相同的部分） */
const BOARD_BASE = {

  // 新增議題時預設的階段標籤
  stageTags: ["收案", "處理中", "待回覆", "結案"],

  // 重點色：accentLight 淺色模式紅、accentDark 深色模式紅、ok 進度≥50% 綠、neon 每週概述按鈕螢光綠、okDot 完成燈號
  colors: { accentLight: "#e0342a", accentDark: "#ff5a4e", ok: "#3ccf7f", neon: "#00ff6a", okDot: "#2bff88" },

  // 啟用的區塊（false = 隱藏）
  sections: { live: true, timeline: true, cards: true, done: true, weekly: true, simple: true },

  // 學年：label 顯示文字、start 開學日（用來算「開學第幾週」）、end 學年結束日（第三階段學期歸檔會用到）
  term: { label: "115學年", start: "2026-09-07", end: "2027-07-31" },

  // 資料位置：owner/repo 留空＝自動從 github.io 網址判斷；path 是資料檔、page 是網頁檔（分享預覽會改它）
  data: { owner: "", repo: "", branch: "main", path: "data.json", page: "index.html" },

  // 每週回報期限：即時回報依這一天判斷狀態顏色（0＝週日、1＝週一、2＝週二…6＝週六）
  //   綠＝期限前有更新；白＝這週完成過一段，或期限過後才補更新；紅＝期限前後都沒更新
  week: { cutoff: 2 },

  // 預留：之後的通知功能（目前沒有作用）
  notify: { url: "" }
};

/* ---------------------------------------------------------
   各部門（目前全部放在同一個網站／repo，之後再拆）
   網址加 ?d=代號 開那個部門，例如 …/?d=marketing；沒加就是權益部。
   每個部門的資料是 repo 根目錄下自己的檔案（權益部沿用 data.json）。
   logo:false＝頁首先用文字代替 logo；follow:true＝有「追蹤」面板（會長室）；meeting:true＝有「會議報告事項」與「會議編輯」面板（秘書處）；grant:true＝開放秘書處會議編輯的開關（會長室）
   test:true＝測試用部門（2026-11-06 水果部）：不出現在總覽、各部門彙整（window.BOARD_DEPTS 不含它），只能用網址 ?d=代號 進去；
     後台管理員可以在設定 → 網站管理「重置」它（回到剛開通的狀態，provision.js 的 pvReset）
   ext:"名稱"＝多一個分頁放這個部門專用的功能（2026-11-06：會長室「會長室」＝文件、會議開關、追蹤、編輯量；秘書處「會議」＝逐部門編輯報告事項、會議紀錄、各部門週報）；
   extIcon＝那個分頁的圖示；mergeDone:true＝完成紀錄併進「即時回報」那一頁（不另外佔一個分頁）
   --------------------------------------------------------- */
const BOARD_DEPTS = [
  { id: "rights",      name: "權益部", path: "data.json", boardId: "board-main", logo: true },
  { id: "president",   name: "會長室", follow: true, grant: true, ext: "會長室", extIcon: "flag", mergeDone: true },
  { id: "secretariat", name: "秘書處", meeting: true, ext: "會議", extIcon: "calendar", mergeDone: true },
  { id: "marketing",   name: "行銷部" },
  { id: "finance",     name: "財務部" },
  { id: "events",      name: "活動部" },
  { id: "affairs",     name: "社務部" },
  { id: "pr",          name: "公關部" },
  { id: "works",       name: "工務部" },
  { id: "fruit",       name: "水果部", test: true },
].map(d => ({ path: `data-${d.id}.json`, boardId: `board-${d.id}`, logo: false, follow: false, meeting: false, grant: false, test: false, ext: "", extIcon: "", mergeDone: false, ...d }));

(() => {
  const q = new URLSearchParams(location.search).get("d") || "rights";
  const d = BOARD_DEPTS.find(x => x.id === q) || BOARD_DEPTS[0];
  const org = "南臺科技大學學生會";
  window.BOARD_DEPTS = BOARD_DEPTS.filter(x => !x.test);   /* 總覽、各部門彙整用（不含測試部門）；開通、重置用完整的 BOARD_DEPTS */
  window.BOARD_CONFIG = {
    ...BOARD_BASE,
    deptId: d.id,
    boardId: d.boardId,                       // 本機暫存用的代號（每個部門不同）
    title: `${d.name}工作進度`,               // 看板預設名稱（資料裡已有名稱時以資料為準）
    brand: org + d.name,                      // logo 的無障礙名稱
    dept: { name: d.name, org },
    logo: d.logo,
    follow: d.follow,
    meeting: d.meeting,
    grant: d.grant,
    ext: d.ext, extIcon: d.extIcon, mergeDone: d.mergeDone,                           // true＝看板上有「開放秘書處會議編輯」開關（會長室）                       // true＝秘書處的「會議報告事項」面板（core/js/meeting.js）
    data: { ...BOARD_BASE.data, path: d.path },
  };
})();

