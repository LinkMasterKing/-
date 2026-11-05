# 學生會工作看板：給 Claude Code 的規則

每次開始工作前，先讀 `docs/交接說明.md`（現況、程式結構、資料、待辦）和 `docs/DESIGN.md`（設計規格）。
這兩份是從 claude.ai 對話交接過來的。裡面提到「交接包、zip、免資料夾、flat.py、上傳」的地方，都以這份 CLAUDE.md 為準（見「交付方式」）。

## 這是什麼
- 南臺科大學生會各部門的工作看板，純前端（HTML／CSS／一般 script），放在 GitHub Pages：https://linkmasterking.github.io/-/
- 使用者是權益部幹部，用繁體中文溝通。回覆一律繁體中文，不要 emoji。

## 絕對不要做的事
1. **不要修改、刪除、搬動任何 `data.json`、`data-*.json`，也不要動 `archive/`。** 這些是各部門的正式資料，看板本身會用 GitHub API 直接寫進 main。你的分支只要碰到它們，合併時就可能蓋掉別人剛存的資料。
2. **不要索取、讀取、印出 GitHub 權杖**，也不要寫任何會把權杖顯示在畫面或 console 的程式。帳號登入、兩步驟驗證、產生權杖一律由使用者自己操作。
3. 不要直接推到 main。一律開新分支、發 pull request，由使用者看過再合併（main 一合併，GitHub Pages 就上線）。
4. 不要新增伺服器、資料庫、付費服務或建置工具（npm 套件、打包器）。網站要能直接被 GitHub Pages 原樣提供。

## 程式結構（根目錄就是網站）
- `index.html`（看板殼）、`home.html`（各部門總覽）、`manifest.webmanifest`、`sw.js`
- `core/board.css`、`core/js/*.js`（一般 script，共用全域變數，載入順序見 index.html）
- `dept/config.js`（部門設定）、`dept/icons/`、`dept/cover.png`
- `docs/`：交接說明、設計規格
- `tools/tests/`：Playwright 測試；`assets/`：使用者提供的原始素材（學生會 logo）
- 以前因為 GitHub 網頁上傳不能傳資料夾，才有「免資料夾版本」（`core-xxx.js`）和 `flat.py`。改用 git 之後不再需要，不要再產生那種檔名。

## 開發規則（跟交接說明第九節相同，這裡是重點）
- 現有資料檔要能直接讀；改資料結構一定要加 schemaVersion 與自動遷移（`core/js/state.js` 的 migrations）。
- 改在源頭，不在檔案後面疊覆寫；不新增 `!important`；同一個元件的樣式（含手機、深色、列印）集中在 `board.css` 同一段並加註解標題。只能靠疊補丁完成的修改，先停下來提出整理方案。
- 只做被要求的事；看到可以改善的列在回覆最後。新增功能、顯示模式、設定項、儲存方式前先問。涉及資料儲存或公開發布，先說明存在哪裡、誰看得到。
- 修改前對照 `docs/DESIGN.md`；要求跟規格衝突時指出來，問要改規格還是改要求。
- 使用者偏好：不要原生下拉、勾選外觀（用自製的 `.csel`、`.fld-check`）；互動要有過渡動畫；回報要直接、具體。
- 使用者列需求時可能標「錯」（bug）、「定」（決定要做）、「想」（還在想）；只有「錯」「定」可以實作，「想」只討論，沒標的先問。

## 測試
- 準備：把整個 repo 複製到暫存資料夾，放一份 `tools/tests/data_test.json`（或 `data_v5.json`）改名成 `data.json`，在那裡開 `python3 -m http.server 8300`。伺服器要在同一個指令裡開（背景執行容易在指令之間被關掉，可用 `setsid nohup ... &`）。
- 在 `tools/tests/` 執行 `node xxx.js`（Playwright＋Chromium）。各測試的用途見 `docs/交接說明.md` 第七節與各節的「測試」。
- Google Fonts、GitHub API 在測試裡用 route 模擬，不要真的連 GitHub 寫資料。
- 只跑跟這次修改有關的測試；視覺效果由使用者自己看。
- 測試產生的截圖、PDF、報告檔不要 commit（`.gitignore` 已排除）。

## 交付方式（取代交接說明裡的 zip 流程）
- 一批相關的修改＝一個分支＋一個 pull request。分支名稱用英文短描述（例如 `opening-animation`）。
- 修改完要同步更新 `docs/交接說明.md`（功能、資料欄位、待辦）與 `docs/DESIGN.md`（設計規則），跟程式在同一個 PR。
- PR 說明與最後的回覆用三到五行回報：改了哪些檔案、哪些區塊；有沒有動到沒提到的地方；使用者應該檢查哪些畫面（手機寬度、深色模式、編輯中等）。
- 同一個區塊在這次工作裡改超過三次，要主動提醒，建議先整理。
- 合併後網站約一兩分鐘更新；使用者要在手機與電腦各看一次。出問題就在 GitHub 上把那個 PR revert。
