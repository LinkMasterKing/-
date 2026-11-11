// 遷移演練指令。只有兩種模式，都不碰正式資料：
//   node migrate/cli.js --dry-run            只讀資料檔，印出對照報告（不連任何資料庫）
//   npm run migrate:emulator                  在本機模擬器跑完整匯入＋驗證（firebase emulators:exec 包住）
// 正式匯入是 02D 的「總管理員在瀏覽器執行的匯入頁」，不在這裡。
import { loadSources, plan, runImport, finishImport, verify } from './run.js';

const args = process.argv.slice(2);
const src = loadSources({ commit: (args.find(a => a.startsWith('--commit=')) || '').split('=')[1] || undefined });
console.log(`來源 commit ${src.commit}`);
src.files.forEach(f => console.log(`  ${f.path.padEnd(22)} ${f.sha256.slice(0, 16)}…`));
if (args.includes('--dry-run')) {
  const p = plan(src, { batch: 'dry-run', uid: 'dry-run' });
  const by = {}; p.docs.forEach(d => by[d.kind] = (by[d.kind] || 0) + 1);
  console.log('會產生的文件：', by);
  p.reports.forEach(r => { if (r.broken.length || r.badTimes.length) console.log(r.dept, '斷掉的連結', r.broken, '無法解析的時間', r.badTimes); });
  process.exit(0);
}
if (args.includes('--emulator')) {
  if (!process.env.FIRESTORE_EMULATOR_HOST) { console.error('只能在模擬器執行：請用 npm run migrate:emulator'); process.exit(1); }
  const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
  const { default: firebase } = await import('firebase/compat/app');
  await import('firebase/compat/firestore');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  const { readFileSync } = await import('node:fs');
  const t = await initializeTestEnvironment({ projectId: 'demo-stustsa-board', firestore: { host, port: +port, rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
  const uid = 'emulator-super';
  await t.withSecurityRulesDisabled(async c => {            // 等同主控台建立第一位總管理員（invitations-roles-audit.md 第 7 節）
    await c.firestore().doc(`roles/${uid}`).set({ super: true, depts: {}, rev: 1, lastVia: 'manual', lastRef: 'bootstrap', updatedBy: uid, updatedAt: firebase.firestore.Timestamp.now() });
  });
  const db = t.authenticatedContext(uid, { email: 'super@example.test', email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore();
  const FV = firebase.firestore.FieldValue, TS = firebase.firestore.Timestamp, batch = 'emu-' + Date.now();
  const r = await runImport(db, FV, TS, src, { batch, uid, log: console.log });
  const v = await verify(db, src, r.plan);
  await finishImport(db, FV, batch, uid, v.ok ? 'done' : 'failed', { written: r.written, skipped: r.skipped, conflicts: r.conflicts, verify: v.items });
  console.log('寫入', r.written, '跳過', r.skipped, '衝突', r.conflicts);
  v.items.forEach(i => console.log(i.ok ? '通過' : '失敗', i.id, i.msg));
  console.log('與預期筆數的差異：', v.expectedDiff.length ? v.expectedDiff : '無');
  await t.cleanup();
  process.exit(v.ok ? 0 : 1);
}
console.log('用法：--dry-run 或 --emulator');
