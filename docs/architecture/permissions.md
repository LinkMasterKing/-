# 資料分級、角色與權限矩陣

## 1. 資料分級（依決定 A2 修正）

| 等級 | 誰能讀 | 內容 |
|---|---|---|
| L0 公開 | 任何人，不用登入 | `departments`（部門名稱與外觀）、`org/config`、`events` 中 `visibility == 'public'` 的公開活動 |
| L1 內部 | **任何已登入的 Google 帳號，不需審核**（02A 定案，取代 01A-R 的已授權檢視者，見第 2.1 節） | 看板內容：`deptSettings`、`cards`（`open`／`done`）、`cards/{id}/versions`（只限 `open`／`done` 的卡片）、`issues`、`weeks`、`labels`、`events`（全部非公開的）、`profiles`、`legacyIdentities`、`grants`、`calendars`、`openWindows`、`slots`（只有忙／閒） |
| 本人 | 登入者自己 | `users/{自己}`、`roles/{自己}`、自己的 `roleRequests`、自己的 `bookings`、`bookingQuota` |
| L2 部門 | 該部門管理員／編輯者 | 該部門**刪除中**的卡片（`state == 'purging'`）與它的版本，只給前端接續清除用（02A 修正：沒有「已刪除、可復原」的卡片了，見第 5.1 節） |
| L3 秘書處授權 | 秘書處管理員／編輯者、總管理員 | `meetingMinutes`、`attendance*` |
| L4 會長室 | 總管理員 | 全部 `roles`、`roleRequests`、`invitations`、`auditLogs`、`migrations`、`users` |
| 預約管理者 | `calendars/{ownerId}.managers` 列出的 UID | 該行事曆的 `bookings`、`busyBlocks`（私人標題）。**會長私人行程不在 L1 開放範圍**（02A），總管理員與會長室部門角色也讀不到 |

### 跟現在比，誰會看不到原本看得到的東西

現在所有部門的資料檔都是公開的。切換後，**沒登入的人只看得到部門名稱與公開活動**；登入任何 Google 帳號就看得到全部看板內容（02A）；從 LINE 內建瀏覽器點進來的人，要先用外部瀏覽器開啟並登入才看得到看板內容（Google 會擋內建瀏覽器的登入〔推論，02 實機驗證〕）。02 的畫面要在未登入時清楚說明這一點。

## 2. 角色

| 角色 | 怎麼取得 | 能做什麼 |
|---|---|---|
| 未登入 | | 讀 L0 |
| 一般登入者 | 用 Google 登入，沒有 `roles` 文件（或 `roles` 裡沒有任何權限） | 讀 L0、L1（**02A 修正：不需審核**）；建立自己的 `users`／`profiles`；提出部門角色申請。**不能寫任何看板內容** |
| ~~已授權檢視者 `viewer`~~ | 02A 取消 | 登入就能讀，不再有檢視申請與檢視邀請；`roles` 不接受 `viewer` 欄位 |
| 部門編輯者 `editor` | QR 邀請或申請經總管理員核准 | 該部門的卡片、議題、週報、標籤、時間事件的新增與修改；**永久刪除該部門的卡片**（02A，見第 5.1 節） |
| 部門管理員 `admin` | 同上 | 編輯者的權限＋該部門 `deptSettings` |
| 會長室總管理員 `super` | 第一位由主控台手動建立；之後由總管理員授予 | 全部讀寫（角色、邀請、稽核、遷移）；刪卡片也走同一個永久刪除流程；不能取消自己的 `super` |
| 預約管理者 | `calendars/{ownerId}.managers` | 管理該行事曆的開放時段、私人忙碌、審核預約 |

部門別帶來的特殊權限（不是另一種角色）：

| 條件 | 額外權限 |
|---|---|
| 秘書處編輯者＋`grants/meetingEdit.until` 未到期 | 修改任何部門 `report == true` 的卡片內容與其時間事件 |
| 秘書處編輯者 | 把時間事件標成 `scope: 'all-meeting'`；讀寫 L3 |
| 活動部編輯者 | 把任何部門的時間事件標成 `scope: 'all-activity'`；發布公開活動（見決策 D4） |

### 2.1 登入可讀（02A 定案，取代 01A-R 的已授權檢視者）

- **修正**：01A-R 的「已授權檢視者」（`roles.viewer`、檢視申請、檢視邀請）整個取消。`internalReader()` 改回 `signedIn()`：任何用 Google 登入、信箱已驗證的帳號都能唯讀 L1，不需審核。
- 不在開放範圍（維持原本限制）：秘書處點名名單與會議紀錄（`attendance*`、`meetingMinutes`，L3）、會長私人行程（`busyBlocks` 的標題、`bookings` 的內容，只有行事曆管理者與申請人本人）、L4。
- 寫入不變：所有寫入條件都用 `isEditor`／`isAdmin`／`isSuper`／`isManager`，一般登入者什麼都不能寫（N-04）。
- 後果（請知悉）：任何人用任何 Google 帳號登入就看得到各部門的看板內容、專員名字（`profiles.displayName`）與舊身分名字；**撤權只收回寫入，收回不了閱讀**。要擋特定帳號閱讀，得另外做封鎖名單（列為待決定，見 [README.md](README.md)）。
- 01A-R 的 I-47～I-49、C-17、C-19 依這個決定改寫（見第 5.1a 節、[invitations-roles-audit.md](invitations-roles-audit.md) 第 8 節）。

是否保留 `editor` 這一級、部門管理員能不能自己發邀請：見決策 D2、D3（02A 不變）。規則已經支援兩級；如果只要一級，管理員以外都不發 `editor` 就好，規則不用改。

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
| `roleRequests` | | 本人 RC、本人撤回（只能申請部門的 `admin`／`editor`） | 同左 | 同左 | RU（核准要同批改 `roles`） | |
| `invitations` | | 知道權杖者 get；核銷 U | 同左 | 同左（D3 開放則可對自己部門 C） | RCU | 不能 list |
| `legacyIdentities` | | R；核銷認領 U | 同左 | 同左 | RCU | |
| `auditLogs` | | 只能隨受保護的寫入一起 C | 同左 | 同左 | R | 任何人都不能 U、D |
| `cards` | | R（`open`／`done`） | RCU（部門）＋D（部門，永久刪除流程）＋讀刪除中 | 同左 | RCU＋D（永久刪除流程或遷移回復） | 秘書處授權期間可 U 報告事項，不能刪；D 的條件見第 5.1 節（02A 修正） |
| `cards/{id}/versions` | | R（**只限卡片可讀時**） | R 同卡片；C（隨卡片）；D（只限永久刪除，由新往舊） | 同左 | R、C；D 同左 | 不能 U；不能單獨 D；跨卡片查詢（collection group）只限本部門或總管理員 |
| `issues`、`weeks`、`labels` | | R | RCU（部門） | RCU（部門） | RCUD | |
| `events` | R（`public`） | R | RCU（部門）；屬於卡片的 D（隨永久刪除，或同批從卡片 `timeIds` 拿掉） | 同左 | RCUD | 全會範圍、公開見第 2 節 |
| `grants/meetingEdit` | | R | R | R | RCU | |
| `meetingMinutes` | | | 秘書處 RCU | 秘書處 RCU | RCUD | |
| `attendance*` | | | 秘書處 RCU | 秘書處 RCU | RCUD | 07 定稿 |
| `calendars`、`openWindows` | | R | R | R | RCU | 管理者 CU |
| `slots` | | R（02A 修正：一般登入者不能申請預約，所以沒有 C、D） | R；隨自己的預約 C；預約批次後已拒絕／取消時 D | 同左 | R | 管理者隨私人忙碌 C；**任何人都不能單獨刪除有效預約或私人忙碌的鎖**；任何人都不能 U（[booking.md](booking.md) 第 4 節） |
| `bookings` | | —（D6：有部門角色才能申請） | 本人 RC、本人取消 | 同左 | 不是管理者就讀不到（02A 修正：原本誤寫 R；規則與 N-12 都是讀不到） | 管理者 RU；會長私人行程不在 L1 開放範圍 |
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
    // L1 的定義集中在這一個函式。02A 定案：任何已登入的 Google 帳號（01A-R 的已授權檢視者取消）
    function internalReader() { return signedIn(); }
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

正式規則在 `backend/firestore.rules` 的「即時回報卡片」段，這裡只寫重點（01A 的設計稿已經被正式規則取代）。

```
match /cards/{id} {
  // 狀態：open | done | purging（02A：拿掉 deleted；purging＝永久刪除進行中，不可逆）
  allow get:  if internalReader() && (resource.data.state != 'purging' || deptWriter(resource.data.deptId));
  allow list: if internalReader() && (resource.data.state in ['open', 'done'] || deptWriter(resource.data.deptId));
  allow create: if cardShape() && (normalCreate() || importCreate()) && verAfter();     // 同批新建第 1 版
  allow update: if cardShape() && unchanged([...])
    && (editorEdit() || meetingEdit() || reorder() || purgeStart() || purgeSweep());
  allow delete: if purgeFinish() || rollbackDelete();
  // editorEdit／meetingEdit：卡片是 open／done、version +1、同批新建版本；從 timeIds 拿掉的時間事件要同批刪掉（droppedGone）
  // purgeStart：open／done → purging，deletedAt＝現在、deletedBy＝自己；timeIds 只能減少，拿掉的事件要同批刪（一批最多 3 個）
  // purgeSweep：purging → purging，只改 timeIds（只能減少，拿掉的事件要同批刪）
  // purgeFinish：purging、timeIds 是空的、第 1 版在批次後不存在
  // 以上三步都要 deptWriter(deptId)＝該部門編輯者以上或總管理員
}
match /cards/{cid}/versions/{v} {
  allow get, list: if isSuper() || (internalReader() && exists(卡片) && (卡片.state != 'purging' || isEditor(卡片.deptId)));
  allow create: if 內容＝批次後的卡片 && 批次後卡片是 open／done && (imported == false || 遷移路徑);
  allow update: if false;
  allow delete: if deptWriter(resource.data.deptId)
    && (卡片批次後存在 ? 批次後是 purging : 卡片批次前存在)        // 只能隨永久刪除（或遷移回復）
    && 第 v+1 版批次後不存在;                                     // 由新往舊刪，剩下的永遠是 1～k
}
```

**永久刪除（02A 定案，修正 01A／01A-R 的軟刪除）**

- 刪除就是永久刪除：卡片、它的全部版本（`cards/{id}/versions/*`）、它的全部時間事件（`events` 中 `cardId == id`）一起移除。沒有「已刪除」狀態、沒有「最近刪除」、不能復原；總管理員也沒有「只刪卡片、留下版本」的硬刪。
- 誰能刪：該部門編輯者以上、總管理員。一般登入者、別部門的編輯者、已撤權者、秘書處的會議授權（只能改內容）都不能刪（N-16）。
- 為什麼分三步：規則沒有迴圈、一批最多 500 筆寫入、整批讀取最多 20 次，所以「一次寫入裡檢查全部版本與事件都被刪掉」做不到。改成：
  1. **開始**：卡片改成 `purging`。從這一刻起一般登入者讀不到卡片與版本（N-17）；`purging` 不能改回 `open`／`done`、不能再寫新版本或新時間事件（C-07、C-20）。同一批可以先刪最多 3 個時間事件。
  2. **清除**（可以多批）：時間事件——卡片的 `timeIds` 列出它**全部**的時間事件（建立時間事件時規則要求它列在母卡片的 `timeIds`，`cardId` 之後不能改），從 `timeIds` 拿掉一個 ID 時那份事件必須同一批刪掉；版本——由新往舊刪，刪第 v 版時第 v+1 版必須已經不在，所以剩下的版本永遠是 1～k。
  3. **刪卡片**：`timeIds` 必須是空的、第 1 版必須已經不在。由上面兩條推得：版本與時間事件都沒有殘留（N-13、N-14）。
- 每批大小（照整批讀取 20 次估算，不依賴快取）：時間事件每批 3 個（3×4＋卡片 5＝17）、版本每批 3 個（3×5＋卡片 3＝18）。參考實作：`backend/tests/helpers.js` 的 `purgeCard`。前端（02B 以後）照這個順序做；中途關掉瀏覽器時卡片停在 `purging`，同部門編輯者再開看板時接著清除。
- 前端的確認：**卡片含時間標記時，刪除前要求使用者再次確認**（第二次確認要寫出會一起刪掉幾個時間標記）；沒有時間標記的卡片照 `DESIGN.md`「刪除鍵」的規則確認一次。
- 已知限制：時間事件超過 3 個的卡片，第一批之後剩下的時間事件在清除完之前仍是登入可讀（只有名稱、時間、地點，沒有卡片內文；N-17）。正常情況下清除會在幾秒內接著完成。
- 遷移失敗回復（01B R1）另有專用路徑：批次是 `rollingBack`、卡片 `version == 1` 而且是這個批次匯入的，總管理員可以刪卡片＋第 1 版；它的時間事件由回復程式接著刪（`rollbackImport`）。

**其他**

- 卡片與版本互相檢查：卡片規則要求同一批**新建**了對應版本號的版本文件（`verAfter`）；版本規則要求內容（`title`、`blocks`、`state`、`deptId`）、作者、時間都等於批次後的卡片。兩邊都只看批次後的狀態，所以不會有「卡片改了、版本沒寫」或「版本寫的跟卡片不一樣」。
- `times`（當時的時間值快照）來自 `events`，長度不固定，規則沒辦法逐筆比對，**由前端負責**；它只用在歷史顯示，不影響權限。
- 每次內容修改都產生一筆版本（寫入次數 ×2）。「勾選一個核取方塊算不算一個版本」是 04 的設計問題（階段 00 的 8-9）；01B 先全部算版本，04 再決定要不要放寬成「只改 `check` 不加版本」。
- 併發：前端一律用交易，「讀最新 → 改 → 寫回並帶 `version + 1`」。規則的 `version == 舊 + 1` 保證不會有兩個人寫出同一個版本號（C-15；模擬器裡後提交的那筆是被規則拒絕，前端拒絕時重讀重試）。

### 5.1a 一般資料攻擊測試（01A-R 新增，01B 寫成模擬器測試；02A 修正的項目標在 # 欄）

| # | 情境 | 預期 |
|---|---|---|
| C-01（02A 修正） | 一般登入者 `get` 刪除中（`purging`）的卡片 | 拒絕 |
| C-02（02A 修正） | 一般登入者 `get` 刪除中卡片的任一版本（直接猜 `cards/X/versions/3`） | 拒絕 |
| C-03（02A 修正） | 一般登入者 `list` 刪除中卡片的版本 | 拒絕 |
| C-04 | 一般登入者用 collection group 查詢所有 `versions`（不帶或帶別部門 `deptId`） | 拒絕 |
| C-05（02A 修正） | 同部門編輯者讀刪除中的卡片與版本（接續清除）；清除完任何人（含總管理員）都讀不到殘留 | 允許；不存在 |
| C-06 | 別部門的編輯者讀刪除中卡片的版本 | 拒絕 |
| C-07（02A 修正） | 刪除中的卡片改回 `open`／`done`（復原）、或再寫新版本 | 拒絕 |
| C-08 | 編輯者更新卡片內容但不寫版本 | 拒絕 |
| C-09 | 版本的 `title`／`blocks`／`state`／`deptId`／`by`／`at` 任一項跟批次後的卡片不同 | 拒絕 |
| C-10 | 卡片版本號一次加 2、或沿用舊號 | 拒絕 |
| C-11 | 單獨建立版本文件（同批沒有更新卡片），包括替遷移卡片「補」缺的版本 | 拒絕 |
| C-12（02A 修正） | 總管理員直接刪卡片（留下版本）；有殘留版本時用同一個 ID 重建 | 拒絕（版本必須同批新建）；永久刪除後用同 ID 重建則允許 |
| C-13 | 修改任何版本；卡片沒在刪除時刪除版本（含總管理員） | 拒絕 |
| C-14 | 版本寫 `imported: true`（非遷移路徑） | 拒絕 |
| C-15 | 兩個編輯者同時改同一張卡片 | 各自產生連續版本號，沒有重號；後提交的交易重試 |
| C-16 | 秘書處在 `meetingEdit` 到期後修改報告卡片；修改沒標 `report` 的卡片 | 拒絕 |
| C-17（02A 修正） | 沒有角色的登入者讀 `cards`、`issues`、`events`（非公開）、`profiles`、`slots`；未登入讀同樣的東西 | 登入者允許；未登入拒絕 |
| C-18 | 一般登入者寫任何看板內容（卡片、議題、週報、標籤、時間事件、`deptSettings`） | 拒絕 |
| C-19（02A 修正） | 撤掉部門角色後下一次讀取、寫入；已開的監聽 | 讀取允許、寫入拒絕；監聽照常收到更新 |
| C-20（02A 修正） | 屬於卡片的時間事件沒列在批次後母卡片的 `timeIds`、跟卡片不同部門、卡片不存在或在刪除中；改 `cardId` | 拒絕 |

### 5.1b 02A 負面測試（`backend/tests/rules-02a.test.js`）

| # | 情境 | 預期 |
|---|---|---|
| N-01 | 未登入者 `get`／`list` 十個部門的卡片、版本、議題、週報、標籤、內部時間事件、部門設定，以及 `profiles`、`legacyIdentities`、`grants`、`calendars`、`openWindows`、`slots` | 拒絕；部門名稱與公開活動允許 |
| N-02 | 未登入者寫任何部門的內部資料 | 拒絕 |
| N-03 | 沒有 `roles` 文件、或 `roles` 是空的 Google 帳號讀上面全部；信箱密碼登入、信箱未驗證的帳號讀卡片 | 允許；後兩者拒絕 |
| N-04 | 一般登入者對十個部門做 12 種寫入（新增／修改／排序／開始刪除卡片、新增／修改議題、週報、標籤、新增／修改／刪除時間事件、部門設定） | 全部拒絕 |
| N-05 | 部門編輯者、部門管理員對其他 9 個部門做同樣 12 種寫入；把自己部門的資料改成別的部門 | 全部拒絕；自己部門允許 |
| N-06 | 部分撤權後寫被撤的部門（含自己建的卡片）；全部撤權後寫任何部門；被撤權的人自己把角色寫回去 | 全部拒絕；讀取仍允許 |
| N-07 | QR 竄改：權杖改一個字元、截短、加長、大寫、換成雜湊、換成別張的權杖、空字串；用合法權杖但核銷時改邀請上的部門／角色／期限／綁定信箱 | 全部拒絕；邀請仍是 `active` |
| N-08 | 重放已核銷的 QR：同一人、別人、被撤權後再掃 | 拒絕 |
| N-09 | 過期 1 秒的 QR；核銷時把期限改長；總管理員事後延長期限；建立 10 分 1 秒的邀請 | 拒絕 |
| N-10 | 重新產生：同一批撤銷舊邀請＋建立新邀請；非總管理員重新產生 | 總管理員允許，舊 QR 失效、新 QR 可用；其他人拒絕 |
| N-11 | 一般登入者、各部門編輯者／管理員（含會長室）讀寫秘書處點名名單與會議紀錄 | 拒絕；秘書處、總管理員允許 |
| N-12 | 一般登入者、會長室部門管理員、總管理員讀會長私人行程（`busyBlocks`）與別人的預約 | 拒絕；只看得到 `slots` 的忙／閒；行事曆管理者與申請人本人允許 |
| N-13 | 永久刪除（5 個時間事件、3 個版本；小卡片兩批；總管理員） | 卡片、全部版本、全部時間事件都不存在 |
| N-14 | 留下版本或時間標記的刪法：直接刪卡片、拿掉 `timeIds` 卻不刪事件、一批拿掉超過 3 個、刪除時加新標記、還有事件或版本時刪卡片、版本跳著刪 | 全部拒絕 |
| N-15 | 卡片沒在刪除時單獨刪版本（含總管理員）或刪仍列在卡片上的時間事件；別部門編輯者刪事件 | 拒絕；編輯卡片時同批拿掉並刪除允許 |
| N-16 | 一般登入者、別部門管理員、秘書處（會議授權中）、已撤權者、會長室部門管理員：開始刪除、清除、直接刪、單獨刪事件或版本；接手別人開始的刪除 | 全部拒絕 |
| N-17 | 刪除中的卡片與版本對一般登入者；第一批之後剩下的時間事件 | 卡片與版本拒絕；剩下的事件在清除完前可讀（已知限制） |

### 5.2 時間事件

```
match /events/{id} {
  allow get, list: if resource.data.visibility == 'public' || internalReader();   // 02A：拿掉 cardDeleted（D14 取消）
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
  allow delete: if isSuper() || withCard();   // 02A：屬於卡片的事件隨永久刪除，或同批從卡片 timeIds 拿掉
}
```

02A：屬於卡片的時間事件建立時必須列在批次後母卡片的 `timeIds`、跟卡片同部門、卡片是 `open`／`done`；`cardId` 建立後不能改（`cardOk`）。這是永久刪除能確認「全部刪光」的前提。

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
