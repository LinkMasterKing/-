# 會長預約：防止重複預約

修正階段 00 風險 3：預約要在「不同時長、部分時間重疊、多人同時送出」時都保證不重複，而且**不能假設 Firestore Rules 本身能判斷重疊**。

## 1. 核心想法：防重複不是靠規則「算重疊」

規則語言沒有迴圈，不能查詢「現在有哪些預約跟我重疊」〔文件〕。所以這套設計不讓規則去比較兩筆預約，而是把問題轉成**文件 ID 的唯一性**：

1. 把時間切成固定格線（建議 30 分鐘一格，見決策 D5）。每一格有一個全域唯一的格號：`idx = 自 1970-01-01 起的毫秒數 ÷ 1,800,000`。台灣是 UTC+8、沒有日光節約，整點與半點都剛好落在格線上。
2. 每一格對應一份**時段鎖**文件：`slots/{ownerId}_{idx}`。
3. 一筆預約佔 `[startSlot, startSlot + slotCount)`，必須在**同一批寫入**裡建立它涵蓋的每一份時段鎖。
4. 時段鎖**只能新增，不能修改**。文件已經存在時，寫入會被當成「修改」並被拒絕〔已驗證 P1〕。
5. 一批寫入是原子的：任何一格被拒，整筆預約（含其他格）都不會寫入〔文件；已驗證 P2b〕。
6. 時段鎖**只能隨它的擁有者（預約或私人忙碌）一起釋放**：刪除一格時，同一批寫入後那筆預約必須已經是 `rejected`／`cancelled`，或那筆私人忙碌必須已經是 `released`。任何人（包括管理者、總管理員透過網站）都不能單獨刪掉一筆仍有效的預約或私人忙碌的鎖（01A-R 修正，見第 4 節）。

### 為什麼這樣就不會重複

兩段整數區間 `[a, a+n)` 與 `[b, b+m)` 重疊，若且唯若 `a < b+m` 且 `b < a+n`。這時 `max(a, b)` 同時落在兩段裡，也就是兩筆預約一定要建立同一份 `slots/{owner}_{max(a,b)}`。同一份文件只能被建立一次，所以**兩筆有重疊的預約不可能都提交成功**，不管時長多少、從哪裡開始重疊、誰先誰後。頭尾相接（`a+n == b`）沒有共同格，兩筆都能成功。

規則在這裡只負責三件事：

- **時段鎖不能被改寫**（`allow update: if false`）。
- **預約與私人忙碌一定要鎖住它涵蓋的每一格**：兩者的建立規則都逐格檢查 `getAfter(slots/...).data.ref == 自己`。少鎖一格、鎖錯格、完全不鎖，都寫不進去〔預約已驗證 P3b、P3c；私人忙碌待驗證 B-28～B-30〕。
- **時段鎖不能脫離擁有者的狀態被刪除**：刪鎖的規則看的是「批次後」擁有者的狀態，而擁有者的狀態轉換（拒絕、取消、釋放）又要求同一批刪掉全部的鎖。兩邊互相要求，所以「有效的預約」與「它的鎖」只能一起存在、一起消失。

真正保證「同一份文件只會被建立一次」的是 Firestore 的原子提交，不是規則邏輯本身。

## 2. 集合

| 集合 | 讀 | 寫 | 欄位 |
|---|---|---|---|
| `calendars/{ownerId}` | L1 | 總管理員 | `name`、`managers`（UID 陣列）、`gridMin: 30`、`maxSlots: 4`、`horizonDays: 60`、`maxPendingPerUser: 3`、`rev` |
| `openWindows/{id}` | L1 | 管理者 | `ownerId`、`start`、`end`（都在格線上）。由管理者的畫面依「每週固定時段」自動產生未來幾週的文件 |
| `slots/{ownerId}_{idx}` | L1 | 見規則 | `ownerId`、`idx`、`ref`（預約或私人忙碌的隨機 ID）。**沒有標題、沒有申請人**，只代表「這格不能約」 |
| `bookings/{id}` | 申請人本人、管理者 | 見規則 | `ownerId`、`requester`、`windowId`、`startSlot`、`slotCount`、`start`、`end`、`topic`、`note`、`status`（`pending`｜`approved`｜`rejected`｜`cancelled`）、`rev`、`createdAt`、`updatedAt`、`updatedBy`、`decidedBy` |
| `busyBlocks/{id}` | 管理者 | 管理者（見規則；**不能硬刪**） | `ownerId`、`title`、`start`、`end`、`startSlot`、`slotCount`（1～4）、`status`（`active`｜`released`）、`rev`、`createdAt`、`updatedAt`、`updatedBy`（私人行程，標題只有管理者看得到） |
| `bookingQuota/{ownerId}_{uid}` | 本人、管理者 | 見規則 | `pending`（目前待審件數） |

`slots.ref` 是隨機 ID，預約與私人忙碌共用同一個欄位，所以一般人從時段鎖分辨不出「有人預約」還是「會長私人有事」。

## 3. 流程

| 動作 | 誰 | 同一批寫入 |
|---|---|---|
| 申請 | 有 L1 的登入者（誰可以申請見決策 D6） | `bookings/{id}`（`pending`, `rev: 1`）＋涵蓋的每一份 `slots`＋`bookingQuota` 加 1＋`auditLogs/bookings_{id}_1` |
| 核准 | 管理者 | `bookings` → `approved`（`rev + 1`）＋稽核；時段鎖不動 |
| 拒絕／取消 | 管理者；或申請人取消自己的 | `bookings` → `rejected`／`cancelled`＋刪除它的所有 `slots`＋`bookingQuota` 減 1＋稽核 |
| 私人忙碌 | 管理者 | `busyBlocks/{id}`（`active`, `rev: 1`）＋涵蓋的**每一份** `slots`；任何一格已被佔（含待審預約）整批失敗，畫面列出衝突的預約，管理者要先拒絕那筆預約再重試 |
| 取消私人忙碌 | 管理者 | `busyBlocks` → `released`（`rev + 1`）＋刪除它的所有 `slots` |
| 清除孤兒鎖 | 管理者 | 只有在鎖指向的預約與私人忙碌都**不存在**時才能單獨刪（只會因為主控台誤操作出現，見第 6 節） |
| 改期 | 申請人 | 先取消、再申請（兩次提交）。第一版不做原子改期，畫面提醒「改期期間時段可能被別人約走」 |

- **私人忙碌一次最多 4 格（2 小時）**：理由同預約的讀取預算（第 4 節）。更長的不在場（整天、出國）不用私人忙碌，而是把那段 `openWindows` 刪掉或縮短；已經成立的預約不受開放時段變動影響，要管理者逐筆拒絕。
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
    return isManager(s().ownerId) && x.ownerId == s().ownerId && x.status == 'active'
        && s().idx >= x.startSlot && s().idx < x.startSlot + x.slotCount;
  }
  // 01A-R：刪鎖不看「誰在刪」，只看「擁有者在批次後是否已經釋放」。
  // 管理者單獨刪鎖（擁有者仍是 pending／approved／active）一律拒絕。
  function r() { return resource.data; }
  function covers(x) { return x.ownerId == r().ownerId && r().idx >= x.startSlot && r().idx < x.startSlot + x.slotCount; }
  function bookingReleased() {                              // 讀 2 次
    return existsAfter(doc('bookings', r().ref))
        && covers(getAfter(doc('bookings', r().ref)).data)
        && getAfter(doc('bookings', r().ref)).data.status in ['rejected', 'cancelled'];
  }
  function busyReleased() {                                 // 讀 3 次（前一項的 existsAfter 為 false 才走到這裡）
    return !existsAfter(doc('bookings', r().ref))
        && existsAfter(doc('busyBlocks', r().ref))
        && covers(getAfter(doc('busyBlocks', r().ref)).data)
        && getAfter(doc('busyBlocks', r().ref)).data.status == 'released';
  }
  function orphan() {                                       // 預約與私人忙碌都不能硬刪，所以兩者都不存在＝主控台造成的孤兒
    return isManager(r().ownerId)
        && !existsAfter(doc('bookings', r().ref)) && !existsAfter(doc('busyBlocks', r().ref));
  }
  allow delete: if signedIn() && (bookingReleased() || busyReleased() || orphan());
}

match /busyBlocks/{xid} {
  function x() { return request.resource.data; }
  function claimed(i) { return getAfter(slotDoc(x().ownerId, i)).data.ref == xid; }
  function claimsAll() {
    let s = x().startSlot; let n = x().slotCount;
    return claimed(s) && (n < 2 || claimed(s + 1)) && (n < 3 || claimed(s + 2)) && (n < 4 || claimed(s + 3));
  }
  function released() {
    let s = resource.data.startSlot; let n = resource.data.slotCount; let o = resource.data.ownerId;
    return !existsAfter(slotDoc(o, s)) && (n < 2 || !existsAfter(slotDoc(o, s + 1)))
        && (n < 3 || !existsAfter(slotDoc(o, s + 2))) && (n < 4 || !existsAfter(slotDoc(o, s + 3)));
  }
  allow get, list: if isManager(resource.data.ownerId);
  allow delete: if false;                                    // 不能硬刪：釋放一定走 status → released
  allow create: if isManager(x().ownerId)
    && x().keys().hasOnly(['ownerId', 'title', 'start', 'end', 'startSlot', 'slotCount', 'status', 'rev',
                           'createdAt', 'updatedAt', 'updatedBy'])
    && x().status == 'active' && x().rev == 1
    && x().slotCount is int && x().slotCount >= 1 && x().slotCount <= 4
    && x().start.toMillis() == x().startSlot * 1800000
    && x().end.toMillis()   == (x().startSlot + x().slotCount) * 1800000
    && x().createdAt == request.time && stamped()
    && claimsAll();                                          // 原子鎖住每一格；任何一格已存在則整批失敗
  allow update: if isManager(resource.data.ownerId) && revNext() && stamped()
    && unchanged(['ownerId', 'start', 'end', 'startSlot', 'slotCount', 'createdAt'])   // 改時間＝釋放後重建
    && ( (resource.data.status == 'active' && x().status == 'active' && onlyChanged(['title', 'rev', 'updatedAt', 'updatedBy']))
      || (resource.data.status == 'active' && x().status == 'released' && released()) );
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

| 其他批次（01A-R 新增） | 讀取 |
|---|---|
| 拒絕／取消預約：`bookings` 更新（`isManager` 1、`released` 4、稽核 1）＋4 份 `slots` 刪除（每份 `bookingReleased` 2）＋`bookingQuota` 約 2＋稽核 1 | 約 17 |
| 建立私人忙碌：`busyBlocks` 新增（`isManager` 1、`claimsAll` 4）＋4 份 `slots` 新增（每份 `getAfter` 預約 1、`getAfter` 私人忙碌 1、`isManager` 1；`bookingCovers` 先失敗才走 `busyCovers`） | 約 17 |
| 釋放私人忙碌：`busyBlocks` 更新（`isManager` 1、`released` 4）＋4 份 `slots` 刪除（每份 `busyReleased` 3） | 約 17 |

三種都低於整批 20，但已經接近上限。01B 要用模擬器量實際讀取次數；如果超過，退路是「一批只處理 3 格」或把 `slots.ref` 改成帶種類前綴（代價是一般人能從鎖分辨出「預約」與「私人忙碌」，要你同意）。

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

01A-R 新增（時段鎖刪除權限、私人忙碌原子鎖）：

| # | 情境 | 預期 |
|---|---|---|
| B-24 | 管理者單獨刪除一筆 `pending` 預約的時段鎖 | 拒絕 |
| B-25 | 管理者單獨刪除一筆 `approved` 預約的時段鎖，再用自己的私人忙碌或別人的預約佔走 | 刪除拒絕，後續建立也因格已存在拒絕 |
| B-26 | 管理者把預約改成 `rejected` 並刪鎖，但少刪一格 | 整批拒絕（`released()` 不成立） |
| B-27 | 申請人把自己的預約改成 `cancelled`，但不刪鎖；之後單獨刪鎖 | 前者拒絕；後者因批次後預約仍是原狀態而拒絕 |
| B-28 | 管理者建立 3 格的私人忙碌，只鎖 2 格 | 拒絕 |
| B-29 | 管理者建立私人忙碌，完全不建立時段鎖 | 拒絕 |
| B-30 | 私人忙碌的時段鎖指向另一個行事曆、或指向不涵蓋這格的私人忙碌 | 拒絕 |
| B-31 | 私人忙碌與一筆已存在的待審預約部分重疊 | 整批拒絕；`busyBlocks` 沒有寫入；那筆預約與它的鎖不變 |
| B-32 | 私人忙碌起點不在格線、超過 4 格、`status` 不是 `active` | 拒絕 |
| B-33 | 管理者與一般帳號同時搶同一格（私人忙碌對預約） | 恰好 1 筆成功 |
| B-34 | 單獨刪除一筆 `active` 私人忙碌的時段鎖（管理者、一般帳號都試） | 拒絕 |
| B-35 | 硬刪 `busyBlocks`；修改 `active` 私人忙碌的 `startSlot`／`slotCount` | 拒絕 |
| B-36 | 把私人忙碌改成 `released` 但少刪一格 | 拒絕 |
| B-37 | 私人忙碌釋放後，任何帳號刪除剩下的鎖；別人立刻申請同一時段 | 成功 |
| B-38 | 孤兒鎖（主控台刪掉預約文件後留下的鎖）：管理者刪除成功；一般帳號、別的行事曆管理者刪除拒絕 | 如述 |
| B-39 | 非管理者讀 `busyBlocks`、或從 `slots` 讀到 `title` | 拒絕；`slots` 沒有 `title` 欄位 |
| B-40 | 拒絕／取消預約、建立與釋放私人忙碌（各 4 格）的整批實際讀取次數 | 都 ≤ 20（量測值回填 [verification.md](verification.md)） |

## 6. 規則做不到的部分（明確列出）

| 情況 | 這套設計怎麼處理 | 要完全自動化需要 |
|---|---|---|
| 任意起訖時間（不對齊格線，例如 10:10–10:50） | 不支援，一律對齊 30 分鐘 | Functions 在伺服器端交易裡查詢重疊 |
| 超過 4 格的長預約 | 不支援；或改成 60 分鐘格線 | 加大格線或 Functions |
| 待審太久沒處理，時段一直被佔 | 每人待審上限＋管理者拒絕；畫面列出待審天數 | 排程自動逾期釋放 |
| 通知會長有新申請、通知申請人結果 | 不做；登入後看到待辦 | Functions 寄信／推播 |
| 原子改期 | 取消＋重新申請兩步 | 可以用規則做（時段鎖「轉移」），但會增加規則複雜度；有需要再加 |
| 同一時段要同時約會長與副會長 | 不支援（每個行事曆各自獨立） | 兩個行事曆的格放在同一批即可做到，06 再評估 |
| 時段鎖因程式錯誤沒被刪掉（孤兒鎖） | 規則下不會發生（擁有者的狀態轉換要求同批刪鎖）；只有主控台誤刪預約文件才會出現。只會造成「多擋」，**不會造成重複預約**；管理者只能刪「擁有者不存在」的鎖 | |
| 管理者要清掉一段已有預約的時間 | 先逐筆拒絕那些預約（有稽核、申請人看得到結果），再建立私人忙碌；不能直接刪鎖 | |

設計刻意讓所有錯誤都偏向「多擋一格」而不是「多約一筆」。

## 7. 模擬器結果的限制

- 探針在模擬器裡用 `Promise.all` 同時送出多個批次與交易，結果全部不重疊（[verification.md](verification.md) P2、P2'）。
- 但模擬器是單一程序，併發處理方式跟正式環境不完全相同〔推論〕。正式環境的保證來自官方文件寫明的原子提交〔文件〕。06 驗收時要在**開發專案**（不是正式專案）再跑一次 B-01、B-05。
