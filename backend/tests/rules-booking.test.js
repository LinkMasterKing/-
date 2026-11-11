// 會長預約：時段鎖、私人忙碌、併發 B-01～B-40（booking.md 第 5 節）
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { env, google, seed, seedRole, seedDepts, assertSucceeds, assertFails, NOW, TS, readDoc, auditId, SLOT } from './helpers.js';

let t, base;
const O = 'pres';
const db = u => google(t, u);
before(async () => { t = await env(); });
after(async () => { await t.cleanup(); });
beforeEach(async () => {
  await t.clearFirestore();
  await seedDepts(t);
  base = Math.ceil((Date.now() + 864e5) / SLOT);                                   // 明天起的第一格
  await seed(t, async d => {
    await d.doc(`calendars/${O}`).set({ name: '會長', managers: ['mgr'], gridMin: 30, maxSlots: 4, horizonDays: 60, maxPendingPerUser: 3, rev: 1 });
    await d.doc('calendars/vice').set({ name: '副會長', managers: ['mgr2'], rev: 1 });
    await d.doc('openWindows/w1').set({ ownerId: O, start: TS.fromMillis(base * SLOT), end: TS.fromMillis((base + 400) * SLOT) });
    await d.doc('openWindows/wv').set({ ownerId: 'vice', start: TS.fromMillis(base * SLOT), end: TS.fromMillis((base + 400) * SLOT) });
  });
  for (const u of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'mgr', 'mgr2']) await seedRole(t, u, { depts: { rights: 'editor' } });
  await seedRole(t, 'vw', { viewer: true });
});

async function commit(x, w) { const b = x.batch(); for (const [p, v] of w) v === null ? b.delete(x.doc(p)) : b.set(x.doc(p), v); return b.commit(); }
const quotaOf = (u, o = O) => readDoc(t, `bookingQuota/${o}_${u}`);
// 申請：startSlot 相對於 base
async function bookW(u, bid, s, n, o = {}) {
  const owner = o.owner || O, S = base + s, q = o.quota !== undefined ? o.quota : await quotaOf(u, owner);
  const bk = { ownerId: owner, requester: u, windowId: owner === O ? 'w1' : 'wv', startSlot: S, slotCount: n,
    start: TS.fromMillis(S * SLOT), end: TS.fromMillis((S + n) * SLOT), topic: '討論', note: '', status: 'pending', rev: 1,
    createdAt: NOW(), updatedAt: NOW(), updatedBy: u, ...(o.bk || {}) };
  const w = [[`bookings/${bid}`, bk]];
  const lock = o.lock || [...Array(n).keys()];
  for (const i of lock) w.push([`slots/${owner}_${S + i}`, { ownerId: owner, idx: S + i, ref: o.ref || bid }]);
  w.push([`bookingQuota/${owner}_${u}`, { ownerId: owner, uid: u, pending: (q ? q.pending : 0) + 1, lastRef: bid }]);
  w.push([auditId('bookings', bid, 1), { col: 'bookings', docId: bid, rev: 1, action: 'request', actor: u, at: NOW(), before: {}, after: { status: 'pending' }, ref: '' }]);
  return w;
}
const book = async (u, bid, s, n, o) => commit(db(u), await bookW(u, bid, s, n, o));
async function releaseW(actor, bid, status, o = {}) {
  const bk = await readDoc(t, `bookings/${bid}`), q = await quotaOf(bk.requester, bk.ownerId);
  const nb = { ...bk, status, rev: bk.rev + 1, updatedAt: NOW(), updatedBy: actor, ...(status === 'rejected' ? { decidedBy: actor } : {}) };
  const w = [[`bookings/${bid}`, nb]];
  const del = o.del || [...Array(bk.slotCount).keys()];
  if (!o.keepLocks) for (const i of del) w.push([`slots/${bk.ownerId}_${bk.startSlot + i}`, null]);
  w.push([`bookingQuota/${bk.ownerId}_${bk.requester}`, { ...q, pending: q.pending - 1, lastRef: bid }]);
  w.push([auditId('bookings', bid, nb.rev), { col: 'bookings', docId: bid, rev: nb.rev, action: status, actor, at: NOW(), before: { status: bk.status }, after: { status }, ref: '' }]);
  return w;
}
async function approveW(actor, bid) {
  const bk = await readDoc(t, `bookings/${bid}`);
  return [[`bookings/${bid}`, { ...bk, status: 'approved', decidedBy: actor, rev: bk.rev + 1, updatedAt: NOW(), updatedBy: actor }],
    [auditId('bookings', bid, bk.rev + 1), { col: 'bookings', docId: bid, rev: bk.rev + 1, action: 'approve', actor, at: NOW(), before: { status: bk.status }, after: { status: 'approved' }, ref: '' }]];
}
function busyW(u, xid, s, n, o = {}) {
  const owner = o.owner || O, S = base + s;
  const x = { ownerId: owner, title: '私人行程', start: TS.fromMillis(S * SLOT), end: TS.fromMillis((S + n) * SLOT), startSlot: S, slotCount: n,
    status: 'active', rev: 1, createdAt: NOW(), updatedAt: NOW(), updatedBy: u, ...(o.x || {}) };
  const w = [[`busyBlocks/${xid}`, x]];
  for (const i of (o.lock || [...Array(n).keys()])) w.push([`slots/${o.slotOwner || owner}_${S + i}`, { ownerId: o.slotOwner || owner, idx: S + i, ref: o.ref || xid }]);
  return w;
}
async function busyReleaseW(u, xid, o = {}) {
  const x = await readDoc(t, `busyBlocks/${xid}`);
  const w = [[`busyBlocks/${xid}`, { ...x, status: 'released', rev: x.rev + 1, updatedAt: NOW(), updatedBy: u }]];
  for (const i of (o.del || [...Array(x.slotCount).keys()])) w.push([`slots/${x.ownerId}_${x.startSlot + i}`, null]);
  return w;
}
const overlap = (a, b) => a.s < b.s + b.n && b.s < a.s + a.n;

describe('預約 B-01～B-23', () => {
  it('B-01 兩個帳號同時搶完全相同的時段：恰好 1 筆', async () => {
    const res = await Promise.allSettled([book('a1', 'b1', 0, 2), book('a2', 'b2', 0, 2)]);
    assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
  });
  it('B-02 部分重疊、B-03 不同時長重疊：拒絕；B-04 頭尾相接：成功', async () => {
    await assertSucceeds(book('a1', 'b1', 0, 2));                                  // 10:00–11:00
    await assertFails(book('a2', 'b2', 1, 2));                                     // 10:30–11:30
    await assertSucceeds(book('a1', 'b3', 4, 4));                                  // 12:00–14:00
    await assertFails(book('a2', 'b4', 7, 1));                                     // 13:30–14:00
    await assertSucceeds(book('a2', 'b5', 2, 2));                                  // 11:00–12:00 頭尾相接
    assert.equal(await readDoc(t, 'bookings/b2'), undefined);
    assert.equal(await readDoc(t, `slots/${O}_${base + 3}`).then(s => s.ref), 'b5');
  });
  it('B-05 隨機併發：6 個帳號、隨機起點、1～4 格，30 輪：成功的兩兩不重疊、每輪至少 1 筆', async () => {
    let total = 0;
    for (let round = 0; round < 30; round++) {
      const off = round * 12;
      const reqs = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((u, i) => ({ u, bid: `r${round}_${i}`, s: off + Math.floor(Math.random() * 6), n: 1 + Math.floor(Math.random() * 4) }));
      const ws = await Promise.all(reqs.map(r => bookW(r.u, r.bid, r.s, r.n, { quota: null })));
      // 額度不是這裡要測的：每輪先清掉
      await seed(t, async d => { for (const r of reqs) await d.doc(`bookingQuota/${O}_${r.u}`).delete(); });
      const res = await Promise.allSettled(ws.map((w, i) => commit(db(reqs[i].u), w)));
      const ok = reqs.filter((_, i) => res[i].status === 'fulfilled');
      assert.ok(ok.length >= 1, `第 ${round} 輪沒有任何成功`);
      for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) assert.ok(!overlap(ok[i], ok[j]), `第 ${round} 輪重疊`);
      for (const r of reqs.filter((_, i) => res[i].status === 'rejected')) assert.equal(await readDoc(t, `bookings/${r.bid}`), undefined);
      total += ok.length;
      await seed(t, async d => { for (const r of reqs) await d.doc(`bookingQuota/${O}_${r.u}`).delete(); });
    }
    console.log('B-05 30 輪成功預約筆數：', total);
  });
  it('B-06 不建鎖、B-07 少鎖一格、B-08 鎖指向別人的預約、B-12 超過 4 格：拒絕', async () => {
    await assertFails(book('a1', 'b1', 0, 3, { lock: [] }));
    await assertFails(book('a1', 'b1', 0, 3, { lock: [0, 1] }));
    await assertSucceeds(book('a2', 'x', 10, 1));
    await assertFails(book('a1', 'b1', 0, 1, { ref: 'x' }));
    await assertFails(book('a1', 'b1', 0, 5));
  });
  it('B-09 覆寫已存在的時段鎖、B-10 刪除別人預約的鎖：拒絕', async () => {
    await assertSucceeds(book('a1', 'b1', 0, 2));
    await assertFails(db('a2').doc(`slots/${O}_${base}`).set({ ownerId: O, idx: base, ref: 'b2' }));
    await assertFails(db('a2').doc(`slots/${O}_${base}`).delete());
    await assertFails(db('a1').doc(`slots/${O}_${base}`).delete());
  });
  it('B-11 起點不在格線、B-14 開放時段以外、B-15 過去或 60 天以後：拒絕', async () => {
    await assertFails(book('a1', 'b1', 0, 1, { bk: { start: TS.fromMillis(base * SLOT + 600000) } }));
    await assertFails(book('a1', 'b1', 0, 1, { bk: { end: TS.fromMillis((base + 2) * SLOT) } }));
    await seed(t, d => d.doc('openWindows/w1').update({ end: TS.fromMillis((base + 2) * SLOT) }));
    await assertFails(book('a1', 'b1', 1, 2));                                     // 跨出開放時段
    await assertSucceeds(book('a1', 'b1', 0, 2));
    const past = Math.floor(Date.now() / SLOT) - 2;
    await seed(t, d => d.doc('openWindows/w2').set({ ownerId: O, start: TS.fromMillis(past * SLOT), end: TS.fromMillis((past + 4000) * SLOT) }));
    await assertFails(book('a2', 'b2', past - base, 1, { bk: { windowId: 'w2' } }));
    await assertFails(book('a2', 'b3', (Math.ceil((Date.now() + 61 * 864e5) / SLOT)) - base, 1, { bk: { windowId: 'w2' } }));
  });
  it('B-13 申請會長私人忙碌的時段：拒絕', async () => {
    await assertSucceeds(commit(db('mgr'), busyW('mgr', 'x1', 0, 2)));
    await assertFails(book('a1', 'b1', 1, 2));
  });
  it('B-16 一般帳號讀 busyBlocks、別人的 bookings：拒絕', async () => {
    await assertSucceeds(commit(db('mgr'), busyW('mgr', 'x1', 0, 2)));
    await assertSucceeds(book('a1', 'b1', 4, 1));
    await assertFails(db('a2').doc('busyBlocks/x1').get());
    await assertFails(db('a2').doc('bookings/b1').get());
    await assertSucceeds(db('a1').doc('bookings/b1').get());
    await assertSucceeds(db('mgr').doc('bookings/b1').get());
    await assertSucceeds(db('mgr').doc('busyBlocks/x1').get());
    await assertFails(db('mgr2').doc('busyBlocks/x1').get());
    await assertSucceeds(db('a1').collection('bookings').where('requester', '==', 'a1').get());
  });
  it('B-17 申請人把自己的預約改成 approved：拒絕；管理者可以', async () => {
    await assertSucceeds(book('a1', 'b1', 0, 1));
    await assertFails(commit(db('a1'), await approveW('a1', 'b1')));
    await assertSucceeds(commit(db('mgr'), await approveW('mgr', 'b1')));
  });
  it('B-18 拒絕或取消時沒一起刪鎖：拒絕；B-19 取消後別人立刻申請同一時段：成功', async () => {
    await assertSucceeds(book('a1', 'b1', 0, 2));
    await assertFails(commit(db('mgr'), await releaseW('mgr', 'b1', 'rejected', { keepLocks: true })));
    await assertFails(commit(db('a1'), await releaseW('a1', 'b1', 'cancelled', { keepLocks: true })));
    await assertSucceeds(commit(db('a1'), await releaseW('a1', 'b1', 'cancelled')));
    await assertSucceeds(book('a2', 'b2', 0, 2));
  });
  it('B-20 超過待審上限（每人 3 筆）：拒絕', async () => {
    for (const [i, s] of [0, 2, 4].entries()) await assertSucceeds(book('a1', 'q' + i, s, 1));
    await assertFails(book('a1', 'q4', 6, 1));
    await assertFails(book('a1', 'q5', 6, 1, { quota: { pending: 0 } }));            // 額度不能自己歸零
  });
  it('B-21 管理者以外的人建立私人忙碌：拒絕；沒有部門角色的人申請預約：拒絕（D6）', async () => {
    await assertFails(commit(db('a1'), busyW('a1', 'x1', 0, 2)));
    await assertFails(commit(db('mgr2'), busyW('mgr2', 'x1', 0, 2)));
    await assertFails(book('vw', 'b1', 0, 1));
    await assertFails(book('nb', 'b2', 0, 1));
  });
  it('B-22 管理者核准、同時申請人取消同一筆：一筆成功；狀態與稽核鏈一致', async () => {
    await assertSucceeds(book('a1', 'b1', 0, 2));
    const [aw, cw] = [await approveW('mgr', 'b1'), await releaseW('a1', 'b1', 'cancelled')];
    const res = await Promise.allSettled([commit(db('mgr'), aw), commit(db('a1'), cw)]);
    assert.equal(res.filter(r => r.status === 'fulfilled').length, 1);
    const bk = await readDoc(t, 'bookings/b1');
    assert.equal(bk.rev, 2);
    assert.equal((await readDoc(t, auditId('bookings', 'b1', 2))).after.status, bk.status);
  });
  it('B-23 改期（取消＋新申請）期間被別人搶走：新申請拒絕', async () => {
    await assertSucceeds(book('a1', 'b1', 0, 2));
    await assertSucceeds(commit(db('a1'), await releaseW('a1', 'b1', 'cancelled')));
    await assertSucceeds(book('a2', 'b2', 0, 1));
    await assertFails(book('a1', 'b3', 0, 2));
  });
});

describe('時段鎖刪除與私人忙碌 B-24～B-40', () => {
  it('B-24、B-25 管理者單獨刪 pending／approved 預約的鎖：拒絕', async () => {
    await assertSucceeds(book('a1', 'b1', 0, 2));
    await assertFails(db('mgr').doc(`slots/${O}_${base}`).delete());
    await assertSucceeds(commit(db('mgr'), await approveW('mgr', 'b1')));
    await assertFails(db('mgr').doc(`slots/${O}_${base}`).delete());
    await assertFails(commit(db('mgr'), busyW('mgr', 'x1', 0, 1)));
    await assertFails(book('a2', 'b2', 0, 1));
  });
  it('B-26 拒絕但少刪一格、B-27 取消不刪鎖再單獨刪：拒絕', async () => {
    await assertSucceeds(book('a1', 'b1', 0, 3));
    await assertFails(commit(db('mgr'), await releaseW('mgr', 'b1', 'rejected', { del: [0, 1] })));
    await assertFails(commit(db('a1'), await releaseW('a1', 'b1', 'cancelled', { keepLocks: true })));
    await assertFails(db('a1').doc(`slots/${O}_${base}`).delete());
    await assertSucceeds(commit(db('mgr'), await releaseW('mgr', 'b1', 'rejected')));
  });
  it('B-28 私人忙碌少鎖、B-29 不鎖、B-30 鎖指向別的行事曆或不涵蓋的私人忙碌：拒絕', async () => {
    await assertFails(commit(db('mgr'), busyW('mgr', 'x1', 0, 3, { lock: [0, 1] })));
    await assertFails(commit(db('mgr'), busyW('mgr', 'x1', 0, 3, { lock: [] })));
    await assertFails(commit(db('mgr'), busyW('mgr', 'x1', 0, 2, { slotOwner: 'vice' })));
    await assertSucceeds(commit(db('mgr'), busyW('mgr', 'x9', 20, 1)));
    await assertFails(commit(db('mgr'), [[`slots/${O}_${base + 30}`, { ownerId: O, idx: base + 30, ref: 'x9' }]]));
  });
  it('B-31 私人忙碌與待審預約部分重疊：整批拒絕、預約與鎖不變', async () => {
    await assertSucceeds(book('a1', 'b1', 2, 2));
    await assertFails(commit(db('mgr'), busyW('mgr', 'x1', 0, 3)));
    assert.equal(await readDoc(t, 'busyBlocks/x1'), undefined);
    assert.equal(await readDoc(t, `slots/${O}_${base}`), undefined);
    assert.equal((await readDoc(t, `slots/${O}_${base + 2}`)).ref, 'b1');
    assert.equal((await readDoc(t, 'bookings/b1')).status, 'pending');
  });
  it('B-32 私人忙碌不在格線、超過 4 格、status 不是 active：拒絕', async () => {
    await assertFails(commit(db('mgr'), busyW('mgr', 'x1', 0, 1, { x: { start: TS.fromMillis(base * SLOT + 60000) } })));
    await assertFails(commit(db('mgr'), busyW('mgr', 'x1', 0, 5)));
    await assertFails(commit(db('mgr'), busyW('mgr', 'x1', 0, 1, { x: { status: 'released' } })));
  });
  it('B-33 管理者與一般帳號同時搶同一格：恰好 1 筆', async () => {
    for (let r = 0; r < 10; r++) {
      const s = r * 6;
      const [bw, xw] = [await bookW('a' + (1 + (r % 3)), 'b' + r, s, 2, { quota: null }), busyW('mgr', 'x' + r, s + 1, 2)];
      await seed(t, async d => { for (const u of ['a1', 'a2', 'a3']) await d.doc(`bookingQuota/${O}_${u}`).delete(); });
      const res = await Promise.allSettled([commit(db('a' + (1 + (r % 3))), bw), commit(db('mgr'), xw)]);
      assert.equal(res.filter(x => x.status === 'fulfilled').length, 1);
      await seed(t, async d => { for (const u of ['a1', 'a2', 'a3']) await d.doc(`bookingQuota/${O}_${u}`).delete(); });
    }
  });
  it('B-34 單獨刪 active 私人忙碌的鎖、B-35 硬刪或改時間、B-36 釋放但少刪一格：拒絕', async () => {
    await assertSucceeds(commit(db('mgr'), busyW('mgr', 'x1', 0, 3)));
    await assertFails(db('mgr').doc(`slots/${O}_${base}`).delete());
    await assertFails(db('a1').doc(`slots/${O}_${base}`).delete());
    await assertFails(db('mgr').doc('busyBlocks/x1').delete());
    const x = await readDoc(t, 'busyBlocks/x1');
    await assertFails(db('mgr').doc('busyBlocks/x1').set({ ...x, startSlot: x.startSlot + 1, rev: 2, updatedAt: NOW(), updatedBy: 'mgr' }));
    await assertFails(db('mgr').doc('busyBlocks/x1').set({ ...x, slotCount: 2, rev: 2, updatedAt: NOW(), updatedBy: 'mgr' }));
    await assertSucceeds(db('mgr').doc('busyBlocks/x1').set({ ...x, title: '改標題', rev: 2, updatedAt: NOW(), updatedBy: 'mgr' }));
    await assertFails(commit(db('mgr'), await busyReleaseW('mgr', 'x1', { del: [0, 1] })));
  });
  it('B-37 私人忙碌釋放後別人立刻申請同一時段：成功', async () => {
    await assertSucceeds(commit(db('mgr'), busyW('mgr', 'x1', 0, 2)));
    await assertSucceeds(commit(db('mgr'), await busyReleaseW('mgr', 'x1')));
    await assertSucceeds(book('a1', 'b1', 0, 2));
  });
  it('B-38 孤兒鎖：管理者刪除成功；一般帳號、別的行事曆管理者拒絕', async () => {
    await seed(t, d => d.doc(`slots/${O}_${base}`).set({ ownerId: O, idx: base, ref: 'gone' }));
    await assertFails(db('a1').doc(`slots/${O}_${base}`).delete());
    await assertFails(db('mgr2').doc(`slots/${O}_${base}`).delete());
    await assertSucceeds(db('mgr').doc(`slots/${O}_${base}`).delete());
  });
  it('B-39 非管理者讀 busyBlocks；slots 不能有 title', async () => {
    await assertSucceeds(commit(db('mgr'), busyW('mgr', 'x1', 0, 1)));
    await assertFails(db('vw').collection('busyBlocks').where('ownerId', '==', O).get());
    await assertSucceeds(db('vw').collection('slots').where('ownerId', '==', O).get());
    const s = await readDoc(t, `slots/${O}_${base}`);
    assert.deepEqual(Object.keys(s).sort(), ['idx', 'ownerId', 'ref']);
    const w = busyW('mgr', 'x2', 4, 1); w[1][1].title = '私人';
    await assertFails(commit(db('mgr'), w));
  });
  it('B-40 4 格的申請、拒絕、取消、建立與釋放私人忙碌：整批在讀取上限內成功', async () => {
    await assertSucceeds(book('a1', 'b1', 0, 4));
    await assertSucceeds(commit(db('mgr'), await releaseW('mgr', 'b1', 'rejected')));
    await assertSucceeds(book('a1', 'b2', 0, 4));
    await assertSucceeds(commit(db('mgr'), await approveW('mgr', 'b2')));
    await assertSucceeds(commit(db('a1'), await releaseW('a1', 'b2', 'cancelled')));
    await assertSucceeds(commit(db('mgr'), busyW('mgr', 'x1', 0, 4)));
    await assertSucceeds(commit(db('mgr'), await busyReleaseW('mgr', 'x1')));
    assert.equal((await quotaOf('a1')).pending, 0);
  });
  it('I-43（預約）稽核 after.status 與實際不符：拒絕', async () => {
    const w = await bookW('a1', 'b1', 0, 1);
    w[w.length - 1][1].after = { status: 'approved' };
    await assertFails(commit(db('a1'), w));
  });
});
