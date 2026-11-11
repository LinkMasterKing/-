# 查詢與索引

## 1. 原則

- Firestore 規則不是篩選器：查詢條件必須讓規則能確定「結果每一筆都可讀」，否則整個查詢被拒〔文件〕。所以下表每個查詢都帶著規則需要的條件（例如一般讀者查卡片一定帶 `state in ['open','done']`）。
- 單一欄位的索引 Firestore 會自動建；下表只列需要手動建的複合索引。01B 寫成 `backend/firestore.indexes.json`。
- 大段文字欄位設成免索引，省索引空間與寫入成本。

## 2. 查詢清單與複合索引

| # | 畫面／用途 | 查詢 | 複合索引 | 規則依據 |
|---|---|---|---|---|
| Q1 | 總覽（未登入） | `departments` where `active == true` order by `order` | `active ASC, order ASC` | L0 |
| Q2 | 總覽、全會行事曆（未登入） | `events` where `visibility == 'public'` and `start >= 月初` and `start < 月底` | `visibility ASC, start ASC` | L0 只開放 `public` |
| Q3 | 部門看板：進行中 | `cards` where `deptId == X` and `state == 'open'` order by `order` | `deptId ASC, state ASC, order ASC` | L1 |
| Q4 | 部門看板：已完成（分頁） | `cards` where `deptId == X` and `state == 'done'` order by `doneAt DESC` limit 20 | `deptId ASC, state ASC, doneAt DESC` | L1 |
| Q5 | 部門看板：最近刪除 | `cards` where `deptId == X` and `state == 'deleted'` order by `deletedAt DESC` | `deptId ASC, state ASC, deletedAt DESC` | L2 才能查 |
| Q6 | 秘書處會議報告事項 | `cards` where `report == true` and `state == 'open'` | `report ASC, state ASC, deptId ASC` | L1 |
| Q7 | 母議題底下的卡片 | `cards` where `issueId == X` and `state in ['open','done']` | `issueId ASC, state ASC` | L1 |
| Q8 | 卡片版本歷史 | `cards/X/versions` order by `version DESC`（01A-R 改成子集合） | 單一欄位，免複合索引 | 卡片可讀時（已刪除卡片只有 L2） |
| Q9 | 會長室各部門編輯量 | collection group `versions` where `deptId == X` and `at >= 起` | collection group：`deptId ASC, at ASC` | 總管理員或該部門編輯者（01A-R） |
| Q10 | 母議題 | `issues` where `deptId == X` order by `order` | `deptId ASC, order ASC` | L1 |
| Q11 | 週報 | `weeks` where `deptId == X` order by `date DESC` | `deptId ASC, date DESC` | L1 |
| Q12 | 本部門行事曆 | `events` where `deptId == X` and `start` 範圍 | `deptId ASC, start ASC` | L1 |
| Q13 | 全會活動／全會會議 | `events` where `scope == S` and `start` 範圍 | `scope ASC, start ASC` | L1 |
| Q14 | 全會行事曆（登入） | `events` where `start` 範圍 | 單一欄位 | L1 |
| Q15 | 標籤 | `labels` where `deptId == X` | 單一欄位 | L1 |
| Q16 | 預約：某人某週忙閒 | `slots` where `ownerId == P` and `idx >= a` and `idx < b` | `ownerId ASC, idx ASC` | L1 |
| Q17 | 預約：開放時段 | `openWindows` where `ownerId == P` and `start` 範圍 | `ownerId ASC, start ASC` | L1 |
| Q18 | 預約：我的申請 | `bookings` where `requester == me` order by `start DESC` | `requester ASC, start DESC` | 本人 |
| Q19 | 預約：待審 | `bookings` where `ownerId == P` and `status == 'pending'` order by `start` | `ownerId ASC, status ASC, start ASC` | 管理者 |
| Q20 | 私人忙碌 | `busyBlocks` where `ownerId == P` and `start` 範圍 | `ownerId ASC, start ASC` | 管理者 |
| Q21 | 角色清單 | `roles` 全部 | 無 | L4 |
| Q22 | 待審申請 | `roleRequests` where `status == 'pending'` order by `createdAt` | `status ASC, createdAt ASC` | L4 |
| Q23 | 我的申請 | `roleRequests` where `uid == me` | 單一欄位 | 本人 |
| Q24 | 邀請清單 | `invitations` where `status == 'active'` order by `expiresAt` | `status ASC, expiresAt ASC` | L4 |
| Q25 | 稽核：某人的權限歷史 | `auditLogs` where `col == 'roles'` and `docId == uid` order by `rev DESC` | `col ASC, docId ASC, rev DESC` | L4 |
| Q26 | 稽核：最近紀錄 | `auditLogs` order by `at DESC` limit 50 | 單一欄位 | L4 |
| Q27 | 稽核：某人做過什麼 | `auditLogs` where `actor == uid` order by `at DESC` | `actor ASC, at DESC` | L4 |
| Q28 | 點名：某場次 | `attendanceRecords` where `sessionId == S` | 單一欄位 | L3 |
| Q29 | 點名：某人出席紀錄 | `attendanceRecords` where `memberId == M` order by `sessionAt DESC` | `memberId ASC, sessionAt DESC` | L3 |

## 3. 免索引欄位

| 集合 | 欄位 | 原因 |
|---|---|---|
| `cards` | `blocks`、`legacyDesc`、`links`、`touched` | 大段文字或陣列，不拿來查詢 |
| `versions`（collection group） | `blocks`、`times`、`title` | 快照內容 |
| `issues` | `markers`、`note`、`links` | |
| `weeks` | `text` | |
| `meetingMinutes` | `items` | |
| `auditLogs` | `before`、`after` | |

## 4. 待驗證

- 每個查詢在模擬器裡用「最低權限的身分」實際跑一次，確認規則接受、索引存在〔待驗證〕。模擬器不檢查複合索引是否存在〔文件〕，所以索引設定檔要在 02 部署到**開發專案**後，逐一實際查詢確認。
- `state in [...]` 搭配 `order by` 的索引組合以開發專案的錯誤訊息為準〔待驗證〕。
