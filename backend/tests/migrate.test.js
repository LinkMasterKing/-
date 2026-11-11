// 遷移演練（模擬器）：V1～V7、重跑、回復、讀回來的資料等於原始資料（migration.md 第 6、7 節）
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { env, google, anon, seed, seedRole, assertFails, assertSucceeds, FV, TS } from './helpers.js';
import { loadSources, runImport, finishImport, rollbackImport, setMigrationStatus, verify, fromFirestore, MAP } from '../migrate/run.js';
import { editCard, readDoc } from './helpers.js';

let t, src, first, v1;
const SU = 'mig-super', B = 'test-batch-1';
const sdb = () => google(t, SU);
before(async () => {
  t = await env();
  await t.clearFirestore();
  await seedRole(t, SU, { super: true });
  src = loadSources();
  first = await runImport(sdb(), FV, TS, src, { batch: B, uid: SU });
  v1 = await verify(sdb(), src, first.plan);
});
after(async () => { await t.cleanup(); });

describe('遷移', () => {
  it('V1～V4、V6：筆數、多行還原、連結、時間、敏感欄位', () => {
    for (const i of v1.items) assert.ok(i.ok, `${i.id}：${i.msg}`);
    console.log('遷移驗證：', v1.items.map(i => `${i.id} ${i.msg}`).join('｜'));
    console.log('實際筆數：', JSON.stringify(v1.counts), '與預期差異：', v1.expectedDiff.length ? v1.expectedDiff.join('；') : '無');
    assert.equal(first.conflicts.length, 0);
    // 分批：每批的規則讀取估算 ≤ 18（模擬器不執行整批 20 次上限，見 verification.md）
    assert.ok(first.batches >= 10);
  });
  it('V5 重跑一次：不寫入任何文件、文件數與內容雜湊相同', async () => {
    const again = await runImport(sdb(), FV, TS, src, { batch: B, uid: SU });
    assert.equal(Object.keys(again.written).length, 0, '重跑不應寫入：' + JSON.stringify(again.written));
    assert.equal(again.conflicts.length, 0, again.conflicts.join(','));
    const v2 = await verify(sdb(), src, again.plan);
    assert.equal(v2.hash, v1.hash);
    assert.deepEqual(v2.counts, v1.counts);
  });
  it('V7 讀取分級：未登入只看得到部門與公開活動；一般帳號讀不到看板；檢視者讀得到、讀不到 L2～L4', async () => {
    await seedRole(t, 'viewer1', { viewer: true });
    const card = 'cards/rights__' + src.files[0].state.events[0].id;
    await assertSucceeds(anon(t).collection('departments').get());
    await assertSucceeds(anon(t).doc('org/config').get());
    await assertFails(anon(t).doc(card).get());
    await assertFails(anon(t).collection('deptSettings').get());
    await assertFails(anon(t).collection('events').get());
    await assertSucceeds(anon(t).collection('events').where('visibility', '==', 'public').get());
    await assertFails(google(t, 'nobody').doc(card).get());
    await assertFails(google(t, 'nobody').collection('legacyIdentities').get());
    const v = google(t, 'viewer1');
    await assertSucceeds(v.doc(card).get());
    await assertSucceeds(v.collection('cards').where('deptId', '==', 'rights').where('state', 'in', ['open', 'done']).get());
    await assertSucceeds(v.collection('legacyIdentities').where('deptId', '==', 'rights').get());
    for (const p of ['roles/' + SU, 'migrations/' + B, 'auditLogs/migrations_' + B + '_1', 'meetingMinutes/x', 'users/' + SU]) await assertFails(v.doc(p).get());
    await assertFails(v.collection('auditLogs').get());
  });
  it('讀回來（新 → 舊）等於原始資料：網頁 Firestore 模式看到的內容跟 GitHub 模式相同', async () => {
    const db = sdb();
    const all = async c => (await db.collection(c).get()).docs.map(s => ({ id: s.id, ...fromFirestore(s.data()) }));
    const [settings, cards, issues, weeks, labels, events, legacy, org, grants] = await Promise.all(
      ['deptSettings', 'cards', 'issues', 'weeks', 'labels', 'events', 'legacyIdentities', 'org', 'grants'].map(all));
    for (const f of src.files) {
      const d = f.dept, by = a => a.filter(x => x.deptId === d);
      const back = MAP.toState(d, { settings: settings.find(s => s.id === d), cards: by(cards), issues: by(issues), weeks: by(weeks),
        labels: by(labels), events: by(events), legacy: by(legacy), org: d === 'secretariat' ? org[0] : null, grant: d === 'president' ? grants[0] : null });
      assert.deepEqual(canon(back, d), canon(f.state, d), `${f.path} 讀回來不同`);
    }
  });
  it('非總管理員、或批次已結束：不能匯入', async () => {
    await seedRole(t, 'adm', { depts: { rights: 'admin' } });
    await assertFails(runImport(google(t, 'adm'), FV, TS, src, { batch: 'b-adm', uid: 'adm' }));
    await finishImport(sdb(), FV, B, SU, 'done', { counts: {} });
    await assertFails((async () => {
      await seed(t, d => d.doc('cards/rights__zzz').delete());
      const x = sdb(), b = x.batch(), c = { deptId: 'rights', title: 'x', blocks: [], state: 'open', version: 1, report: false, createdAt: null,
        createdBy: 'legacy:import', importBatch: B, updatedAt: FV.serverTimestamp(), updatedBy: SU };
      b.set(x.doc('cards/rights__zzz'), c);
      b.set(x.doc('cards/rights__zzz/versions/1'), { cardId: 'rights__zzz', deptId: 'rights', version: 1, title: 'x', blocks: [], times: [], state: 'open', by: SU, at: FV.serverTimestamp(), imported: true });
      await b.commit();
    })());
  });
});

describe('遷移失敗回復（R1）', () => {
  const R1 = 'rb-batch-1', R2 = 'rb-batch-2';
  let total, edited;
  before(async () => {
    await t.clearFirestore();
    await seedRole(t, SU, { super: true });
    await seedRole(t, 'ed', { depts: { rights: 'editor' } });
    const r = await runImport(sdb(), FV, TS, src, { batch: R1, uid: SU });
    total = r.written.cards;
    edited = 'cards/rights__' + src.files[0].state.events[0].id;
    // 匯入後有人改過一張卡片（版本 2）：回復時必須保留
    const cur = await readDoc(t, edited);
    await editCard(google(t, 'ed'), 'ed', edited.split('/')[1], cur, { title: cur.title + '（已修改）' });
  });
  it('批次不是 rollingBack 時，總管理員一般的卡片硬刪不能連帶刪掉版本歷史', async () => {
    const db = sdb(), p = 'cards/affairs__' + src.files.find(f => f.dept === 'affairs').state.events[0].id;
    const b = db.batch(); b.delete(db.doc(p)); b.delete(db.doc(p + '/versions/1'));
    await assertFails(b.commit());
    await assertFails(db.doc(p + '/versions/1').delete());
  });
  it('已完成（done）的批次不能進入回復', async () => {
    await seed(t, d => d.doc('migrations/done-1').set({ status: 'done', rev: 1, startedBy: SU, startedAt: TS.now(), updatedAt: TS.now(), updatedBy: SU }));
    await assertFails(setMigrationStatus(sdb(), FV, 'done-1', SU, 'rollingBack'));
    await assert.rejects(rollbackImport(sdb(), FV, 'done-1', SU), /只有 running／failed 能回復/);   // 程式也先擋
  });
  it('回復：只刪這個批次、匯入後沒改過的資料；改過的卡片與它的版本全部保留；狀態轉換有稽核', async () => {
    const r = await rollbackImport(sdb(), FV, R1, SU);
    assert.equal(r.deleted.cards, total - 1);
    assert.deepEqual(r.kept, [edited]);
    assert.ok(await readDoc(t, edited + '/versions/1'));
    assert.ok(await readDoc(t, edited + '/versions/2'));
    const m = await readDoc(t, `migrations/${R1}`);
    assert.equal(m.status, 'rolledBack');
    for (const [rev, st] of [[2, 'rollingBack'], [3, 'rolledBack']]) assert.equal((await readDoc(t, `auditLogs/migrations_${R1}_${rev}`)).after.status, st);
    // 回復結束後，保留下來的版本仍然不能刪（含遷移產生的第 1 版）
    const db = sdb(), b = db.batch(); b.delete(db.doc(edited)); b.delete(db.doc(edited + '/versions/1'));
    await assertFails(b.commit());
    await assertFails(db.doc(edited + '/versions/2').delete());
    await assertFails(setMigrationStatus(sdb(), FV, R1, SU, 'running'));       // rolledBack 不能再回到 running
  });
  it('重新匯入（新批次）可以安全重跑：沒有重複資料、沒有版本衝突', async () => {
    const r = await runImport(sdb(), FV, TS, src, { batch: R2, uid: SU });
    assert.equal(r.written.cards, total - 1);
    assert.deepEqual(r.conflicts, [edited]);                                     // 改過的那張不覆寫，列為衝突
    const again = await runImport(sdb(), FV, TS, src, { batch: R2, uid: SU });
    assert.equal(Object.keys(again.written).length, 0);
    const db = sdb();
    assert.equal((await db.collection('cards').get()).size, total);
    const vs = (await db.collectionGroup('versions').get()).docs;
    assert.equal(vs.length, total + 1);                                          // 每張一個第 1 版，改過的那張多一個第 2 版
    assert.equal(new Set(vs.map(v => v.ref.path)).size, vs.length);
    for (const v of vs) if (v.id === '1') assert.equal(v.data().importBatch, v.ref.path === edited + '/versions/1' ? R1 : R2);
  });
  it('模擬器演練優先用「重置＋重新匯入」：清空後再匯入，筆數與驗證結果相同', async () => {
    await t.clearFirestore();
    await seedRole(t, SU, { super: true });
    const r = await runImport(sdb(), FV, TS, src, { batch: 'reset-1', uid: SU });
    const v = await verify(sdb(), src, r.plan);
    for (const i of v.items) assert.ok(i.ok, `${i.id}：${i.msg}`);
    assert.deepEqual(v.counts, v1.counts);
  });
});

// 比對用：把兩邊都整理成 normalize 之後畫面會用到的樣子（缺值＝預設值）
function canon(s, dept) {
  const ev = e => ({ id: e.id, name: e.name || '', desc: e.desc || '', issueId: e.issueId || null, staff: e.staff || [], labels: e.labels || [],
    links: e.links || [], report: !!e.report, createdAt: e.createdAt || null, doneAt: e.doneAt || null, round: +e.round || 1,
    roundAt: e.roundAt || null, touched: e.touched || [], touchedAt: e.touchedAt || null, fromEv: e.fromEv || null,
    times: (e.times || []).map(x => ({ id: x.id, label: x.label || '', start: x.start || '', end: x.end || '', place: x.place || '', toIssue: !!x.toIssue })) });
  const out = {
    title: s.title || '', range: s.range || null, reportBase: s.reportBase || null, docs: s.docs || [],
    follows: dept === 'president' ? (s.follows || []) : [],
    members: (s.members || []).map(m => ({ id: m.id, name: m.name, role: m.role === 'admin' ? 'admin' : 'member', createdAt: m.createdAt || '' })),
    labels: s.labels || [],
    issues: (s.issues || []).map(i => ({ id: i.id, title: i.title, cur: i.cur || 0, start: i.start || '', end: i.end || '', note: i.note || '',
      tags: i.tags || [], labels: i.labels || [], links: i.links || [], staff: i.staff || [], doneAt: i.doneAt || null, markers: i.markers || [] })),
    weeks: (s.weeks || []).map(w => ({ id: w.id, date: w.date, text: w.text, auto: !!w.auto })).sort((a, b) => (a.date + a.id < b.date + b.id ? -1 : 1)),
    events: (s.events || []).map(ev),
    meetGrant: dept === 'president' ? (s.meetGrant || null) : null,
  };
  if (dept === 'secretariat') Object.assign(out, { yearLabel: s.yearLabel, termStart: s.termStart, semester: s.semester || '' });
  return JSON.parse(JSON.stringify(out));
}
