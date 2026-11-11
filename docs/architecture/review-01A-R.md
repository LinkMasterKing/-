# 01A-R：架構驗收修正

- 產出日期：2026-11-11。疊在 01A（`claude/cool-ramanujan-qg4y8o`）之上。
- 範圍：只更新設計文件、開發規範（`CLAUDE.md`）與測試規格。**沒有實作功能、沒有改 `data*.json` 與 `archive/`、沒有建立或連線任何 Firebase 專案、沒有部署、沒有移轉 repository。**
- 依據：既有 `docs/architecture/`、`docs/upgrade-plan.md`、`CLAUDE.md`，沒有重新掃描整個專案。新設計都是〔待驗證〕（01B 用模擬器）；檢視者機制另外是〔待核准〕。

## 1. 審查意見的處理

| # | 審查意見 | 處理 | 文件 |
|---|---|---|---|
| 1 | 管理者單獨刪鎖會讓既有預約失去互斥保護；私人忙碌建立時沒有強制鎖住全部時段 | 刪鎖的規則改成只看「擁有者在批次後是否已釋放」：預約必須是 `rejected`／`cancelled`、私人忙碌必須是 `released`，而擁有者的狀態轉換又要求同批刪掉全部的鎖。管理者不再有單獨刪鎖的權限（只剩擁有者不存在的孤兒鎖）。私人忙碌新增 `status`、`rev`，建立時用 `claimsAll()` 逐格檢查、最多 4 格、對齊格線、不能硬刪、不能改時間。補 B-24～B-40 | [booking.md](booking.md) 第 1～6 節 |
| 2 | 已刪除卡片的版本歷史一般使用者讀得到 | 版本從頂層 `cardVersions` 改成子集合 `cards/{id}/versions/{version}`，讀取條件跟母卡片相同；跨卡片查詢（collection group）只開放給總管理員與該部門編輯者。另外列出同類殘留：已刪除卡片的時間標記（`events`），提出 `cardDeleted` 做法（D14）。補 C-01～C-07 | [permissions.md](permissions.md) 第 5.1、5.1a 節；[data-model.md](data-model.md)；[indexes.md](indexes.md) Q8、Q9；[migration.md](migration.md) |
| 3 | `internalReader()` 改成需授權的檢視者 | 規劃 `roles.viewer`：申請（`roleRequests` 的 `role: 'viewer'`）或 QR 邀請取得，仍然唯讀；有部門角色或 `super` 的人自動是檢視者。沿用 `roles` 的稽核鏈。**標成〔待核准〕，你核准前 01B 不寫進正式規則** | [permissions.md](permissions.md) 第 2.1、4 節；[invitations-roles-audit.md](invitations-roles-audit.md) |
| 4 | QR 預設 10 分鐘、總管理員可撤銷、一次性核銷 | 預設與規則上限都改成 10 分鐘（伺服器時間）；撤銷涵蓋未到期與已過期但未使用的邀請；撤銷與核銷同時發生只有一筆成功；一次性核銷不變。要不要開放更長期限見 D13。補 I-31～I-36 | [invitations-roles-audit.md](invitations-roles-audit.md) 第 2、4、8 節 |
| 5 | `CLAUDE.md` 仍禁止新增資料庫 | 確認第 4 條「不要新增伺服器、資料庫、付費服務或建置工具」與已核准的 Firebase 架構衝突。依階段 00 第 9.1 節草案改寫：允許 Firebase，不允許其他後端與付費功能；開發工具只放 `backend/`。保留並加強：正式資料（`data*.json`、`archive/`、正式 Firebase 專案）不可動、機密不可經手、不直接推 main；新增「不擅自部署或改正式設定、不移轉 repository」 | `CLAUDE.md`「這是什麼」「絕對不要做的事」「程式結構」「開發規則」「測試」 |
| 6 | 每階段技術債清理 | `CLAUDE.md` 新增「技術債清理」一節：五類檢查、只移除確定無引用且無相容需求的程式、過時測試要先確認、清理與功能分開 commit、清理報告格式 | `CLAUDE.md` |
| 7 | 原始 `stustsa-change-spec` 規格可讀性 | **讀不到**，見第 2 節 | |
| 8 | 02D、09、10、11 納入開發計畫 | 原「正式切換」關卡改名為 02D；09 重新定義為 UI/UX 統整（含開場動畫與視覺校正），原 09 的「回歸、整理過時測試」移到 10；新增 10 資安與程式品質總驗收、11 Organization 移轉與正式啟用；附 09／10 分工表。11 排在最後等於移轉文件的時機 B，與該文件原本建議的時機 A 不同，列為 D15 | [../upgrade-plan.md](../upgrade-plan.md) 第 7.2、7.3、10 節；[github-ownership-migration.md](github-ownership-migration.md) 第 0 節 |
| 9 | 申請核准、角色變更、卡片版本的一致性驗證 | 見第 3 節 | |

## 2. 規格檔核對（審查意見 7）

- 01A 與 01A-R 指示要讀的 `stustsa-change-spec/CHANGE_SCOPE.md`、`stages/00`～`09`：
  - repo 的 39 個遠端分支都沒有這些檔案（逐一列出檔案清單比對）。
  - 這個雲端工作環境的檔案系統沒有。
  - 你的 Google 雲端硬碟用標題搜尋 `stustsa`、`CHANGE_SCOPE`、`01A_backend` 沒有結果。
  - 這個工作階段能存取的 GitHub repository 只有 `linkmasterking/-`。
- 結論：**原始規格目前不可讀，沒辦法逐條核對有無遺漏。** 階段 00 時規格是另外提供的（`upgrade-plan.md` 開頭寫明依據），但沒有進 repo。
- 能做到的間接核對（只依 `upgrade-plan.md` 引用到的規格內容）：

| 規格項目（依 `upgrade-plan.md` 的轉述） | 架構文件是否涵蓋 | 備註 |
|---|---|---|
| 02：未登入與一般帳號無法寫入、QR 只能核銷一次、撤權後不能寫、會長室看得到申請與授權紀錄 | 有 | I-01～I-49、`auditLogs` |
| 02：角色只有「唯讀／部門管理員／會長室總管理員」 | 有，另外多了 `editor`（D2）與 `viewer`（〔待核准〕） | 跟規格字面不同，要你確認 |
| 03：逐行內容（核取方塊、時間） | 有，`cards.blocks` | 欄位細節 03 定稿 |
| 04：版本歷史、拖曳完成／刪除、全會標記 | 有，版本子集合、`state`、`events.scope` | 8-9 尚未決定 |
| 05：行事曆五類 | **只涵蓋三種範圍**（`dept`、`all-activity`、`all-meeting`）＋公開活動＋預約 | 五類的確切定義在規格裡，需要原文確認 |
| 06：會長時段、預約、私人時段 | 有 | B-01～B-40 |
| 07：點名 | 只有集合與分級，欄位 07 定稿 | |
| 08／08B：首頁 | 與資料層無關 | |
| 09：開場分鏡 REF_01 | 不在架構範圍 | 已排入新的 09 |

- **請你把規格放進 repo（例如 `docs/spec/`，只放文字與分鏡圖）或直接貼給我**。拿到後我會逐條比對，差異補在本文件。

## 3. 一致性驗證的檢查結果與修正（審查意見 9）

| 檢查點 | 01A 的缺口 | 01A-R 修正 | 測試 |
|---|---|---|---|
| 申請核准 → 角色 | 申請可以單獨改成 `approved` 而沒有角色；已核准的申請可以一再被拿來當角色寫入的依據（重放） | 核准必須同批讓 `roles.lastVia == 'request'`、`lastRef == 申請 ID`；角色規則要求批次前申請是 `pending`、批次後是 `approved` 且 `decidedBy` 是自己 | I-37、I-38、I-40、I-44 |
| 以申請為名的角色寫入 | 只檢查申請的那個部門，其他部門、`super` 可以順便改 | `lastVia: 'request'` 時只能動申請的那一項，`super`／`viewer` 不變（或只把 `viewer` 設為申請的值） | I-39 |
| 撤權 | `lastVia: 'revoke'` 可以順便加權限 | 撤權只能移除部門或把旗標改成 false；降級走 `manual` | I-41 |
| 角色白名單 | `superWrite` 的新增路徑沒有欄位白名單；部門角色值沒限制 | `keys().hasOnly(roleKeys())`；`depts.values().hasOnly(['admin','editor'])` | I-45 |
| 稽核內容 | 只有 `roles` 比對 `before`／`after`；`action`、`ref` 可以亂寫 | 角色稽核的 `action == lastVia`、`ref == lastRef`；邀請、申請、預約、遷移的稽核要比對 `before.status`／`after.status` | I-42、I-43 |
| 卡片 → 版本 | `verAfter` 只看版本文件存在，硬刪後重建同 ID 的卡片可以沿用舊版本 | 版本必須「批次前不存在、批次後存在」 | C-12 |
| 版本 → 卡片 | 只比對 `title`、`blocks`、`version` | 再比對 `deptId`、`state`、`by == updatedBy`、`at == updatedAt`；欄位白名單；`imported` 只能是 false | C-08～C-11、C-14 |
| 核准與取消同時發生 | 沒有測試 | `rev` 只能 +1，兩筆提交依序生效，後者因 `rev` 或批次前狀態不符被拒 | I-44、I-36 |

## 4. 仍待驗證

| 項目 | 何時 | 為什麼還不能說已解決 |
|---|---|---|
| 新增的規則設計稿能編譯、行為符合預期 | 01B 模擬器 | 01A-R 沒有跑模擬器；全部是〔待驗證〕 |
| 拒絕／取消預約、建立與釋放私人忙碌的整批讀取次數 ≤ 20（B-40） | 01B | 估算約 17，離上限很近；超過時有退路但要你同意（`slots.ref` 帶種類前綴會洩漏「預約」或「私人忙碌」） |
| 子集合 `list` 規則用 `get(母卡片)` 能通過查詢檢查；collection group 與一般路徑規則並存 | 01B | 依官方文件的規則行為推論 |
| `map.diff().affectedKeys()`、`map.values().hasOnly()` 等寫法 | 01B | 探針沒測過 |
| 已刪除卡片的時間標記（D14） | 你決定後 01B | 規則保證不了「每筆都標到」 |
| `roles.viewer` 檢視者機制 | 你核准後 01B | 〔待核准〕 |
| 10 分鐘有效期在手機上的實際操作時間夠不夠（掃碼、外部瀏覽器開啟、Google 登入） | 02 實機 | LINE 內建瀏覽器要先跳出去登入，可能接近 10 分鐘 |
| 併發測試在開發專案重跑（B-01、B-05、B-33、I-02、I-36、I-44） | 02、06、10 | 模擬器併發與正式環境不同 |
| 規格原文逐條核對 | 拿到規格後 | 第 2 節 |

## 5. 01B 的實作前置條件

1. **你核准 01A＋01A-R**（本 PR 合併）。合併後 `CLAUDE.md` 的新條文才生效，01B 才能新增 `backend/`。
2. **決定 D1**：採用已授權檢視者（B），或維持 A／改 C。這決定 `internalReader()` 與 C-17、I-47～I-49 要不要寫。
3. **決定 D13、D14**（有預設值：10 分鐘不放寬、接受 `cardDeleted` 做法）；D5、D6 若不回覆就照 01A 的建議（30 分鐘一格、最長 4 格、送出就佔位；有部門角色才能申請、每人 3 筆待審）。
4. **提供 `stustsa-change-spec`**，或明確同意 01B 先以 `upgrade-plan.md` 與本資料夾為準。
5. 確認 01B 的工作環境可以安裝開發用工具（`firebase-tools`、`@firebase/rules-unit-testing`，只放 `backend/`，不被網頁載入）並跑 Java 的 Firestore 模擬器。01A 已在這個雲端環境實際跑過。
6. 01B 不需要：Firebase 專案、任何權杖或金鑰、Organization。D9、D10、D15 可以之後再定，但 D10（權杖 T1～T5）建議不要拖。
