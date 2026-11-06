/* 核心｜安裝成 App（2026-11-06 使用者：安裝後打開預設是總覽頁）
   全會共用一個 App：每一頁（各部門看板、總覽 home.html）都連到根目錄的 manifest.webmanifest（名稱「學生會工作看板」、start_url＝home.html），
   在哪一頁按「安裝」／「加入主畫面」，裝起來都是同一個，打開是總覽，從總覽選部門進看板。
   以前每個部門各一個 App、打開時回到上次停的部門與區塊（localStorage「board-app:last:…」）：這一套拿掉了，不然在總覽選了部門會被跳回上次的部門。
   dept/app/*.webmanifest 留著給已經裝過的舊 App 讀（start_url 也改成總覽），新安裝不會再用到。
   這個檔在 dept/config.js 前面載入。 */
let appStartSec="";   /* render.js 的 curSec 初始值會讀它；現在都從第一個區塊開始 */
try{localStorage.removeItem("board-app:last:");Object.keys(localStorage).filter(k=>k.startsWith("board-app:last:")).forEach(k=>localStorage.removeItem(k));sessionStorage.removeItem("board-app:id")}catch(_){}   /* 清掉舊版記的位置 */
