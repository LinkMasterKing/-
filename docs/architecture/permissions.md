# 資料分級、角色與權限矩陣

## 1. 資料分級（依決定 A2 修正）

| 等級 | 誰能讀 | 內容 |
|---|---|---|
| L0 公開 | 任何人，不用登入 | `departments`（部門名稱與外觀）、`org/config`、`events` 中 `visibility == 'public'` 的公開活動 |
| L1 內部 | 已授權的檢視者、有任何部門角色的人、總管理員（01A-R 定案，見第 2.1 節〔啟用前核准〕） | 看板內容：`deptSettings`、`cards`（未刪除）、`cards/{id}/versions`（只限未刪除的卡片）、`issues`、`weeks`、`labels`、`events`（全部非私人）、`profiles`、`legacyIdentities`、`grants`、`calendars`、`openWindows`、`slots`（只有忙／閒） |
| 本人 | 登入者自己 | `users/{自己}`、`roles/{自己}`、自己的 `roleRequests`、自己的 `bookings`、`bookingQuota` |
| L2 部門 | 該部門管理員／編輯者 | 該部門已刪除的卡片（`state == 'deleted'`）**與它的版本歷史** |
| L3 秘書處授權 | 秘書處管理員／編輯者、總管理員 | `meetingMinutes`、`attendance*` |
| L4 會長室 | 總管理員 | 全部 `roles`、`roleRequests`、`invitations`、`auditLogs`、`migrations`、`users` |
| 預約管理者 | `calendars/{ownerId}.managers` 列出的 UID | 該行事曆的 `bookings`、`busyBlocks`（私人標題） |

### 跟現在比，誰會看不到原本看得到的東西

現在所有部門的資料檔都是公開的。切換後，**沒登入的人只看得到部門名稱與公開活動**；從 LINE 內建瀏覽器點進來的人，要先用外部瀏覽器開啟並登入才看得到看板內容（Google 會擋內建瀏覽器的登入〔推論，02 實機驗證〕）。02 的畫面要在未登入時清楚說明這一點。

## 2. 角色

| 角色 | 怎麼取得 | 能做什麼 |
|---|---|---|
| 未登入 | | 讀 L0 |
| 一般使用者 | 用 Google 登入，沒有 `roles` 文件（或 `roles` 裡沒有任何權限） | 讀 L0；建立自己的 `users`／`profiles`；提出權限申請（含檢視資格）。**讀不到 L1** |
| 已授權檢視者 `viewer` | 申請經總管理員核准，或 QR 邀請（`role: 'viewer'`） | 讀 L1；**仍然唯讀**，不能寫任何看板內容；（06 起，依 D6）預約申請另議 |
| 部門編輯者 `editor` | QR 邀請或申請經總管理員核准 | 該部門的卡片、議題、週報、標籤、時間事件的新增與修改 |
| 部門管理員 `admin` | 同上 | 編輯者的權限＋該部門 `deptSettings`、看該部門已刪除卡片、硬刪以外的復原 |
| 會長室總管理員 `super` | 第一位由主控台手動建立；之後由總管理員授予 | 全部讀寫（硬刪、角色、邀請、稽核、遷移）；不能取消自己的 `super` |
| 預約管理者 | `calendars/{ownerId}.managers` | 管理該行事曆的開放時段、私人忙碌、審核預約 |

部門別帶來的特殊權限（不是另一種角色）：

| 條件 | 額外權限 |
|---|---|
| 秘書處編輯者＋`grants/meetingEdit.until` 未到期 | 修改任何部門 `report == true` 的卡片內容與其時間事件 |
| 秘書處編輯者 | 把時間事件標成 `scope: 'all-meeting'`；讀寫 L3 |
| 活動部編輯者 | 把任何部門的時間事件標成 `scope: 'all-activity'`；發布公開活動（見決策 D4） |

### 2.1 已授權檢視者（01A-R 定案〔啟用前核准〕）

取代 01A 的 `internalReader() = signedIn()`（決策 D1 的選項 A）。01B 照這個實作與測試；**02 在真的專案啟用前要你核准**。

- 資料：`roles/{uid}.viewer: true`。沿用 `roles` 的版本號鏈與稽核（[invitations-roles-audit.md](invitations-roles-audit.md) 第 3 節），不另開集合，`internalReader()` 每次請求只多讀 0 次（`role()` 本來就會讀）。
- 取得：使用者在網站上送出 `roleRequests`（`role: 'viewer'`、`deptId: null`），總管理員核准；或總管理員發 `role: 'viewer'` 的 QR 邀請。
- 有部門角色或 `super` 的人自動是檢視者，不用另外申請。撤掉部門角色時 `viewer` 不會自動消失；要完全收回閱讀權限，總管理員另外把 `viewer` 改成 `false`（一樣有稽核）。
- 取得資格後仍是唯讀：規則裡所有寫入條件都用 `isEditor`／`isAdmin`／`isSuper`，沒有任何一條接受 `viewer`。
- 申請中的人在畫面上看到「已送出檢視申請，等待會長室核准」，看不到任何看板內容。
- 換屆：是否加 `viewerUntil`（到期自動失效）見決策 D12。

是否保留 `editor` 這一級、部門管理員能不能自己發邀請：見決策 D2、D3。規則已經支援兩級；如果只要一級，管理員以外都不發 `editor` 就好，規則不用改。

## 3. 權限矩陣

R＝讀、C＝新增、U＝修改、D＝硬刪；「部門」＝文件的 `deptId` 是自己有角色的部門。

| 集合 | 未登入 | 一般登入 | 部門編輯者 | 部門管理員 | 總管理員 | 備註 |
|---|---|---|---|---|---|---|
| `departments` | R | R | R | R | RCUD | |
| `org/config` | R | R | R | R | RCU | |
| `deptSettings` | | R | R | RU（部門） | RCUD | |
| `users/{uid}` | | 本人 RCU | 本人 | 本人 | R | 信箱必須等於登入信箱 |
| `profiles/{uid}` | | R；本人 CU | 同左 | 同左 | RU | |
| `roles/{uid}` | | 本人 R；核銷邀請時本人 CU | 同左 | 同左 | RCU（不能動自己的 `super`） | 見 [invitations-roles-audit.md](invitations-roles-audit.md) |
| `roleRequests` | | 本人 RC、本人撤回（含申請 `viewer`） | 同左 | 同左 | RU（核准要同批改 `roles`） | |
| `invitations` | | 知道權杖者 get；核銷 U | 同左 | 同左（D3 開放則可對自己部門 C） | RCU | 不能 list |
| `legacyIdentities` | | R；核銷認領 U | 同左 | 同左 | RCU | |
| `auditLogs` | | 只能隨受保護的寫入一起 C | 同左 | 同左 | R | 任何人都不能 U、D |
| `cards` | | 檢視者 R（未刪除） | RCU（部門）＋讀已刪除 | RCU（部門）＋讀已刪除 | RCUD | 秘書處授權期間可 U 報告事項 |
| `cards/{id}/versions` | | 檢視者 R（**只限卡片可讀時**） | R 同卡片；C（隨卡片） | 同左 | R、C | 不能 U、D；跨卡片查詢（collection group）只限本部門或總管理員 |
| `issues`、`weeks`、`labels` | | R | RCU（部門） | RCU（部門） | RCUD | |
| `events` | R（`public`） | R | RCU（部門） | RCU（部門） | RCUD | 全會範圍、公開見第 2 節 |
| `grants/meetingEdit` | | R | R | R | RCU | |
| `meetingMinutes` | | | 秘書處 RCU | 秘書處 RCU | RCUD | |
| `attendance*` | | | 秘書處 RCU | 秘書處 RCU | RCUD | 07 定稿 |
| `calendars`、`openWindows` | | R | R | R | RCU | 管理者 CU |
| `slots` | | R；隨自己的預約 C；預約批次後已拒絕／取消時 D | 同左 | 同左 | R | 管理者隨私人忙碌 C；**任何人都不能單獨刪除有效預約或私人忙碌的鎖**；任何人都不能 U（[booking.md](booking.md) 第 4 節） |
| `bookings` | | 本人 RC、本人取消 | 同左 | 同左 | R | 管理者 RU |
| `busyBlocks` | | | | | | 只有管理者 RCU；不能硬刪，釋放＝`released`＋同批刪鎖 |
| `migrations` | | | | | RCU | |

## 4. 規則共用函式（設計稿〔待驗證〕）

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function doc(col, id)   { return /databases/$(database)/documents/$(col)/$(id); }
    function signedIn()     { return request.auth != null
                                && request.auth.token.firebase.sign_in_provider == 'google.com'
                                && request.auth.token.email_verified == true; }
    function me()           { return request.auth.uid; }
    function hasRole()      { return signedIn() && exists(doc('roles', me())); }
    function role()         { return get(doc('roles', me())).data; }
    // L1 的定義集中在這一個函式。
    // 01A（選項 A）：return signedIn();
    // 01A-R 定案（選項 B，已授權檢視者）〔啟用前核准〕：
    function internalReader() { return hasRole() && ( role().get('viewer', false) == true
                                                   || role().get('super', false) == true
                                                   || role().get('depts', {}).size() > 0 ); }
    function isSuper()      { return hasRole() && role().get('super', false) == true; }
    function deptRole(d)    { return hasRole() ? role().get('depts', {}).get(d, null) : null; }
    function isEditor(d)    { return deptRole(d) in ['admin', 'editor']; }
    function isAdmin(d)     { return deptRole(d) == 'admin'; }
    function now()          { return request.time; }
    function stamped()      { return request.resource.data.updatedAt == request.time
                                && request.resource.data.updatedBy == me(); }
    function unchanged(keys){ return !request.resource.data.diff(resource.data).affectedKeys().hasAny(keys); }
    function onlyChanged(keys) { return request.resource.data.diff(resource.data).affectedKeys().hasOnly(keys); }
    function revNext()      { return request.resource.data.rev == resource.data.rev + 1; }
    ...
  }
}
```

要點：

- 角色每次請求都從 `roles/{uid}` 讀，不用 custom claims，所以**撤權立刻生效**，不用等登入權杖過期（custom claims 要 Admin SDK 或 Functions 才能設〔文件〕）。
- 規則每個操作最多 10 次文件讀取（`get`／`exists`／`getAfter`／`existsAfter`），整批最多 20 次；超過一律拒絕〔文件；10 次上限已驗證 P7〕。同一份文件重複讀取可能會被快取、不計次〔文件〕，但設計不依賴快取：每條規則都按「不快取」計算過次數。
- `signedIn()` 限定 Google 登入，避免日後有人在主控台多開匿名登入或信箱登入時，規則意外放行。

## 5. 一般資料的規則（設計稿〔待驗證〕）

### 5.1 卡片

```
match /cards/{id} {
  function d()        { return request.resource.data; }
  function verDoc()   { return /databases/$(database)/documents/cards/$(id)/versions/$(string(d().version)); }
  // 01A-R：版本一定要「在這一批新建」，不接受已存在的舊版本文件（例如總管理員硬刪後重建同 ID 的卡片）
  function verAfter() { return !exists(verDoc()) && existsAfter(verDoc()); }
  allow get:  if internalReader() && (resource.data.state != 'deleted' || isEditor(resource.data.deptId) || isSuper());
  allow list: if internalReader() && (resource.data.state in ['open', 'done'] || isEditor(resource.data.deptId) || isSuper());

  allow create: if isEditor(d().deptId) && cardShape()
    && d().state == 'open' && d().version == 1
    && d().createdBy == me() && d().createdAt == request.time && stamped()
    && verAfter();

  allow update: if cardShape() && unchanged(['deptId', 'createdAt', 'createdBy', 'importBatch', 'legacyDesc'])
    && ( editorEdit() || meetingEdit() || reorder() );

  function editorEdit()  { return isEditor(resource.data.deptId) && stamped()
                             && d().version == resource.data.version + 1 && verAfter() && stateMove(); }
  function meetingEdit() { return isEditor('secretariat') && resource.data.report == true
                             && get(doc('grants', 'meetingEdit')).data.until > request.time
                             && onlyChanged(['title', 'blocks', 'timeIds', 'version', 'updatedAt', 'updatedBy'])
                             && stamped() && d().version == resource.data.version + 1 && verAfter(); }
  function reorder()     { return isEditor(resource.data.deptId) && onlyChanged(['order', 'updatedAt', 'updatedBy']) && stamped(); }
  // 狀態轉換：open→done（doneAt == 現在）、done→open、任何→deleted（deletedAt、deletedBy）、deleted→open
  allow delete: if isSuper();
}

// 01A-R：版本改成卡片的子集合 cards/{cardId}/versions/{version}。
// 原因：頂層 cardVersions 的讀取只看 internalReader()，一般檢視者可以繞過「已刪除卡片只有部門看得到」去讀歷史內容。
// 子集合的路徑裡就有 cardId，規則可以直接讀母卡片判斷（查詢時 cardId 也是固定的，規則能判斷）。
match /cards/{cid}/versions/{v} {
  function card()      { return get(doc('cards', cid)).data; }
  function cardAfter() { return getAfter(doc('cards', cid)).data; }
  function nv()        { return request.resource.data; }
  // 讀：跟母卡片同一個條件。母卡片被硬刪（不存在）時只有總管理員讀得到。
  allow get, list: if isSuper()
    || (internalReader() && exists(doc('cards', cid))
        && (card().state != 'deleted' || isEditor(card().deptId)));
  allow create: if signedIn()
    && nv().keys().hasOnly(['cardId', 'deptId', 'version', 'title', 'blocks', 'times', 'state', 'by', 'at', 'imported'])
    && nv().cardId == cid && v == string(nv().version)
    && cardAfter().version == nv().version                   // 版本號＝批次後卡片的版本號（卡片規則保證只 +1）
    && nv().deptId == cardAfter().deptId
    && nv().title  == cardAfter().title
    && nv().blocks == cardAfter().blocks
    && nv().state  == cardAfter().state
    && nv().by == me() && nv().by == cardAfter().updatedBy
    && nv().at == request.time && nv().at == cardAfter().updatedAt
    && nv().imported == false;                               // true 只出現在遷移路徑（migration.md 第 3 節，總管理員＋running 批次）
  allow update, delete: if false;
}

// 跨卡片查詢（會長室編輯量 Q9）：collection group。
// 規則不能逐筆讀母卡片，所以只開放給「看得到這個部門所有卡片（含已刪除）」的人。
match /{path=**}/versions/{v} {
  allow list: if isSuper() || isEditor(resource.data.deptId);
}
```

- 卡片與版本互相檢查：卡片規則要求同一批**新建**了對應版本號的版本文件（`verAfter`）；版本規則要求內容（`title`、`blocks`、`state`、`deptId`）、作者、時間都等於批次後的卡片。兩邊都只看批次後的狀態，所以不會有「卡片改了、版本沒寫」或「版本寫的跟卡片不一樣」。
- `times`（當時的時間值快照）來自 `events`，長度不固定，規則沒辦法逐筆比對，**由前端負責**；它只用在歷史顯示，不影響權限〔待驗證：01B 用前端測試覆蓋〕。
- 已知殘留：已刪除卡片在 `events` 裡的時間標記（名稱、地點、時間）仍是 L1 可讀。規則沒辦法在查詢時逐筆讀母卡片。01B 的做法：卡片改成 `deleted` 時，前端同一批把它的時間事件標 `cardDeleted: true`，`events` 的讀取規則排除 `cardDeleted == true`（部門編輯者除外），`events` 的寫入規則檢查 `cardDeleted == (getAfter(卡片).state == 'deleted')`。規則能保證「標了的一定正確」，但不能保證「每一筆都標了」（卡片的時間事件數量不固定）；漏標的後果是時間標記仍可讀、卡片內文不會外流。已定案採用（D14）。
- 每次內容修改都產生一筆版本（寫入次數 ×2）。「勾選一個核取方塊算不算一個版本」是 04 的設計問題（階段 00 的 8-9）；01B 先全部算版本，04 再決定要不要放寬成「只改 `check` 不加版本」。
- 併發：前端一律用交易，「讀最新 → 改 → 寫回並帶 `version + 1`」。兩人同時改同一張卡片時，後提交的交易會因為讀過的文件已變更而重試，重試時拿到新版本再套用自己的修改〔文件：交易的樂觀併發〕。規則的 `version == 舊 + 1` 保證不會有兩個人寫出同一個版本號〔待驗證〕。

### 5.1a 一般資料攻擊測試（01A-R 新增，01B 寫成模擬器測試）

| # | 情境 | 預期 |
|---|---|---|
| C-01 | 已授權檢視者 `get` 已刪除的卡片 | 拒絕 |
| C-02 | 已授權檢視者 `get` 已刪除卡片的任一版本（直接猜 `cards/X/versions/3`） | 拒絕 |
| C-03 | 已授權檢視者 `list` 已刪除卡片的版本 | 拒絕 |
| C-04 | 已授權檢視者用 collection group 查詢所有 `versions`（不帶或帶別部門 `deptId`） | 拒絕 |
| C-05 | 同部門編輯者讀已刪除卡片與它的版本；總管理員讀硬刪後留下的版本 | 允許 |
| C-06 | 別部門的編輯者讀已刪除卡片的版本 | 拒絕 |
| C-07 | 卡片復原（`deleted` → `open`）後，檢視者讀版本 | 允許 |
| C-08 | 編輯者更新卡片內容但不寫版本 | 拒絕 |
| C-09 | 版本的 `title`／`blocks`／`state`／`deptId`／`by`／`at` 任一項跟批次後的卡片不同 | 拒絕 |
| C-10 | 卡片版本號一次加 2、或沿用舊號 | 拒絕 |
| C-11 | 單獨建立版本文件（同批沒有更新卡片），包括替遷移卡片「補」缺的版本 | 拒絕 |
| C-12 | 總管理員硬刪卡片後，用同一個 ID 重建卡片，沿用留下的 `versions/1` | 拒絕（版本必須同批新建） |
| C-13 | 修改或刪除任何版本（含總管理員） | 拒絕 |
| C-14 | 版本寫 `imported: true`（非遷移路徑） | 拒絕 |
| C-15 | 兩個編輯者同時改同一張卡片 | 各自產生連續版本號，沒有重號；後提交的交易重試 |
| C-16 | 秘書處在 `meetingEdit` 到期後修改報告卡片；修改沒標 `report` 的卡片 | 拒絕 |
| C-17 | 沒有角色的登入者（未核准檢視）讀 `cards`、`issues`、`events`（非公開）、`profiles`、`slots` | 拒絕 |
| C-18 | 已授權檢視者寫任何看板內容（卡片、議題、週報、標籤、時間事件、`deptSettings`） | 拒絕 |
| C-19 | 撤掉檢視者（`viewer: false`、沒有部門角色）後下一次讀取；已開的監聽 | 讀取拒絕；監聽行為記錄在 verification.md |
| C-20 | 時間事件寫 `cardDeleted` 跟批次後母卡片的狀態不一致 | 拒絕 |

### 5.2 時間事件

```
match /events/{id} {
  allow get, list: if resource.data.visibility == 'public'
    || (internalReader() && (resource.data.get('cardDeleted', false) == false
                             || isEditor(resource.data.deptId) || isSuper()));   // cardDeleted：D14
  allow create: if isEditor(request.resource.data.deptId) && eventShape() && scopeOk() && visOk() && stampedRev1();
  allow update: if eventShape() && unchanged(['deptId']) && stamped() && revNext() && (
         (isEditor(resource.data.deptId) && scopeOk() && visOk())
      || (isEditor('events')      && onlyChanged(['scope', 'rev', 'updatedAt', 'updatedBy'])
                                  && request.resource.data.scope in ['dept', 'all-activity'])
      || (isEditor('secretariat') && onlyChanged(['scope', 'rev', 'updatedAt', 'updatedBy'])
                                  && request.resource.data.scope in ['dept', 'all-meeting'])
      || meetingEditOfReportedCard() );
  function scopeOk() { return request.resource.data.scope == (resource == null ? 'dept' : resource.data.scope)
                           || request.resource.data.scope == 'dept'
                           || (request.resource.data.scope == 'all-activity' && isEditor('events'))
                           || (request.resource.data.scope == 'all-meeting'  && isEditor('secretariat'))
                           || isSuper(); }
  function visOk()   { return request.resource.data.visibility == 'internal'
                           || ((isEditor('events') || isSuper()) && publicShape()); }   // D4
  allow delete: if isSuper();
}
```

`publicShape()` 限制公開事件只能有 `deptId、title、summary、start、end、allDay、place、scope、visibility、rev、updatedAt、updatedBy`，避免卡片內文跟著公開。

### 5.3 其他

| 集合 | 規則重點 |
|---|---|
| `deptSettings` | `isAdmin(deptId) \|\| isSuper()`；`rev` 加 1 |
| `issues`、`weeks`、`labels` | 同卡片的部門檢查、`deptId` 不能改、`stamped()`；不產生版本 |
| `users/{uid}` | `uid == me()`；`email == request.auth.token.email`；之後只能改 `lastLoginAt` |
| `profiles/{uid}` | `uid == me()`；`displayName` 是 1～40 字的字串 |
| `grants/meetingEdit` | 只有 `isSuper()`；`until` 不超過現在＋7 天；`rev` 加 1 且要有稽核紀錄（見 [invitations-roles-audit.md](invitations-roles-audit.md) 第 3 節） |
| `meetingMinutes`、`attendance*` | `isEditor('secretariat') \|\| isSuper()` |
| 其他沒列到的路徑 | 預設拒絕：`match /{document=**} { allow read, write: if false; }` |

## 6. 規則做不到、需要 Cloud Functions（Blaze）或人工的事

| 需求 | Spark＋規則的做法 | 要 Functions 才能做到的 |
|---|---|---|
| 寄信或推播通知（申請送出、預約核准） | 不做；登入後在畫面上看到待辦 | 觸發器寄信／推播 |
| 過期資料清理（過期邀請、逾時未審的預約） | 規則把過期的當作無效；畫面不顯示；總管理員手動清 | 排程清理 |
| 排程備份 | 總管理員在瀏覽器手動「匯出全部資料」 | 受管匯出需要啟用計費〔文件〕 |
| 跨大量文件的統計 | 前端查詢後自己算 | 計數器觸發器 |
| 雙人覆核（例如授予 `super` 要兩位總管理員同意） | 不做；靠稽核紀錄事後檢查 | 可用 Functions 檢查 |
| 依 IP 限流 | 不做；靠 App Check（D7）與 Spark 額度上限 | |

結論：01A 範圍內沒有「非 Functions 不可」的需求。上表左欄的取捨要請你確認（決策 D8）。
