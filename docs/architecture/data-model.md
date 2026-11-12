# 資料模型

全部是 Cloud Firestore（Native mode）頂層集合，資料庫位置建議 `asia-east1`（台灣，建立後不能改）。分級代號見 [permissions.md](permissions.md)：L0 公開、L1 內部（02A：任何已登入的 Google 帳號）、L2 部門、L3 秘書處授權、L4 會長室；「本人」＝文件屬於登入者自己。

## 1. 共用約定

| 項目 | 約定 |
|---|---|
| 文件 ID | 新建的資料用 SDK 產生的隨機 ID；遷移來的資料用 `{deptId}__{舊ID}`（決定性，重跑覆寫同一份） |
| 時間 | 一律存 Firestore `Timestamp`。使用者輸入的日期時間以 `Asia/Taipei` 解讀（台灣沒有日光節約時間）。只有日期的欄位另存 `allDay: true` |
| 伺服器時間 | `createdAt`、`updatedAt`、稽核時間用 `serverTimestamp()`，規則要求 `== request.time`〔已驗證 P5〕 |
| 操作者 | `createdBy`、`updatedBy` 存 UID，規則要求 `== request.auth.uid`。畫面上的名字從 `profiles` 查，不在每份文件重複存信箱 |
| 版本號 | 受保護的文件有 `rev`（整數，每次寫入加 1），與稽核紀錄鏈結，見 [invitations-roles-audit.md](invitations-roles-audit.md) 第 3 節 |
| 部門代號 | 沿用 `dept/config.js` 的代號：`rights`（權益部，舊檔 `data.json`）、`events`、`affairs`、`president`、`secretariat`、`marketing`、`pr`、`finance`、`works`、`fruit`（已對照 `dept/config.js`） |
| 刪除 | 02A 修正：卡片的刪除是**永久刪除**，連同版本與時間事件一起移除，沒有軟刪除、不能復原（流程見 [permissions.md](permissions.md) 第 5.1 節）。其他一般資料的刪除照各集合的規則 |
| 欄位白名單 | 每個集合的可寫欄位在規則裡用 `keys().hasOnly([...])` 限制〔待驗證〕 |

## 2. 組織、部門、使用者

### `departments/{deptId}`：L0 公開
| 欄位 | 型別 | 說明 |
|---|---|---|
| `name` | string | 部門名稱（例「權益部」） |
| `short` | string | 簡稱 |
| `order` | int | 總覽排序 |
| `color`、`icon` | string | 總覽卡片外觀（對應 `dept/config.js`） |
| `active` | bool | 是否顯示在總覽 |
寫入：L4。這是唯一不登入就讀得到的部門資訊。

### `deptSettings/{deptId}`：L1 讀、該部門管理員寫
| 欄位 | 說明（舊欄位） |
|---|---|
| `title` | 看板標題（`title`） |
| `range` | `{start, end}` 時間軸範圍（`range`） |
| `reportBase` | `{date, issues}` 週報基準（`reportBase`） |
| `follows` | 會長室追蹤清單（只有 `president`；`follows[]`，`ref` 改成新文件 ID） |
| `docs` | 會長室文件連結 `[{id, name, url}]`（`docs[]`） |
| `rev`、`updatedAt`、`updatedBy` | |

### `org/config`：L0 讀、L4 寫
`yearLabel`、`termStart`、`semester`（來源：秘書處檔）。

### `users/{uid}`：本人與 L4
| 欄位 | 說明 |
|---|---|
| `email` | 規則要求 `== request.auth.token.email` |
| `createdAt`、`lastLoginAt` | |
本人建立與更新（只能改 `lastLoginAt`）。**信箱只放這裡**，不出現在其他 L1 可讀的文件。

### `profiles/{uid}`：L1 讀、本人寫
`displayName`（1～40 字）、`photoURL`、`updatedAt`。卡片的負責人、版本歷史的修改者都用這裡的名字顯示。

### `roles/{uid}`：本人讀自己、L4 讀全部；寫入見 [invitations-roles-audit.md](invitations-roles-audit.md)
| 欄位 | 型別 | 說明 |
|---|---|---|
| `super` | bool | 會長室總管理員 |
| `depts` | map | `{deptId: 'admin' \| 'editor'}` |
| `rev` | int | 版本號（稽核鏈） |
| `lastVia` | string | `invite` \| `request` \| `manual` \| `revoke` |
| `lastRef` | string | 邀請雜湊或申請 ID |
| `updatedAt`、`updatedBy` | | |
沒有 `roles` 文件、或 `super` 不是 true 且 `depts` 為空的登入者＝一般登入者：讀得到 L0、L1，不能寫，可以申請部門角色（02A 定案；01A-R 的 `viewer` 欄位取消，規則不接受這個欄位）。

### `roleRequests/{id}`：本人與 L4
`uid`、`deptId`、`role`（`admin`｜`editor`；02A 拿掉 `viewer`）、`note`、`legacyRef`（選填，要認領的舊身分）、`status`（`pending`｜`approved`｜`rejected`｜`cancelled`）、`createdAt`、`decidedBy`、`decidedAt`、`rev`。

### `invitations/{sha256(token) 小寫十六進位}`：L4 讀寫；核銷者只能 `get`
`deptId`、`role`（`admin`｜`editor`；02A 拿掉 `viewer`）、`legacyRef`、`boundEmail`（選填）、`note`、`status`（`active`｜`used`｜`revoked`）、`createdBy`、`createdAt`、`expiresAt`（預設與上限都是建立後 10 分鐘，01A-R）、`usedBy`、`usedAt`、`token`（核銷時才寫入）、`revokedBy`、`revokedAt`、`rev`。詳見 [invitations-roles-audit.md](invitations-roles-audit.md)。

### `legacyIdentities/{deptId}__{舊身分ID}`：L1 讀、L4 寫（核銷時本人可認領）
`deptId`、`name`、`oldRole`（`admin`｜`member`）、`createdAt`（原字串）、`claimedBy`（UID 或 null）、`claimedAt`、`rev`。**不搬** `kdf`、`tok`。

### `auditLogs/{集合}_{文件ID}_{rev}`：L4 讀；只能新增
`col`、`docId`、`rev`、`action`、`actor`、`at`、`before`、`after`、`ref`。詳見 [invitations-roles-audit.md](invitations-roles-audit.md) 第 3 節。

## 3. 看板內容（L1 讀；該部門管理員／編輯者寫）

### `cards/{id}`：即時回報卡
| 欄位 | 說明（舊欄位） |
|---|---|
| `deptId` | 建立後不能改 |
| `title` | 名稱（`name`） |
| `blocks` | 逐行內容 `[{id, text, check: null \| {done, doneAt, doneBy}, timeId: null \| string}]`（由 `desc` 依換行切開；03 才用到核取方塊） |
| `timeIds` | 這張卡片的**全部**時間事件 ID（`times[]` 搬到 `events` 後的 ID；行層級的也列在這裡，`blocks[].timeId` 指向其中一個）。02A：規則要求屬於卡片的時間事件一定列在這裡，永久刪除靠它確認全部刪光 |
| `issueId` | 母議題（`issueId`，改新 ID） |
| `staff` | 負責人：UID 或 `legacy:{deptId}__{舊身分ID}`（`staff[]`） |
| `labels` | 標籤 ID（`labels[]`，改新 ID） |
| `links` | 連結（`links[]`） |
| `report` | 會議要報告（`report`） |
| `state` | `open` \| `done` \| `purging`（02A：永久刪除進行中，不可逆；拿掉 `deleted`） |
| `doneAt`、`deletedAt`、`deletedBy` | （`doneAt`）；`deletedAt`、`deletedBy`＝開始永久刪除的時間與人 |
| `order` | 排序值 |
| `round`、`roundAt`、`touched`、`touchedAt`、`fromEv` | 燈號與舊分段紀錄，原樣保留 |
| `version` | 每次內容修改加 1，與 `cards/{id}/versions/{version}` 對應 |
| `createdAt`、`createdBy`、`updatedAt`、`updatedBy` | （`createdAt` 舊字串轉時間） |
| `legacyDesc` | 遷移時的原始說明全文（回復與比對用；03 之後不再寫入） |
| `importBatch` | 遷移批次 ID（只有遷移資料有） |
單一文件上限 1 MiB〔文件〕；以目前最長的說明估算遠低於上限〔推論〕。

### `cards/{cardId}/versions/{version}`：跟母卡片同一個讀取條件；只能新增，只能隨永久刪除刪掉
（01A-R：從頂層 `cardVersions/{cardId}_{version}` 改成子集合，讀取條件跟著母卡片。02A：永久刪除時由新往舊一起刪掉，見 [permissions.md](permissions.md) 第 5.1 節。）
`cardId`、`deptId`、`version`、`title`、`blocks`、`times`（當時的時間值快照）、`state`、`by`、`at`、`imported`（遷移產生的第 1 版為 true）、`importBatch`（只有遷移產生的第 1 版有，等於母卡片的批次；01B R1）。`title`、`blocks`、`state`、`deptId`、`by`、`at` 由規則比對批次後的卡片。

### `issues/{id}`：母議題
`deptId`、`title`、`cur`（目前階段）、`start`、`end`（原字串＋時間）、`note`、`tags`、`labels`、`links`、`staff`、`markers`（陣列，保留舊結構，`evId`／`tmId` 改新 ID）、`doneAt`、`order`、`rev`、`updatedAt`、`updatedBy`。

### `weeks/{id}`：週報
`deptId`、`date`、`text`、`auto`、`createdAt`、`updatedBy`。

### `labels/{id}`：人事時地物標籤
`deptId`、`kind`、`name`。

### `events/{id}`：統一的時間事件
| 欄位 | 說明（舊欄位） |
|---|---|
| `deptId` | |
| `cardId`、`blockId` | 來源卡片與行（舊資料只有 `cardId`）。02A：有 `cardId` 時必須列在那張卡片的 `timeIds`、跟卡片同部門；`cardId` 建立後不能改 |
| `label` | 標記名稱（`times[].label`） |
| `start`、`end` | Timestamp；`startRaw`、`endRaw` 原字串 |
| `allDay` | 只有日期 |
| `place` | 地點（`times[].place`） |
| `toIssue` | 也顯示在母議題（`times[].toIssue`） |
| `scope` | `dept` \| `all-activity`（全會活動，只有活動部能設）\| `all-meeting`（全會會議，只有秘書處能設） |
| `visibility` | `internal` \| `public`（公開活動，L0 可讀） |
| `title`、`summary` | 只有 `public` 時使用：對外顯示的標題與簡介 |
| `rev`、`updatedAt`、`updatedBy` | |
`visibility: 'public'` 的文件整份對外公開，所以規則要求這種文件只能有公開欄位（不放卡片內文）〔待驗證〕。

### `grants/meetingEdit`：L1 讀、L4 寫
`until`（Timestamp）、`by`、`at`、`rev`。秘書處跨部門修改的開關（舊 `meetGrant`）。

### `meetingMinutes/{YYYY-MM-DD}`：L3
舊 `minutes[]` 的結構原樣保留：`date`、`by`、`items[]`。

## 4. 預約（06）

見 [booking.md](booking.md)。集合：`calendars/{ownerId}`（L1 讀設定、管理者寫）、`openWindows/{id}`（L1）、`slots/{ownerId}_{格號}`（L1，只有忙／閒）、`bookings/{id}`（申請人本人與管理者）、`busyBlocks/{id}`（只有管理者；有 `status`、`rev`，不能硬刪）、`bookingQuota/{ownerId}_{uid}`（本人與管理者）。

## 5. 點名（07）

只定集合與分級，欄位在 07 開工時定稿：`attendanceMembers/{id}`、`attendanceSessions/{id}`、`attendanceRecords/{sessionId}_{memberId}`，全部 L3（秘書處管理員／編輯者與會長室）。記錄用「場次＿成員」決定性 ID，快速連點時只會覆寫同一份，不會重複。

## 6. 遷移管理

`migrations/{batchId}`：L4。`status`（`running`｜`done`｜`failed`｜`rollingBack`｜`rolledBack`，01B R1）、`sourceCommit`、`fileHashes`、`counts`、`startedBy`、`startedAt`、`finishedAt`、`report`（摘要）。正在跑的批次讓總管理員可以寫入帶舊時間的文件，見 [migration.md](migration.md) 第 3 節。

## 7. 讀取量估算〔推論〕

| 動作 | 讀取次數 |
|---|---|
| 未登入開總覽 | `departments` 10＋公開活動（本月）約 0～20 |
| 登入開一個部門看板（進行中） | `deptSettings` 1＋進行中卡片約 5～15＋議題 0～5＋標籤＋本月 `events` 約 0～20 |
| 開「已完成」頁 | 每頁 20 筆，切過去才讀 |
| 全會行事曆 | `events` 依月份範圍查 |
| 即時監聽 | 只有變動的文件計讀取 |
以每天 300 次開啟估算低於 3 萬次讀取，在 Spark 每天 5 萬次讀取內〔文件：免費額度為每天 5 萬讀、2 萬寫、2 萬刪、1 GiB 儲存、每月 10 GiB 流出；每日在太平洋時間午夜重置；每次查詢至少算 1 次讀取〕。
