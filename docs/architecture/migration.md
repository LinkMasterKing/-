# 遷移計畫

延續階段 00 第 6 節，補上完整欄位對照、匯入的規則路徑、舊身分對照與凍結方式。原則不變：遷移程式**只讀** `data*.json`、`archive/`，永遠不寫；演練只在模擬器；正式遷移每個部門都要你確認。

## 1. 欄位對照（涵蓋現有 10 個資料檔出現過的每一個欄位）

欄位清單是 01A 用唯讀腳本掃過全部資料檔得到的（schemaVersion 13）。

### 1.1 檔案層級

| 舊欄位 | 去處 | 備註 |
|---|---|---|
| `schemaVersion`、`v` | 不搬；記進 `migrations/{batch}.report` | 匯入前先用現有 `migrate`／`normalize` 升到 13 |
| `id` | 不搬 | 看板 ID，新架構用部門代號 |
| `title` | `deptSettings/{dept}.title` | |
| `range.start`、`range.end` | `deptSettings/{dept}.range` | |
| `reportBase.date`、`reportBase.issues` | `deptSettings/{dept}.reportBase` | `issues` 裡的議題 ID 改新 ID |
| `semester`、`termStart`、`yearLabel` | `org/config`（取秘書處檔） | 其他部門檔的值不同時列進報告 |
| `follows[]`（`id, dept, kind, ref`） | `deptSettings/president.follows` | `ref` 改成 `{dept}__{ref}` |
| `docs[]`（`id, name, url`） | `deptSettings/{dept}.docs` | |
| `meetGrant`（`date, by, at`） | `grants/meetingEdit`（`until`、`by`、`at`） | `until` 的換算方式 01B 依 `meeting.js` 的 `mtGrant` 確認；`by` 是舊名字字串 |
| `minutes[]` | `meetingMinutes/{date}` | 結構原樣；`by` 是舊名字陣列 |
| `members[]`（`id, name, role, createdAt`） | `legacyIdentities/{dept}__{id}` | **`kdf`、`tok` 不搬** |
| `sync.*`（`owner, repo, branch, path, resetAt, tokenAll, tokenEnc`） | **不搬** | 加密權杖不進新資料庫 |
| `pwKdf` | **不搬** | 部門共用密碼雜湊 |
| `locked` | 不搬 | 只是畫面的唯讀開關 |
| `savedAt`、`savedBy` | 記進報告 | |

### 1.2 即時回報 `events[]` → `cards/{dept}__{id}`

| 舊欄位 | 新欄位 | 轉換 |
|---|---|---|
| `id` | 文件 ID 的後半 | |
| `name` | `title` | |
| `desc` | `blocks` ＋ `legacyDesc` | 依 `\n` 切行；每行 `{id: '{卡片ID}_L{序號}', text, check: null, timeId: null}`；空白行保留成空字串；`legacyDesc` 存原文 |
| `issueId` | `issueId` | 改 `{dept}__{issueId}`；找不到的保留原值並列進報告 |
| `staff[]`（舊身分 ID） | `staff[]` | 改 `legacy:{dept}__{id}` |
| `labels[]` | `labels[]` | 改新 ID |
| `links[]` | `links[]` | 原樣 |
| `report` | `report` | |
| `times[]` | `timeIds[]` ＋ `events` 集合 | 見 1.3 |
| `createdAt` | `createdAt` | 字串依 `Asia/Taipei` 轉 Timestamp；`createdBy` 寫 `legacy:import` |
| `doneAt` | `doneAt` ＋ `state` | 有值＝`done`，否則 `open` |
| `fromEv` | `fromEv` | 改新 ID；這 12 筆舊分段紀錄原樣保留，不轉成版本 |
| `round`、`roundAt`、`touched`、`touchedAt` | 同名 | 原樣 |
| （陣列順序） | `order` | 以原本在陣列中的位置 ×1000 |
| | `version: 1`、`importBatch` | 同時建立 `cards/{id}/versions/1`（`imported: true`；01A-R 改成子集合） |

### 1.3 時間標記 `events[].times[]` → `events/{dept}__{timeId}`

| 舊欄位 | 新欄位 | 轉換 |
|---|---|---|
| `id` | 文件 ID 的後半 | |
| `label` | `label` | |
| `start`、`end` | `start`、`end` ＋ `startRaw`、`endRaw` ＋ `allDay` | 只有日期（`YYYY-MM-DD`）＝全天；有時間（`YYYY-MM-DDTHH:MM` 或空白分隔）依 `Asia/Taipei` 轉換；`end` 空白時等於 `start` |
| `place` | `place` | |
| `toIssue` | `toIssue` | |
| （所屬卡片） | `cardId`、`blockId: null` | 不猜它屬於哪一行 |
| | `scope: 'dept'`、`visibility: 'internal'` | 舊資料沒有全會與公開的概念 |

### 1.4 其他陣列

| 舊 | 新 | 備註 |
|---|---|---|
| `issues[]`（`id, title, cur, start, end, note, tags, labels, links, staff, doneAt, markers[]`） | `issues/{dept}__{id}` | `markers[]`（`id, at, date, pos, stage, text, evId, tmId`）原樣嵌入，`evId`、`tmId` 改新 ID；`staff` 同卡片 |
| `weeks[]`（`id, date, text, auto`） | `weeks/{dept}__{id}` | |
| `labels[]`（`id, kind, name`） | `labels/{dept}__{id}` | |

### 1.5 部門本身

`dept/config.js` 的 `BOARD_DEPTS` → `departments/{id}`（`name`、`order`、外觀）。`test: true` 的水果部 `active: false`。

## 2. 預期筆數（驗收用，來自階段 00 第 1.3 節）

| 項目 | 數量 |
|---|---|
| `cards` | 50（權益部 42、活動部 7、社務部 1） |
| `cards/*/versions`（collection group） | 50 |
| `issues` | 4 |
| `weeks` | 11 |
| `labels` | 1 |
| `events`（時間標記） | 16 |
| 議題註記（嵌在 `issues`） | 11 |
| `legacyIdentities` | 11 |
| `departments`、`deptSettings` | 各 10 |
| 多行說明需逐筆還原比對 | 20 筆（權益部） |

正式遷移時以當下 commit 的實際數量為準，報告列出跟上表的差異。

## 3. 匯入方式與規則路徑

- **不產生服務帳戶金鑰**。正式匯入做成「總管理員登入後在瀏覽器執行的匯入頁」，走同一套規則。
- 匯入需要寫入帶舊時間的 `createdAt`、`createdBy: 'legacy:import'`，正常規則不允許。所以每個看板集合的規則多一個分支〔待驗證〕：

```
function importing() {
  return isSuper()
    && request.resource.data.importBatch is string
    && get(doc('migrations', request.resource.data.importBatch)).data.status == 'running';
}
// 例：match /cards/{id} { allow create, update: if importing() || ...一般規則... }
// 版本子集合的匯入分支另外要求 imported == true、version == 1，且同批的卡片也是 importing()（01A-R）
```

- 流程：總管理員建立 `migrations/{batch}`（`status: 'running'`，有稽核）→ 匯入 → 驗證 → 改成 `done`（之後這個批次號就不能再用來寫入）。
- 一批最多 500 筆寫入〔文件〕；全會約 170 份文件，分 1～3 批。
- 模擬器演練時用測試身分直接跑同一支匯入程式。

## 4. 舊身分對照（決定 A4）

- 11 個舊身分搬成 `legacyIdentities/{dept}__{id}`：`name`、`oldRole`、`createdAt`，`claimedBy: null`。
- **舊身分不會自動得到任何權限。**卡片與議題上的負責人顯示成舊名字（從 `legacyIdentities` 查），跟現在看到的一樣。
- 重新授權有兩條路，都會記錄對照：
  1. **QR 邀請帶 `legacyRef`**：總管理員發邀請時選「這張邀請給舊身分『小芸』」。核銷時同一批寫入 `legacyIdentities.claimedBy = 核銷者 UID`（規則見 [invitations-roles-audit.md](invitations-roles-audit.md) 第 4 節）。
  2. **權限申請帶 `legacyRef`**：使用者登入後申請「我是活動部的舊身分『活動部地精』」，總管理員核准時一起寫入認領。
- 認領後不改寫卡片上的 `legacy:...`；畫面顯示時由 `legacyIdentities.claimedBy` 找到 `profiles` 的新名字。**原始的舊 ID 與名字永遠保留**，可以查到「這張卡片當時標的是誰、後來由哪個帳號認領」。
- 已經有 `claimedBy` 的舊身分不能再被認領（規則 I-27）。認領錯了由總管理員修正（有稽核）。

## 5. 凍結與切換（每個部門）

1. 01B 在 `dept/config.js` 給每個部門一個 `source`：`github`（現狀）｜`frozen`（唯讀，畫面顯示「搬家中，暫停編輯」）｜`firestore`。
2. 切換當天：
   1. 合併一個只把該部門改成 `frozen` 的 PR（你合併）→ 公告暫停編輯。
   2. 記下該部門資料檔目前的 commit SHA 與 SHA-256。
   3. 總管理員執行匯入 → 看報告（筆數、多行還原、連結檢查）。
   4. 該部門的人用 QR 加入、確認看得到也能編輯。
   5. 合併把 `source` 改成 `firestore` 的 PR。
3. 順序與節奏見 [github-token-retirement.md](github-token-retirement.md) 第 2 節第二段。
4. 舊資料檔留在 repo 當唯讀備份，不刪。

`frozen` 的好處是凍結不靠資料檔裡的 `locked`（那要寫資料檔），只靠程式設定，所以凍結本身不會碰正式資料。

## 6. 驗證清單

| # | 檢查 |
|---|---|
| V1 | 每個集合、每個部門的來源筆數＝寫入筆數 |
| V2 | 20 筆多行說明：`blocks[].text` 用 `\n` 接回去＝`legacyDesc`＝原始 `desc` |
| V3 | 連結：`issueId`、`markers[].evId／tmId`、`follows[].ref`、`fromEv`、`labels`、`staff` 全部指得到；斷掉的列出，不丟棄 |
| V4 | 時間：每個 `events` 的 `startRaw` 重新解析＝`start`；全天事件的日期在台灣時間沒有偏一天 |
| V5 | 重跑一次：文件數相同、每份文件內容雜湊相同 |
| V6 | 新資料庫裡找不到 `tokenAll`、`tokenEnc`、`tok`、`kdf`、`pwKdf` 任何一個字 |
| V7 | 用「一般登入帳號」與「未登入」各讀一次：一般帳號讀得到看板、讀不到 L2～L4；未登入只讀得到部門名稱與公開活動 |
| V8 | 現有畫面在 `github` 模式下的 Playwright 測試結果跟改動前相同 |

## 7. 回復

| 時間點 | 回復方式 | 會不會掉資料 |
|---|---|---|
| 切換前 | 不合併或 revert | 不會 |
| 某部門 `frozen` 中、匯入失敗 | 把 `source` 改回 `github`；批次改成 `rollingBack`，用 `rollbackImport` 刪掉那個批次匯入**而且沒被改過**的文件（卡片連同遷移產生的第 1 版、時間事件、議題、週報、標籤），完成後批次改成 `rolledBack`。有稽核鏈的文件（舊身分、部門設定、授權）不刪，重新匯入時內容相同就跳過。重新匯入用新的批次號，文件 ID 是決定性的，不會重複（01B R1，規則與測試見 `backend/`） | 不會，凍結期間沒有人寫；被改過的資料一律保留並列在報告 |
| 模擬器演練 | 直接清空模擬器再匯入（不需要回復流程） | 不會 |
| 某部門已切換、權杖還沒作廢 | `source` 改回 `github`；切換後的新修改用「匯出成 schemaVersion 13 的 JSON」，由你用看板的匯入備份寫回 | 不會（03 之前結構能一對一對回去） |
| 權杖已作廢 | 從 Firestore 匯出備份還原到 Firestore；真的要回到 GitHub 寫入，再發一把新權杖 | 不會 |
| 03 上線後退回 JSON | 逐行核取狀態會被攤平成文字 | 失去核取與行層級時間關聯，文字不會掉 |

## 8. 備份（Spark 沒有排程備份）

- 總管理員可用的「匯出全部資料」：輸出 JSON（各集合的文件陣列＋批次資訊），並可轉成 schemaVersion 13 的部門檔格式（03 之前）。
- 頻率、存放位置、負責人：決策 D11。建議每週一次＋每次部門切換前後各一次，存到學生會公用帳號的雲端硬碟（只有幹部看得到的資料夾）。
- 備份檔包含 L4 資料（角色、稽核），存放位置的存取權要跟總管理員一致。
