/* =========================================================
   部門設定檔（換部門時只要改這個檔案＋logo）
   ※ 這裡不放任何密碼或權杖。
   ========================================================= */
window.BOARD_CONFIG = {
  boardId: "board-main",                 // 本機暫存用的代號（不同部門請用不同代號）
  title: "權益部工作進度",                // 看板預設名稱（資料裡已有名稱時以資料為準）
  brand: "南臺科技大學學生會權益部",       // logo 的無障礙名稱
  dept: { name: "權益部", org: "南臺科技大學學生會" },

  // 新增議題時預設的階段標籤
  stageTags: ["收案", "處理中", "待回覆", "結案"],

  // 重點色：accentLight 淺色模式紅、accentDark 深色模式紅、ok 進度≥50% 綠、neon 每週概述按鈕螢光綠、okDot 完成燈號
  colors: { accentLight: "#e0342a", accentDark: "#ff5a4e", ok: "#3ccf7f", neon: "#00ff6a", okDot: "#2bff88" },

  // 啟用的區塊（false = 隱藏）
  sections: { live: true, timeline: true, cards: true, done: true, weekly: true, simple: true, animation: true },

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
