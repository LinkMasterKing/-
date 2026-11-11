# QR 邀請、角色與稽核紀錄

修正階段 00 風險 2：QR 核銷、角色建立與稽核紀錄要有具體的 Security Rules 設計與攻擊測試。

## 1. 目標與威脅

要保證的事：

1. 只有拿到 QR（原始權杖）的人能核銷，而且只能核銷一次，即使多人同時掃同一張。
2. 核銷只能得到邀請上寫的那個部門、那個角色，不能多拿、不能升級、不能拿 `super`。
3. 每一次角色變更（核銷、核准申請、手動授予、撤銷）**一定**留下稽核紀錄，紀錄的內容等於實際的變更，事後不能改、不能刪、不能補寫、不能跳號。
4. 撤權立刻生效。

假設的攻擊者：任何 Google 帳號（可以直接呼叫 Firestore API，不經過我們的畫面）；拿到別人 QR 截圖的人；看得到邀請清單的人；已經是某部門編輯者、想擴權的人；被撤權的人。

**信任邊界**：Firebase 專案的擁有者／編輯者（IAM 成員）用主控台或 Admin SDK 寫資料時**不經過規則**〔文件〕。所以稽核紀錄只能防「透過網站與 API 的使用者」，防不了專案擁有者。緩解：專案 IAM 只放學生會公用帳號＋一個備援帳號，兩者都開兩步驟驗證；交接時一起換密碼（決策 D9）。

## 2. 邀請的生命週期

| 步驟 | 誰 | 寫入（同一批，原子） |
|---|---|---|
| 建立 | 總管理員（D3：也可開放部門管理員邀自己部門的編輯者） | `invitations/{h}`（`rev: 1`, `status: 'active'`）＋`auditLogs/invitations_{h}_1` |
| 掃描預覽 | 登入的任何人 | 讀 `invitations/{h}`（只有 `active` 的讀得到），顯示「你將加入活動部，身分：編輯者，到期時間」 |
| 核銷 | 掃碼者本人 | `invitations/{h}` → `used`（`rev: 2`）＋`roles/{me}` 新增該部門角色（`rev + 1`）＋`auditLogs/invitations_{h}_2`＋`auditLogs/roles_{me}_{rev}`；有 `legacyRef` 時再加 `legacyIdentities/{ref}.claimedBy = me`＋其稽核 |
| 撤銷 | 總管理員 | `invitations/{h}` → `revoked`（`rev: 2`）＋`auditLogs/invitations_{h}_2` |
| 過期 | 不用寫 | 規則把 `expiresAt <= request.time` 的邀請當作無效；清單上標「已過期」 |

### 權杖與 QR

- 權杖：瀏覽器 `crypto.getRandomValues` 產生 32 位元組（256 位元），base64url 編碼。
- 文件 ID：`h = SHA-256(權杖)` 的小寫十六進位（64 字）。資料庫裡只存雜湊；**看得到邀請清單的人（總管理員、匯出的備份）也拿不到可以核銷的權杖。**
- QR 內容：`https://linkmasterking.github.io/-/#join=<權杖>`。放在 `#` 後面，不會送到 GitHub Pages 的伺服器、也不會出現在 Referer〔文件：瀏覽器不傳送網址片段〕。
- 核銷時把原始權杖寫進邀請文件的 `token` 欄位，規則用 `hashing.sha256(token).toHexString().lower() == h` 驗證〔已驗證 P4：`toHexString()` 回傳**大寫**，所以一定要 `.lower()`〕。權杖在用過之後才寫進資料庫，用過的權杖沒有作用。
- 預設 24 小時到期，規則上限 7 天。可選擇綁定信箱（`boundEmail`）：綁定時只有那個 Google 帳號能核銷，建議發「部門管理員」邀請時使用。

## 3. 稽核紀錄鏈（版本號鏈）

所有受保護的文件（`roles`、`invitations`、`roleRequests`、`grants`、`legacyIdentities`、`bookings`、`deptSettings`、`migrations`）都有 `rev`。規則：

1. 這份文件每次寫入，`rev` 必須剛好是舊值＋1（新建＝1）。
2. 同一批寫入裡必須存在 `auditLogs/{集合}_{文件ID}_{新rev}`（`existsAfter`）。
3. 稽核紀錄只能新增；它的 ID 必須等於 `{col}_{docId}_{rev}`，而且「批次後」那份文件的 `rev` 等於它、`updatedBy` 等於寫紀錄的人。
4. 稽核紀錄任何人（包括總管理員）都不能修改或刪除。

結果：

- **不能略過**：沒有稽核紀錄，文件本身就寫不進去〔已驗證 P6c〕。
- **不能補寫或預先佔號**：稽核紀錄只有在同一批把文件推進到那個 `rev` 時才建得出來。
- **不能重複或改寫**：ID 是決定性的，第二次建立會變成「修改」，被拒〔已驗證 P1、P6h 的同類行為〕。
- **不能跳號**：`rev` 只能加 1，所以 `rev` 從 1 到目前值的每一筆紀錄都必然存在。總管理員可以逐號檢查連續性。
- 角色的稽核紀錄另外驗證 `before`、`after` 等於批次前後的 `roles` 內容，所以紀錄寫的就是實際變更。

## 4. 規則設計稿〔待驗證〕

共用函式見 [permissions.md](permissions.md) 第 4 節。

```
function auditAfter(col, id, rev) { return existsAfter(doc('auditLogs', col + '_' + id + '_' + string(rev))); }
function d()           { return request.resource.data; }

// ---------- 邀請 ----------
match /invitations/{h} {
  allow get:  if isSuper() || (signedIn() && resource.data.status == 'active');
  allow list: if isSuper();
  allow delete: if false;

  allow create: if isSuper()                                     // D3 開放時：|| (isAdmin(d().deptId) && d().role == 'editor')
    && h.matches('^[0-9a-f]{64}$')
    && d().keys().hasOnly(['deptId', 'role', 'legacyRef', 'boundEmail', 'note', 'status', 'rev',
                           'createdBy', 'createdAt', 'expiresAt', 'updatedAt', 'updatedBy'])
    && d().status == 'active' && d().rev == 1
    && d().role in ['admin', 'editor']
    && exists(doc('departments', d().deptId))
    && d().createdBy == me() && d().createdAt == request.time && stamped()
    && d().expiresAt > request.time && d().expiresAt <= request.time + duration.value(7, 'd')
    && auditAfter('invitations', h, 1);

  allow update: if revNext() && auditAfter('invitations', h, d().rev) && (redeem() || revoke());

  function redeem() {
    return signedIn()
      && resource.data.status == 'active' && resource.data.expiresAt > request.time
      && onlyChanged(['status', 'usedBy', 'usedAt', 'token', 'rev', 'updatedAt', 'updatedBy']) && stamped()
      && d().status == 'used' && d().usedBy == me() && d().usedAt == request.time
      && hashing.sha256(d().token).toHexString().lower() == h
      && (resource.data.get('boundEmail', null) == null || resource.data.boundEmail == request.auth.token.email)
      && getAfter(doc('roles', me())).data.lastRef == h
      && (resource.data.get('legacyRef', null) == null
          || getAfter(doc('legacyIdentities', resource.data.legacyRef)).data.claimedBy == me());
  }
  function revoke() {
    return isSuper() && resource.data.status == 'active'
      && onlyChanged(['status', 'revokedBy', 'revokedAt', 'rev', 'updatedAt', 'updatedBy']) && stamped()
      && d().status == 'revoked' && d().revokedBy == me() && d().revokedAt == request.time;
  }
}

// ---------- 角色 ----------
match /roles/{uid} {
  function inv()      { return get(doc('invitations', d().lastRef)).data; }       // 批次前
  function invAfter() { return getAfter(doc('invitations', d().lastRef)).data; }  // 批次後
  function viaInvite() {
    return uid == me() && d().lastVia == 'invite' && stamped()
      && inv().status == 'active' && invAfter().status == 'used' && invAfter().usedBy == me();
  }
  function reqAfter() { return getAfter(doc('roleRequests', d().lastRef)).data; }

  allow get:  if signedIn() && (uid == me() || isSuper());
  allow list: if isSuper();
  allow delete: if false;

  allow create: if d().rev == 1 && auditAfter('roles', uid, 1) && (
      ( viaInvite()
        && d().keys().hasOnly(['depts', 'rev', 'lastVia', 'lastRef', 'updatedAt', 'updatedBy'])
        && d().depts == { (inv().deptId): inv().role } )                         // 已驗證 P6：計算鍵的 map 字面值可用
   || superWrite() );

  allow update: if revNext() && auditAfter('roles', uid, d().rev) && (
      ( viaInvite()
        && onlyChanged(['depts', 'rev', 'lastVia', 'lastRef', 'updatedAt', 'updatedBy'])
        && d().depts.diff(resource.data.depts).addedKeys() == [inv().deptId].toSet()
        && d().depts.diff(resource.data.depts).changedKeys().size() == 0
        && d().depts.diff(resource.data.depts).removedKeys().size() == 0
        && d().depts[inv().deptId] == inv().role )                                // 已在該部門有角色就不能核銷（避免降級或重複）
   || superWrite() );

  function superWrite() {
    return isSuper() && stamped()
      && d().lastVia in ['request', 'manual', 'revoke']
      && (uid != me() || d().get('super', false) == (resource == null ? false : resource.data.get('super', false)))  // 不能動自己的 super
      && d().depts.keys().hasOnly(['rights', 'president', 'secretariat', 'marketing', 'finance',
                                   'events', 'affairs', 'pr', 'works', 'fruit'])
      && (d().lastVia != 'request'
          || (reqAfter().status == 'approved' && reqAfter().uid == uid
              && d().depts.get(reqAfter().deptId, null) == reqAfter().role));
  }
}

// ---------- 權限申請 ----------
match /roleRequests/{id} {
  allow get:  if signedIn() && (resource.data.uid == me() || isSuper());
  allow list: if isSuper() || (signedIn() && resource.data.uid == me());
  allow create: if signedIn() && d().uid == me() && d().status == 'pending' && d().rev == 1
    && d().role in ['admin', 'editor'] && exists(doc('departments', d().deptId))
    && d().createdAt == request.time && stamped() && auditAfter('roleRequests', id, 1);
  allow update: if revNext() && auditAfter('roleRequests', id, d().rev) && stamped() && (
      (resource.data.uid == me() && resource.data.status == 'pending' && d().status == 'cancelled'
         && onlyChanged(['status', 'rev', 'updatedAt', 'updatedBy']))
   || (isSuper() && resource.data.status == 'pending' && d().status in ['approved', 'rejected']
         && d().decidedBy == me() && d().decidedAt == request.time
         && onlyChanged(['status', 'decidedBy', 'decidedAt', 'rev', 'updatedAt', 'updatedBy'])) );
  allow delete: if false;
}

// ---------- 稽核紀錄 ----------
match /auditLogs/{aid} {
  function a()        { return request.resource.data; }
  function target()   { return getAfter(doc(a().col, a().docId)).data; }
  function rolesOk() {
    return a().after == { 'super': target().get('super', false), 'depts': target().depts }
      && (a().rev == 1 ? a().before == {}
                       : a().before == { 'super': get(doc('roles', a().docId)).data.get('super', false),
                                         'depts': get(doc('roles', a().docId)).data.depts });
  }
  allow get, list: if isSuper();
  allow update, delete: if false;
  allow create: if signedIn()
    && a().keys().hasOnly(['col', 'docId', 'rev', 'action', 'actor', 'at', 'before', 'after', 'ref'])
    && a().col in ['roles', 'invitations', 'roleRequests', 'grants', 'legacyIdentities',
                   'bookings', 'deptSettings', 'migrations']
    && aid == a().col + '_' + a().docId + '_' + string(a().rev)
    && a().actor == me() && a().at == request.time
    && target().rev == a().rev && target().updatedBy == me()
    && (a().col != 'roles' || rolesOk());
}

// ---------- 舊身分認領 ----------
match /legacyIdentities/{ref} {
  allow get, list: if internalReader();
  allow update: if revNext() && auditAfter('legacyIdentities', ref, d().rev) && stamped()
    && onlyChanged(['claimedBy', 'claimedAt', 'rev', 'updatedAt', 'updatedBy'])
    && resource.data.claimedBy == null && d().claimedAt == request.time
    && ( (d().claimedBy == me()
          && getAfter(doc('invitations', getAfter(doc('roles', me())).data.lastRef)).data.legacyRef == ref
          && getAfter(doc('invitations', getAfter(doc('roles', me())).data.lastRef)).data.usedBy == me())
      || isSuper() );
  allow create, delete: if isSuper();
}
```

### 文件讀取次數預算（不計快取）

| 核銷批次裡的操作 | 讀取 |
|---|---|
| `invitations` 更新 | `existsAfter` 稽核 1、`getAfter` roles 1、（有舊身分時）`getAfter` legacy 1 → 最多 3 |
| `roles` 新增／更新 | `get` 邀請 1、`getAfter` 邀請 1、`existsAfter` 稽核 1；走到 `superWrite` 分支時再加 `exists`／`get` roles 2 → 最多 5 |
| `auditLogs` roles | `getAfter` roles 1、`get` roles 1 → 2 |
| `auditLogs` invitations | `getAfter` 邀請 1 |
| `legacyIdentities` 更新＋其稽核 | `getAfter` roles 1、`getAfter` 邀請 1、`existsAfter` 1；稽核 `getAfter` 1 → 4 |
| 合計 | 最多 15，低於整批 20、每個操作都低於 10〔文件〕 |

如果模擬器實測超過上限，退路是把「認領舊身分」拆成核銷之後的第二批寫入（規則改成檢查 `roles.lastRef` 指向一張已被自己用掉、帶這個 `legacyRef` 的邀請）。

## 5. 撤權

- 總管理員把 `roles/{uid}.depts` 拿掉那個部門（`lastVia: 'revoke'`）＋稽核紀錄。
- 規則每次請求都讀 `roles`，所以下一次寫入就被拒〔文件；待驗證 I-24〕。
- 已經開著的即時監聽：Firestore 在規則相關資料變動後會重新評估監聽，讀取權限也會被收回〔推論，待驗證〕。內部讀取只要求登入（L1），撤部門權限不影響閱讀。
- 要讓某個帳號完全不能讀：決策 D1 選 B（需要核准的檢視者）時才有意義；選 A 時任何 Google 帳號都能讀 L1。

## 6. 為什麼核銷在併發下只會成功一次

- 每一筆核銷都要把 `invitations/{h}` 從 `active` 改成 `used`。規則檢查的是**批次前**的 `status == 'active'`。
- Firestore 的一次提交是原子的；同一份文件的兩筆提交會依序生效，第二筆提交時看到的批次前狀態已經是 `used`，被規則拒絕〔文件；已驗證 P6f：4 個帳號同時核銷，只有 1 個成功〕。
- 前端用交易（先讀邀請、確認 `active`，再寫），交易衝突時自動重試，重試讀到 `used` 就顯示「這張邀請已被使用」。
- 模擬器跟正式環境的併發處理不完全相同〔推論〕，所以 02 驗收時要在**開發專案**再跑一次同時核銷（不碰正式專案）。

## 7. 第一位總管理員與救援

1. 公用帳號建立 Firebase 專案（決定 A3），只在開發專案先做一次演練。
2. 要當總管理員的人先在網站上用 Google 登入一次，產生 UID。
3. 公用帳號在主控台手動建立兩份文件（主控台不經過規則）：
   - `roles/{UID}`：`{ super: true, depts: {}, rev: 1, lastVia: 'manual', lastRef: 'bootstrap', updatedBy: '{UID}', updatedAt: 現在 }`
   - `auditLogs/roles_{UID}_1`：`{ col: 'roles', docId: '{UID}', rev: 1, action: 'bootstrap', actor: '{UID}', at: 現在, before: {}, after: { super: true, depts: {} }, ref: 'console' }`
4. 之後的總管理員由現任總管理員在網站上授予（`lastVia: 'manual'`，有稽核）。
5. 規則禁止總管理員取消自己的 `super`，所以透過網站不可能把總管理員減到零。真的全部失聯時，公用帳號用主控台重做第 3 步。

## 8. 攻擊測試清單（01B 寫成模擬器測試）

「探針」欄：01A 探針已經驗證過同一個機制的項目（探針規則比本設計簡化，01B 要用正式規則重跑全部）。

| # | 攻擊 | 預期 | 探針 |
|---|---|---|---|
| I-01 | 同一張邀請，第二次核銷（同一人重放） | 拒絕 | P6g |
| I-02 | 4 個帳號同時核銷同一張 | 恰好 1 個成功，其餘拒絕；成功者有 1 筆角色與 2 筆稽核 | P6f |
| I-03 | 核銷已過期的邀請 | 拒絕 | P6e |
| I-04 | 核銷已撤銷的邀請 | 拒絕 | |
| I-05 | 只知道雜湊（看過邀請清單）、不知道權杖，嘗試核銷 | 拒絕 | P6d |
| I-06 | 邀請是編輯者，核銷時寫成管理員 | 拒絕 | P6a |
| I-07 | 核銷時順便寫 `super: true` | 拒絕 | |
| I-08 | 邀請是活動部，核銷時寫成公關部 | 拒絕 | P6b |
| I-09 | 核銷時多加一個部門 | 拒絕 | |
| I-10 | 不更新邀請，直接建立自己的 `roles`（`lastRef` 指向別人的有效邀請） | 拒絕 | |
| I-11 | `lastRef` 指向不存在的邀請 | 拒絕 | |
| I-12 | 更新邀請成 `used`，但不寫稽核紀錄 | 拒絕 | P6c |
| I-13 | 稽核紀錄的 `actor` 寫別人、或 `at` 用用戶端時間 | 拒絕 | P5b |
| I-14 | 修改或刪除任何稽核紀錄（含總管理員） | 拒絕 | P6h |
| I-15 | 預先建立 `auditLogs/roles_{別人}_{下一號}` 佔號 | 拒絕 | |
| I-16 | `roles.rev` 一次加 2，或沿用舊號 | 拒絕 | |
| I-17 | 稽核紀錄的 `before`／`after` 跟實際變更不符 | 拒絕 | |
| I-18 | 綁定信箱的邀請由別的帳號核銷 | 拒絕 | |
| I-19 | 已經是該部門管理員，再核銷同部門編輯者邀請（降級） | 拒絕 | |
| I-20 | 非總管理員建立邀請；建立 30 天期限的邀請；角色寫 `super`；部門不存在；文件 ID 不是 64 位小寫十六進位 | 全部拒絕 | |
| I-21 | 非總管理員 list 邀請；get 已使用的邀請 | 拒絕 | |
| I-22 | 未登入、匿名登入、信箱密碼登入、信箱未驗證的帳號做任何寫入 | 拒絕 | |
| I-23 | 申請人把自己的申請改成 `approved` | 拒絕 | |
| I-24 | 被撤權的人在撤權後下一次寫入卡片 | 拒絕 | |
| I-25 | 總管理員取消自己的 `super` | 拒絕 | |
| I-26 | 總管理員用 `lastVia: 'request'` 授權，但申請沒有核准、或部門角色跟申請不符 | 拒絕 | |
| I-27 | 認領不是邀請上寫的舊身分；認領已被認領的舊身分 | 拒絕 | |
| I-28 | 總管理員撤權與使用者核銷同時發生在同一份 `roles` | 兩筆都成功或一筆重試後成功；`rev` 連號、稽核紀錄兩筆 | |
| I-29 | 一般帳號讀 `roles`、`auditLogs`、`invitations`（list）、`users`（別人的） | 拒絕 | |
| I-30 | 正常流程：建立 → 預覽 → 核銷 → 稽核鏈從 1 連號；申請 → 核准；撤權 | 成功 | P6f 的成功路徑 |
