# 學生會工作看板：給 Claude Code 的規則

每次開始工作前，先讀 `docs/交接說明.md`（現況、程式結構、資料、待辦）和 `docs/DESIGN.md`（設計規格）；改版相關的工作再讀 `docs/upgrade-plan.md`（階段計畫）與 `docs/architecture/`（後端設計，入口 `README.md`）。
這兩份是從 claude.ai 對話交接過來的。裡面提到「交接包、zip、免資料夾、flat.py、上傳」的地方，都以這份 CLAUDE.md 為準（見「交付方式」）。

## 這是什麼
- 南臺科大學生會各部門的工作看板。靜態前端（HTML／CSS／一般 script）放在 GitHub Pages：https://linkmasterking.github.io/-/
- 改版中（已核准的架構，見 `docs/architecture/`）：登入與資料改用 Firebase（Authentication、Cloud Firestore、Security Rules），Spark 免費方案。授權一律由 Security Rules 判斷，前端只負責顯示。切換完成前，各部門仍讀寫 GitHub 上的 `data*.json`。
- 使用者是權益部幹部，用繁體中文溝通。回覆一律繁體中文，不要 emoji。

## 絕對不要做的事
1. **不要修改、刪除、搬動任何 `data.json`、`data-*.json`，也不要動 `archive/`。** 這些是各部門的正式資料，看板本身會用 GitHub API 直接寫進 main。你的分支只要碰到它們，合併時就可能蓋掉別人剛存的資料。切換到 Firestore 之後這些檔案是唯讀備份，仍然不要動。
2. **不要碰正式的 Firebase 資料**：不要對正式專案寫入、匯入、刪除或跑遷移。測試與演練一律用模擬器（Emulator Suite）；需要真實環境時只用開發專案，而且要使用者當次同意。
3. **不要索取、讀取、印出任何機密**：GitHub 權杖、服務帳戶金鑰、OAuth 用戶端密鑰、任何密碼；也不要寫會把它們顯示在畫面或 console 的程式。帳號登入、兩步驟驗證、產生或作廢權杖、主控台設定一律由使用者自己操作。Firebase 的網頁設定（apiKey、projectId 等）不是機密，可以進 repo。
4. 不要直接推到 main。一律開新分支、發 pull request，由使用者看過再合併（main 一合併，GitHub Pages 就上線）。
5. **不要擅自部署或改正式設定**：不執行 `firebase deploy`、不發布規則或索引到任何真的專案、不改 Firebase 主控台、GitHub Pages、repo 設定，也不移轉 repository。只有使用者在當次指示中明確要求時才做，而且先說明會影響什麼。
6. 不要新增 Firebase 以外的伺服器或資料庫；不啟用需要付費的功能（含 Cloud Functions、Blaze 方案），要用之前先問。網站本身不加打包器、不讓網頁載入 npm 套件，要能被 GitHub Pages 原樣提供；開發用工具（模擬器、規則測試、遷移程式）只放在 `backend/`，不被網頁載入。

## 程式結構（根目錄就是網站）
- `index.html`（看板殼）、`home.html`（各部門總覽）、`manifest.webmanifest`、`sw.js`
- `core/board.css`、`core/js/*.js`（一般 script，共用全域變數，載入順序見 index.html）
- `dept/config.js`（部門設定）、`dept/icons/`、`dept/cover.png`
- `docs/`：交接說明、設計規格、`upgrade-plan.md`（改版階段計畫）、`architecture/`（後端設計）
- `backend/`（01B 起）：`firestore.rules`、索引、模擬器設定、規則測試、遷移程式；只給開發用，網頁不載入
- `tools/tests/`：Playwright 測試；`assets/`：使用者提供的原始素材（學生會 logo）
- 以前因為 GitHub 網頁上傳不能傳資料夾，才有「免資料夾版本」（`core-xxx.js`）和 `flat.py`。改用 git 之後不再需要，不要再產生那種檔名。

## 開發規則（跟交接說明第九節相同，這裡是重點）
- 現有資料檔要能直接讀；改資料結構一定要加 schemaVersion 與自動遷移（`core/js/state.js` 的 migrations）。這條在切換完成前照舊。
- Firestore 的結構或權限變更：同時改規則、寫規則測試（含攻擊案例）、需要時寫遷移程式，並更新 `docs/architecture/`。規則一律預設拒絕。
- 改在源頭，不在檔案後面疊覆寫；不新增 `!important`；同一個元件的樣式（含手機、深色、列印）集中在 `board.css` 同一段並加註解標題。只能靠疊補丁完成的修改，先停下來提出整理方案。
- 只做被要求的事；看到可以改善的列在回覆最後。新增功能、顯示模式、設定項、儲存方式前先問。涉及資料儲存或公開發布，先說明存在哪裡、誰看得到。
- 修改前對照 `docs/DESIGN.md`；要求跟規格衝突時指出來，問要改規格還是改要求。
- 使用者偏好：不要原生下拉、勾選外觀（用自製的 `.csel`、`.fld-check`）；互動要有過渡動畫；回報要直接、具體。
- 使用者列需求時可能標「錯」（bug）、「定」（決定要做）、「想」（還在想）；只有「錯」「定」可以實作，「想」只討論，沒標的先問。

## 測試
- 準備：把整個 repo 複製到暫存資料夾，放一份 `tools/tests/data_test.json`（或 `data_v5.json`）改名成 `data.json`，在那裡開 `python3 -m http.server 8300`。伺服器要在同一個指令裡開（背景執行容易在指令之間被關掉，可用 `setsid nohup ... &`）。
- 在 `tools/tests/` 執行 `node xxx.js`（Playwright＋Chromium）。各測試的用途見 `docs/交接說明.md` 第七節與各節的「測試」。
- Google Fonts、GitHub API 在測試裡用 route 模擬，不要真的連 GitHub 寫資料。
- Firestore 與登入用 Firebase Emulator Suite；不連正式專案。規則測試放在 `backend/tests/`：`cd backend && npm install && npm test`（規則＋遷移）、`npm run test:web`（網頁的資料來源開關）。
- 只跑跟這次修改有關的測試；視覺效果由使用者自己看。
- 測試產生的截圖、PDF、報告檔不要 commit（`.gitignore` 已排除）。

## 改版階段工作原則（01A-R 起）
- 架構已在 01A＋01A-R 定案（`docs/architecture/README.md`「決策定案」）。之後照已核准的架構直接實作，不重新規劃、不重新設計整個系統、不再新增規劃子階段。
- 實作中發現的一般程式問題，在當前階段直接修正並測試。
- 只有會造成**權限繞過、敏感資料外洩、資料遺失或不可回復**的重大風險，才停下來請使用者決策。
- 非阻斷的設計改善與技術債，記在 `docs/architecture/README.md` 的待辦（或 `docs/交接說明.md` 第八節），不新增階段。
- 每個階段只做一次完整驗收；修正驗收發現的問題屬於同一階段，不另開新的階段名稱（例如不要再出現「01B-R」）。
- 少寫重複文件與架構討論，優先產出能測試的功能；文件只更新被改到的部分。

## 技術債清理（每個階段都要做）
- 每個階段結束前，檢查這次碰到的範圍（含被它取代的舊程式）裡的五類技術債：
  1. 重複實作：同一件事有兩份程式或兩段樣式。
  2. 廢棄函式：沒有任何地方呼叫的函式、全域變數、設定項。
  3. 事件監聽器：重複綁定、元件移除後沒解除、Firestore 監聽沒有 unsubscribe。
  4. CSS 覆寫：後面疊上去蓋前面的規則、同一元件的樣式散在多段、`!important`。
  5. 過時測試：測的是已經不存在或已改規格的行為。
- 只移除**確定**沒有引用、也沒有相容需求的程式：要用 `grep` 查過全部 HTML／JS／CSS（含 `home.html`、`sw.js` 快取清單、`tools/tests/`）；舊資料檔、舊網址、舊版本快取還會用到的相容程式要留著。不確定的只列出，不刪。
- 過時測試：先確認它在修改前就已經失敗或測的是舊規格，才刪或改；不能為了讓測試通過而刪測試。
- 清理跟功能修改分開 commit，方便單獨 revert。
- 交付時附「清理報告」（放在 PR 說明與 `docs/交接說明.md` 該階段那一節）：每一類各列「已移除（檔案、名稱、怎麼確認沒有引用）」、「保留（原因）」、「發現但沒處理（建議）」；沒有就寫「無」。

## 交付方式（取代交接說明裡的 zip 流程）
- 一批相關的修改＝一個分支＋一個 pull request。分支名稱用英文短描述（例如 `opening-animation`）。
- 修改完要同步更新 `docs/交接說明.md`（功能、資料欄位、待辦）與 `docs/DESIGN.md`（設計規則），後端相關再更新 `docs/architecture/`，跟程式在同一個 PR。
- PR 說明與最後的回覆用三到五行回報：改了哪些檔案、哪些區塊；有沒有動到沒提到的地方；使用者應該檢查哪些畫面（手機寬度、深色模式、編輯中等）。
- 同一個區塊在這次工作裡改超過三次，要主動提醒，建議先整理。
- 合併後網站約一兩分鐘更新；使用者要在手機與電腦各看一次。出問題就在 GitHub 上把那個 PR revert。
