# 後端資料架構（階段 01A）

- 產出日期：2026-11-11。分支 `claude/cool-ramanujan-qg4y8o`，疊在階段 00（[#52](https://github.com/LinkMasterKing/-/pull/52)，`docs/upgrade-plan.md`）之上。
- **01A-R（架構驗收修正）**：同日依審查意見補強，修改內容與待驗證項目見 [review-01A-R.md](review-01A-R.md)。
- 本階段只有設計文件：沒有改網站功能、沒有碰 `data*.json`、沒有建立 Firebase 專案、沒有開始 01B。
- 設計依據：`CLAUDE.md`、`docs/upgrade-plan.md`、使用者在 01A 指示的四項架構決定，以及對 `core/js/cloud.js`、`state.js` 與現有資料檔欄位的唯讀檢查。
- 注意：01A 指示要讀的 `stustsa-change-spec/CHANGE_SCOPE.md` 與 `stages/01A_backend_architecture.md` **不在 repo 的任何分支裡**（階段 00 時應該是另外提供的）。這次以階段 00 計畫第 7.3 節「01A」的產出與驗收清單代替。如果規格檔對 01A 有額外要求，請再提供，我會補上差異。

## 已採用的架構決定（使用者 01A 指示）

| # | 決定 | 在設計中的落點 |
|---|---|---|
| A1 | Firebase Spark 免費方案優先，不預設啟用 Cloud Functions | 全部權限靠 Security Rules＋交易／批次寫入；需要 Functions 的地方明確列出（[booking.md](booking.md) 第 6 節、[permissions.md](permissions.md) 第 6 節） |
| A2 | 部門名稱、公開活動免登入可看；內部看板資料要 Google 登入；一般使用者預設唯讀 | 分級 L0～L4，見 [permissions.md](permissions.md)。**這改掉了階段 00 第 5.2 節「看板內容維持公開」的建議** |
| A3 | Firebase 專案由學生會可交接的公用 Google 帳號持有；管理員 UID 在 02 配置 | 規則不寫死任何信箱或 UID；第一位總管理員由主控台手動建立，見 [invitations-roles-audit.md](invitations-roles-audit.md) 第 7 節 |
| A4 | 舊身分不自動取得權限；經會長室審核或 QR 邀請重新授權；保留原始歷史對照 | `legacyIdentities` 集合＋邀請／申請上的 `legacyRef`，見 [migration.md](migration.md) 第 4 節 |

## 文件清單

| 檔案 | 內容 |
|---|---|
| [data-model.md](data-model.md) | 集合、欄位、文件 ID、分級 |
| [indexes.md](indexes.md) | 查詢清單、複合索引、免索引欄位 |
| [permissions.md](permissions.md) | 資料分級、角色、權限矩陣、規則共用函式、一般資料的規則設計 |
| [invitations-roles-audit.md](invitations-roles-audit.md) | QR 邀請核銷、角色建立與撤銷、稽核紀錄鏈：規則設計與攻擊測試（階段 00 風險 2） |
| [booking.md](booking.md) | 會長預約：時段鎖、不同時長、部分重疊、併發：規則設計與攻擊測試（階段 00 風險 3） |
| [github-token-retirement.md](github-token-retirement.md) | GitHub 權杖的最早安全撤銷方案（階段 00 風險 1） |
| [migration.md](migration.md) | 欄位對照、遷移流程、凍結與切換、回復 |
| [verification.md](verification.md) | 已驗證／官方文件記載／待模擬器驗證的區分；01A 探針結果；01B 工作清單 |
| [github-ownership-migration.md](github-ownership-migration.md) | Repository 移轉到學生會 GitHub Organization（階段 11） |
| [review-01A-R.md](review-01A-R.md) | 01A-R 審查意見的處理、規格核對、仍待驗證項目、01B 前置條件 |

## 狀態標記

每個技術主張都標其中一種：

| 標記 | 意思 |
|---|---|
| 〔已驗證〕 | 01A 在本機 Firestore 模擬器用探針實際跑過（結果見 [verification.md](verification.md) 第 2 節）。探針是拋棄式程式，放在暫存資料夾，沒有進 repo |
| 〔文件〕 | 官方文件明載，但這次沒有實測（這個雲端環境連不到 firebase.google.com，數字以搜尋到的官方頁摘要為準，02 前要你在主控台或官方頁再看一次） |
| 〔待驗證〕 | 本文件的設計，01B 要寫成正式規則並用模擬器測試 |
| 〔推論〕 | 依經驗判斷，沒有文件或測試支持 |
| 〔待核准〕 | 01A-R 的規劃，**你核准前不寫進正式規則**（目前只有「已授權檢視者」與 D12～D15） |

## 與階段 00 計畫的差異（修正）

1. **資料分級**：看板內容從「L0 公開」改成「L1 登入可讀」（決定 A2）。公開的只剩部門名稱與標成公開的活動。
2. **GitHub 權杖**：不再「留到最後」。改成三段式：現在就降低風險並加上到期日、第 02 階段驗收後逐部門切換、最後一個部門切換後 3 個工作天內作廢。見 [github-token-retirement.md](github-token-retirement.md)。
3. **QR 邀請**：邀請文件 ID 改成「權杖的 SHA-256」，規則要求核銷者提出原始權杖；角色變更與稽核紀錄用「版本號鏈」綁在同一批寫入，不能略過、不能補寫、不能改。
4. **預約**：不只靠「規則檢查重疊」，而是靠「固定格線時段鎖文件的唯一性＋原子批次寫入」，規則只負責強制「預約一定要鎖住它涵蓋的每一格」。並列出規則做不到、需要人工或 Functions 的情況。
5. **稽核紀錄**：與 `roleEvents` 合併成一個 `auditLogs`，用「集合＿文件＿版本號」決定性 ID。
6. **文件 ID**：遷移的文件 ID 一律加部門前綴（`{deptId}__{舊ID}`），不再假設舊 ID 跨部門唯一（目前 50 張卡片的 ID 實際上沒有重複，但不依賴這一點）。

## 需要你決策的事項

### 重大（影響 01B 的規則或安全）

| # | 事項 | 建議 | 影響 |
|---|---|---|---|
| D1 | 「登入就能讀看板」的範圍 | **01A-R 規劃採 B〔待核准〕**：已授權檢視者（申請或 QR，`roles.viewer`），取得後仍唯讀；設計見 [permissions.md](permissions.md) 第 2.1 節。A：任何 Google 帳號；C：只限學校網域 | A 等於世界上任何有 Gmail 的人登入後都看得到內部看板。規則只改 `internalReader()`；**你核准 B 之前，01B 不寫進正式規則** |
| D10 | GitHub 權杖現在就處理 | 本週做 T1～T5：檢查權限、重發一把到期日 2027-01-31 的權杖、換全會密碼、開通知、存緊急程序 | 這些都要你本人在 GitHub 與看板後台操作；我不經手權杖 |
| D5 | 預約格線與長度 | 30 分鐘一格、單次最長 2 小時、**送出申請就先佔位**（待審也鎖住） | 15 分鐘格線或更長的預約會超過規則讀取上限，只能改格線或用 Functions |
| D6 | 誰能申請預約、每人待審上限 | 有部門角色的人才能申請；每人同時最多 3 筆待審 | 開放給任何登入者會讓佔位問題變大 |
| D13 | QR 邀請有效期上限 | 01A-R 已改成預設 10 分鐘、規則上限也是 10 分鐘。要不要開放總管理員發較長期限（例如 24 小時，給不在場的人） | 開放就是改規則的一個數字；不開放時不在場的人改走申請 |
| D15 | Organization 移轉時機 | 開發計畫照你的指示排在最後（階段 11＝移轉文件的時機 B）；移轉文件原本建議時機 A（02 之前） | B：使用者經歷兩次變動（02 換登入、11 換網址）；A：一次，但 02 之前要多處理一次權杖 |
| D9 | Firebase 專案的 IAM 成員 | 只放學生會公用帳號＋1 個備援帳號，兩者都開兩步驟驗證，換屆時一起交接 | 專案擁有者不受規則限制，能改稽核紀錄 |

### 一般（有預設值，不回覆就照建議）

| # | 事項 | 建議 |
|---|---|---|
| D2 | 保留「部門編輯者（不能管人）」這一級 | 保留；規則已支援，不用也不影響 |
| D3 | 部門管理員能不能自己發邀請 | 先不行，全部由會長室發（符合 A4）；之後要開放只改一行規則 |
| D4 | 誰能把活動標成公開（未登入可見） | 活動部編輯者與總管理員 |
| D7 | 是否在 02 加 App Check（reCAPTCHA）擋濫用公開讀取 | 02 再評估；Spark 超量只會當天停用、不會收費 |
| D8 | 接受 Spark 的取捨：沒有通知、過期資料手動清、備份手動匯出 | 接受 |
| D12 | 檢視資格要不要有期限 | 先不加；換屆時總管理員批次收回。要加就多一個 `viewerUntil` 欄位 |
| D14 | 已刪除卡片的時間標記 | 接受 [permissions.md](permissions.md) 第 5.1 節的 `cardDeleted` 做法（規則保證標記正確，但不能保證每筆都標到） |
| D11 | 備份頻率與存放 | 每週一次＋每次部門切換前後；放公用帳號的雲端硬碟（只限幹部的資料夾） |
| — | `stustsa-change-spec/` 規格檔 | 01A-R 再查一次仍然讀不到（repo 全部 39 個遠端分支、這個工作環境、你的雲端硬碟都沒有），見 [review-01A-R.md](review-01A-R.md) 第 2 節。請把它放進 repo（例如 `docs/spec/`）或貼給我 |
