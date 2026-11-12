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
| 掃描預覽 | 登入的任何人 | 讀 `invitations/{h}`（只有 `active` 的讀得到），顯示「你將加入活動部，身分：編輯者，剩下 mm:ss」（02A：沒有 `viewer` 邀請了，登入就能讀） |
| 核銷 | 掃碼者本人 | `invitations/{h}` → `used`（`rev: 2`）＋`roles/{me}` 新增該部門角色（`rev + 1`）＋`auditLogs/invitations_{h}_2`＋`auditLogs/roles_{me}_{rev}`；有 `legacyRef` 時再加 `legacyIdentities/{ref}.claimedBy = me`＋其稽核 |
| 撤銷 | 總管理員 | `invitations/{h}` → `revoked`（`rev: 2`）＋`auditLogs/invitations_{h}_2` |
| 重新產生（02A 新增） | 總管理員 | 同一批：舊邀請 → `revoked`（稽核 `ref` 寫新邀請的雜湊）＋新邀請（新權杖、新雜湊、新的 10 分鐘，稽核 `ref` 寫舊邀請的雜湊）。同一張邀請的期限不能延長（N-09），所以「再給 10 分鐘」一律是重新產生 |
| 過期 | 不用寫 | 規則把 `expiresAt <= request.time` 的邀請當作無效；清單上標「已過期」 |

### 權杖與 QR

- 權杖：瀏覽器 `crypto.getRandomValues` 產生 32 位元組（256 位元），base64url 編碼。
- 文件 ID：`h = SHA-256(權杖)` 的小寫十六進位（64 字）。資料庫裡只存雜湊；**看得到邀請清單的人（總管理員、匯出的備份）也拿不到可以核銷的權杖。**
- QR 內容：`https://<網站網址>/#join=<權杖>`（02A：repo 在 02B 前移轉到學生會 Organization，網址以移轉後的為準，見 [github-ownership-migration.md](github-ownership-migration.md) 第 9 節；程式用 `location` 組網址，不寫死）。放在 `#` 後面，不會送到 GitHub Pages 的伺服器、也不會出現在 Referer〔文件：瀏覽器不傳送網址片段〕。
- 核銷時把原始權杖寫進邀請文件的 `token` 欄位，規則用 `hashing.sha256(token).toHexString().lower() == h` 驗證〔已驗證 P4：`toHexString()` 回傳**大寫**，所以一定要 `.lower()`〕。權杖在用過之後才寫進資料庫，用過的權杖沒有作用。
- **有效期（01A-R 修正，02A 定案）**：預設 10 分鐘，規則上限也是 10 分鐘（`expiresAt <= request.time + 10 分鐘`，以伺服器時間計）。QR 畫面顯示倒數，到期後畫面提示「請重新產生」。不在場的人改走申請（D13 定案）。
- **撤銷**：總管理員隨時可以把 `active` 的邀請改成 `revoked`（含尚未到期、已過期但還沒用過的），撤銷後任何人都不能核銷。撤銷與核銷同時發生時只有一筆成功（兩者都要求批次前 `status == 'active'`，同一份文件依序生效）。
- **一次性核銷**維持不變（第 6 節）。
- **可重新產生**（02A 定案）：見上表「重新產生」。舊 QR 立刻失效（已撤銷），新 QR 從頭倒數 10 分鐘（N-10）。
- 可選擇綁定信箱（`boundEmail`）：綁定時只有那個 Google 帳號能核銷，建議發「部門管理員」邀請時使用。

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

  function roleOk() {                                           // 02A：拿掉 viewer 邀請
    return d().role in ['admin', 'editor'] && exists(doc('departments', d().deptId));
  }
  allow create: if isSuper()                                     // D3 開放時：|| (isAdmin(d().deptId) && d().role == 'editor')
    && h.matches('^[0-9a-f]{64}$')
    && d().keys().hasOnly(['deptId', 'role', 'legacyRef', 'boundEmail', 'note', 'status', 'rev',
                           'createdBy', 'createdAt', 'expiresAt', 'updatedAt', 'updatedBy'])
    && d().status == 'active' && d().rev == 1
    && roleOk()
    && d().createdBy == me() && d().createdAt == request.time && stamped()
    && d().expiresAt > request.time && d().expiresAt <= request.time + duration.value(10, 'm')   // 01A-R：10 分鐘（D13）
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

  function roleKeys() { return ['super', 'depts', 'rev', 'lastVia', 'lastRef', 'updatedAt', 'updatedBy']; }   // 02A：拿掉 viewer
  function oldSuper()  { return resource == null ? false : resource.data.get('super', false); }
  function oldDepts()  { return resource == null ? {} : resource.data.depts; }
  // 「除了這一項，其他權限都沒變」：用來保證 invite／request／revoke 的寫入跟它宣稱的來源一致
  function deptsDelta() { return d().depts.diff(oldDepts()); }
  function onlyDeptAdded(dept, r) {
    return deptsDelta().addedKeys() == [dept].toSet() && deptsDelta().changedKeys().size() == 0
        && deptsDelta().removedKeys().size() == 0 && d().depts[dept] == r;
  }
  function onlyDeptSet(dept, r) {                                                 // 核准申請：新增或改成申請的角色
    return deptsDelta().affectedKeys() == [dept].toSet() && d().depts[dept] == r;
  }

  allow create: if d().rev == 1 && auditAfter('roles', uid, 1) && d().keys().hasOnly(roleKeys())
    && (viaInvite() && inviteGrant() || superWrite());
  allow update: if revNext() && auditAfter('roles', uid, d().rev) && d().keys().hasOnly(roleKeys())
    && (viaInvite() && inviteGrant() || superWrite());

  function inviteGrant() {                                                        // 已驗證 P6：計算鍵的 map 字面值可用
    return d().get('super', false) == oldSuper()
      && onlyDeptAdded(inv().deptId, inv().role);                        // 已在該部門有角色就不能核銷（避免降級或重複）
  }

  function superWrite() {
    return isSuper() && stamped()
      && d().lastVia in ['request', 'manual', 'revoke']
      && (uid != me() || d().get('super', false) == oldSuper())                  // 不能動自己的 super
      && d().depts.keys().hasOnly(['rights', 'president', 'secretariat', 'marketing', 'finance',
                                   'events', 'affairs', 'pr', 'works', 'fruit'])
      && d().depts.values().hasOnly(['admin', 'editor'])
      && (d().lastVia != 'request' || viaRequest())
      && (d().lastVia != 'revoke'  || onlyRemoves());
  }
  // 01A-R：核准申請＝同一批把申請從 pending 改成 approved，而且角色變更只包含申請的那一項
  function viaRequest() {
    let rb = get(doc('roleRequests', d().lastRef)).data;                          // 批次前
    return rb.status == 'pending' && reqAfter().status == 'approved' && reqAfter().decidedBy == me()
      && rb.uid == uid
      && d().get('super', false) == oldSuper()
      && onlyDeptSet(rb.deptId, rb.role);
  }
  // 01A-R：撤權只能拿掉部門或把 super 改成 false，不能新增、不能改值（降級 admin → editor 走 'manual'）
  function onlyRemoves() {
    return deptsDelta().addedKeys().size() == 0 && deptsDelta().changedKeys().size() == 0
      && (d().get('super', false) == false || oldSuper() == true);
  }
}

// ---------- 權限申請 ----------
match /roleRequests/{id} {
  allow get:  if signedIn() && (resource.data.uid == me() || isSuper());
  allow list: if isSuper() || (signedIn() && resource.data.uid == me());
  allow create: if signedIn() && d().uid == me() && d().status == 'pending' && d().rev == 1
    && d().keys().hasOnly(['uid', 'deptId', 'role', 'note', 'legacyRef', 'status', 'rev', 'createdAt', 'updatedAt', 'updatedBy'])
    && d().role in ['admin', 'editor'] && exists(doc('departments', d().deptId))   // 02A：不再申請檢視資格
    && d().createdAt == request.time && stamped() && auditAfter('roleRequests', id, 1);
  allow update: if revNext() && auditAfter('roleRequests', id, d().rev) && stamped() && (
      (resource.data.uid == me() && resource.data.status == 'pending' && d().status == 'cancelled'
         && onlyChanged(['status', 'rev', 'updatedAt', 'updatedBy']))
   || (isSuper() && resource.data.status == 'pending' && d().status == 'rejected'
         && d().decidedBy == me() && d().decidedAt == request.time
         && onlyChanged(['status', 'decidedBy', 'decidedAt', 'rev', 'updatedAt', 'updatedBy']))
   // 01A-R：核准一定要同一批把角色寫進 roles，而且 roles 的來源指向這筆申請。
   // 避免「申請標成已核准但沒有角色」，也避免同一筆已核准的申請被拿來當之後角色寫入的依據（重放）。
   || (isSuper() && resource.data.status == 'pending' && d().status == 'approved'
         && d().decidedBy == me() && d().decidedAt == request.time
         && onlyChanged(['status', 'decidedBy', 'decidedAt', 'rev', 'updatedAt', 'updatedBy'])
         && getAfter(doc('roles', resource.data.uid)).data.lastVia == 'request'
         && getAfter(doc('roles', resource.data.uid)).data.lastRef == id
         && getAfter(doc('roles', resource.data.uid)).data.updatedAt == request.time) );
  allow delete: if false;
}

// ---------- 稽核紀錄 ----------
match /auditLogs/{aid} {
  function a()        { return request.resource.data; }
  function target()   { return getAfter(doc(a().col, a().docId)).data; }
  function rolesOk() {
    return a().after == { 'super': target().get('super', false), 'depts': target().depts }
      && (a().rev == 1 ? a().before == {}
                       : a().before == { 'super':  get(doc('roles', a().docId)).data.get('super', false),
                                         'depts':  get(doc('roles', a().docId)).data.depts });
  }
  allow get, list: if isSuper();
  allow update, delete: if false;
  // 01A-R：稽核紀錄的「動作」與「依據」也要等於文件本身，不只版本號
  function statusOk() {                                     // 有 status 的集合：after.status＝批次後的狀態
    return a().after.status == target().status
      && (a().rev == 1 ? a().before == {} : a().before.status == get(doc(a().col, a().docId)).data.status);
  }
  allow create: if signedIn()
    && a().keys().hasOnly(['col', 'docId', 'rev', 'action', 'actor', 'at', 'before', 'after', 'ref'])
    && a().col in ['roles', 'invitations', 'roleRequests', 'grants', 'legacyIdentities',
                   'bookings', 'deptSettings', 'migrations']
    && aid == a().col + '_' + a().docId + '_' + string(a().rev)
    && a().actor == me() && a().at == request.time
    && target().rev == a().rev && target().updatedBy == me()
    && (a().col != 'roles' || (rolesOk() && a().action == target().lastVia && a().ref == target().lastRef))
    && (!(a().col in ['invitations', 'roleRequests', 'bookings', 'migrations']) || statusOk());
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

| 核准申請批次（01A-R） | 讀取 |
|---|---|
| `roleRequests` 更新（`isSuper` 2、稽核 1、`getAfter` roles 1） | 4 |
| `roles` 新增／更新（`isSuper` 2、稽核 1、`get`／`getAfter` 申請 2；`create` 時 `resource == null`） | 5 |
| `auditLogs` roles（`getAfter` roles 1、`get` roles 1）＋ `auditLogs` roleRequests（`getAfter` 申請 1、`get` 申請 1） | 4 |
| 合計 | 約 13（`isSuper` 讀的是同一份 `roles/{me}`，可能被快取，但不依賴） |

如果模擬器實測超過上限，退路是把「認領舊身分」拆成核銷之後的第二批寫入（規則改成檢查 `roles.lastRef` 指向一張已被自己用掉、帶這個 `legacyRef` 的邀請）。

## 5. 撤權

- 總管理員把 `roles/{uid}.depts` 拿掉那個部門（`lastVia: 'revoke'`）＋稽核紀錄。
- 規則每次請求都讀 `roles`，所以下一次寫入就被拒〔文件；待驗證 I-24〕。
- 讀取不受撤權影響（02A 修正）：內部看板登入就能讀，撤權只收回寫入；已開的監聽照常收到更新（C-19、N-06）。01A-R「把 `viewer` 改成 `false` 讓帳號完全不能讀」的做法隨檢視者一起取消；要擋特定帳號閱讀需要另做封鎖名單（待決定）。
- 撤權的畫面流程見第 9.4 節。

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

01A-R 新增（QR 有效期與撤銷、申請核准與角色變更的一致性；檢視者的 I-46～I-49 在 02A 依新決策改寫）：

| # | 攻擊 | 預期 |
|---|---|---|
| I-31 | 建立 `expiresAt` 超過現在＋10 分鐘的邀請（11 分鐘、24 小時、7 天） | 拒絕 |
| I-32 | 建立後第 9 分 59 秒核銷 | 成功 |
| I-33 | 第 10 分鐘之後核銷（以伺服器時間；用戶端把時鐘調慢也一樣） | 拒絕 |
| I-34 | 非總管理員撤銷邀請 | 拒絕 |
| I-35 | 撤銷已使用的邀請；把 `revoked` 改回 `active` | 拒絕 |
| I-36 | 總管理員撤銷與使用者核銷同時發生 | 恰好一筆成功；狀態與稽核鏈一致 |
| I-37 | 總管理員把申請改成 `approved`，但同一批沒有寫 `roles` | 拒絕 |
| I-38 | 總管理員用一筆**早就核准過**的申請當 `lastRef` 再寫一次角色（重放） | 拒絕（批次前申請必須是 `pending`） |
| I-39 | 以 `lastVia: 'request'` 核准時，順便多加一個部門、改另一個部門、或設 `super: true` | 拒絕 |
| I-40 | 核准 A 的申請，卻把角色寫到 B 的 `roles` | 拒絕 |
| I-41 | 以 `lastVia: 'revoke'` 寫入時新增部門、改任何部門的角色值、把 `super` 從 false 改成 true、或寫入已取消的 `viewer` 欄位 | 拒絕 |
| I-42 | 角色的稽核紀錄 `action` 跟 `roles.lastVia` 不同、或 `ref` 跟 `lastRef` 不同 | 拒絕 |
| I-43 | 申請、邀請、預約的稽核紀錄 `after.status`／`before.status` 跟實際不符 | 拒絕 |
| I-44 | 申請人取消與總管理員核准同時發生 | 恰好一筆成功；失敗的那筆整批（含 `roles`）沒有寫入 |
| I-45 | `roles` 寫入白名單以外的欄位；部門角色值不是 `admin`／`editor` | 拒絕 |
| I-46（02A 修正） | 申請 `role: 'super'`；申請 `viewer`（不論有沒有 `deptId`）；申請不存在的部門；替別人申請 | 拒絕 |
| I-47（02A 修正） | 一般登入者不用申請就讀卡片；寫卡片；總管理員寫入 `viewer` 欄位 | 讀允許；寫與 `viewer` 拒絕 |
| I-48（02A 修正） | 建立 `viewer` 邀請；部門邀請核銷時順便寫 `viewer: true` | 拒絕 |
| I-49（02A 修正） | 一般登入者送出部門申請後：讀卡片、讀自己的申請、讀別人的申請 | 前兩者允許、最後拒絕 |

02A 另外的負面測試（QR 竄改、重放、過期、重新產生、撤權後寫入）見 [permissions.md](permissions.md) 第 5.1b 節 N-06～N-10。

## 9. 02B 實作規格（02A 補齊的缺口）

02B（Google 登入、權限、QR 邀請）開工前，把 01A／01A-R 文件只寫了規則、沒寫清楚的畫面與流程補上。每一項標明「新增」（原文件沒有）或「修正」（原文件有，但跟 02A 定案不一致）。規則與資料結構以前面各節與 `backend/firestore.rules` 為準，這裡不重新設計。

### 9.1 Google 登入流程（新增）

| # | 步驟 | 內容 |
|---|---|---|
| G-1 | 未登入 | 讀得到 L0（部門名稱、公開活動）。部門看板顯示「登入後可以看看板內容」與「用 Google 登入」按鈕；不顯示任何內部資料的骨架數字 |
| G-2 | 登入方式 | Firebase Authentication 的 Google 登入，`signInWithPopup` 為主；彈出視窗被擋（`auth/popup-blocked`）時改用 `signInWithRedirect`。只開 Google 一種登入方式（規則也只接受 `google.com` 且信箱已驗證） |
| G-3 | App 內建瀏覽器 | LINE、Instagram、Facebook 的內建瀏覽器 Google 會擋登入：偵測到時不嘗試登入，改顯示「請用瀏覽器開啟」與「複製網址」按鈕；網址保留 `?d=`、`#join=` |
| G-4 | 登入後第一次 | 同一批：`users/{uid}`（信箱＝登入信箱）＋`profiles/{uid}`（顯示名稱預設取 Google 名稱，超過 40 字截斷，之後本人可改）。之後每次登入只更新 `users.lastLoginAt` |
| G-5 | 決定畫面權限 | 監聽自己的 `roles/{uid}`：沒有文件或 `depts` 為空＝一般登入者（唯讀＋申請入口）；有部門角色＝那些部門可編輯；`super`＝多一個「會長室管理」。角色被改或撤掉時畫面即時切換，不用重新整理 |
| G-6 | 帳號範圍 | 任何 Google 帳號都能登入、都能讀內部看板（02A 定案，等於階段 00 決策 8-7 選「任何 Google 帳號」） |
| G-7 | 登入狀態 | 預設保存在這台裝置（`browserLocalPersistence`）；「登出」清掉登入狀態與本機草稿以外的快取 |
| G-8 | 錯誤 | 關掉視窗：不提示；`auth/unauthorized-domain`：「這個網址還沒開放登入，請改用 `<正式網址>`」；網路錯誤：「沒有連上網路，稍後再試」。錯誤訊息不顯示信箱以外的帳號資料 |
| G-9 | 授權網域 | 只有移轉後的正式網域（[github-ownership-migration.md](github-ownership-migration.md) 第 9 節 F1）與本機測試用的 `localhost` |
| G-10 | 測試 | 前端測試用 Auth 模擬器（`firebase emulators` 加上 `auth`），不連真的專案 |

### 9.2 角色與授權（修正：拿掉檢視者，對齊四種身分）

| 身分 | 資料 | 讀 | 寫 | 怎麼取得 | 畫面上多出來的東西 |
|---|---|---|---|---|---|
| 一般登入者 | 沒有 `roles`，或 `depts` 空、`super` 不是 true | L0、L1 | 只有自己的 `users`、`profiles`、`roleRequests` | 用 Google 登入 | 「申請編輯權限」：選部門、選角色（編輯者／管理員）、備註、可選「我是舊身分 X」 |
| 部門編輯者 | `depts.{部門} == 'editor'` | 同上＋該部門刪除中的卡片 | 該部門的卡片、議題、週報、標籤、時間事件；永久刪除該部門卡片 | QR 邀請，或申請經會長室核准 | 該部門看板的編輯、刪除 |
| 部門管理員 | `depts.{部門} == 'admin'` | 同上 | 編輯者的全部＋該部門 `deptSettings` | 同上 | 部門設定 |
| 會長室（總管理員） | `super == true` | 全部（私人行程除外，那是行事曆管理者的） | 全部（角色、邀請、申請審核、遷移）；刪卡片也走永久刪除流程 | 第一位由主控台建立（第 7 節）；之後由現任總管理員授予 | 「會長室管理」：人員與角色、待審申請、QR 邀請、稽核紀錄 |

- 「會長室」身分＝總管理員 `super`；會長室這個**部門**的看板編輯權（`depts.president`）是另一回事，兩者分開授予。
- 一個人可以同時有好幾個部門的角色；同一部門只有一個角色。
- 部門管理員不能發邀請、不能審申請（D3 不變）。

### 9.3 QR 邀請的產生與核銷（新增：畫面流程；有效期等規則見第 2 節）

產生（會長室管理 → QR 邀請）：

1. 選部門、角色（編輯者／管理員）；可選「綁定信箱」（發管理員邀請時建議綁）、「給舊身分 X」。
2. 瀏覽器產生 32 位元組權杖 → 算 SHA-256 → 同一批寫 `invitations/{h}`（`expiresAt`＝現在＋10 分鐘）＋稽核。權杖只留在這個畫面的記憶體裡，不寫進 localStorage、不印到 console。
3. 顯示 QR、部門與角色、倒數 mm:ss、「重新產生」「撤銷」兩個按鈕。到期後 QR 變灰、只剩「重新產生」。
4. 「重新產生」＝同一批撤銷舊的＋建立新的（第 2 節表格）；「撤銷」要確認一次。
5. 邀請清單（Q24）列出進行中的邀請：部門、角色、剩餘時間、建立者；已用掉的顯示核銷者與時間。清單上永遠看不到權杖（只存雜湊）。
6. QR 圖的產生方式：不能加 npm 套件，要放一支單檔 QR 程式進 repo 或自己寫（階段 00 決策 8-8，待你決定）。

核銷（掃碼的人）：

1. 打開 `…/#join=<權杖>`：程式**一讀到就用 `history.replaceState` 把 `#join=` 從網址列拿掉**，權杖暫存在 `sessionStorage`（關掉分頁就沒了），避免留在瀏覽紀錄或被截圖。
2. 沒登入：先走 9.1 登入，登入完回到這個流程。
3. 預覽：用雜湊讀邀請（只有 `active` 的讀得到）。讀不到一律顯示「這張邀請已失效（已使用、已撤銷或超過 10 分鐘），請向會長室要新的 QR」，不區分原因。讀得到就顯示部門、角色、剩餘時間與「加入」按鈕。
4. 按「加入」：交易內重讀邀請與自己的 `roles`，同一批寫邀請（`used`＋權杖）、`roles`、兩筆稽核（有舊身分再加認領）。成功後清掉 `sessionStorage` 的權杖，畫面切到那個部門的看板並提示「已加入 X 部（編輯者）」。
5. 失敗的對應訊息：已經在那個部門有角色 →「你已經是 X 部的 Y」；綁定信箱不符 →「這張邀請只限指定的帳號使用」；交易重試後邀請已用掉 → 同第 3 步的失效訊息。

### 9.4 撤權（新增：畫面流程）

1. 會長室管理 → 人員：列出全部 `roles`（Q21），每人顯示名稱、部門角色、是否總管理員。
2. 對一個人可以：拿掉某個部門（`lastVia: 'revoke'`）、把管理員降成編輯者或反過來（`manual`）、授予或取消總管理員（不能對自己取消）。都用交易：讀最新 `roles` → `rev + 1` → 同一批寫稽核。
3. 確認對話框寫清楚後果：「撤掉後他仍然看得到看板（登入就能讀），但不能再編輯 X 部」。
4. 被撤權的人：畫面透過 `roles` 監聽即時切回唯讀；正在編輯的內容存檔被拒時保留草稿，提示「你在 X 部的編輯權限已被收回」。
5. 讀取收不回（02A 定案的後果）。要完全擋掉某個帳號閱讀需要另做封鎖名單（待你決定，見 [README.md](README.md) 待辦）。

### 9.5 稽核紀錄（新增：畫面；規則見第 3、4 節）

1. 會長室管理 → 紀錄：最近 50 筆（Q26），可翻頁；可以篩「某人的權限歷史」（Q25）與「某人做過什麼」（Q27）。
2. 每筆顯示：時間、操作者（`profiles` 名稱）、動作（建立邀請、核銷、撤銷、重新產生、申請、核准、拒絕、撤權、手動調整、部門設定、會議授權、遷移）、對象、前後差異（角色顯示部門與角色的增減）。
3. 「檢查連號」：對一份受保護的文件從第 1 號讀到目前的 `rev`，缺號就標紅（規則保證不會缺，這是給你事後確認的工具）。
4. 稽核紀錄只能新增，任何人都不能改或刪（I-14）；備份照 D11 一起匯出。
5. 卡片的編輯紀錄不在這裡（是卡片的版本歷史）；卡片永久刪除後它的版本也一起消失，所以「誰刪了哪張卡片」目前沒有留下紀錄（待你決定要不要加，見 [README.md](README.md) 待辦）。
