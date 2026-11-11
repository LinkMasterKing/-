# 會長預約：防止重複預約

修正階段 00 風險 3：預約要在「不同時長、部分時間重疊、多人同時送出」時都保證不重複，而且**不能假設 Firestore Rules 本身能判斷重疊**。

## 1. 核心想法：防重複不是靠規則「算重疊」

規則語言沒有迴圈，不能查詢「現在有哪些預約跟我重疊」〔文件〕。所以這套設計不讓規則去比較兩筆預約，而是把問題轉成**文件 ID 的唯一性**：

1. 把時間切成固定格線（建議 30 分鐘一格，見決策 D5）。每一格有一個全域唯一的格號：`idx = 自 1970-01-01 起的毫秒數 ÷ 1,800,000`。台灣是 UTC+8、沒有日光節約，整點與半點都剛好落在格線上。
2. 每一格對應一份**時段鎖**文件：`slots/{ownerId}_{idx}`。
3. 一筆預約佔 `[startSlot, startSlot + slotCount)`，必須在**同一批寫入**裡建立它涵蓋的每一份時段鎖。
4. 時段鎖**只能新增，不能修改**。文件已經存在時，寫入會被當成「修改」並被拒絕〔已驗證 P1〕。
5. 一批寫入是原子的：任何一格被拒，整筆預約（含其他格）都不會寫入〔文件；已驗證 P2b〕。

### 為什麼這樣就不會重複

兩段整數區間 `[a, a+n)` 與 `[b, b+m)` 重疊，若且唯若 `a < b+m` 且 `b < a+n`。這時 `max(a, b)` 同時落在兩段裡，也就是兩筆預約一定要建立同一份 `slots/{owner}_{max(a,b)}`。同一份文件只能被建立一次，所以**兩筆有重疊的預約不可能都提交成功**，不管時長多少、從哪裡開始重疊、誰先誰後。頭尾相接（`a+n == b`）沒有共同格，兩筆都能成功。

規則在這裡只負責兩件事：

- **時段鎖不能被改寫**（`allow update: if false`）。
- **預約一定要鎖住它涵蓋的每一格**：預約文件的規則逐格檢查 `getAfter(slots/...).data.ref == 這筆預約`。少鎖一格、鎖錯格、完全不鎖，預約都寫不進去〔已驗證 P3b、P3c〕。

真正保證「同一份文件只會被建立一次」的是 Firestore 的原子提交，不是規則邏輯本身。

## 2. 集合

| 集合 | 讀 | 寫 | 欄位 |
|---|---|---|---|
| `calendars/{ownerId}` | L1 | 總管理員 | `name`、`managers`（UID 陣列）、`gridMin: 30`、`maxSlots: 4`、`horizonDays: 60`、`maxPendingPerUser: 3`、`rev` |
| `openWindows/{id}` | L1 | 管理者 | `ownerId`、`start`、`end`（都在格線上）。由管理者的畫面依「每週固定時段」自動產生未來幾週的文件 |
| `slots/{ownerId}_{idx}` | L1 | 見規則 | `ownerId`、`idx`、`ref`（預約或私人忙碌的隨機 ID）。**沒有標題、沒有申請人**，只代表「這格不能約」 |
| `bookings/{id}` | 申請人本人、管理者 | 見規則 | `ownerId`、`requester`、`windowId`、`startSlot`、`slotCount`、`start`、`end`、`topic`、`note`、`status`（`pending`｜`approved`｜`rejected`｜`cancelled`）、`rev`、`createdAt`、`updatedAt`、`updatedBy`、`decidedBy` |
| `busyBlocks/{id}` | 管理者 | 管理者 | `ownerId`、`title`、`start`、`end`、`startSlot`、`slotCount`（私人行程，標題只有管理者看得到） |
| `bookingQuota/{ownerId}_{uid}` | 本人、管理者 | 見規則 | `pending`（目前待審件數） |

`slots.ref` 是隨機 ID，預約與私人忙碌共用同一個欄位，所以一般人從時段鎖分辨不出「有人預約」還是「會長私人有事」。

## 3. 流程

| 動作 | 誰 | 同一批寫入 |
|---|---|---|
| 申請 | 有 L1 的登入者（誰可以申請見決策 D6） | `bookings/{id}`（`pending`, `rev: 1`）＋涵蓋的每一份 `slots`＋`bookingQuota` 加 1＋`auditLogs/bookings_{id}_1` |
| 核准 | 管理者 | `bookings` → `approved`（`rev + 1`）＋稽核；時段鎖不動 |
| 拒絕／取消 | 管理者；或申請人取消自己的 | `bookings` → `rejected`／`cancelled`＋刪除它的所有 `slots`＋`bookingQuota` 減 1＋稽核 |
| 私人忙碌 | 管理者 | `busyBlocks/{id}`＋涵蓋的每一份 `slots` |
| 改期 | 申請人 | 先取消、再申請（兩次提交）。第一版不做原子改期，畫面提醒「改期期間時段可能被別人約走」 |

- **申請就佔位**（待審也鎖住時段）：避免兩個人都申請同一時段、會長核准時才發現衝突。代價是有人可以佔著不放，所以有每人待審上限（`bookingQuota`，D6）與管理者拒絕。
- 前端用交易：先讀涵蓋的每一格，有任何一格已存在就直接顯示「這段時間已經被預約」，不送出；交易提交時若別人搶先，交易重試、讀到已存在的格，同樣顯示已被預約〔已驗證 P2'〕。
- 交易在離線時會直接失敗，不會先顯示成功再被退回〔文件〕；畫面要在伺服器確認後才顯示「已送出」。

## 4. 規則設計稿〔待驗證〕

```
function cal(o)       { return get(doc('calendars', o)).data; }
function isManager(o) { return signedIn() && me() in cal(o).managers; }
function slotDoc(o, i){ return doc('slots', o + '_' + string(i)); }
// 格線 30 分鐘＝1800000 毫秒。規則語言沒有常數宣告，以下直接寫數字。

match /slots/{sid} {
  function s() { return request.resource.data; }
  allow get, list: if internalReader();
  allow update: if false;                                   // 已驗證 P1
  allow create: if signedIn()
    && sid == s().ownerId + '_' + string(s().idx)
    && s().keys().hasOnly(['ownerId', 'idx', 'ref'])
    && ( bookingCovers() || busyCovers() );
  function bookingCovers() {
    let b = getAfter(doc('bookings', s().ref)).data;
    return b.requester == me() && b.ownerId == s().ownerId && b.status == 'pending'
        && s().idx >= b.startSlot && s().idx < b.startSlot + b.slotCount;
  }
  function busyCovers() {
    let x = getAfter(doc('busyBlocks', s().ref)).data;
    return isManager(s().ownerId) && x.ownerId == s().ownerId
        && s().idx >= x.startSlot && s().idx < x.startSlot + x.slotCount;
  }
  allow delete: if signedIn() && (
      isManager(resource.data.ownerId)
   || ( getAfter(doc('bookings', resource.data.ref)).data.requester == me()
        && getAfter(doc('bookings', resource.data.ref)).data.status == 'cancelled' ) );
}

match /bookings/{bid} {
  function b() { return request.resource.data; }
  function claimed(i) { return getAfter(slotDoc(b().ownerId, i)).data.ref == bid; }
  function claimsAll() {                                    // 規則沒有迴圈：上限 4 格就展開 4 次
    let s = b().startSlot; let n = b().slotCount;
    return claimed(s) && (n < 2 || claimed(s + 1)) && (n < 3 || claimed(s + 2)) && (n < 4 || claimed(s + 3));
  }
  function released() {
    let s = resource.data.startSlot; let n = resource.data.slotCount; let o = resource.data.ownerId;
    return !existsAfter(slotDoc(o, s)) && (n < 2 || !existsAfter(slotDoc(o, s + 1)))
        && (n < 3 || !existsAfter(slotDoc(o, s + 2))) && (n < 4 || !existsAfter(slotDoc(o, s + 3)));
  }
  function inWindow() {
    let w = get(doc('openWindows', b().windowId)).data;
    return w.ownerId == b().ownerId && w.start <= b().start && b().end <= w.end;
  }
  allow get:  if signedIn() && (resource.data.requester == me() || isManager(resource.data.ownerId));
  allow list: if signedIn() && (resource.data.requester == me() || isManager(resource.data.ownerId));
  allow delete: if false;

  allow create: if signedIn() && b().requester == me() && b().status == 'pending' && b().rev == 1
    && b().slotCount is int && b().slotCount >= 1 && b().slotCount <= 4               // 已驗證 P3d
    && b().start.toMillis() == b().startSlot * 1800000                                 // 對齊格線（已驗證 P3a）
    && b().end.toMillis()   == (b().startSlot + b().slotCount) * 1800000
    && b().start > request.time && b().start < request.time + duration.value(60, 'd')
    && inWindow()
    && claimsAll()                                                                     // 已驗證 P3b、P3c
    && getAfter(doc('bookingQuota', b().ownerId + '_' + me())).data.pending <= 3
    && b().createdAt == request.time && stamped()
    && auditAfter('bookings', bid, 1);

  allow update: if revNext() && stamped() && auditAfter('bookings', bid, request.resource.data.rev)
    && unchanged(['ownerId', 'requester', 'windowId', 'startSlot', 'slotCount', 'start', 'end', 'createdAt'])
    && ( (isManager(resource.data.ownerId) && resource.data.status == 'pending' && b().status == 'approved')
      || (isManager(resource.data.ownerId) && resource.data.status in ['pending', 'approved']
            && b().status == 'rejected' && released())
      || (resource.data.requester == me() && resource.data.status in ['pending', 'approved']
            && b().status == 'cancelled' && released()) );
}

match /bookingQuota/{qid} {
  // 只能隨預約一起 +1／−1：+1 時要有同批新增的自己的 pending 預約；−1 時要有同批轉成 rejected／cancelled 的預約
  // 細節 01B 定稿；額度不是安全邊界，只是防佔位，寫錯的後果是「多佔或少佔幾筆」，不會造成重複預約
}
```

### 文件讀取次數預算（不計快取）

| 申請批次裡的操作 | 讀取 |
|---|---|
| `bookings` 新增 | `claimed` 最多 4、`openWindows` 1、`bookingQuota` 1、稽核 1 → 7 |
| 每一份 `slots` 新增 | `getAfter` 預約 1 → 4 格共 4 |
| `bookingQuota` | 約 1～2 |
| `auditLogs` | `getAfter` 預約 1 |
| 合計 | 約 14，低於整批 20；單一操作最多 7，低於 10〔文件；10 次上限已驗證 P7〕 |

這就是**最長 2 小時（4 格）的原因**：如果要 15 分鐘格線、最長 2 小時（8 格），單一預約操作要讀 8＋3＝11 份文件，超過每個操作 10 次的上限。要更長的預約，只能加大格線或改用 Functions（第 6 節）。

## 5. 攻擊與併發測試清單（01B 寫成模擬器測試）

| # | 情境 | 預期 | 探針 |
|---|---|---|---|
| B-01 | 兩個帳號同時搶完全相同的時段 | 恰好 1 筆成功 | P2 |
| B-02 | 部分重疊：A 10:00–11:00 已存在，B 申請 10:30–11:30 | B 拒絕 | P2b |
| B-03 | 不同時長：A 10:00–12:00，B 11:30–12:00 | B 拒絕 | P2b 同機制 |
| B-04 | 頭尾相接：A 10:00–11:00，B 11:00–12:00 | 兩筆都成功 | P2c |
| B-05 | 隨機併發：6 個帳號、隨機起點、隨機 1～4 格同時送出，重複 30 輪 | 每輪成功的預約兩兩不重疊，且每輪至少 1 筆成功 | P2（30 輪、77 筆成功、0 筆重疊）；P2' 用交易 15 輪 0 筆重疊 |
| B-06 | 建立預約但不建立時段鎖 | 拒絕 | P3c |
| B-07 | 預約宣稱 3 格、只鎖 2 格 | 拒絕 | P3b |
| B-08 | 時段鎖指向別人的預約 | 拒絕 | P3e |
| B-09 | 對已存在的時段鎖 `set` 覆寫（搶走別人的格） | 拒絕 | P1 |
| B-10 | 刪除別人預約的時段鎖，好讓自己可以約 | 拒絕 | |
| B-11 | 起點不在格線上（10:10） | 拒絕 | |
| B-12 | 超過 4 格 | 拒絕 | P3d |
| B-13 | 申請會長私人忙碌的時段 | 拒絕（格已存在） | P1 同機制 |
| B-14 | 申請開放時段以外、或跨出開放時段 | 拒絕 | |
| B-15 | 申請過去的時間、或 60 天以後 | 拒絕 | |
| B-16 | 一般帳號讀 `busyBlocks`、讀別人的 `bookings` | 拒絕 | |
| B-17 | 申請人把自己的預約改成 `approved` | 拒絕 | |
| B-18 | 拒絕或取消時沒有一起刪掉時段鎖 | 拒絕 | |
| B-19 | 取消後，別人立刻申請同一時段 | 成功 | |
| B-20 | 申請人超過待審上限 | 拒絕 | |
| B-21 | 管理者以外的人建立私人忙碌的時段鎖 | 拒絕 | |
| B-22 | 管理者核准、同時申請人取消同一筆 | 一筆成功、一筆因 `rev` 衝突失敗或重試；最終狀態與稽核鏈一致 | |
| B-23 | 改期（取消＋新申請）期間別人搶走 | 新申請拒絕，畫面顯示已被預約 | |

## 6. 規則做不到的部分（明確列出）

| 情況 | 這套設計怎麼處理 | 要完全自動化需要 |
|---|---|---|
| 任意起訖時間（不對齊格線，例如 10:10–10:50） | 不支援，一律對齊 30 分鐘 | Functions 在伺服器端交易裡查詢重疊 |
| 超過 4 格的長預約 | 不支援；或改成 60 分鐘格線 | 加大格線或 Functions |
| 待審太久沒處理，時段一直被佔 | 每人待審上限＋管理者拒絕；畫面列出待審天數 | 排程自動逾期釋放 |
| 通知會長有新申請、通知申請人結果 | 不做；登入後看到待辦 | Functions 寄信／推播 |
| 原子改期 | 取消＋重新申請兩步 | 可以用規則做（時段鎖「轉移」），但會增加規則複雜度；有需要再加 |
| 同一時段要同時約會長與副會長 | 不支援（每個行事曆各自獨立） | 兩個行事曆的格放在同一批即可做到，06 再評估 |
| 時段鎖因程式錯誤沒被刪掉（孤兒鎖） | 只會造成「多擋」，**不會造成重複預約**；管理者可以刪孤兒鎖 | |

設計刻意讓所有錯誤都偏向「多擋一格」而不是「多約一筆」。

## 7. 模擬器結果的限制

- 探針在模擬器裡用 `Promise.all` 同時送出多個批次與交易，結果全部不重疊（[verification.md](verification.md) P2、P2'）。
- 但模擬器是單一程序，併發處理方式跟正式環境不完全相同〔推論〕。正式環境的保證來自官方文件寫明的原子提交〔文件〕。06 驗收時要在**開發專案**（不是正式專案）再跑一次 B-01、B-05。
