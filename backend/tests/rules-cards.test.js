// 權限矩陣（抽樣每個集合）＋卡片／版本可見性與一致性 C-01～C-20（permissions.md 第 3、5.1a 節）
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { env, google, anon, seed, seedRole, seedDepts, assertSucceeds, assertFails, NOW, TS,
         createCard, editCard, cardData, verData, readDoc, audit, auditId } from './helpers.js';

let t;
const U = { boss: { super: true }, ed: { depts: { rights: 'editor' } }, adm: { depts: { rights: 'admin' } },
            ev: { depts: { events: 'editor' } }, sec: { depts: { secretariat: 'editor' } }, vw: { viewer: true } };
before(async () => { t = await env(); });
after(async () => { await t.cleanup(); });
beforeEach(async () => {
  await t.clearFirestore();
  await seedDepts(t);
  for (const [u, r] of Object.entries(U)) await seedRole(t, u, r);
});
const db = u => google(t, u);

describe('權限矩陣', () => {
  it('departments：任何人讀、只有總管理員寫', async () => {
    await assertSucceeds(anon(t).doc('departments/rights').get());
    await assertSucceeds(anon(t).collection('departments').where('active', '==', true).get());
    await assertFails(db('adm').doc('departments/rights').set({ name: 'x', order: 1, active: true, updatedAt: NOW(), updatedBy: 'adm' }));
    await assertSucceeds(db('boss').doc('departments/rights').set({ name: '權益部', order: 0, active: true, updatedAt: NOW(), updatedBy: 'boss' }));
    await assertFails(db('boss').doc('departments/nope').set({ name: 'x', order: 1, active: true, updatedAt: NOW(), updatedBy: 'boss' }));
  });
  it('org/config：公開讀，總管理員寫', async () => {
    await assertSucceeds(anon(t).doc('org/config').get());
    await assertFails(db('sec').doc('org/config').set({ yearLabel: '115', termStart: '', semester: '', updatedAt: NOW(), updatedBy: 'sec' }));
    await assertSucceeds(db('boss').doc('org/config').set({ yearLabel: '115', termStart: '', semester: 'up', updatedAt: NOW(), updatedBy: 'boss' }));
  });
  it('deptSettings：L1 讀；該部門管理員改（要 rev＋稽核）；編輯者、別部門不能', async () => {
    await seed(t, d => d.doc('deptSettings/rights').set({ title: 'A', rev: 1, updatedAt: TS.now(), updatedBy: 'boss' }));
    await assertFails(anon(t).doc('deptSettings/rights').get());
    await assertFails(db('nb').doc('deptSettings/rights').get());
    await assertSucceeds(db('vw').doc('deptSettings/rights').get());
    const w = (u, withAudit = true) => { const x = db(u), b = x.batch();
      b.set(x.doc('deptSettings/rights'), { title: 'B', rev: 2, updatedAt: NOW(), updatedBy: u });
      if (withAudit) b.set(x.doc(auditId('deptSettings', 'rights', 2)), audit('deptSettings', 'rights', 2, u));
      return b.commit(); };
    await assertFails(w('ed'));
    await assertFails(w('adm', false));
    await assertSucceeds(w('adm'));
  });
  it('users：本人建立（信箱要等於登入信箱）、之後只能改 lastLoginAt；別人讀不到', async () => {
    await assertFails(db('nb').doc('users/nb').set({ email: 'x@y.z', createdAt: NOW(), lastLoginAt: NOW() }));
    await assertSucceeds(db('nb').doc('users/nb').set({ email: 'nb@example.test', createdAt: NOW(), lastLoginAt: NOW() }));
    await assertFails(db('nb').doc('users/nb').update({ email: 'nb2@example.test' }));
    await assertSucceeds(db('nb').doc('users/nb').update({ lastLoginAt: NOW() }));
    await assertFails(db('ed').doc('users/nb').get());
    await assertSucceeds(db('boss').doc('users/nb').get());
  });
  it('profiles：本人寫 1～40 字；L1 讀；一般帳號只讀得到自己', async () => {
    await assertFails(db('nb').doc('profiles/nb').set({ displayName: '', updatedAt: NOW() }));
    await assertFails(db('nb').doc('profiles/nb').set({ displayName: 'x'.repeat(41), updatedAt: NOW() }));
    await assertSucceeds(db('nb').doc('profiles/nb').set({ displayName: '小明', updatedAt: NOW() }));
    await assertFails(db('nb').doc('profiles/ed').set({ displayName: '冒名', updatedAt: NOW() }));
    await assertSucceeds(db('nb').doc('profiles/nb').get());
    await assertSucceeds(db('vw').doc('profiles/nb').get());
    await seed(t, d => d.doc('profiles/ed').set({ displayName: 'ed', updatedAt: TS.now() }));
    await assertFails(db('nb').doc('profiles/ed').get());
  });
  it('issues／weeks／labels：L1 讀、部門編輯者寫、deptId 不能改', async () => {
    const iss = u => ({ deptId: 'rights', title: '議題', rev: 1, updatedAt: NOW(), updatedBy: u });
    await assertFails(db('vw').doc('issues/i1').set(iss('vw')));
    await assertFails(db('ev').doc('issues/i1').set(iss('ev')));
    await assertSucceeds(db('ed').doc('issues/i1').set(iss('ed')));
    await assertSucceeds(db('vw').doc('issues/i1').get());
    await assertFails(db('nb').doc('issues/i1').get());
    await assertFails(db('ed').doc('issues/i1').set({ ...iss('ed'), deptId: 'events', rev: 2 }));
    await assertSucceeds(db('ed').doc('issues/i1').set({ ...iss('ed'), title: '改', rev: 2 }));
    await assertSucceeds(db('ed').doc('weeks/w1').set({ deptId: 'rights', date: '2026-11-11', text: 'x', auto: false, createdAt: NOW(), updatedAt: NOW(), updatedBy: 'ed' }));
    await assertFails(db('vw').doc('labels/l1').set({ deptId: 'rights', kind: '人', name: 'x', updatedAt: NOW(), updatedBy: 'vw' }));
    await assertSucceeds(db('adm').doc('labels/l1').set({ deptId: 'rights', kind: '人', name: 'x', updatedAt: NOW(), updatedBy: 'adm' }));
    await assertFails(db('adm').doc('labels/l1').delete());
    await assertSucceeds(db('boss').doc('labels/l1').delete());
  });
  it('meetingMinutes：秘書處與總管理員', async () => {
    await assertFails(db('ed').doc('meetingMinutes/2026-11-11').set({ date: '2026-11-11', items: [] }));
    await assertFails(db('vw').doc('meetingMinutes/2026-11-11').get());
    await assertSucceeds(db('sec').doc('meetingMinutes/2026-11-11').set({ date: '2026-11-11', items: [] }));
    await assertSucceeds(db('boss').doc('meetingMinutes/2026-11-11').get());
    await assertSucceeds(db('sec').doc('attendanceRecords/s_m').set({ sessionId: 's', memberId: 'm' }));
    await assertFails(db('ed').doc('attendanceRecords/s_m').get());
  });
  it('grants/meetingEdit：L1 讀、總管理員寫、最多 7 天、要稽核', async () => {
    const w = (u, days) => { const x = db(u), b = x.batch();
      b.set(x.doc('grants/meetingEdit'), { until: TS.fromMillis(Date.now() + days * 864e5), by: u, at: NOW(), rev: 1, updatedAt: NOW(), updatedBy: u });
      b.set(x.doc(auditId('grants', 'meetingEdit', 1)), audit('grants', 'meetingEdit', 1, u));
      return b.commit(); };
    await assertFails(w('sec', 1));
    await assertFails(w('boss', 8));
    await assertSucceeds(w('boss', 1));
    await assertSucceeds(db('vw').doc('grants/meetingEdit').get());
    await assertFails(db('nb').doc('grants/meetingEdit').get());
  });
  it('migrations、未列出的集合：一般人全部拒絕', async () => {
    await assertFails(db('adm').doc('migrations/b1').get());
    await assertFails(db('boss').doc('whatever/x').set({ a: 1 }));
    await assertFails(db('boss').doc('whatever/x').get());
  });
});

describe('時間事件', () => {
  const ev = (u, o = {}) => ({ deptId: 'rights', cardId: null, blockId: null, label: '開會', start: TS.fromMillis(Date.UTC(2026, 10, 20)),
    end: TS.fromMillis(Date.UTC(2026, 10, 20)), startRaw: '2026-11-20', endRaw: '2026-11-20', allDay: true, place: '', toIssue: false,
    cardDeleted: false, scope: 'dept', visibility: 'internal', rev: 1, updatedAt: NOW(), updatedBy: u, ...o });
  it('公開活動 L0 可讀、內部的不行；公開只有活動部與總管理員能發、而且只能有公開欄位', async () => {
    await assertFails(db('ed').doc('events/p1').set(ev('ed', { visibility: 'public', title: 't' })));
    const pub = u => ({ deptId: 'events', title: '迎新', summary: '', start: TS.fromMillis(Date.UTC(2026, 10, 20)), end: TS.fromMillis(Date.UTC(2026, 10, 20)),
      allDay: true, place: '', scope: 'dept', visibility: 'public', cardDeleted: false, rev: 1, updatedAt: NOW(), updatedBy: u });
    await assertSucceeds(db('ev').doc('events/p1').set(pub('ev')));
    await assertFails(db('ev').doc('events/p2').set({ ...pub('ev'), label: '內文', cardId: 'c' }));
    await assertSucceeds(db('ed').doc('events/i1').set(ev('ed')));
    await assertSucceeds(anon(t).doc('events/p1').get());
    await assertSucceeds(anon(t).collection('events').where('visibility', '==', 'public').get());
    await assertFails(anon(t).doc('events/i1').get());
    await assertFails(anon(t).collection('events').get());
  });
  it('全會範圍：活動部可標 all-activity、秘書處可標 all-meeting、其他人不行', async () => {
    await seed(t, d => d.doc('events/e1').set({ ...ev('ed'), updatedAt: TS.now() }));
    const sc = (u, s) => db(u).doc('events/e1').update({ scope: s, rev: 2, updatedAt: NOW(), updatedBy: u });
    await assertFails(sc('ed', 'all-activity'));
    await assertFails(sc('sec', 'all-activity'));
    await assertSucceeds(sc('ev', 'all-activity'));
    await assertFails(db('ev').doc('events/e1').update({ scope: 'dept', label: '偷改', rev: 3, updatedAt: NOW(), updatedBy: 'ev' }));
  });
});

describe('卡片與版本 C-01～C-20', () => {
  async function deletedCard() {
    await createCard(db('ed'), 'ed', 'c1');
    const cur = await readDoc(t, 'cards/c1');
    await editCard(db('ed'), 'ed', 'c1', cur, { state: 'deleted', deletedAt: NOW(), deletedBy: 'ed' });
  }
  it('C-01～C-04 檢視者讀不到已刪除卡片與其版本（get、list、collection group）', async () => {
    await deletedCard();
    await assertFails(db('vw').doc('cards/c1').get());                                   // C-01
    await assertFails(db('vw').doc('cards/c1/versions/1').get());                        // C-02
    await assertFails(db('vw').doc('cards/c1/versions/2').get());
    await assertFails(db('vw').collection('cards/c1/versions').get());                   // C-03
    await assertFails(db('vw').collectionGroup('versions').get());                       // C-04
    await assertFails(db('vw').collectionGroup('versions').where('deptId', '==', 'rights').get());
    await assertFails(db('ev').collectionGroup('versions').where('deptId', '==', 'rights').get());
    await assertFails(db('vw').collection('cards').where('deptId', '==', 'rights').get()); // 沒帶 state 條件
    await assertSucceeds(db('vw').collection('cards').where('deptId', '==', 'rights').where('state', 'in', ['open', 'done']).get());
  });
  it('C-05 同部門編輯者讀已刪除卡片與版本；總管理員讀硬刪後留下的版本', async () => {
    await deletedCard();
    await assertSucceeds(db('ed').doc('cards/c1').get());
    await assertSucceeds(db('ed').doc('cards/c1/versions/2').get());
    await assertSucceeds(db('ed').collection('cards/c1/versions').get());
    await assertSucceeds(db('ed').collectionGroup('versions').where('deptId', '==', 'rights').get());
    await assertSucceeds(db('boss').doc('cards/c1').delete());
    await assertSucceeds(db('boss').doc('cards/c1/versions/1').get());
    await assertFails(db('ed').doc('cards/c1/versions/1').get());
  });
  it('C-06 別部門編輯者讀已刪除卡片的版本：拒絕', async () => {
    await deletedCard();
    await assertFails(db('ev').doc('cards/c1/versions/1').get());
    await assertFails(db('ev').doc('cards/c1').get());
  });
  it('C-07 復原後檢視者讀得到版本', async () => {
    await deletedCard();
    const cur = await readDoc(t, 'cards/c1');
    await assertSucceeds(editCard(db('ed'), 'ed', 'c1', cur, { state: 'open', deletedAt: null, deletedBy: null }));
    await assertSucceeds(db('vw').doc('cards/c1/versions/2').get());
    await assertSucceeds(db('vw').collection('cards/c1/versions').get());
  });
  it('C-08 改內容不寫版本：拒絕', async () => {
    await createCard(db('ed'), 'ed', 'c1');
    const cur = await readDoc(t, 'cards/c1');
    await assertFails(editCard(db('ed'), 'ed', 'c1', cur, { title: '改' }, null));
    await assertFails(createCard(db('ed'), 'ed', 'c2', {}, null));
  });
  it('C-09 版本內容與卡片不一致：拒絕', async () => {
    await createCard(db('ed'), 'ed', 'c1');
    const cur = await readDoc(t, 'cards/c1');
    for (const vo of [{ title: '別的' }, { blocks: [] }, { state: 'done' }, { deptId: 'events' }, { by: 'adm' }, { at: TS.now() }])
      await assertFails(editCard(db('ed'), 'ed', 'c1', cur, { title: '改' }, vo));
    await assertSucceeds(editCard(db('ed'), 'ed', 'c1', cur, { title: '改' }));
  });
  it('C-10 版本號跳號或沿用：拒絕', async () => {
    await createCard(db('ed'), 'ed', 'c1');
    const cur = await readDoc(t, 'cards/c1');
    await assertFails(editCard(db('ed'), 'ed', 'c1', cur, { title: 'x', version: 3 }));
    await assertFails(editCard(db('ed'), 'ed', 'c1', cur, { title: 'x', version: 1 }));
  });
  it('C-11 單獨建立版本（含替遷移卡片補版本）：拒絕', async () => {
    await createCard(db('ed'), 'ed', 'c1');
    const cur = await readDoc(t, 'cards/c1');
    await assertFails(db('ed').doc('cards/c1/versions/2').set(verData('ed', 'c1', { ...cur, version: 2 })));
    await assertFails(db('ed').doc('cards/c1/versions/1').set(verData('ed', 'c1', cur)));
  });
  it('C-12 硬刪後同 ID 重建、沿用留下的 versions/1：拒絕', async () => {
    await createCard(db('ed'), 'ed', 'c1');
    await db('boss').doc('cards/c1').delete();
    await assertFails(db('ed').doc('cards/c1').set(cardData('ed')));
    await assertFails(createCard(db('ed'), 'ed', 'c1'));
  });
  it('C-13 修改或刪除版本（含總管理員）：拒絕', async () => {
    await createCard(db('ed'), 'ed', 'c1');
    await assertFails(db('ed').doc('cards/c1/versions/1').update({ title: 'x' }));
    await assertFails(db('boss').doc('cards/c1/versions/1').update({ title: 'x' }));
    await assertFails(db('boss').doc('cards/c1/versions/1').delete());
    await assertFails(db('ed').doc('cards/c1/versions/1').delete());
  });
  it('C-14 非遷移路徑寫 imported: true：拒絕', async () => {
    await assertFails(createCard(db('ed'), 'ed', 'c1', {}, { imported: true }));
    await assertFails(createCard(db('boss'), 'boss', 'c1', { deptId: 'rights' }, { imported: true }));
  });
  it('C-15 兩個編輯者同時改同一張卡片：連續版本號、沒有重號；失敗的一方重讀後重試成功', async () => {
    await createCard(db('ed'), 'ed', 'c1');
    const outcome = [];
    // 前端的做法：交易內讀最新 → version＋1 → 寫回。模擬器裡後提交的那筆可能直接被規則拒絕
    // （版本文件已存在），而不是交易衝突重試；所以前端在拒絕時要重讀一次、版本變了就重試。
    const edit = async u => { const x = db(u);
      for (let i = 0; i < 3; i++) {
        try { await x.runTransaction(async tr => {
          const ref = x.doc('cards/c1'), cur = (await tr.get(ref)).data();
          const c = { ...cur, title: '由 ' + u, version: cur.version + 1, updatedAt: NOW(), updatedBy: u };
          tr.set(ref, c); tr.set(x.doc(`cards/c1/versions/${c.version}`), verData(u, 'c1', c));
        }); outcome.push(u + ':ok@' + i); return; }
        catch (e) { outcome.push(u + ':' + e.code + '@' + i); }
      }
      throw new Error('三次都失敗');
    };
    await Promise.all([edit('ed'), edit('adm')]);
    console.log('C-15 併發結果：', outcome.join(', '));
    const card = await readDoc(t, 'cards/c1');
    assert.equal(card.version, 3);
    const v2 = await readDoc(t, 'cards/c1/versions/2'), v3 = await readDoc(t, 'cards/c1/versions/3');
    assert.ok(v2 && v3 && v2.by !== v3.by && v3.by === card.updatedBy);
  });
  it('C-16 秘書處會議編輯：授權有效時可改報告事項；到期或沒標 report 拒絕', async () => {
    await createCard(db('ed'), 'ed', 'r1', { report: true });
    await createCard(db('ed'), 'ed', 'n1', { report: false });
    const grant = ms => seed(t, d => d.doc('grants/meetingEdit').set({ until: TS.fromMillis(Date.now() + ms), by: 'boss', at: TS.now(), rev: 1, updatedAt: TS.now(), updatedBy: 'boss' }));
    await grant(-60000);
    let cur = await readDoc(t, 'cards/r1');
    await assertFails(editCard(db('sec'), 'sec', 'r1', cur, { title: '秘書處改' }));
    await grant(3600000);
    await assertSucceeds(editCard(db('sec'), 'sec', 'r1', cur, { title: '秘書處改' }));
    cur = await readDoc(t, 'cards/n1');
    await assertFails(editCard(db('sec'), 'sec', 'n1', cur, { title: '秘書處改' }));
    cur = await readDoc(t, 'cards/r1');
    await assertFails(editCard(db('sec'), 'sec', 'r1', cur, { report: false }));          // 只能改內容
  });
  it('C-17 沒有角色的登入者讀看板內容：拒絕', async () => {
    await createCard(db('ed'), 'ed', 'c1');
    await seed(t, async d => { await d.doc('issues/i1').set({ deptId: 'rights', title: 'x', rev: 1 });
      await d.doc('slots/p_1').set({ ownerId: 'p', idx: 1, ref: 'r' }); await d.doc('profiles/ed').set({ displayName: 'ed' });
      await d.doc('events/e1').set({ deptId: 'rights', visibility: 'internal', cardDeleted: false }); });
    for (const p of ['cards/c1', 'issues/i1', 'events/e1', 'profiles/ed', 'slots/p_1', 'cards/c1/versions/1'])
      await assertFails(db('nb').doc(p).get());
    await assertFails(db('nb').collection('cards').where('state', 'in', ['open', 'done']).get());
  });
  it('C-18 檢視者寫任何看板內容：拒絕', async () => {
    await assertFails(createCard(db('vw'), 'vw', 'c1'));
    await assertFails(db('vw').doc('issues/i1').set({ deptId: 'rights', title: 'x', rev: 1, updatedAt: NOW(), updatedBy: 'vw' }));
    await assertFails(db('vw').doc('weeks/w1').set({ deptId: 'rights', date: '', text: 'x', auto: false, createdAt: NOW(), updatedAt: NOW(), updatedBy: 'vw' }));
    await assertFails(db('vw').doc('labels/l1').set({ deptId: 'rights', kind: '人', name: 'x', updatedAt: NOW(), updatedBy: 'vw' }));
    await assertFails(db('vw').doc('events/e1').set({ deptId: 'rights', start: TS.now(), end: TS.now(), allDay: false, cardDeleted: false, scope: 'dept', visibility: 'internal', rev: 1, updatedAt: NOW(), updatedBy: 'vw' }));
    await seed(t, d => d.doc('deptSettings/rights').set({ title: 'A', rev: 1 }));
    const x = db('vw'), b = x.batch();
    b.set(x.doc('deptSettings/rights'), { title: 'B', rev: 2, updatedAt: NOW(), updatedBy: 'vw' });
    b.set(x.doc(auditId('deptSettings', 'rights', 2)), audit('deptSettings', 'rights', 2, 'vw'));
    await assertFails(b.commit());
  });
  it('C-19 撤掉檢視者後下一次讀取被拒；已開的監聽也收到錯誤', async () => {
    await createCard(db('ed'), 'ed', 'c1');
    await assertSucceeds(db('vw').doc('cards/c1').get());
    const q = db('vw').collection('cards').where('state', 'in', ['open', 'done']);
    const events = [];
    const unsub = q.onSnapshot(s => events.push('snap:' + s.size), e => events.push('error:' + e.code));
    await new Promise(r => setTimeout(r, 500));
    await seedRole(t, 'vw', { viewer: false, rev: 2, lastVia: 'revoke' });
    await assertFails(db('vw').doc('cards/c1').get());
    // 觸發監聽重新評估：卡片有變動
    const cur = await readDoc(t, 'cards/c1');
    await editCard(db('ed'), 'ed', 'c1', cur, { title: '撤權後的修改' });
    await new Promise(r => setTimeout(r, 1500));
    unsub();
    console.log('C-19 監聽紀錄：', events.join(', '));
    assert.equal(events[0], 'snap:1');
    assert.ok(events.includes('error:permission-denied'), '監聽應該被收回');
    assert.equal(events.filter(e => e.startsWith('snap')).length, 1, '撤權後不應再收到新快照');
  });
  it('C-20 時間事件的 cardDeleted 必須等於批次後母卡片狀態', async () => {
    await createCard(db('ed'), 'ed', 'c1');
    const ev = (u, del) => ({ deptId: 'rights', cardId: 'c1', blockId: null, label: 'x', start: TS.now(), end: TS.now(), startRaw: '', endRaw: '',
      allDay: false, place: '', toIssue: false, cardDeleted: del, scope: 'dept', visibility: 'internal', rev: 1, updatedAt: NOW(), updatedBy: u });
    await assertFails(db('ed').doc('events/e1').set(ev('ed', true)));
    await assertSucceeds(db('ed').doc('events/e1').set(ev('ed', false)));
    // 刪除卡片時同一批把時間事件標 cardDeleted
    const cur = await readDoc(t, 'cards/c1'), x = db('ed');
    const c = { ...cur, state: 'deleted', deletedAt: NOW(), deletedBy: 'ed', version: 2, updatedAt: NOW(), updatedBy: 'ed' };
    let b = x.batch();
    b.set(x.doc('cards/c1'), c); b.set(x.doc('cards/c1/versions/2'), verData('ed', 'c1', c));
    b.set(x.doc('events/e1'), { ...ev('ed', false), rev: 2 });                               // 沒標
    await assertFails(b.commit());
    b = x.batch();
    b.set(x.doc('cards/c1'), c); b.set(x.doc('cards/c1/versions/2'), verData('ed', 'c1', c));
    b.set(x.doc('events/e1'), { ...ev('ed', true), rev: 2 });
    await assertSucceeds(b.commit());
    await assertFails(db('vw').doc('events/e1').get());
    await assertSucceeds(db('ed').doc('events/e1').get());
    await assertSucceeds(db('vw').collection('events').where('deptId', '==', 'rights').where('cardDeleted', '==', false).get());
  });
  it('狀態轉換：完成要 doneAt＝現在；刪除要 deletedBy＝自己', async () => {
    await createCard(db('ed'), 'ed', 'c1');
    const cur = await readDoc(t, 'cards/c1');
    await assertFails(editCard(db('ed'), 'ed', 'c1', cur, { state: 'done', doneAt: TS.fromMillis(0) }));
    await assertFails(editCard(db('ed'), 'ed', 'c1', cur, { state: 'deleted', deletedAt: NOW(), deletedBy: 'adm' }));
    await assertSucceeds(editCard(db('ed'), 'ed', 'c1', cur, { state: 'done', doneAt: NOW() }));
    await assertFails(db('ed').doc('cards/c1').update({ order: 5, title: 'x', updatedAt: NOW(), updatedBy: 'ed' }));
    await assertSucceeds(db('ed').doc('cards/c1').update({ order: 5, updatedAt: NOW(), updatedBy: 'ed' }));
    await assertFails(db('ev').doc('cards/c1').update({ order: 6, updatedAt: NOW(), updatedBy: 'ev' }));
  });
});
