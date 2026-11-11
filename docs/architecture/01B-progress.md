# 01B 進度紀錄

2026-11-11 因使用額度中斷時寫的接續紀錄；同日已接續完成，留在這裡當紀錄。完整說明在 `docs/交接說明.md` 九十一、`verification.md` 第 6 節、`README.md`「01B 實作調整」。

| 中斷時未完成的項目 | 結果 |
|---|---|
| 最後一次重構（時間值轉換共用 `store-map.js` 的 `plain`）後重跑測試 | 已重跑：`npm test` 103/103、`npm run test:web` 全部通過 |
| R1（使用者決定：版本歷史不可刪，只留遷移失敗回復的專用流程） | 已實作：規則、`rollbackImport`、4 項回復測試＋重置重新匯入 |
| 清理（`TEMPLATE`、`data-bundle`、過時註解） | 已做，獨立 commit |
| V8（現有 Playwright 測試在 github 模式前後相同） | 見 `docs/交接說明.md` 九十一 |
| PR 與 02 前置條件 | 見 PR 說明 |

接續或重驗的指令：`cd backend && npm install && npm test`、`npm run test:web`。
