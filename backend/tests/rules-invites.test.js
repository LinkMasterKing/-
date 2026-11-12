// QR 邀請、角色、權限申請、稽核紀錄攻擊測試 I-01～I-49（invitations-roles-audit.md 第 8 節）
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { env, google, anon, seed, seedRole, seedDepts, assertSucceeds, assertFails, NOW, TS,
         createCard, readDoc, newToken, auditId,
         commit, inviteWrites, redeemWrites, patch, superRoleWrites } from './helpers.js';

let t;
before(async () => { t = await env(); });
after(async () => { await t.cleanup(); });
beforeEach(async () => {
  await t.clearFirestore();
  await seedDepts(t);
  await seedRole(t, 'boss', { super: true });
  await seedRole(t, 'boss2', { super: true });
});
const db = u => google(t, u);
const MIN = 60000;

// 建構合法寫入的函式在 helpers.js（commit、inviteWrites、redeemWrites、patch、superRoleWrites）；攻擊測試改其中的欄位
async function invite(o = {}) { const k = newToken(); await assertSucceeds(commit(db('boss'), inviteWrites('boss', k.h, o))); return { ...k, inv: await readDoc(t, `invitations/${k.h}`) }; }
function requestWrites(u, id, o = {}) {
  return [[`roleRequests/${id}`, { uid: u, deptId: 'rights', role: 'editor', note: '', status: 'pending', rev: 1, createdAt: NOW(), updatedAt: NOW(), updatedBy: u, ...o }],
    [auditId('roleRequests', id, 1), { col: 'roleRequests', docId: id, rev: 1, action: 'request', actor: u, at: NOW(), before: {}, after: { status: 'pending' }, ref: '' }]];
}
function decideWrites(actor, id, req, status) {
  return [[`roleRequests/${id}`, { ...req, status, decidedBy: actor, decidedAt: NOW(), rev: req.rev + 1, updatedAt: NOW(), updatedBy: actor }],
    [auditId('roleRequests', id, req.rev + 1), { col: 'roleRequests', docId: id, rev: req.rev + 1, action: status, actor, at: NOW(), before: { status: req.status }, after: { status }, ref: id }]];
}
const roleOf = u => readDoc(t, `roles/${u}`);

describe('邀請核銷 I-01～I-22、I-31～I-36', () => {
  it('I-30 正常流程：建立 → 預覽 → 核銷；稽核鏈連號', async () => {
    const k = await invite();
    await assertSucceeds(db('u1').doc(`invitations/${k.h}`).get());               // 預覽
    await assertSucceeds(commit(db('u1'), redeemWrites('u1', k, null, { depts: { rights: 'editor' } })));
    const r = await roleOf('u1');
    assert.deepEqual(r.depts, { rights: 'editor' });
    assert.ok(await readDoc(t, auditId('invitations', k.h, 1)) && await readDoc(t, auditId('invitations', k.h, 2)) && await readDoc(t, auditId('roles', 'u1', 1)));
    await assertSucceeds(createCard(db('u1'), 'u1', 'c1'));
  });
  it('I-01 同一張邀請再核銷一次：拒絕', async () => {
    const k = await invite();
    await assertSucceeds(commit(db('u1'), redeemWrites('u1', k, null, { depts: { rights: 'editor' } })));
    const k2 = { ...k, inv: await readDoc(t, `invitations/${k.h}`) };
    const cur = await roleOf('u1');
    await assertFails(commit(db('u1'), redeemWrites('u1', { ...k2, inv: { ...k2.inv, status: 'active' } }, cur, { depts: { rights: 'admin' } })));
    await assertFails(commit(db('u2'), redeemWrites('u2', { ...k2, inv: { ...k2.inv, status: 'active' } }, null, { depts: { rights: 'editor' } })));
  });
  it('I-02 四個帳號同時核銷同一張：恰好一個成功', async () => {
    const k = await invite();
    const us = ['a1', 'a2', 'a3', 'a4'];
    const res = await Promise.allSettled(us.map(u => commit(db(u), redeemWrites(u, k, null, { depts: { rights: 'editor' } }))));
    const ok = res.map((r, i) => r.status === 'fulfilled' ? us[i] : null).filter(Boolean);
    assert.equal(ok.length, 1);
    const winner = ok[0];
    assert.equal((await readDoc(t, `invitations/${k.h}`)).usedBy, winner);
    for (const u of us) assert.equal(!!(await roleOf(u)), u === winner);
    assert.ok(await readDoc(t, auditId('roles', winner, 1)));
  });
  it('I-03 過期、I-04 已撤銷、I-33 第 10 分鐘之後：拒絕；I-32 到期前：成功', async () => {
    const k = await invite();
    await seed(t, d => d.doc(`invitations/${k.h}`).update({ expiresAt: TS.fromMillis(Date.now() - 1000) }));
    await assertFails(commit(db('u1'), redeemWrites('u1', { ...k, inv: await readDoc(t, `invitations/${k.h}`) }, null, { depts: { rights: 'editor' } })));
    const k2 = await invite();
    await seed(t, d => d.doc(`invitations/${k2.h}`).update({ expiresAt: TS.fromMillis(Date.now() + 1500) }));   // 剩 1.5 秒＝第 9 分 58 秒
    await assertSucceeds(commit(db('u2'), redeemWrites('u2', { ...k2, inv: await readDoc(t, `invitations/${k2.h}`) }, null, { depts: { rights: 'editor' } })));
    const k3 = await invite();
    await assertSucceeds(commit(db('boss'), [[`invitations/${k3.h}`, { ...k3.inv, status: 'revoked', revokedBy: 'boss', revokedAt: NOW(), rev: 2, updatedAt: NOW(), updatedBy: 'boss' }],
      [auditId('invitations', k3.h, 2), { col: 'invitations', docId: k3.h, rev: 2, action: 'revoke', actor: 'boss', at: NOW(), before: { status: 'active' }, after: { status: 'revoked' }, ref: '' }]]));
    await assertFails(commit(db('u3'), redeemWrites('u3', { ...k3, inv: { ...k3.inv, rev: 2 } }, null, { depts: { rights: 'editor' } })));
    // 用戶端時鐘：usedAt 用自己的時間
    const k4 = await invite();
    await assertFails(commit(db('u4'), patch(redeemWrites('u4', k4, null, { depts: { rights: 'editor' } }), 0, { usedAt: TS.fromMillis(Date.now() - 20 * MIN) })));
  });
  it('I-05 只知道雜湊、不知道權杖：拒絕', async () => {
    const k = await invite();
    await assertFails(commit(db('u1'), redeemWrites('u1', { ...k, token: k.h }, null, { depts: { rights: 'editor' } })));
    await assertFails(commit(db('u1'), redeemWrites('u1', { ...k, token: newToken().token }, null, { depts: { rights: 'editor' } })));
    await assertFails(commit(db('u1'), patch(redeemWrites('u1', k, null, { depts: { rights: 'editor' } }), 0, { token: null })));
  });
  it('I-06 寫成管理員、I-07 順便 super、I-08 換部門、I-09 多加部門：拒絕', async () => {
    const k = await invite();
    for (const next of [{ depts: { rights: 'admin' } }, { depts: { rights: 'editor' }, super: true },
                        { depts: { pr: 'editor' } }, { depts: { rights: 'editor', pr: 'editor' } }, { depts: {} }])
      await assertFails(commit(db('u1'), redeemWrites('u1', k, null, next)));
    await assertSucceeds(commit(db('u1'), redeemWrites('u1', k, null, { depts: { rights: 'editor' } })));
  });
  it('I-10 不更新邀請直接建立角色、I-11 lastRef 指向不存在的邀請：拒絕', async () => {
    const k = await invite();
    const w = redeemWrites('u1', k, null, { depts: { rights: 'editor' } });
    await assertFails(commit(db('u1'), w.slice(2)));
    const fake = newToken();
    const w2 = redeemWrites('u1', { ...k, h: fake.h }, null, { depts: { rights: 'editor' } });
    await assertFails(commit(db('u1'), w2.slice(2)));
  });
  it('I-12 核銷不寫稽核；I-13 稽核 actor 寫別人或 at 用用戶端時間：拒絕', async () => {
    const k = await invite();
    const w = redeemWrites('u1', k, null, { depts: { rights: 'editor' } });
    await assertFails(commit(db('u1'), [w[0], w[2], w[3]]));
    await assertFails(commit(db('u1'), [w[0], w[1], w[2]]));
    await assertFails(commit(db('u1'), patch(redeemWrites('u1', k, null, { depts: { rights: 'editor' } }), 1, { actor: 'boss' })));
    await assertFails(commit(db('u1'), patch(redeemWrites('u1', k, null, { depts: { rights: 'editor' } }), 3, { at: TS.now() })));
  });
  it('I-14 修改或刪除稽核紀錄（含總管理員）：拒絕', async () => {
    const k = await invite();
    for (const u of ['boss', 'u1']) {
      await assertFails(db(u).doc(auditId('invitations', k.h, 1)).update({ actor: 'x' }));
      await assertFails(db(u).doc(auditId('invitations', k.h, 1)).delete());
    }
    await assertFails(commit(db('boss'), [[auditId('invitations', k.h, 1), { col: 'invitations', docId: k.h, rev: 1, action: 'x', actor: 'boss', at: NOW(), before: {}, after: { status: 'active' }, ref: '' }]]));
  });
  it('I-15 預先建立別人的下一號稽核佔號：拒絕', async () => {
    await seedRole(t, 'u1', { depts: { rights: 'editor' } });
    for (const actor of ['u2', 'boss'])
      await assertFails(db(actor).doc(auditId('roles', 'u1', 2)).set({ col: 'roles', docId: 'u1', rev: 2, action: 'manual', actor, at: NOW(), before: {}, after: {}, ref: '' }));
  });
  it('I-16 roles.rev 跳號或沿用；I-17 稽核 before／after 不符：拒絕', async () => {
    await seedRole(t, 'u1', { depts: { rights: 'editor' } });
    const cur = await roleOf('u1');
    const w = superRoleWrites('boss', 'u1', cur, { depts: { rights: 'admin' } }, 'manual');
    await assertFails(commit(db('boss'), [[w[0][0], { ...w[0][1], rev: 3 }], [auditId('roles', 'u1', 3), { ...w[1][1], rev: 3 }]]));
    await assertFails(commit(db('boss'), [[w[0][0], { ...w[0][1], rev: 1 }], [auditId('roles', 'u1', 1), { ...w[1][1], rev: 1 }]]));
    await assertFails(commit(db('boss'), patch(superRoleWrites('boss', 'u1', cur, { depts: { rights: 'admin' } }, 'manual'), 1, { after: { super: false, depts: { rights: 'editor' } } })));
    await assertFails(commit(db('boss'), patch(superRoleWrites('boss', 'u1', cur, { depts: { rights: 'admin' } }, 'manual'), 1, { before: { super: false, depts: {} } })));
    await assertSucceeds(commit(db('boss'), superRoleWrites('boss', 'u1', cur, { depts: { rights: 'admin' } }, 'manual')));
  });
  it('I-18 綁定信箱的邀請由別的帳號核銷：拒絕', async () => {
    const k = await invite({ boundEmail: 'u1@example.test' });
    await assertFails(commit(db('u2'), redeemWrites('u2', k, null, { depts: { rights: 'editor' } })));
    await assertSucceeds(commit(db('u1'), redeemWrites('u1', k, null, { depts: { rights: 'editor' } })));
  });
  it('I-19 已是該部門管理員，再核銷同部門編輯者邀請（降級）：拒絕', async () => {
    await seedRole(t, 'u1', { depts: { rights: 'admin' } });
    const k = await invite();
    const cur = await roleOf('u1');
    await assertFails(commit(db('u1'), redeemWrites('u1', k, cur, { depts: { rights: 'editor' } })));
    await assertFails(commit(db('u1'), redeemWrites('u1', k, cur, { depts: { rights: 'admin' } })));
  });
  it('I-20、I-31 建立邀請的限制', async () => {
    const k = () => newToken().h;
    await assertFails(commit(db('u1'), inviteWrites('u1', k())));                                   // 非總管理員
    await seedRole(t, 'adm', { depts: { rights: 'admin' } });
    await assertFails(commit(db('adm'), inviteWrites('adm', k())));                                 // D3：部門管理員也不行
    for (const ms of [11 * MIN, 24 * 60 * MIN, 7 * 24 * 60 * MIN, 30 * 24 * 60 * MIN])
      await assertFails(commit(db('boss'), inviteWrites('boss', k(), { expiresAt: TS.fromMillis(Date.now() + ms) })));
    await assertFails(commit(db('boss'), inviteWrites('boss', k(), { role: 'super' })));
    await assertFails(commit(db('boss'), inviteWrites('boss', k(), { deptId: 'nope' })));
    await assertFails(commit(db('boss'), inviteWrites('boss', 'A'.repeat(64))));
    await assertFails(commit(db('boss'), inviteWrites('boss', 'abc')));
    await assertFails(commit(db('boss'), inviteWrites('boss', k(), { status: 'used' })));
    await assertFails(commit(db('boss'), inviteWrites('boss', k()).slice(0, 1)));                   // 沒稽核
    await assertSucceeds(commit(db('boss'), inviteWrites('boss', k())));
  });
  it('I-21 非總管理員 list 邀請、get 已使用的邀請：拒絕', async () => {
    const k = await invite();
    await assertFails(db('u1').collection('invitations').get());
    await assertSucceeds(db('boss').collection('invitations').where('status', '==', 'active').get());
    await assertSucceeds(commit(db('u1'), redeemWrites('u1', k, null, { depts: { rights: 'editor' } })));
    await assertFails(db('u2').doc(`invitations/${k.h}`).get());
    await assertFails(db('u1').doc(`invitations/${k.h}`).get());
  });
  it('I-22 未登入、匿名、信箱密碼、信箱未驗證：任何寫入都拒絕', async () => {
    const k = await invite();
    const ctxs = [anon(t),
      t.authenticatedContext('x1', { firebase: { sign_in_provider: 'anonymous' } }).firestore(),
      t.authenticatedContext('x2', { email: 'x2@example.test', email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore(),
      t.authenticatedContext('x3', { email: 'x3@example.test', email_verified: false, firebase: { sign_in_provider: 'google.com' } }).firestore()];
    for (const [i, x] of ctxs.entries()) {
      const u = 'x' + i;
      await assertFails(x.doc(`users/${u}`).set({ email: `${u}@example.test`, createdAt: NOW(), lastLoginAt: NOW() }));
      await assertFails(commit(x, requestWrites(u, 'rq' + i)));
      await assertFails(commit(x, redeemWrites(u, k, null, { depts: { rights: 'editor' } })));
      await assertFails(x.doc(`invitations/${k.h}`).get());
    }
  });
  it('I-34 非總管理員撤銷；I-35 撤銷已使用的邀請、把 revoked 改回 active：拒絕', async () => {
    const k = await invite();
    const rv = (u, inv) => commit(db(u), [[`invitations/${k.h}`, { ...inv, status: 'revoked', revokedBy: u, revokedAt: NOW(), rev: inv.rev + 1, updatedAt: NOW(), updatedBy: u }],
      [auditId('invitations', k.h, inv.rev + 1), { col: 'invitations', docId: k.h, rev: inv.rev + 1, action: 'revoke', actor: u, at: NOW(), before: { status: inv.status }, after: { status: 'revoked' }, ref: '' }]]);
    await seedRole(t, 'adm', { depts: { rights: 'admin' } });
    await assertFails(rv('adm', k.inv));
    await assertSucceeds(rv('boss', k.inv));
    const inv2 = await readDoc(t, `invitations/${k.h}`);
    await assertFails(commit(db('boss'), [[`invitations/${k.h}`, { ...inv2, status: 'active', rev: 3, updatedAt: NOW(), updatedBy: 'boss' }],
      [auditId('invitations', k.h, 3), { col: 'invitations', docId: k.h, rev: 3, action: 'x', actor: 'boss', at: NOW(), before: { status: 'revoked' }, after: { status: 'active' }, ref: '' }]]));
    const k2 = await invite();
    await assertSucceeds(commit(db('u1'), redeemWrites('u1', k2, null, { depts: { rights: 'editor' } })));
    const used = await readDoc(t, `invitations/${k2.h}`);
    await assertFails(commit(db('boss'), [[`invitations/${k2.h}`, { ...used, status: 'revoked', revokedBy: 'boss', revokedAt: NOW(), rev: 3, updatedAt: NOW(), updatedBy: 'boss' }],
      [auditId('invitations', k2.h, 3), { col: 'invitations', docId: k2.h, rev: 3, action: 'revoke', actor: 'boss', at: NOW(), before: { status: 'used' }, after: { status: 'revoked' }, ref: '' }]]));
  });
  it('I-36 總管理員撤銷與使用者核銷同時發生：恰好一筆成功', async () => {
    for (let round = 0; round < 5; round++) {
      const k = await invite();
      const rv = commit(db('boss'), [[`invitations/${k.h}`, { ...k.inv, status: 'revoked', revokedBy: 'boss', revokedAt: NOW(), rev: 2, updatedAt: NOW(), updatedBy: 'boss' }],
        [auditId('invitations', k.h, 2), { col: 'invitations', docId: k.h, rev: 2, action: 'revoke', actor: 'boss', at: NOW(), before: { status: 'active' }, after: { status: 'revoked' }, ref: '' }]]);
      const u = 'r' + round;
      const rd = commit(db(u), redeemWrites(u, k, null, { depts: { rights: 'editor' } }));
      const res = await Promise.allSettled([rv, rd]);
      assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
      const inv = await readDoc(t, `invitations/${k.h}`);
      assert.equal(!!(await roleOf(u)), inv.status === 'used');
      assert.equal(inv.rev, 2);
    }
  });
});

describe('角色、申請、撤權 I-23～I-29、I-37～I-49', () => {
  async function pending(u, id, o) { await assertSucceeds(commit(db(u), requestWrites(u, id, o))); return readDoc(t, `roleRequests/${id}`); }
  it('I-30 申請 → 核准；撤權', async () => {
    const req = await pending('u1', 'q1');
    await assertSucceeds(commit(db('boss'), [...decideWrites('boss', 'q1', req, 'approved'), ...superRoleWrites('boss', 'u1', null, { depts: { rights: 'editor' } }, 'request', 'q1')]));
    let r = await roleOf('u1');
    assert.equal(r.depts.rights, 'editor');
    await assertSucceeds(commit(db('boss'), superRoleWrites('boss', 'u1', r, { depts: {} }, 'revoke', 'rv1')));
    r = await roleOf('u1');
    assert.deepEqual(r.depts, {});
    assert.equal(r.rev, 2);
  });
  it('I-23 申請人自己核准：拒絕', async () => {
    const req = await pending('u1', 'q1');
    await assertFails(commit(db('u1'), decideWrites('u1', 'q1', req, 'approved')));
    await assertFails(commit(db('u1'), [...decideWrites('u1', 'q1', req, 'approved'), ...superRoleWrites('u1', 'u1', null, { depts: { rights: 'editor' } }, 'request', 'q1')]));
    await assertSucceeds(commit(db('u1'), [[`roleRequests/q1`, { ...req, status: 'cancelled', rev: 2, updatedAt: NOW(), updatedBy: 'u1' }],
      [auditId('roleRequests', 'q1', 2), { col: 'roleRequests', docId: 'q1', rev: 2, action: 'cancel', actor: 'u1', at: NOW(), before: { status: 'pending' }, after: { status: 'cancelled' }, ref: '' }]]));
  });
  it('I-24 撤權後下一次寫入卡片：拒絕', async () => {
    await seedRole(t, 'u1', { depts: { rights: 'editor' } });
    await assertSucceeds(createCard(db('u1'), 'u1', 'c1'));
    await assertSucceeds(commit(db('boss'), superRoleWrites('boss', 'u1', await roleOf('u1'), { depts: {} }, 'revoke')));
    await assertFails(createCard(db('u1'), 'u1', 'c2'));
  });
  it('I-25 總管理員取消自己的 super：拒絕；取消別人的可以', async () => {
    await assertFails(commit(db('boss'), superRoleWrites('boss', 'boss', await roleOf('boss'), { super: false }, 'revoke')));
    await assertFails(commit(db('boss'), superRoleWrites('boss', 'boss', await roleOf('boss'), { super: false }, 'manual')));
    await assertSucceeds(commit(db('boss'), superRoleWrites('boss', 'boss2', await roleOf('boss2'), { super: false }, 'revoke')));
  });
  it('I-26 以申請為名但申請沒核准、或部門角色不符：拒絕', async () => {
    const req = await pending('u1', 'q1');
    await assertFails(commit(db('boss'), superRoleWrites('boss', 'u1', null, { depts: { rights: 'editor' } }, 'request', 'q1')));
    await assertFails(commit(db('boss'), [...decideWrites('boss', 'q1', req, 'approved'), ...superRoleWrites('boss', 'u1', null, { depts: { rights: 'admin' } }, 'request', 'q1')]));
    await assertFails(commit(db('boss'), [...decideWrites('boss', 'q1', req, 'approved'), ...superRoleWrites('boss', 'u1', null, { depts: { events: 'editor' } }, 'request', 'q1')]));
    await assertFails(commit(db('boss'), [...decideWrites('boss', 'q1', req, 'rejected'), ...superRoleWrites('boss', 'u1', null, { depts: { rights: 'editor' } }, 'request', 'q1')]));
  });
  it('I-27 認領邀請以外的舊身分、認領已被認領的舊身分：拒絕；正常認領成功', async () => {
    const mk = (id, claimedBy = null) => seed(t, d => d.doc(`legacyIdentities/${id}`).set({ deptId: 'rights', name: id, oldRole: 'member', createdAt: '', claimedBy, claimedAt: null, rev: 1, updatedAt: TS.now(), updatedBy: 'boss' }));
    await mk('rights__a'); await mk('rights__b'); await mk('rights__c', 'someone');
    const k = await invite({ legacyRef: 'rights__a' });
    const la = await readDoc(t, 'legacyIdentities/rights__a');
    // 核銷時改去認領 b
    const w = redeemWrites('u1', k, null, { depts: { rights: 'editor' } }, { legacy: la });
    const wb = w.map(x => x[0].includes('rights__a') ? [x[0].replace('rights__a', 'rights__b'), { ...x[1], ...(x[1].docId ? { docId: 'rights__b' } : {}) }] : x);
    await assertFails(commit(db('u1'), wb));
    // 不認領（邀請帶舊身分時一定要同批認領）
    await assertFails(commit(db('u1'), w.slice(0, 4)));
    // 單獨認領別的舊身分
    await assertFails(commit(db('u2'), [[`legacyIdentities/rights__b`, { ...la, name: 'rights__b', claimedBy: 'u2', claimedAt: NOW(), rev: 2, updatedAt: NOW(), updatedBy: 'u2' }],
      [auditId('legacyIdentities', 'rights__b', 2), { col: 'legacyIdentities', docId: 'rights__b', rev: 2, action: 'claim', actor: 'u2', at: NOW(), before: {}, after: {}, ref: '' }]]));
    await assertSucceeds(commit(db('u1'), w));
    assert.equal((await readDoc(t, 'legacyIdentities/rights__a')).claimedBy, 'u1');
    // 已被認領的：用另一張帶同一個舊身分的邀請
    const k2 = await invite({ legacyRef: 'rights__c' });
    const lc = await readDoc(t, 'legacyIdentities/rights__c');
    await assertFails(commit(db('u3'), redeemWrites('u3', k2, null, { depts: { rights: 'editor' } }, { legacy: lc })));
  });
  it('I-28 總管理員撤權與使用者核銷同時發生在同一份 roles：rev 連號、兩筆稽核', async () => {
    await seedRole(t, 'u1', { depts: { events: 'editor' } });
    const k = await invite();
    const cur = await roleOf('u1');
    const res = await Promise.allSettled([
      commit(db('boss'), superRoleWrites('boss', 'u1', cur, { depts: {} }, 'revoke')),
      commit(db('u1'), redeemWrites('u1', k, cur, { depts: { events: 'editor', rights: 'editor' } }))]);
    const okN = res.filter(r => r.status === 'fulfilled').length;
    assert.ok(okN >= 1);
    if (okN === 1) {                                                                // 失敗的一方重讀後重試
      const now = await roleOf('u1');
      if (res[0].status === 'rejected') await assertSucceeds(commit(db('boss'), superRoleWrites('boss', 'u1', now, { depts: Object.fromEntries(Object.entries(now.depts).filter(([d]) => d !== 'events')) }, 'revoke')));
      else await assertSucceeds(commit(db('u1'), redeemWrites('u1', k, now, { depts: { ...now.depts, rights: 'editor' } })));
    }
    const fin = await roleOf('u1');
    assert.equal(fin.rev, 3);
    assert.deepEqual(fin.depts, { rights: 'editor' });
    for (const r of [2, 3]) assert.ok(await readDoc(t, auditId('roles', 'u1', r)));
  });
  it('I-29 一般帳號讀 roles（別人）、auditLogs、invitations list、users（別人）：拒絕', async () => {
    await seedRole(t, 'u1', { depts: { rights: 'editor' } });
    await seed(t, d => d.doc('users/u2').set({ email: 'u2@example.test' }));
    await assertSucceeds(db('u1').doc('roles/u1').get());
    await assertFails(db('u1').doc('roles/boss').get());
    await assertFails(db('u1').collection('roles').get());
    await assertFails(db('u1').collection('auditLogs').get());
    await assertFails(db('u1').doc(auditId('roles', 'u1', 1)).get());
    await assertFails(db('u1').collection('invitations').get());
    await assertFails(db('u1').doc('users/u2').get());
    await assertSucceeds(db('boss').collection('auditLogs').orderBy('at', 'desc').limit(50).get());
  });
  it('I-37 核准但同批沒寫 roles；I-38 用早就核准過的申請重放：拒絕', async () => {
    const req = await pending('u1', 'q1');
    await assertFails(commit(db('boss'), decideWrites('boss', 'q1', req, 'approved')));
    await assertSucceeds(commit(db('boss'), [...decideWrites('boss', 'q1', req, 'approved'), ...superRoleWrites('boss', 'u1', null, { depts: { rights: 'editor' } }, 'request', 'q1')]));
    let r = await roleOf('u1');
    await assertSucceeds(commit(db('boss'), superRoleWrites('boss', 'u1', r, { depts: {} }, 'revoke')));
    r = await roleOf('u1');
    await assertFails(commit(db('boss'), superRoleWrites('boss', 'u1', r, { depts: { rights: 'editor' } }, 'request', 'q1')));
  });
  it('I-39 核准時多加部門、改別的部門、設 super：拒絕', async () => {
    await seedRole(t, 'u1', { depts: { events: 'editor' } });
    const req = await pending('u1', 'q1');
    const cur = await roleOf('u1');
    for (const next of [{ depts: { events: 'editor', rights: 'editor', pr: 'editor' } }, { depts: { events: 'admin', rights: 'editor' } },
                        { depts: { events: 'editor', rights: 'editor' }, super: true }, { depts: { events: 'editor', rights: 'editor' }, viewer: true }])
      await assertFails(commit(db('boss'), [...decideWrites('boss', 'q1', req, 'approved'), ...superRoleWrites('boss', 'u1', cur, next, 'request', 'q1')]));
    await assertSucceeds(commit(db('boss'), [...decideWrites('boss', 'q1', req, 'approved'), ...superRoleWrites('boss', 'u1', cur, { depts: { events: 'editor', rights: 'editor' } }, 'request', 'q1')]));
  });
  it('I-40 核准 A 的申請卻寫到 B 的 roles：拒絕', async () => {
    const req = await pending('u1', 'q1');
    await assertFails(commit(db('boss'), [...decideWrites('boss', 'q1', req, 'approved'), ...superRoleWrites('boss', 'u2', null, { depts: { rights: 'editor' } }, 'request', 'q1')]));
  });
  it('I-41 撤權時新增部門、改角色值、把 super 改成 true、寫入已取消的 viewer 欄位：拒絕', async () => {
    await seedRole(t, 'u1', { depts: { rights: 'admin', events: 'editor' } });
    const cur = await roleOf('u1');
    for (const next of [{ depts: { rights: 'admin', events: 'editor', pr: 'editor' } }, { depts: { rights: 'editor' } },
                        { depts: { rights: 'admin' }, viewer: true }, { depts: { rights: 'admin' }, super: true }])
      await assertFails(commit(db('boss'), superRoleWrites('boss', 'u1', cur, next, 'revoke')));
    await assertSucceeds(commit(db('boss'), superRoleWrites('boss', 'u1', cur, { depts: { rights: 'editor' } }, 'manual')));   // 降級走 manual
  });
  it('I-42 角色稽核 action／ref 跟 roles 不符：拒絕', async () => {
    await seedRole(t, 'u1', { depts: { rights: 'editor' } });
    const cur = await roleOf('u1');
    await assertFails(commit(db('boss'), patch(superRoleWrites('boss', 'u1', cur, { depts: {} }, 'revoke'), 1, { action: 'manual' })));
    await assertFails(commit(db('boss'), patch(superRoleWrites('boss', 'u1', cur, { depts: {} }, 'revoke', 'r1'), 1, { ref: 'r2' })));
  });
  it('I-43 申請、邀請的稽核 before／after.status 跟實際不符：拒絕', async () => {
    await assertFails(commit(db('u1'), patch(requestWrites('u1', 'q1'), 1, { after: { status: 'approved' } })));
    const req = await pending('u1', 'q1');
    await assertFails(commit(db('boss'), [...patch(decideWrites('boss', 'q1', req, 'rejected'), 1, { before: { status: 'approved' } })]));
    await assertFails(commit(db('boss'), patch(inviteWrites('boss', newToken().h), 1, { after: { status: 'used' } })));
    const k = await invite();
    await assertFails(commit(db('u1'), patch(redeemWrites('u1', k, null, { depts: { rights: 'editor' } }), 1, { after: { status: 'revoked' } })));
  });
  it('I-44 申請人取消與總管理員核准同時發生：恰好一筆成功，失敗那筆整批沒寫入', async () => {
    for (let i = 0; i < 5; i++) {
      const u = 'p' + i, id = 'q' + i;
      const req = await pending(u, id);
      const res = await Promise.allSettled([
        commit(db(u), [[`roleRequests/${id}`, { ...req, status: 'cancelled', rev: 2, updatedAt: NOW(), updatedBy: u }],
          [auditId('roleRequests', id, 2), { col: 'roleRequests', docId: id, rev: 2, action: 'cancel', actor: u, at: NOW(), before: { status: 'pending' }, after: { status: 'cancelled' }, ref: '' }]]),
        commit(db('boss'), [...decideWrites('boss', id, req, 'approved'), ...superRoleWrites('boss', u, null, { depts: { rights: 'editor' } }, 'request', id)])]);
      assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
      const fin = await readDoc(t, `roleRequests/${id}`);
      assert.equal(!!(await roleOf(u)), fin.status === 'approved');
    }
  });
  it('I-45 roles 白名單外欄位、部門角色值不是 admin／editor：拒絕', async () => {
    await assertFails(commit(db('boss'), patch(superRoleWrites('boss', 'u1', null, { depts: { rights: 'editor' } }, 'manual'), 0, { note: 'x' })));
    await assertFails(commit(db('boss'), superRoleWrites('boss', 'u1', null, { depts: { rights: 'owner' } }, 'manual')));
    await assertFails(commit(db('boss'), superRoleWrites('boss', 'u1', null, { depts: { nope: 'editor' } }, 'manual')));
    await assertSucceeds(commit(db('boss'), superRoleWrites('boss', 'u1', null, { depts: { rights: 'editor' } }, 'manual')));
  });
  it('I-46（02A 修正）申請 super、申請檢視資格（viewer，已取消）、申請不存在的部門、替別人申請：拒絕', async () => {
    await assertFails(commit(db('u1'), requestWrites('u1', 'q1', { role: 'super' })));
    await assertFails(commit(db('u1'), requestWrites('u1', 'q2', { role: 'viewer', deptId: 'rights' })));
    await assertFails(commit(db('u1'), requestWrites('u1', 'q5', { role: 'viewer', deptId: null })));
    await assertFails(commit(db('u1'), requestWrites('u1', 'q3', { deptId: 'nope' })));
    await assertFails(commit(db('u1'), requestWrites('u1', 'q4', { uid: 'u2' })));
    await assertSucceeds(commit(db('u1'), requestWrites('u1', 'q6')));
  });
  it('I-47（02A 修正）一般登入者不用申請就讀得到看板、不能寫；總管理員不能再授予 viewer 欄位', async () => {
    await seedRole(t, 'ed', { depts: { rights: 'editor' } });
    await createCard(db('ed'), 'ed', 'c1');
    await assertSucceeds(db('u1').doc('cards/c1').get());
    await assertFails(createCard(db('u1'), 'u1', 'c2'));
    await assertFails(commit(db('boss'), superRoleWrites('boss', 'u1', null, { viewer: true }, 'manual')));
  });
  it('I-48（02A 修正）viewer 邀請不能建立；核銷時順便寫 viewer 欄位：拒絕', async () => {
    await assertFails(commit(db('boss'), inviteWrites('boss', newToken().h, { role: 'viewer', deptId: null })));
    const kd = await invite();
    await assertFails(commit(db('u2'), redeemWrites('u2', kd, null, { viewer: true, depts: { rights: 'editor' } })));
    await assertSucceeds(commit(db('u2'), redeemWrites('u2', kd, null, { depts: { rights: 'editor' } })));
  });
  it('I-49（02A 修正）一般登入者送出部門申請後：讀得到看板與自己的申請，讀不到別人的申請', async () => {
    await seedRole(t, 'ed', { depts: { rights: 'editor' } });
    await createCard(db('ed'), 'ed', 'c1');
    await pending('u1', 'q1');
    await assertSucceeds(db('u1').doc('cards/c1').get());
    await assertSucceeds(db('u1').doc('roleRequests/q1').get());
    await assertSucceeds(db('u1').collection('roleRequests').where('uid', '==', 'u1').get());
    await assertFails(db('u2').doc('roleRequests/q1').get());
  });
});
