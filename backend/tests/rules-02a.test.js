// 02A 規則負面測試 N-01～N-17（permissions.md 第 5.1b 節）：
// 登入可讀的範圍、各身分的寫入邊界、撤權、QR 竄改／重放／過期／重新產生、L3 與私人行程、永久刪除不留殘留。
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { env, google, anon, seed, seedRole, seedDepts, assertSucceeds, assertFails, NOW, TS, DEPTS,
         createCard, editCard, cardData, verData, readDoc, audit, auditId, newToken,
         commit, inviteWrites, redeemWrites, patch, superRoleWrites,
         purgeCard, purgeStartData, createCardWithEvents, eventData } from './helpers.js';

let t;
const MIN = 60000;
const U = { boss: { super: true }, ed: { depts: { rights: 'editor' } }, adm: { depts: { rights: 'admin' } },
            sec: { depts: { secretariat: 'editor' } }, pres: { depts: { president: 'admin' } }, gen: {} };
before(async () => { t = await env(); });
after(async () => { await t.cleanup(); });
beforeEach(async () => {
  await t.clearFirestore();
  await seedDepts(t);
  for (const [u, r] of Object.entries(U)) await seedRole(t, u, r);
});
const db = u => google(t, u);
const roleOf = u => readDoc(t, `roles/${u}`);

// 每個部門各放一份內部資料（規則停用下布置）
async function seedBoard() {
  await seed(t, async d => {
    for (const dept of DEPTS) {
      const id = `${dept}__c1`;
      await d.doc(`cards/${id}`).set({ ...cardData('seed', { deptId: dept }), createdAt: TS.now(), updatedAt: TS.now() });
      await d.doc(`cards/${id}/versions/1`).set({ ...verData('seed', id, { deptId: dept, version: 1, title: '卡片', blocks: [], state: 'open' }), at: TS.now() });
      await d.doc(`issues/${dept}__i1`).set({ deptId: dept, title: '議題', rev: 1, updatedAt: TS.now(), updatedBy: 'seed' });
      await d.doc(`weeks/${dept}__w1`).set({ deptId: dept, date: '2026-11-11', text: 'x', createdAt: TS.now(), updatedAt: TS.now(), updatedBy: 'seed' });
      await d.doc(`labels/${dept}__l1`).set({ deptId: dept, kind: '人', name: 'x', updatedAt: TS.now(), updatedBy: 'seed' });
      await d.doc(`events/${dept}__e1`).set({ ...eventData('seed', null, { deptId: dept }), updatedAt: TS.now() });
      await d.doc(`deptSettings/${dept}`).set({ title: dept, rev: 1, updatedAt: TS.now(), updatedBy: 'seed' });
    }
    await d.doc('profiles/ed').set({ displayName: 'ed', updatedAt: TS.now() });
    await d.doc('legacyIdentities/rights__m1').set({ deptId: 'rights', name: '舊', oldRole: 'member', createdAt: '', claimedBy: null, claimedAt: null, rev: 1 });
    await d.doc('grants/meetingEdit').set({ until: TS.fromMillis(Date.now() + 3600e3), by: 'boss', at: TS.now(), rev: 1 });
    await d.doc('calendars/pres').set({ name: '會長', managers: ['mgr'], rev: 1 });
    await d.doc('openWindows/w1').set({ ownerId: 'pres', start: TS.now(), end: TS.now() });
    await d.doc('slots/pres_1').set({ ownerId: 'pres', idx: 1, ref: 'x1' });
  });
}
const INTERNAL = d => [`cards/${d}__c1`, `cards/${d}__c1/versions/1`, `issues/${d}__i1`, `weeks/${d}__w1`, `labels/${d}__l1`,
  `events/${d}__e1`, `deptSettings/${d}`];
const SHARED = ['profiles/ed', 'legacyIdentities/rights__m1', 'grants/meetingEdit', 'calendars/pres', 'openWindows/w1', 'slots/pres_1'];

// 對某個部門做每一種看板寫入；回傳 [說明, Promise 工廠]
function boardWrites(u, dept) {
  const x = db(u);
  return [
    ['新增卡片', () => createCard(x, u, `${dept}__n_${u}`, { deptId: dept })],
    ['修改卡片', async () => editCard(x, u, `${dept}__c1`, await readDoc(t, `cards/${dept}__c1`), { title: '改' })],
    ['排序卡片', () => x.doc(`cards/${dept}__c1`).update({ order: 7, updatedAt: NOW(), updatedBy: u })],
    ['開始刪除卡片', async () => x.doc(`cards/${dept}__c1`).set(purgeStartData(await readDoc(t, `cards/${dept}__c1`), u, []))],
    ['新增議題', () => x.doc(`issues/${dept}__n_${u}`).set({ deptId: dept, title: 'x', rev: 1, updatedAt: NOW(), updatedBy: u })],
    ['修改議題', () => x.doc(`issues/${dept}__i1`).set({ deptId: dept, title: '改', rev: 2, updatedAt: NOW(), updatedBy: u })],
    ['新增週報', () => x.doc(`weeks/${dept}__n_${u}`).set({ deptId: dept, date: '2026-11-12', text: 'x', createdAt: NOW(), updatedAt: NOW(), updatedBy: u })],
    ['新增標籤', () => x.doc(`labels/${dept}__n_${u}`).set({ deptId: dept, kind: '人', name: 'x', updatedAt: NOW(), updatedBy: u })],
    ['新增時間事件', () => x.doc(`events/${dept}__n_${u}`).set(eventData(u, null, { deptId: dept }))],
    ['修改時間事件', () => x.doc(`events/${dept}__e1`).set({ ...eventData(u, null, { deptId: dept }), label: '改', rev: 2 })],
    ['刪除時間事件', () => x.doc(`events/${dept}__e1`).delete()],
    ['改部門設定', () => commit(x, [[`deptSettings/${dept}`, { title: '改', rev: 2, updatedAt: NOW(), updatedBy: u }],
      [auditId('deptSettings', dept, 2), audit('deptSettings', dept, 2, u)]])],
  ];
}
async function allWritesFail(u, depts, tag) {
  for (const dept of depts) for (const [what, w] of boardWrites(u, dept))
    await assertFails(w()).catch(e => { throw new Error(`${tag}：${dept} ${what} 應該被拒絕（${e.message}）`); });
}

describe('N-01～N-03 讀取範圍（02A：登入即可讀內部看板）', () => {
  it('N-01 未登入者讀任何部門的內部資料：拒絕（get 與 list）；公開的部門名稱與公開活動照常', async () => {
    await seedBoard();
    for (const dept of DEPTS) for (const p of INTERNAL(dept)) await assertFails(anon(t).doc(p).get());
    for (const p of SHARED) await assertFails(anon(t).doc(p).get());
    for (const q of [anon(t).collection('cards').where('state', 'in', ['open', 'done']), anon(t).collection('issues'), anon(t).collection('weeks'),
                     anon(t).collection('labels'), anon(t).collection('events').where('visibility', '==', 'internal'),
                     anon(t).collection('deptSettings'), anon(t).collection('profiles'), anon(t).collectionGroup('versions')])
      await assertFails(q.get());
    await assertSucceeds(anon(t).collection('departments').get());
    await assertSucceeds(anon(t).collection('events').where('visibility', '==', 'public').get());
  });
  it('N-02 未登入者寫任何部門的內部資料：拒絕', async () => {
    await seedBoard();
    const x = anon(t);
    for (const dept of DEPTS) {
      await assertFails(createCard(x, 'anon', `${dept}__n`, { deptId: dept }));
      await assertFails(x.doc(`cards/${dept}__c1`).update({ order: 1 }));
      await assertFails(x.doc(`cards/${dept}__c1`).delete());
      await assertFails(x.doc(`issues/${dept}__n`).set({ deptId: dept, title: 'x', rev: 1 }));
      await assertFails(x.doc(`events/${dept}__n`).set(eventData('anon', null, { deptId: dept })));
      await assertFails(x.doc(`deptSettings/${dept}`).set({ title: 'x', rev: 2 }));
    }
    await assertFails(x.doc('profiles/anon').set({ displayName: 'x', updatedAt: NOW() }));
  });
  it('N-03 任何已登入的 Google 帳號（沒有 roles 文件、或 roles 是空的）讀得到各部門內部看板，不需審核', async () => {
    await seedBoard();
    for (const u of ['gen', 'nobody']) {
      for (const dept of DEPTS) for (const p of INTERNAL(dept)) await assertSucceeds(db(u).doc(p).get());
      for (const p of SHARED) await assertSucceeds(db(u).doc(p).get());
      await assertSucceeds(db(u).collection('cards').where('deptId', '==', 'events').where('state', 'in', ['open', 'done']).get());
      await assertSucceeds(db(u).collection('events').where('deptId', '==', 'events').get());
    }
    // 非 Google 登入、信箱未驗證的帳號不算登入（I-22 的讀取版）
    const pw = t.authenticatedContext('x2', { email: 'x2@example.test', email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
    const nv = t.authenticatedContext('x3', { email: 'x3@example.test', email_verified: false, firebase: { sign_in_provider: 'google.com' } }).firestore();
    for (const x of [pw, nv]) await assertFails(x.doc('cards/rights__c1').get());
  });
});

describe('N-04～N-06 寫入邊界', () => {
  it('N-04 一般登入者（未獲編輯權）寫入任何部門：全部拒絕', async () => {
    await seedBoard();
    await allWritesFail('gen', DEPTS, '一般登入者');
    await allWritesFail('nobody', DEPTS, '沒有 roles 文件');
  });
  it('N-05 部門編輯者／管理員寫入其他部門：全部拒絕；寫自己部門成功', async () => {
    await seedBoard();
    await allWritesFail('ed', DEPTS.filter(d => d !== 'rights'), '權益部編輯者');
    await allWritesFail('adm', DEPTS.filter(d => d !== 'rights'), '權益部管理員');
    // 把自己部門的資料改成別的部門（搬家）也不行
    await assertFails(db('ed').doc('issues/rights__i1').set({ deptId: 'events', title: 'x', rev: 2, updatedAt: NOW(), updatedBy: 'ed' }));
    const cur = await readDoc(t, 'cards/rights__c1');
    await assertFails(editCard(db('ed'), 'ed', 'rights__c1', cur, { deptId: 'events' }));
    // 對照：自己部門可以
    await assertSucceeds(createCard(db('ed'), 'ed', 'rights__ok', { deptId: 'rights' }));
    await assertSucceeds(editCard(db('ed'), 'ed', 'rights__c1', cur, { title: '改' }));
  });
  it('N-06 已撤權者寫入：全部拒絕（含部分撤權後被撤的那個部門）；讀取不受影響', async () => {
    await seedBoard();
    await seedRole(t, 'ex', { depts: { rights: 'admin', events: 'editor' } });
    await assertSucceeds(createCard(db('ex'), 'ex', 'rights__mine', { deptId: 'rights' }));
    // 總管理員撤掉權益部（走 revoke，有稽核）
    await assertSucceeds(commit(db('boss'), superRoleWrites('boss', 'ex', await roleOf('ex'), { depts: { events: 'editor' } }, 'revoke', 'rv1')));
    await allWritesFail('ex', ['rights'], '撤掉權益部之後');
    await assertFails(editCard(db('ex'), 'ex', 'rights__mine', await readDoc(t, 'cards/rights__mine'), { title: '改' }));   // 自己建的也不行
    await assertSucceeds(db('ex').doc('cards/rights__c1').get());
    // 全部撤掉
    await assertSucceeds(commit(db('boss'), superRoleWrites('boss', 'ex', await roleOf('ex'), { depts: {} }, 'revoke', 'rv2')));
    await allWritesFail('ex', DEPTS, '全部撤權之後');
    // 被撤權的人不能自己把角色寫回去
    const r = await roleOf('ex');
    await assertFails(commit(db('ex'), superRoleWrites('ex', 'ex', r, { depts: { rights: 'admin' } }, 'manual', 'self')));
    await assertFails(db('ex').doc('roles/ex').update({ depts: { rights: 'admin' }, rev: r.rev + 1, updatedAt: NOW(), updatedBy: 'ex' }));
  });
});

describe('N-07～N-10 QR 邀請（10 分鐘、一次性、可撤銷、可重新產生）', () => {
  async function invite(o = {}) { const k = newToken(); await assertSucceeds(commit(db('boss'), inviteWrites('boss', k.h, o))); return { ...k, inv: await readDoc(t, `invitations/${k.h}`) }; }
  const editor = { depts: { rights: 'editor' } };
  it('N-07 竄改 QR 內容：改權杖任一字元、截短、加長、換成雜湊、換成別張邀請的權杖：拒絕', async () => {
    const k = await invite(), other = await invite({ deptId: 'events' });
    const flip = c => (c === 'A' ? 'B' : 'A');
    const forged = [k.token.slice(0, -1) + flip(k.token.slice(-1)), flip(k.token[0]) + k.token.slice(1), k.token.slice(0, 20),
      k.token + 'A', k.token.toUpperCase(), k.h, other.token, '', 'x'.repeat(43)];
    for (const tok of forged) await assertFails(commit(db('u1'), redeemWrites('u1', { ...k, token: tok }, null, editor)));
    // 用合法權杖，但核銷時順便改邀請上的部門、角色、期限、綁定信箱
    for (const p of [{ deptId: 'events' }, { role: 'admin' }, { expiresAt: TS.fromMillis(Date.now() + 9 * MIN) }, { boundEmail: 'u1@example.test' }])
      await assertFails(commit(db('u1'), patch(redeemWrites('u1', k, null, editor), 0, p)));
    // 拿 A 的權杖核銷 B（路徑是 B 的雜湊）
    await assertFails(commit(db('u1'), redeemWrites('u1', { ...other, token: k.token }, null, { depts: { events: 'editor' } })));
    assert.equal((await readDoc(t, `invitations/${k.h}`)).status, 'active');
    await assertSucceeds(commit(db('u1'), redeemWrites('u1', k, null, editor)));
  });
  it('N-08 重放已核銷的 QR：同一人、別人、被撤權後再掃一次：拒絕', async () => {
    const k = await invite();
    await assertSucceeds(commit(db('u1'), redeemWrites('u1', k, null, editor)));
    const used = await readDoc(t, `invitations/${k.h}`);
    const replay = { ...k, inv: { ...used, status: 'active', rev: used.rev } };
    await assertFails(commit(db('u2'), redeemWrites('u2', replay, null, editor)));
    await assertFails(commit(db('u2'), redeemWrites('u2', { ...k, inv: used }, null, editor)));
    await assertSucceeds(commit(db('boss'), superRoleWrites('boss', 'u1', await roleOf('u1'), { depts: {} }, 'revoke', 'rv1')));
    await assertFails(commit(db('u1'), redeemWrites('u1', replay, await roleOf('u1'), editor)));
    assert.deepEqual((await roleOf('u1')).depts, {});
    assert.equal(await roleOf('u2'), undefined);
  });
  it('N-09 過期的 QR：到期後 1 秒、核銷時把期限改長、總管理員事後延長期限：拒絕', async () => {
    const k = await invite();
    await seed(t, d => d.doc(`invitations/${k.h}`).update({ expiresAt: TS.fromMillis(Date.now() - 1000) }));
    const exp = { ...k, inv: await readDoc(t, `invitations/${k.h}`) };
    await assertFails(commit(db('u1'), redeemWrites('u1', exp, null, editor)));
    await assertFails(commit(db('u1'), patch(redeemWrites('u1', exp, null, editor), 0, { expiresAt: TS.fromMillis(Date.now() + 5 * MIN) })));
    await assertFails(commit(db('boss'), [[`invitations/${k.h}`, { ...exp.inv, expiresAt: TS.fromMillis(Date.now() + 5 * MIN), rev: 2, updatedAt: NOW(), updatedBy: 'boss' }],
      [auditId('invitations', k.h, 2), { col: 'invitations', docId: k.h, rev: 2, action: 'extend', actor: 'boss', at: NOW(), before: { status: 'active' }, after: { status: 'active' }, ref: '' }]]));
    // 預設與上限都是 10 分鐘：建立 10 分 1 秒的邀請被拒
    await assertFails(commit(db('boss'), inviteWrites('boss', newToken().h, { expiresAt: TS.fromMillis(Date.now() + 10 * MIN + 1000) })));
  });
  it('N-10 重新產生：同一批撤銷舊邀請＋建立新邀請；舊 QR 失效、新 QR 可用；非總管理員不能重新產生', async () => {
    const old = await invite();
    const fresh = newToken();
    const regen = actor => commit(db(actor), [
      [`invitations/${old.h}`, { ...old.inv, status: 'revoked', revokedBy: actor, revokedAt: NOW(), rev: 2, updatedAt: NOW(), updatedBy: actor }],
      [auditId('invitations', old.h, 2), { col: 'invitations', docId: old.h, rev: 2, action: 'revoke', actor, at: NOW(), before: { status: 'active' }, after: { status: 'revoked' }, ref: fresh.h }],
      ...patch(inviteWrites(actor, fresh.h), 1, { ref: old.h })]);
    await seedRole(t, 'adm2', { depts: { rights: 'admin' } });
    await assertFails(regen('adm2'));
    await assertSucceeds(regen('boss'));
    await assertFails(commit(db('u1'), redeemWrites('u1', { ...old, inv: { ...old.inv, rev: 2 } }, null, editor)));
    await assertFails(commit(db('u1'), redeemWrites('u1', old, null, editor)));
    await assertSucceeds(commit(db('u1'), redeemWrites('u1', { ...fresh, inv: await readDoc(t, `invitations/${fresh.h}`) }, null, editor)));
  });
});

describe('N-11～N-12 不在登入可讀範圍內的資料', () => {
  it('N-11 一般登入者、其他部門的編輯者讀秘書處點名名單與會議紀錄：拒絕；秘書處與總管理員可以', async () => {
    await seed(t, async d => {
      await d.doc('attendanceMembers/m1').set({ name: '某人' });
      await d.doc('attendanceSessions/s1').set({ date: '2026-11-11' });
      await d.doc('attendanceRecords/s1_m1').set({ sessionId: 's1', memberId: 'm1', status: 'present' });
      await d.doc('meetingMinutes/2026-11-11').set({ date: '2026-11-11', items: [] });
    });
    const paths = ['attendanceMembers/m1', 'attendanceSessions/s1', 'attendanceRecords/s1_m1', 'meetingMinutes/2026-11-11'];
    for (const u of ['gen', 'nobody', 'ed', 'adm', 'pres']) {
      for (const p of paths) await assertFails(db(u).doc(p).get());
      for (const c of ['attendanceMembers', 'attendanceSessions', 'attendanceRecords', 'meetingMinutes']) await assertFails(db(u).collection(c).get());
      await assertFails(db(u).doc('attendanceRecords/s1_m2').set({ sessionId: 's1', memberId: 'm2', status: 'present' }));
    }
    for (const p of paths) await assertFails(anon(t).doc(p).get());
    for (const u of ['sec', 'boss']) for (const p of paths) await assertSucceeds(db(u).doc(p).get());
  });
  it('N-12 一般登入者、會長室部門管理員（不是行事曆管理者）讀會長私人行程與別人的預約：拒絕；只看得到忙／閒', async () => {
    await seed(t, async d => {
      await d.doc('calendars/pres').set({ name: '會長', managers: ['mgr'], rev: 1 });
      await d.doc('busyBlocks/x1').set({ ownerId: 'pres', title: '看醫生', startSlot: 1, slotCount: 1, status: 'active', rev: 1 });
      await d.doc('bookings/b1').set({ ownerId: 'pres', requester: 'ed', topic: '私事', status: 'pending', rev: 1 });
      await d.doc('slots/pres_1').set({ ownerId: 'pres', idx: 1, ref: 'x1' });
    });
    for (const u of ['gen', 'nobody', 'pres', 'adm', 'boss']) {
      await assertFails(db(u).doc('busyBlocks/x1').get());
      await assertFails(db(u).collection('busyBlocks').where('ownerId', '==', 'pres').get());
      await assertFails(db(u).doc('bookings/b1').get());
      await assertFails(db(u).collection('bookings').where('ownerId', '==', 'pres').get());
    }
    await assertFails(anon(t).doc('busyBlocks/x1').get());
    await assertSucceeds(db('gen').doc('slots/pres_1').get());                                      // 忙／閒（沒有標題）
    await assertSucceeds(db('mgr').doc('busyBlocks/x1').get());
    await assertSucceeds(db('ed').doc('bookings/b1').get());                                        // 申請人本人
  });
});

describe('N-13～N-17 卡片永久刪除（連同版本與時間標記，不留殘留）', () => {
  // 有 3 個版本、5 個時間事件的卡片（時間事件超過一批 3 個，版本要由新往舊刪）
  async function bigCard(id = 'c1') {
    const ids = await createCardWithEvents(db('ed'), 'ed', id, 5);
    for (const title of ['二', '三']) await editCard(db('ed'), 'ed', id, await readDoc(t, `cards/${id}`), { title });
    return ids;
  }
  async function leftovers(id, ids) {
    const left = [];
    for (const p of [`cards/${id}`, ...[1, 2, 3, 4].map(v => `cards/${id}/versions/${v}`), ...ids.map(e => `events/${e}`)])
      if (await readDoc(t, p)) left.push(p);
    return left;
  }
  it('N-13 正常流程：部門編輯者永久刪除後，卡片、全部版本、全部時間標記都不存在', async () => {
    const ids = await bigCard();
    await purgeCard(db('ed'), 'ed', 'c1');
    assert.deepEqual(await leftovers('c1', ids), []);
    // 小卡片只要兩批：開始＋刪時間事件；刪版本＋刪卡片（同一份文件一批只寫一次）
    const small = await createCardWithEvents(db('adm'), 'adm', 'c2', 2);
    const x = db('adm'), b = x.batch();
    b.set(x.doc('cards/c2'), purgeStartData(await readDoc(t, 'cards/c2'), 'adm', []));
    small.forEach(e => b.delete(x.doc(`events/${e}`)));
    await assertSucceeds(b.commit());                                                               // 先進 purging（同一份文件一批只能寫一次）
    const b2 = x.batch(); b2.delete(x.doc('cards/c2/versions/1')); b2.delete(x.doc('cards/c2'));
    await assertSucceeds(b2.commit());
    assert.deepEqual(await leftovers('c2', small), []);
    // 總管理員也走同一個流程
    const ids3 = await createCardWithEvents(db('ed'), 'ed', 'c3', 1);
    await purgeCard(db('boss'), 'boss', 'c3');
    assert.deepEqual(await leftovers('c3', ids3), []);
  });
  it('N-14 留下版本或時間標記的刪法：全部拒絕', async () => {
    const ids = await bigCard();
    const x = db('ed');
    // 直接刪卡片（沒進 purging）
    await assertFails(x.doc('cards/c1').delete());
    await assertFails(db('boss').doc('cards/c1').delete());
    // 開始刪除時從 timeIds 拿掉事件卻沒刪事件
    let cur = await readDoc(t, 'cards/c1');
    await assertFails(x.doc('cards/c1').set(purgeStartData(cur, 'ed', ids.slice(1))));
    // 一次拿掉超過 3 個（規則沒有迴圈）
    let b = x.batch(); b.set(x.doc('cards/c1'), purgeStartData(cur, 'ed', ids.slice(4))); ids.slice(0, 4).forEach(e => b.delete(x.doc(`events/${e}`)));
    await assertFails(b.commit());
    // 開始刪除時順便加新的時間標記
    await assertFails(x.doc('cards/c1').set(purgeStartData(cur, 'ed', [...ids, 'new'])));
    await assertSucceeds(x.doc('cards/c1').set(purgeStartData(cur, 'ed', ids)));
    cur = await readDoc(t, 'cards/c1');
    // 還有時間事件（timeIds 不是空的）、還有版本：刪卡片拒絕
    b = x.batch(); [3, 2, 1].forEach(v => b.delete(x.doc(`cards/c1/versions/${v}`))); b.delete(x.doc('cards/c1'));
    await assertFails(b.commit());
    // 時間事件刪了、timeIds 也清空，但版本還在：刪卡片拒絕
    b = x.batch(); ids.slice(0, 3).forEach(e => b.delete(x.doc(`events/${e}`))); b.update(x.doc('cards/c1'), { timeIds: ids.slice(3), updatedAt: NOW(), updatedBy: 'ed' });
    await assertSucceeds(b.commit());
    b = x.batch(); ids.slice(3).forEach(e => b.delete(x.doc(`events/${e}`))); b.update(x.doc('cards/c1'), { timeIds: [], updatedAt: NOW(), updatedBy: 'ed' });
    await assertSucceeds(b.commit());
    await assertFails(x.doc('cards/c1').delete());
    b = x.batch(); [3, 2].forEach(v => b.delete(x.doc(`cards/c1/versions/${v}`))); b.delete(x.doc('cards/c1'));
    await assertFails(b.commit());                                                                  // 第 1 版還在
    // 版本跳著刪（第 2 版還在就刪第 1 版）
    await assertFails(x.doc('cards/c1/versions/1').delete());
    b = x.batch(); b.delete(x.doc('cards/c1/versions/3')); b.delete(x.doc('cards/c1/versions/1'));
    await assertFails(b.commit());
    // 清除中的卡片 timeIds 只能減少
    await assertFails(x.doc('cards/c1').update({ timeIds: ['x'], updatedAt: NOW(), updatedBy: 'ed' }));
    // 正確順序：由新往舊，最後刪卡片
    b = x.batch(); [3, 2, 1].forEach(v => b.delete(x.doc(`cards/c1/versions/${v}`))); b.delete(x.doc('cards/c1'));
    await assertSucceeds(b.commit());
    assert.deepEqual(await leftovers('c1', ids), []);
  });
  it('N-15 卡片沒在刪除時，單獨刪版本或刪仍列在卡片上的時間事件：拒絕（含總管理員刪版本）', async () => {
    const ids = await bigCard();
    for (const u of ['ed', 'adm', 'boss']) {
      await assertFails(db(u).doc('cards/c1/versions/3').delete());
      await assertFails(db(u).doc('cards/c1/versions/1').delete());
    }
    for (const u of ['ed', 'adm']) await assertFails(db(u).doc(`events/${ids[0]}`).delete());
    // 編輯卡片時拿掉時間標記：要同批刪事件（不刪就拒絕）
    const cur = await readDoc(t, 'cards/c1');
    await assertFails(editCard(db('ed'), 'ed', 'c1', cur, { timeIds: ids.slice(1) }));
    const x = db('ed'), c = { ...cur, timeIds: ids.slice(1), version: cur.version + 1, updatedAt: NOW(), updatedBy: 'ed' };
    const b = x.batch(); b.set(x.doc('cards/c1'), c); b.set(x.doc(`cards/c1/versions/${c.version}`), verData('ed', 'c1', c)); b.delete(x.doc(`events/${ids[0]}`));
    await assertSucceeds(b.commit());
    // 別部門的編輯者不能用「卡片沒列」的理由刪事件
    await seedRole(t, 'evx', { depts: { events: 'editor' } });
    await seed(t, d => d.doc('events/orphanish').set({ ...eventData('ed', 'c1'), updatedAt: TS.now() }));
    await assertFails(db('evx').doc('events/orphanish').delete());
  });
  it('N-16 無刪除權限者刪除卡片（開始刪除、清除、直接刪）：拒絕', async () => {
    const ids = await bigCard();
    await seedRole(t, 'evx', { depts: { events: 'admin' } });
    await seedRole(t, 'ex', { depts: { rights: 'editor' } });
    await assertSucceeds(commit(db('boss'), superRoleWrites('boss', 'ex', await roleOf('ex'), { depts: {} }, 'revoke', 'rv')));
    // 秘書處在會議授權期間可以改報告事項的內容，但不能刪
    await seed(t, async d => { await d.doc('cards/c1').update({ report: true });
      await d.doc('grants/meetingEdit').set({ until: TS.fromMillis(Date.now() + 3600e3), by: 'boss', at: TS.now(), rev: 1 }); });
    const cur = await readDoc(t, 'cards/c1');
    for (const u of ['gen', 'nobody', 'evx', 'sec', 'ex', 'pres']) {
      await assertFails(db(u).doc('cards/c1').set(purgeStartData(cur, u, ids)));
      await assertFails(db(u).doc('cards/c1').delete());
      await assertFails(db(u).doc('cards/c1/versions/3').delete());
      await assertFails(db(u).doc(`events/${ids[0]}`).delete());
    }
    await assertFails(anon(t).doc('cards/c1').delete());
    // 部門編輯者開始刪除之後，沒有刪除權限的人也不能接手清除或刪卡片本身
    await assertSucceeds(db('ed').doc('cards/c1').set(purgeStartData(cur, 'ed', ids)));
    const mid = await readDoc(t, 'cards/c1');
    for (const u of ['gen', 'evx', 'ex']) {
      const x = db(u), b = x.batch();
      b.delete(x.doc(`events/${ids[0]}`)); b.update(x.doc('cards/c1'), { timeIds: ids.slice(1), updatedAt: NOW(), updatedBy: u });
      await assertFails(b.commit());
    }
    assert.deepEqual((await readDoc(t, 'cards/c1')).timeIds, mid.timeIds);
    for (const u of ['gen', 'evx', 'ex', 'sec']) {                                               // 也不能單獨刪事件或版本
      await assertFails(db(u).doc(`events/${ids[0]}`).delete());
      await assertFails(db(u).doc('cards/c1/versions/3').delete());
    }
  });
  it('N-17 一般登入者看不到刪除中的卡片與其版本；刪除中的時間事件仍可讀到被清除為止（已知限制）', async () => {
    const ids = await bigCard();
    const cur = await readDoc(t, 'cards/c1');
    const x = db('ed'), b = x.batch();
    b.set(x.doc('cards/c1'), purgeStartData(cur, 'ed', ids.slice(3))); ids.slice(0, 3).forEach(e => b.delete(x.doc(`events/${e}`)));
    await assertSucceeds(b.commit());
    await assertFails(db('gen').doc('cards/c1').get());
    await assertFails(db('gen').doc('cards/c1/versions/3').get());
    await assertSucceeds(db('gen').doc(`events/${ids[3]}`).get());                                  // 第一批之後剩下的事件
    await purgeCard(db('ed'), 'ed', 'c1');
    assert.deepEqual(await leftovers('c1', ids), []);
  });
});
