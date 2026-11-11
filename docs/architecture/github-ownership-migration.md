# Repository 移轉到學生會 GitHub Organization

- 產出日期：2026-11-11。只有規劃：沒有移轉 repo、沒有部署、沒有改任何正式設定。
- 狀態標記沿用 [README.md](README.md)：〔已確認〕＝從本 repo 程式碼或資料檔讀到；〔文件〕＝GitHub／Firebase 官方文件；〔次級來源〕＝社群文件或討論，官方文件沒有直接寫；〔推論〕＝依經驗判斷；〔待演練〕＝第 1 節演練要確認。
- 文中用 `<org>` 代表 Organization 名稱（還沒決定，見第 8 節 G1）。

## 0. 結論

1. **網址一定會變**：`https://linkmasterking.github.io/-/` → `https://<org>.github.io/-/`。GitHub 會自動轉址 repo 網頁與 git 操作〔文件〕，**但不會轉址 GitHub Pages**〔次級來源〕。舊網址要自己放一個轉址頁（第 2 節）。
2. **換網址＝換來源（origin）**。每個人瀏覽器裡的 localStorage（含解開的權杖、記住的登入、未同步的草稿）、離線快取、已安裝的 App、日後的 Firebase 登入狀態都不會帶過去〔已確認：看板資料都存在 localStorage；瀏覽器以來源區隔儲存是標準行為〕。
3. **現有寫入路徑在移轉當下會壞**：
   - 10 個資料檔中有 7 個把 `sync.owner` 寫死成 `linkmasterking`，而 `cloudCfg()` 只要 `sync.owner` 有值就不再從網址判斷〔已確認：`core/js/cloud.js` 第 4～6 行；權益部、社務部、財務部、水果部、行銷部、公關部、工務部〕。
   - 細粒度權杖的範圍綁「資源擁有者」；repo 改由 Organization 持有後，以個人帳號為擁有者的權杖**應該**就碰不到它〔推論，待演練〕。
4. **建議時機：在階段 02（Firebase 登入）之前移轉**，並把 [github-token-retirement.md](github-token-retirement.md) 的 T2（重發有到期日的權杖）合併在移轉當天做。這樣 Firebase 從第一天起就只認新網域，使用者只需要經歷一次網址變更，之後也不必搬 Firebase 授權網域。比較見第 1.1 節。

## 1. 操作順序

### 1.1 時機比較

| 時機 | 要多做的事 | 使用者受到的影響 | 評估 |
|---|---|---|---|
| **A. 02 之前**（建議） | 移轉當天發一把 Organization 擁有的新權杖、重新開通全會密碼；先合併一個讓 `cloudCfg` 以網址為準的程式 PR | 一次：改用新網址、重新輸入全會密碼、重裝 App | 建議。Firebase 授權網域只設一次 |
| B. 全部切到 Firestore、權杖作廢之後 | 不用處理權杖；要搬 Firebase 授權網域 | 兩次：先學 Google 登入，再換網址、重新登入、重裝 App | 可行，技術最單純，但打擾兩次 |
| C. 02 之後、切換完成之前 | 權杖與 Firebase 網域兩邊都要搬 | 兩次，而且新舊系統並存時最容易混亂 | 不建議 |

以下步驟以 A 為準；選 B 時跳過第 1.4 節的 S7～S9（權杖），改做第 3.4 節的 Firebase 網域搬移。

### 1.2 演練（正式移轉前，用測試 repo，不碰正式 repo）

由你在 GitHub 上操作，約 30 分鐘：

| # | 動作 | 要確認的事 |
|---|---|---|
| R1 | 在個人帳號建一個測試用的公開 repo（例如 `transfer-test`），開 Pages，放一個 `index.html` | |
| R2 | 建一把只授權這個測試 repo 的細粒度權杖 | |
| R3 | 把測試 repo 移轉到 `<org>` | 移轉要不要 Organization 那邊確認、要等多久〔待演練〕 |
| R4 | 開 `https://linkmasterking.github.io/transfer-test/` 與 `https://<org>.github.io/transfer-test/` | 舊網址是否 404、新網址是否自動有 Pages、要不要重新儲存 Pages 設定〔待演練〕 |
| R5 | 用 R2 的權杖對測試 repo 讀與寫 | 個人擁有的權杖移轉後還能不能用〔待演練〕 |
| R6 | 在個人帳號的 `linkmasterking.github.io` repo 放 `transfer-test/index.html` 轉址頁（第 2.2 節） | 舊網址是否改由這份轉址頁提供〔待演練〕 |
| R7 | `git clone https://github.com/linkmasterking/transfer-test.git` | git 是否自動轉到新位置〔文件〕 |
| R8 | 演練完刪掉測試 repo 與權杖 | |

R5、R6 的結果會決定第 1.4 節是否照寫的做。

### 1.3 事前準備（不影響正式站）

| # | 動作 | 誰 |
|---|---|---|
| P1 | 建立 Organization（GitHub Free 即可），擁有者只放學生會公用 GitHub 帳號＋你（或另一位幹部）兩人，都開兩步驟驗證 | 你 |
| P2 | Organization 設定：成員基本權限設為 Read；**只有擁有者能建立 repo、能建立公開 Pages**（Member privileges）；個人存取權杖政策設成「允許細粒度權杖、需要管理員核准」、禁止 classic 權杖存取 Organization〔文件：核准政策只適用細粒度權杖，擁有者自己建的不用核准〕 | 你 |
| P3 | 程式 PR（我做、你合併，移轉前上線）：`cloudCfg()` 在 `*.github.io` 上一律以網址判斷擁有者與 repo，`sync.owner` 只在其他網域使用；`index.html` 的 `og:url`、`og:image` 改成新網址或相對路徑；測試檔（`tools/tests/pv1.js`、`mt2.js`、`td3.js`、`data_test.json`）的網址改成參數 | 我 |
| P4 | 準備舊網址轉址頁的內容（第 2.2 節），先不部署 | 我 |
| P5 | 列出 repo 目前的 collaborators、Pages 設定（來源分支、HTTPS）、webhook、deploy key（目前看起來都沒有，`.github/` 不存在〔已確認〕），移轉後逐項比對 | 你 |
| P6 | 決定 Organization 名稱與 repo 要不要順便改名（第 8 節 G1、G2）。**網址從此固定**，之後再改就又換一次網址 | 你 |
| P7 | 公告移轉時間（建議選沒有會議的晚上），請各部門在那之前存檔 | 你 |

P3 讓 7 個寫死 `sync.owner` 的資料檔不用修改：資料檔照舊不動，程式改成不看它。

### 1.4 移轉當天（約 1 小時）

| # | 動作 | 誰 | 這一步之後正式站的狀態 |
|---|---|---|---|
| S1 | 確認 P3 已上線；跑一次每週檢查指令（[github-token-retirement.md](github-token-retirement.md) 第 4 節）；記下 main 的 commit SHA | 你 | 不變 |
| S2 | 公告開始，暫停編輯 | 你 | 不變 |
| S3 | Settings → Danger Zone → Transfer ownership，移到 `<org>`（要改名就在這之後立刻改） | 你 | 舊網址 404；新網址可讀、**不能存檔** |
| S4 | 到新 repo 的 Settings → Pages 確認來源分支是 `main`、Enforce HTTPS 打開 | 你 | 新網址可讀 |
| S5 | 部署舊網址轉址頁（第 2.2 節） | 你（我先準備好檔案） | 舊網址自動轉到新網址 |
| S6 | 在新網址開總覽與 10 個部門，確認都讀得到 | 你 | |
| S7 | 建一把新的細粒度權杖：資源擁有者＝`<org>`、只授權這個 repo、只有 Contents 讀寫、到期日 2027-01-31（T2）；如果建立者不是 Organization 擁有者，要到 Organization 設定核准 | 你 | |
| S8 | 在新網址的看板後台貼上新權杖、輸入全會密碼，讓自動開通把新的 `tokenAll` 寫進各部門（這是看板平常的寫入流程）；要換全會密碼（T3）就在這一步一起做 | 你 | 恢復可存檔 |
| S9 | 作廢舊的個人權杖（即使它已經沒有作用） | 你 | |
| S10 | 在水果部改一筆、存檔，確認 commit 出現在新 repo | 你 | |
| S11 | 公告新網址、請大家重裝 App（第 4.4 節） | 你 | 完成 |

S3 到 S8 之間不能存檔，但所有內容照常可讀〔已確認：讀取不需要權杖，見 [github-token-retirement.md](github-token-retirement.md) 第 1 節〕。

### 1.5 移轉後一週內

| # | 動作 |
|---|---|
| F1 | 一個文件 PR：`CLAUDE.md`、`README.md`、`docs/交接說明.md`、`docs/upgrade-plan.md`、`docs/architecture/` 裡的舊網址改成新網址（`CLAUDE.md` 的修改要你核准） |
| F2 | 本機與雲端工作環境的 git remote 改到新位置（第 4.1 節） |
| F3 | Claude 的 GitHub App 安裝到 `<org>`，之後的工作階段改用 `<org>/-`（第 4.2 節） |
| F4 | 比對 P5 的清單 |

## 2. GitHub Pages 網址變更與舊網址過渡

### 2.1 會發生什麼

| 項目 | 移轉後 |
|---|---|
| `github.com/linkmasterking/-` 網頁、issue、PR 連結 | 自動轉到新位置〔文件〕 |
| `git clone／fetch／push` 舊網址 | 自動轉到新位置〔文件〕 |
| `api.github.com/repos/linkmasterking/-/...` | 讀取會轉址〔推論，待演練；P3 之後看板不再依賴這一點〕 |
| `linkmasterking.github.io/-/` | **不會轉址，變成 404**〔次級來源〕 |
| 新網址 | `https://<org>.github.io/-/`（Organization 名稱一律小寫） |

**不能做的事**：移轉後不要在個人帳號重新建一個叫 `-` 的 repo 來放轉址頁。那樣會讓 GitHub 對舊 repo 位置的自動轉址失效〔次級來源〕，所有人的 git remote 與舊 PR 連結都會斷。

### 2.2 舊網址轉址頁（建議做法）

GitHub Pages 的規則：沒有專案 repo 佔用的路徑，會由個人網站 repo（`linkmasterking/linkmasterking.github.io`）提供〔次級來源；R6 演練確認〕。所以：

- 在 `linkmasterking/linkmasterking.github.io`（沒有就新建）放一個 `-/` 資料夾，內容只有：

| 檔案 | 作用 |
|---|---|
| `-/index.html`、`-/home.html`、`-/404.html` | 顯示「看板已搬家」與新網址按鈕；同時用 `location.replace` 自動轉到新網址，**保留路徑後段、查詢字串與 `#` 片段**（例如 `?d=events`、日後的 `#join=`）；不支援 JavaScript 時用 `<meta http-equiv="refresh">` 轉到新首頁 |
| `-/sw.js` | 清除用的 Service Worker（第 4.3 節）：安裝後立刻接管、刪掉所有快取、解除註冊 |
| `-/manifest.webmanifest` | 保留舊名稱與圖示，讓已安裝的 App 打開時能看到搬家說明 |

- 轉址頁另外在本機刪掉舊的權杖鍵 `workboard:ghtoken`（只刪這一個，不刪草稿）。這把權杖到時候已經作廢，刪掉只是收尾。
- 建議**永久保留**（免費、不用維護）。最少保留到 2027 學年結束，因為 LINE 群組、海報、記事本裡的舊連結會存在很久。
- 轉址頁不收集、不送出任何資料，只做導向。

### 2.3 長期選項：自訂網域（決策 G3）

給 Organization 的 Pages 設一個學生會自己的網域（例如 `board.<學生會網域>`）：

| 好處 | 代價 |
|---|---|
| 以後換 Organization、改 repo 名稱都不再換網址 | 要有網域與 DNS 管理權，可能要付費，也要交接 |
| Firebase 授權網域只要一個，而且不會連帶授權 `<org>.github.io` 底下的其他 repo（第 3.2 節） | 換網域本身又是一次網址變更 |
| 網站在網域根目錄，日後可以自己放 Firebase 登入輔助頁（第 3.3 節） | 移轉前要先設好 DNS，避免網域被別人搶設〔文件：移轉前要先處理自訂網域的 DNS〕 |

如果要用自訂網域，**最好跟移轉同一天上線**，讓使用者只換一次網址。沒有網域就先用 `<org>.github.io`。

## 3. Firebase Auth 授權網域與 OAuth

### 3.1 依時機分

| 時機 | Firebase 要做的事 |
|---|---|
| A（02 之前移轉，建議） | 02 建立專案時，授權網域只加 `<org>.github.io`（或自訂網域），**從來不加** `linkmasterking.github.io` |
| B（切換完成後才移轉） | 見第 3.4 節的搬移順序 |

### 3.2 授權網域的範圍

- Firebase 的授權網域以**主機名稱**為單位，不分路徑〔文件〕。授權 `<org>.github.io` 等於授權 Organization 底下**所有** repo 的 Pages 都能叫出我們專案的 Google 登入。
- 規則才是真正的權限把關（[permissions.md](permissions.md)），授權網域不是。但為了不讓人在同一個 Organization 架一個看起來一樣的網頁騙登入，P2 要限制只有擁有者能建立 repo 與 Pages。
- 個人帳號的 `linkmasterking.github.io` 同理：**不要**加進授權網域（時機 A），或在過渡期結束後移除（時機 B）。

### 3.3 OAuth 用戶端與同意畫面

| 項目 | 影響 |
|---|---|
| Firebase 自動建立的 Google OAuth 用戶端 | 只要 `authDomain` 維持 `<專案>.firebaseapp.com`，登入回呼網址是 `https://<專案>.firebaseapp.com/__/auth/handler`，**跟 GitHub 網址無關，不用改**〔文件〕 |
| 彈出視窗登入 `signInWithPopup` | 不受網址變更影響；02 的主要登入方式 |
| 重新導向登入 `signInWithRedirect` | 在會擋第三方儲存的瀏覽器（Safari、新版 Chrome、Firefox）上，`authDomain` 跟網站不同網域時可能失敗〔文件，詳細條件 02 確認〕。GitHub Pages 的專案網站不在網域根目錄，沒辦法自己放 `/__/auth/` 輔助頁；有自訂網域（G3）才有這個選項 |
| Google Identity Services 按鈕（階段 00 第 4.1 節的手機備案） | 要在 OAuth 用戶端的「已授權的 JavaScript 來源」加上新網址的來源 `https://<org>.github.io` |
| OAuth 同意畫面 | 應用程式首頁、隱私權政策連結改成新網址。只用 email、profile 這類基本範圍，不需要 Google 審查〔推論，02 確認〕 |
| App Check（決策 D7，若採用） | reCAPTCHA 金鑰的允許網域改成新網域 |

### 3.4 時機 B 的搬移順序

1. 移轉前：授權網域**加上**新網域（舊的先留著）；Identity Services 來源、App Check 網域同步加。
2. 移轉、部署轉址頁。
3. 使用者在新網址要**重新登入一次**（登入狀態存在舊來源）。
4. 過渡期 2 週後，從授權網域、OAuth 來源、App Check **移除**舊網域。
5. 新網址上的 QR 邀請照常可用；舊網址上的 `#join=` 連結由轉址頁帶過去，所以已經發出去還沒過期的邀請不會失效。

## 4. Git remote、分支、PR、PWA 快取

### 4.1 Git remote 與分支

- 每份本機複本改一次：

```bash
git remote set-url origin https://github.com/<org>/-.git
```

- 不改也暫時能用（自動轉址），但不要依賴；轉址在有人重建舊名稱時會失效。
- 分支、commit 歷史、tag 全部原樣搬過去〔文件〕。不需要重新推送任何分支。
- `main` 目前沒有分支保護（看板直接寫入 main）〔已確認〕，移轉後也不要加「必須經過 PR」，否則存檔會壞（[github-token-retirement.md](github-token-retirement.md) 第 2 節）。

### 4.2 PR、issue 與工作環境

| 項目 | 處理 |
|---|---|
| 開著的 PR（例如 #52、#53）與歷史 PR、issue | 跟著搬，編號不變，舊連結自動轉址〔文件〕 |
| PR 的來源分支 | 在同一個 repo 裡，不受影響 |
| Collaborators | 移轉後檢查一次權限是否保留；Organization 建議改用成員＋團隊管理〔待演練〕 |
| Claude 的雲端工作階段 | 目前的 GitHub 存取範圍是 `linkmasterking/-`。移轉後要把 Claude 的 GitHub App 安裝到 `<org>`，新的工作階段改用 `<org>/-`；移轉當下正在進行的工作階段可能推不上去，先把要推的推完再移轉 |
| GitHub Actions、webhook、deploy key | 目前沒有〔已確認：沒有 `.github/`〕，不用處理 |

### 4.3 PWA 與 Service Worker

已確認的現況（`sw.js`、`manifest.webmanifest`）：

- Service Worker 是「網路優先」：拿得到就用網路版，**只有連線失敗才用快取**。網路回 404 時直接回 404，不會拿快取頂替。
- 範圍是 `./`（即 `/-/`），`start_url` 是 `home.html`。

移轉後的影響：

| 情況 | 結果 | 處理 |
|---|---|---|
| 舊網址沒有轉址頁 | 使用者看到 404（不是看到過期的看板）；舊的 Service Worker 留著，但沒有害處 | 轉址頁 |
| 舊網址有轉址頁 | 轉址頁的 `sw.js` 取代舊的 Service Worker：清快取、解除註冊 | 第 2.2 節 |
| 使用者離線時打開舊 App | 舊 Service Worker 還在的話，會顯示最後一次快取的看板（唯讀） | 只會發生在轉址頁上線、他上線一次之前；資料是舊的，看板本來就會顯示離線狀態 |
| 新網址 | 全新的來源，第一次開會重新安裝 Service Worker 與快取 | 不用處理 |

### 4.4 使用者這一側（要寫進公告）

1. 改用新網址：`https://<org>.github.io/-/`（舊網址會自動帶過去）。
2. 在新網址**重新輸入一次全會密碼**解鎖（解開的權杖存在舊網址的瀏覽器儲存區）。
3. 已經「加入主畫面」的人：刪掉舊圖示，在新網址重新加入。
4. 移轉前一定要先存檔；在舊網址還沒同步的修改不會出現在新網址。

## 5. 現有 GitHub 寫入權杖的風險與撤銷

### 5.1 移轉對權杖的影響

| 項目 | 內容 |
|---|---|
| 舊的個人權杖 | 資源擁有者是個人帳號；移轉後應該碰不到 Organization 的 repo〔推論，R5 確認〕。不管結果如何，S9 都會把它作廢 |
| 資料檔裡的加密權杖 | `tokenAll`、`tokenEnc`、`members[].tok` 解開的是舊權杖；S8 重新開通後 `tokenAll` 換成新的。部門共用密碼與個人密碼加密的那幾份會變成解開也沒用的舊權杖〔已確認：`auth.js` 第 35 行依序嘗試 `tokenAll`、`tokenEnc`〕。解開後拿到失效權杖時，存檔會出現什麼錯誤訊息沒有實測；P3 要讓它明確提示「權杖已失效，請重新解鎖或請後台更新」 |
| 新權杖的擁有者 | 資源擁有者＝`<org>`，建立者是你（或公用帳號）。建立者離開 Organization，權杖就失效〔推論〕；它本來就預定在 Firestore 切換後作廢，所以可以接受 |
| 風險有沒有變小 | **沒有本質改變**：新權杖一樣能寫整個 repo（包含網站程式），一樣用全會密碼加密放在公開檔案。改善的只有：有到期日、Organization 可以集中檢視與撤銷權杖〔文件〕、核准政策讓擁有者知道有哪些權杖 |

### 5.2 跟權杖撤銷方案的關係

- [github-token-retirement.md](github-token-retirement.md) 的 T1～T5 照舊。時機 A 時，T2（重發有到期日的權杖）與 T3（換全會密碼）**就在移轉當天的 S7、S8 做**，不用先在個人帳號做一次再做一次。移轉排在兩週以後時，T2 先在個人帳號做，移轉當天再做一次。
- 作廢條件（C1～C4，最後一個部門切到 Firestore 後 3 個工作天）不變，對象改成 Organization 擁有的那把。
- Organization 擁有者可以在 Settings → Personal access tokens 看到並撤銷所有能存取 Organization 的細粒度權杖〔文件〕，緊急程序多了這個入口。

### 5.3 這次不建議的做法

| 做法 | 原因 |
|---|---|
| 移轉時改用 classic 權杖「比較簡單」 | classic 權杖的範圍是使用者的全部 repo，風險更大；P2 也會擋掉 |
| 用 GitHub App 取代權杖 | 安裝權杖要由伺服器簽發，純前端做不到；違反「不新增伺服器」 |
| 移轉時順便把資料檔裡的 `sync.owner` 改掉 | 要改 7 個正式資料檔；P3 用程式解決，資料檔不用動 |

## 6. 驗收與回復

### 6.1 驗收清單

| # | 檢查 | 怎麼確認 |
|---|---|---|
| A1 | 新網址的總覽與 10 個部門都能讀，筆數跟移轉前相同 | 對照移轉前的截圖或匯出 |
| A2 | 新網址可以存檔，commit 出現在 `<org>/-` 的 main | S10 |
| A3 | 每個部門在新網址用全會密碼都能解鎖 | 各部門各一人 |
| A4 | 舊網址轉址：`/-/`、`/-/home.html`、`/-/index.html?d=events`、`/-/?d=fruit#join=測試` 都帶到新網址對應的位置，查詢字串與片段都保留 | 手動＋Playwright（route 模擬兩個網域） |
| A5 | 曾經裝過舊 Service Worker 的瀏覽器，開一次舊網址後 Service Worker 被解除、快取被清空 | Playwright：先註冊舊 SW，再換成清除用 SW |
| A6 | 舊的 git remote 還能 fetch；改成新 remote 後能 push 分支 | F2 |
| A7 | #52、#53 等 PR 與分支都在，數量跟移轉前相同 | 對照 P5 |
| A8 | 舊的個人權杖已作廢；Organization 權杖清單只有一把，到期日正確 | Organization 設定頁 |
| A9 | 每週檢查指令在新 repo 上跑過一次，沒有異常 commit | [github-token-retirement.md](github-token-retirement.md) 第 4 節 |
| A10 | 手機（Android、iPhone）在新網址加入主畫面、打開正常 | 實機 |
| A11 | （時機 B）新網址能用 Google 登入；過渡期結束後舊網域已從授權網域移除 | Firebase 主控台 |

### 6.2 回復

| 時間點 | 問題 | 回復方式 | 會不會掉資料 |
|---|---|---|---|
| S3 之前 | 任何 | 不做就好 | 不會 |
| S3～S8（不能存檔） | 新權杖建不起來、核准卡住 | 先維持唯讀，公告延後恢復編輯；最壞情況把 repo 移轉回個人帳號（Organization 擁有者可以移出）〔待演練：移轉到個人帳號要不要對方確認〕，再用個人權杖照舊開通 | 不會（期間沒有人能寫） |
| S5 之後 | 轉址頁有錯 | 刪掉 `linkmasterking.github.io` repo 的 `-/` 資料夾，舊網址回到 404；修好再放 | 不會 |
| S8 之後 | 新網址某個功能壞了 | **修正往前**（開 PR 修），不建議移轉回去：移轉回去又是一次網址變更，大家剛搬過來的登入與 App 又要重來 | 不會 |
| 時機 B | Firebase 登入在新網域失敗 | 舊網域還在授權清單裡，暫時請大家用舊網址（先拿掉轉址頁）；修好再切 | 不會 |

**沒有不可逆的步驟**：移轉可以再移轉回去、轉址頁可以刪、權杖可以再發。代價是每來回一次，使用者就要再換一次網址。所以實務上的關卡是 S8：S8 完成、A1～A3 通過後就只修正往前。

## 7. 對其他 01A 文件的影響（之後一起更新，這次依指示只改本文件）

| 文件 | 要改的地方 |
|---|---|
| [README.md](README.md) | 文件清單加入本文件；決策清單加入第 8 節 |
| [github-token-retirement.md](github-token-retirement.md) | T2、T3 註明「移轉當天做」；權杖擁有者改成 `<org>` |
| [invitations-roles-audit.md](invitations-roles-audit.md) | QR 網址改成新網址 |
| [migration.md](migration.md) | `departments` 的部門清單來源不變；`dept/config.js` 的 `source` 開關不受影響 |
| [verification.md](verification.md) | 第 4 節加入 R1～R8 演練與 A1～A11 |
| `docs/交接說明.md` | 新增一節 |

## 8. 需要你決定的事

| # | 事項 | 建議 |
|---|---|---|
| G1 | Organization 名稱 | 短、全小寫、跟學年無關（例如 `stustsa`）。**這會變成網址的一部分**，之後改又要換一次網址 |
| G2 | repo 要不要順便改名（現在叫 `-`，網址是 `/-/`） | 要改就跟移轉同一天改（例如 `board`，網址 `/board/`）；不改也沒問題。改名的話轉址頁、文件、`dept/config.js` 都照新名稱 |
| G3 | 要不要自訂網域 | 有學生會網域就同一天上線；沒有就先用 `<org>.github.io` |
| G4 | 移轉時機 | A：02 之前（建議） |
| G5 | Organization 的擁有者 | 學生會公用 GitHub 帳號＋一位現任幹部，都開兩步驟驗證；跟 Firebase 專案的 IAM（決策 D9）同一批人 |
| G6 | 舊網址轉址頁保留多久 | 永久 |
| G7 | 新權杖由誰建立 | 你建立、到期日 2027-01-31。由公用帳號建立的話，換屆時不會因為個人離開而失效 |
