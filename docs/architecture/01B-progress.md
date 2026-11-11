# 01B 進度（因使用額度中斷，2026-11-11）

**01B 還沒有驗收完成。** 程式與測試都已經 commit 在分支 `claude/peaceful-fermi-ngxlna`（疊在 01A-R 的 `claude/vigilant-gates-0yhwka` 上，含 00、01A、01A-R 的文件）。沒有改正式資料（`data*.json`、`archive/`）、沒有建立或連線 Firebase 專案、沒有部署、沒有合併 main、沒有開 PR。

## 已完成並通過的測試（Firestore 模擬器，正式規則）

| 測試 | 結果 | 備註 |
|---|---|---|
| `backend/tests/rules-cards.test.js`（權限矩陣抽樣、時間事件、C-01～C-20） | 29/29 通過 | |
| `backend/tests/rules-invites.test.js`（I-01～I-49） | 38/38 通過 | |
| `backend/tests/rules-booking.test.js`（B-01～B-40、預約的 I-43） | 26/26 通過 | B-40 只證明批次成功；模擬器不執行整批 20 次讀取上限 |
| `backend/tests/migrate.test.js`（V1～V7、重跑、回復、權限） | 6/6 通過 | |
| `npm run migrate:emulator`（完整匯入＋V1～V6） | 通過 | 筆數與預期表沒有差異 |
| `tools/tests/fs1.js`（`npm run test:web`：github／firestore／frozen 三種模式） | 全部通過 | |

## 尚未驗證／尚未完成

1. **最後一次小改動之後還沒重跑測試**：把 Firestore 時間值轉換合併成 `core/js/store-map.js` 的 `plain`（`store-firestore.js` 與 `backend/migrate/run.js` 改成呼叫它）。上表的結果是改動之前的。接續時第一件事就是重跑全部測試。
2. **V8 沒有完成**：現有 Playwright 測試在 github 模式下，改動前後的結果要相同。改動前那份已跑完；改動後那份在中斷時只跑了 2/18 支，沒有結果。
3. **清理沒有做**（只有找出來，沒有刪）：`core/js/util.js` 的 `TEMPLATE` 與 `core/js/boot.js` 給它賦值的那段；`index.html` 36 個 `data-bundle` 屬性；`core/js/save.js`「匯出單一 HTML」的過時註解。要跟功能修改分開 commit。
4. **沒有開 PR**，也沒有寫 PR 說明與「02 前置條件」。
5. 不用自動化來確認的事（已記進 `README.md` 待辦，不擋 01B）：整批讀取次數要到 02 的開發專案實測；卡片併發編輯被規則拒絕時，前端要重讀重試（03）。

## 接續指令

```bash
cd backend && npm install
```

```bash
cd backend && npm test
```

```bash
cd backend && npm run test:web
```

V8（在暫存資料夾準備改動前後兩份樹，各放一份 `tools/tests/data_test.json` 當 `data.json`，在同一個指令裡開 `python3 -m http.server 8300`，再跑 `tools/tests/` 裡的這幾支：st1 ed1 sm1 meet1 mt1 mt2 nt1 lg1 lg2 se1 ad1 app1 pv1 v2 wk2 rp1 tm1 hd1，比對輸出前去掉時間戳記）。改動前那份＝`git worktree add <暫存>/before 4d51019`。

之後：做第 3 項清理（另一個 commit）→ 重跑相關測試 → 更新 `docs/交接說明.md` 九十一的 V8 與清理報告 → 發 PR（附測試結果與 02 前置條件）。完成 01B 驗收前不要開始 02。
